import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type PaymentMethod = "bank_transfer" | "stripe";
type PaymentRequest = { bookingId?: unknown; paymentMethod?: unknown };

const headers = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};
const env = (name: string) => Deno.env.get(name)?.trim() ?? "";
const json = (body: unknown, status = 200) => Response.json(body, { headers, status });
const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/iu, "");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "server_configuration_unavailable" }, 503);
  if (!accessToken) return json({ error: "authentication_required" }, 401);

  let body: PaymentRequest;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!isUuid(body.bookingId) || !["stripe", "bank_transfer"].includes(String(body.paymentMethod))) {
    return json({ error: "invalid_payment_request" }, 400);
  }
  const paymentMethod = body.paymentMethod as PaymentMethod;

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !userData.user?.email) return json({ error: "invalid_session" }, 401);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: booking, error: bookingError } = await admin
    .from("booking_requests")
    .select("id, customer_id, booking_type, state, deposit_amount_cents, currency, approved_date")
    .eq("id", body.bookingId)
    .eq("customer_id", userData.user.id)
    .maybeSingle();
  if (bookingError) return json({ error: "booking_lookup_failed" }, 503);
  if (!booking) return json({ error: "booking_not_found" }, 404);
  const expectedAmount = booking.booking_type === "service" ? 10_000 : 30_000;
  if (booking.state !== "date_approved" || !booking.approved_date || booking.deposit_amount_cents !== expectedAmount || booking.currency !== "AUD") {
    return json({ error: "booking_not_ready_for_payment" }, 409);
  }

  const { data: existing } = await admin
    .from("booking_payment_attempts")
    .select("*")
    .eq("booking_request_id", booking.id)
    .in("state", ["creating", "awaiting_payment", "bank_transfer_pending", "processing"])
    .maybeSingle();
  if (existing && existing.payment_method !== paymentMethod) {
    return json({ error: "payment_method_already_selected" }, 409);
  }

  if (paymentMethod === "bank_transfer") {
    const accountName = env("PSI_BANK_TRANSFER_ACCOUNT_NAME");
    const bsb = env("PSI_BANK_TRANSFER_BSB");
    const accountNumber = env("PSI_BANK_TRANSFER_ACCOUNT_NUMBER");
    if (!accountName || !/^\d{3}-?\d{3}$/u.test(bsb) || !/^\d{6,10}$/u.test(accountNumber)) {
      return json({ error: "bank_transfer_not_configured" }, 503);
    }
    if (existing?.state === "bank_transfer_pending") {
      return json({
        amountCents: existing.amount_cents, currency: "AUD", paymentMethod,
        reference: existing.bank_reference, state: existing.state,
        bank: { accountName, accountNumber, bsb },
      });
    }
    const attemptId = crypto.randomUUID();
    const reference = `PSI-${booking.id.replaceAll("-", "").slice(0, 16).toUpperCase()}`;
    const { error } = await admin.from("booking_payment_attempts").insert({
      id: attemptId,
      booking_request_id: booking.id,
      customer_id: booking.customer_id,
      payment_method: paymentMethod,
      provider: "manual_bank_transfer",
      state: "bank_transfer_pending",
      amount_cents: expectedAmount,
      currency: "AUD",
      bank_reference: reference,
    });
    if (error) return json({ error: "payment_request_conflict" }, 409);
    return json({
      amountCents: expectedAmount, currency: "AUD", paymentMethod, reference,
      state: "bank_transfer_pending", bank: { accountName, accountNumber, bsb },
    }, 201);
  }

  const stripeKey = env("STRIPE_SECRET_KEY");
  const liveMode = env("STRIPE_LIVE_MODE") === "true";
  const returnOrigin = env("PSI_PAYMENT_RETURN_ORIGIN").replace(/\/$/u, "");
  if (!stripeKey || !/^https:\/\/[^/?#]+/u.test(returnOrigin) || (liveMode ? !stripeKey.startsWith("sk_live_") : !stripeKey.startsWith("sk_test_"))) {
    return json({ error: "stripe_not_configured" }, 503);
  }
  if (existing?.provider_checkout_url && existing.expires_at && Date.parse(existing.expires_at) > Date.now()) {
    return json({
      amountCents: existing.amount_cents, checkoutUrl: existing.provider_checkout_url,
      currency: "AUD", expiresAt: existing.expires_at, paymentMethod, state: existing.state,
    });
  }

  const attemptId = existing?.id ?? crypto.randomUUID();
  if (!existing) {
    const { error } = await admin.from("booking_payment_attempts").insert({
      id: attemptId, booking_request_id: booking.id, customer_id: booking.customer_id,
      payment_method: paymentMethod, provider: "stripe", state: "creating",
      amount_cents: expectedAmount, currency: "AUD",
    });
    if (error) return json({ error: "payment_request_conflict" }, 409);
  }

  const expiresAtSeconds = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const form = new URLSearchParams({
    mode: "payment",
    success_url: `${returnOrigin}/?psi_payment=success&booking=${encodeURIComponent(booking.id)}`,
    cancel_url: `${returnOrigin}/?psi_payment=cancelled&booking=${encodeURIComponent(booking.id)}`,
    customer_email: userData.user.email,
    client_reference_id: booking.id,
    expires_at: String(expiresAtSeconds),
    locale: "auto",
    "line_items[0][price_data][currency]": "aud",
    "line_items[0][price_data][unit_amount]": String(expectedAmount),
    "line_items[0][price_data][product_data][name]": `PSI ${booking.booking_type === "dyno" ? "Dyno Tuning" : "Service & Report"} deposit`,
    "line_items[0][quantity]": "1",
    "payment_method_types[0]": "card",
    "payment_method_types[1]": "au_becs_debit",
    "metadata[payment_attempt_id]": attemptId,
    "metadata[booking_request_id]": booking.id,
    "metadata[customer_id]": booking.customer_id,
    "payment_intent_data[metadata][payment_attempt_id]": attemptId,
    "payment_intent_data[metadata][booking_request_id]": booking.id,
  });
  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    body: form,
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `psi-booking-${attemptId}`,
    },
    method: "POST",
  });
  const stripeBody = await stripeResponse.json().catch(() => ({})) as { error?: { code?: string }; expires_at?: number; id?: string; url?: string };
  if (!stripeResponse.ok || !stripeBody.id || !stripeBody.url || !stripeBody.url.startsWith("https://checkout.stripe.com/")) {
    await admin.from("booking_payment_attempts").update({ state: "failed" }).eq("id", attemptId).eq("state", "creating");
    return json({ error: "stripe_checkout_failed", providerCode: stripeBody.error?.code ?? null }, 502);
  }
  const expiresAt = new Date((stripeBody.expires_at ?? expiresAtSeconds) * 1000).toISOString();
  const { error: updateError } = await admin.from("booking_payment_attempts").update({
    state: "awaiting_payment", provider_checkout_id: stripeBody.id,
    provider_checkout_url: stripeBody.url, expires_at: expiresAt,
  }).eq("id", attemptId).eq("state", "creating");
  if (updateError) return json({ error: "payment_state_update_failed" }, 503);
  return json({ amountCents: expectedAmount, checkoutUrl: stripeBody.url, currency: "AUD", expiresAt, paymentMethod, state: "awaiting_payment" }, 201);
});
