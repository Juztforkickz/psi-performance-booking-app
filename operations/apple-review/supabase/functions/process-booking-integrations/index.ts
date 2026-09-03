// Sandbox worker: records deliberately blocked delivery. It cannot send email,
// push, charge a payment or access Google Calendar. Never deploy to live.
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { ...cors, "Cache-Control": "no-store" } });
const URL = "https://jwikoldibbpxyhbdrsow.supabase.co";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (Deno.env.get("SUPABASE_URL") !== URL) return json({ error: "review_project_required" }, 503);
  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "authentication_required" }, 401);
  const user = createClient(URL, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const identity = await user.auth.getUser(token);
  if (identity.error || !identity.data.user) return json({ error: "invalid_session" }, 401);
  let body: { bookingId?: unknown; limit?: unknown };
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const access = await user.rpc("apple_review_staff_access");
  if (access.error) return json({ error: "review_access_unavailable" }, 503);
  if (access.data !== true && typeof body.bookingId !== "string") return json({ error: "booking_required" }, 403);
  if (body.bookingId !== undefined) {
    if (typeof body.bookingId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.bookingId)) return json({ error: "invalid_booking" }, 400);
    const booking = await user.from("booking_requests").select("id").eq("id", body.bookingId).maybeSingle();
    if (booking.error || !booking.data) return json({ error: "booking_access_denied" }, 403);
  }
  const admin = createClient(URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  let query = admin.from("booking_integration_jobs").select("id,job_kind").in("status", ["pending", "failed", "blocked_configuration"]).limit(10);
  if (typeof body.bookingId === "string") query = query.eq("booking_request_id", body.bookingId);
  if (access.data !== true) query = query.eq("customer_id", identity.data.user.id);
  const jobs = await query;
  if (jobs.error) return json({ error: "queue_unavailable" }, 503);
  const ids = (jobs.data ?? []).map(job => job.id);
  if (ids.length) {
    const saved = await admin.from("booking_integration_jobs").update({ status: "blocked_configuration", last_error_code: "review_external_delivery_disabled", last_attempt_at: new Date().toISOString() }).in("id", ids);
    if (saved.error) return json({ error: "queue_update_failed" }, 503);
  }
  return json({
    processed: 0,
    reviewSandbox: true,
    readiness: { calendarConfigured: false, emailConfigured: false, paymentsConfigured: false },
    results: (jobs.data ?? []).map(job => ({ jobId: job.id, kind: job.job_kind, status: "blocked_configuration", errorCode: "review_external_delivery_disabled" })),
  });
});
