import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type BankVerificationRequest = {
  bookingId?: unknown;
  transactionReference?: unknown;
};

const env = (name: string) => Deno.env.get(name)?.trim() ?? "";
const headers = { "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { headers, status });

async function processConfirmedBooking(supabaseUrl: string, serviceKey: string, bookingId: string) {
  const response = await fetch(`${supabaseUrl}/functions/v1/process-booking-integrations`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bookingId, limit: 10 }),
  });
  if (!response.ok) throw new Error(`booking_integrations_${response.status}`);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/iu, "");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "server_configuration_unavailable" }, 503);
  const userClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "invalid_session" }, 401);
  const [{ data: claims }, { data: staff }] = await Promise.all([
    userClient.auth.getClaims(token),
    userClient.from("staff_members").select("id, status").eq("user_id", userData.user.id).eq("status", "active").maybeSingle(),
  ]);
  if (!staff || claims?.claims?.aal !== "aal2") return json({ error: "aal2_staff_access_required" }, 403);

  let body: BankVerificationRequest;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const bookingId = typeof body.bookingId === "string" ? body.bookingId : "";
  const transactionReference = typeof body.transactionReference === "string" ? body.transactionReference.trim().toUpperCase() : "";
  if (!/^[0-9a-f-]{36}$/iu.test(bookingId) || !/^[A-Z0-9 ./-]{6,80}$/u.test(transactionReference)) return json({ error: "invalid_bank_verification" }, 400);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: attempt, error: attemptError } = await admin.from("booking_payment_attempts").select("*").eq("booking_request_id", bookingId).eq("provider", "manual_bank_transfer").eq("state", "bank_transfer_pending").maybeSingle();
  if (attemptError) return json({ error: "payment_lookup_failed" }, 503);
  if (!attempt) return json({ error: "pending_bank_transfer_not_found" }, 404);
  const normalizedEvidence = transactionReference.replace(/\s+/gu, "-");
  const { error } = await admin.rpc("confirm_booking_payment", {
    p_amount_cents: attempt.amount_cents, p_currency: "AUD", p_paid_at: new Date().toISOString(),
    p_payload_hash: null, p_payment_attempt_id: attempt.id, p_provider: "manual_bank_transfer",
    p_provider_event_id: `bank-${attempt.id}-${normalizedEvidence}`.slice(0, 255),
    p_provider_payment_id: transactionReference, p_provider_receipt_url: null,
  });
  if (error) return json({ error: "bank_transfer_confirmation_failed" }, 409);
  try {
    await processConfirmedBooking(supabaseUrl, serviceKey, bookingId);
  } catch {
    // The deposit is already confirmed and the durable jobs remain queued.
    // Returning a retryable response lets PSI run the same idempotent action again.
    return json({ error: "booking_integrations_pending", bookingId, confirmed: true }, 503);
  }
  return json({ bookingId, confirmed: true });
});
