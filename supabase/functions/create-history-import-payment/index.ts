import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type RequestBody = { previousDetails?: unknown; vehicleId?: unknown };

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
const isStripeServerKeyForMode = (key: string, liveMode: boolean) =>
  liveMode ? /^(?:sk|rk)_live_/u.test(key) : /^(?:sk|rk)_test_/u.test(key);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/iu, "");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "server_configuration_unavailable" }, 503);
  if (!accessToken) return json({ error: "authentication_required" }, 401);

  let body: RequestBody;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const previousDetails = typeof body.previousDetails === "string" ? body.previousDetails.trim() : "";
  if (!isUuid(body.vehicleId) || previousDetails.length > 1000) return json({ error: "invalid_request" }, 400);

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !userData.user?.email) return json({ error: "invalid_session" }, 401);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: vehicle, error: vehicleError } = await admin.from("customer_vehicles")
    .select("id, customer_id, year, make, model, registration, archived_at")
    .eq("id", body.vehicleId).eq("customer_id", userData.user.id).maybeSingle();
  if (vehicleError) return json({ error: "vehicle_lookup_failed" }, 503);
  if (!vehicle || vehicle.archived_at) return json({ error: "vehicle_not_found" }, 404);

  const { data: existing, error: existingError } = await admin.from("historical_import_requests")
    .select("*").eq("vehicle_id", vehicle.id).neq("status", "cancelled").maybeSingle();
  if (existingError) return json({ error: "request_lookup_failed" }, 503);
  if (existing?.payment_status === "paid") return json({ request: existing, state: existing.status });
  if (existing?.provider_checkout_url && existing.checkout_expires_at && Date.parse(existing.checkout_expires_at) > Date.now()) {
    return json({ checkoutUrl: existing.provider_checkout_url, request: existing, state: "awaiting_payment" });
  }

  const stripeKey = env("STRIPE_SECRET_KEY");
  const liveMode = env("STRIPE_LIVE_MODE") === "true";
  const returnOrigin = env("PSI_PAYMENT_RETURN_ORIGIN").replace(/\/$/u, "");
  if (!stripeKey || !/^https:\/\/[^/?#]+/u.test(returnOrigin) || !isStripeServerKeyForMode(stripeKey, liveMode)) {
    return json({ error: "stripe_not_configured" }, 503);
  }

  const requestId = existing?.id ?? crypto.randomUUID();
  const checkoutAttempt = existing ? Number(existing.checkout_attempt ?? 1) + 1 : 1;
  if (!existing) {
    const { error } = await admin.from("historical_import_requests").insert({
      id: requestId,
      customer_id: userData.user.id,
      vehicle_id: vehicle.id,
      previous_details: previousDetails || null,
      consent_at: new Date().toISOString(),
      status: "awaiting_payment",
      payment_status: "creating",
      checkout_attempt: checkoutAttempt,
    });
    if (error) return json({ error: "request_create_failed" }, 409);
  } else {
    const { error } = await admin.from("historical_import_requests").update({
      previous_details: previousDetails || existing.previous_details,
      consent_at: new Date().toISOString(),
      payment_status: "creating",
      provider_checkout_id: null,
      provider_checkout_url: null,
      checkout_expires_at: null,
      checkout_attempt: checkoutAttempt,
    }).eq("id", requestId).in("payment_status", ["creating", "awaiting_payment", "failed", "expired"]);
    if (error) return json({ error: "request_reset_failed" }, 409);
  }

  const expiresAtSeconds = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const form = new URLSearchParams({
    mode: "payment",
    success_url: `${returnOrigin}/?psi_history_import=success&request=${encodeURIComponent(requestId)}`,
    cancel_url: `${returnOrigin}/?psi_history_import=cancelled&request=${encodeURIComponent(requestId)}`,
    customer_email: userData.user.email,
    client_reference_id: requestId,
    expires_at: String(expiresAtSeconds),
    locale: "auto",
    "line_items[0][price_data][currency]": "aud",
    "line_items[0][price_data][unit_amount]": "19900",
    "line_items[0][price_data][product_data][name]": "PSI verified vehicle history import",
    "line_items[0][price_data][product_data][description]": `${vehicleLabel} · ${vehicle.registration}`,
    "line_items[0][quantity]": "1",
    "payment_method_types[0]": "card",
    "metadata[purpose]": "historical_import",
    "metadata[historical_import_request_id]": requestId,
    "metadata[customer_id]": userData.user.id,
    "metadata[vehicle_id]": vehicle.id,
    "payment_intent_data[metadata][purpose]": "historical_import",
    "payment_intent_data[metadata][historical_import_request_id]": requestId,
  });
  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    body: form,
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `psi-history-import-${requestId}-${checkoutAttempt}`,
    },
    method: "POST",
  });
  const stripeBody = await stripeResponse.json().catch(() => ({})) as { error?: { code?: string }; expires_at?: number; id?: string; url?: string };
  if (!stripeResponse.ok || !stripeBody.id || !stripeBody.url?.startsWith("https://checkout.stripe.com/")) {
    await admin.from("historical_import_requests").update({ payment_status: "failed" }).eq("id", requestId);
    return json({ error: "stripe_checkout_failed", providerCode: stripeBody.error?.code ?? null }, 502);
  }
  const checkoutExpiresAt = new Date((stripeBody.expires_at ?? expiresAtSeconds) * 1000).toISOString();
  const { data: saved, error: saveError } = await admin.from("historical_import_requests").update({
    payment_status: "awaiting_payment",
    provider_checkout_id: stripeBody.id,
    provider_checkout_url: stripeBody.url,
    checkout_expires_at: checkoutExpiresAt,
  }).eq("id", requestId).eq("payment_status", "creating").select("*").single();
  if (saveError) return json({ error: "payment_state_update_failed" }, 503);
  return json({ checkoutUrl: stripeBody.url, request: saved, state: "awaiting_payment" }, 201);
});
