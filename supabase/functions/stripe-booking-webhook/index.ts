import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (name: string) => Deno.env.get(name)?.trim() ?? "";
const json = (body: unknown, status = 200) => Response.json(body, { headers: { "Cache-Control": "no-store" }, status });
const bytesToHex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const safeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
};

async function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(",").map((part) => part.trim().split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1] ?? "";
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!/^\d{10}$/u.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 || !signatures.length) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = bytesToHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`)));
  return signatures.some((signature) => /^[a-f0-9]{64}$/u.test(signature) && safeEqual(signature, expected));
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const webhookSecret = env("STRIPE_WEBHOOK_SECRET");
  const signature = request.headers.get("Stripe-Signature") ?? "";
  const rawBody = await request.text();
  if (!webhookSecret || rawBody.length > 512_000 || !await verifyStripeSignature(rawBody, signature, webhookSecret)) {
    return json({ error: "invalid_signature" }, 401);
  }
  let event: any;
  try { event = JSON.parse(rawBody); } catch { return json({ error: "invalid_json" }, 400); }
  if (!event?.id || !event?.type || !event?.data?.object) return json({ error: "invalid_event" }, 400);
  const expectedLiveMode = env("STRIPE_LIVE_MODE") === "true";
  if (Boolean(event.livemode) !== expectedLiveMode) return json({ error: "stripe_mode_mismatch" }, 409);

  const session = event.data.object as any;
  const attemptId = session.metadata?.payment_attempt_id;
  const bookingId = session.metadata?.booking_request_id;
  if (!attemptId || !bookingId || session.client_reference_id !== bookingId) return json({ received: true, ignored: true });

  const supabaseUrl = env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "server_configuration_unavailable" }, 503);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: attempt, error: attemptError } = await admin.from("booking_payment_attempts").select("*").eq("id", attemptId).eq("booking_request_id", bookingId).eq("provider", "stripe").maybeSingle();
  if (attemptError) return json({ error: "payment_lookup_failed" }, 503);
  if (!attempt || attempt.provider_checkout_id !== session.id) return json({ error: "payment_attempt_mismatch" }, 409);
  const payloadHash = bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBody)));

  const success = event.type === "checkout.session.async_payment_succeeded"
    || (event.type === "checkout.session.completed" && session.payment_status === "paid");
  if (success) {
    const paymentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!paymentId || !Number.isInteger(session.amount_total) || String(session.currency).toUpperCase() !== "AUD") {
      return json({ error: "payment_data_invalid" }, 422);
    }
    const { error } = await admin.rpc("confirm_booking_payment", {
      p_amount_cents: session.amount_total,
      p_currency: "AUD",
      p_paid_at: new Date(event.created * 1000).toISOString(),
      p_payload_hash: payloadHash,
      p_payment_attempt_id: attempt.id,
      p_provider: "stripe",
      p_provider_event_id: event.id,
      p_provider_payment_id: paymentId,
      p_provider_receipt_url: null,
    });
    if (error) return json({ error: "payment_confirmation_failed" }, 409);
    return json({ received: true, confirmed: true });
  }

  const terminalState = event.type === "checkout.session.expired"
    ? "expired"
    : event.type === "checkout.session.async_payment_failed"
      ? "failed"
      : null;
  if (terminalState) {
    const eventType = terminalState === "expired" ? "checkout_expired" : "payment_failed";
    const { error: eventError } = await admin.from("booking_payment_events").upsert({
      payment_attempt_id: attempt.id, booking_request_id: attempt.booking_request_id,
      customer_id: attempt.customer_id, provider: "stripe", provider_event_id: event.id,
      event_type: eventType, amount_cents: session.amount_total ?? null,
      currency: session.currency ? String(session.currency).toUpperCase() : null, payload_hash: payloadHash,
    }, { onConflict: "provider,provider_event_id", ignoreDuplicates: true });
    if (eventError) return json({ error: "payment_event_store_failed" }, 503);
    await admin.from("booking_payment_attempts").update({ state: terminalState }).eq("id", attempt.id).neq("state", "paid");
  }
  return json({ received: true });
});
