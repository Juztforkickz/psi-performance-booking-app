import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const cors = { "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Origin": "*" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { ...cors, "Cache-Control": "no-store" } });
const env = (name: string) => Deno.env.get(name)?.trim() ?? "";

type ActionBody = { action?: unknown; bookingId?: unknown; expoPushToken?: unknown; platform?: unknown };
type EventRow = { body: string; deep_link: string; id: string; recipient_user_id: string; title: string };
type JobRow = { attempt_count: number; booking_request_id: string | null; event_id: string; id: string; recipient_user_id: string };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "server_configuration_unavailable" }, 503);
  if (!token) return json({ error: "authentication_required" }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "invalid_session" }, 401);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let body: ActionBody = {};
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }

  if (body.action === "register_device") {
    if (typeof body.expoPushToken !== "string" || !/^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/.test(body.expoPushToken)) return json({ error: "invalid_push_token" }, 400);
    if (body.platform !== "ios" && body.platform !== "android") return json({ error: "invalid_platform" }, 400);
    await admin.from("push_devices").update({ enabled: false, updated_at: new Date().toISOString() }).eq("expo_push_token", body.expoPushToken).neq("user_id", userData.user.id);
    const { error } = await admin.from("push_devices").upsert({ user_id: userData.user.id, expo_push_token: body.expoPushToken, platform: body.platform, enabled: true, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "expo_push_token" });
    return error ? json({ error: "device_registration_failed" }, 500) : json({ registered: true });
  }

  if (body.action === "unregister_device") {
    if (typeof body.expoPushToken !== "string") return json({ error: "invalid_push_token" }, 400);
    const { error } = await admin.from("push_devices").update({ enabled: false, updated_at: new Date().toISOString() }).eq("user_id", userData.user.id).eq("expo_push_token", body.expoPushToken);
    return error ? json({ error: "device_unregistration_failed" }, 500) : json({ unregistered: true });
  }

  const bookingId = typeof body.bookingId === "string" ? body.bookingId : null;
  const [{ data: staff }, { data: claims }] = await Promise.all([
    userClient.from("staff_members").select("id").eq("user_id", userData.user.id).eq("status", "active").maybeSingle(),
    userClient.auth.getClaims(token),
  ]);
  const isAal2Staff = Boolean(staff && claims?.claims?.aal === "aal2");
  if (bookingId) {
    const { data: owned } = await userClient.from("booking_requests").select("id").eq("id", bookingId).eq("customer_id", userData.user.id).maybeSingle();
    if (!owned && !isAal2Staff) return json({ error: "booking_access_denied" }, 403);
  } else if (!isAal2Staff) {
    return json({ error: "aal2_staff_access_required" }, 403);
  }

  let jobsQuery = admin.from("push_notification_jobs").select("id,event_id,booking_request_id,recipient_user_id,attempt_count").in("status", ["pending", "failed"]).lte("available_at", new Date().toISOString()).lt("attempt_count", 20).order("created_at", { ascending: true }).limit(25);
  if (bookingId) jobsQuery = jobsQuery.eq("booking_request_id", bookingId);
  const { data: jobs, error: jobsError } = await jobsQuery;
  if (jobsError) return json({ error: "notification_queue_unavailable" }, 500);
  let sent = 0;
  for (const queued of (jobs ?? []) as JobRow[]) {
    const now = new Date().toISOString();
    const { data: claimed } = await admin.from("push_notification_jobs").update({ status: "processing", attempt_count: queued.attempt_count + 1, last_attempt_at: now, updated_at: now }).eq("id", queued.id).in("status", ["pending", "failed"]).select("id").maybeSingle();
    if (!claimed) continue;
    const [{ data: event }, { data: devices }, { data: preference }, { count }] = await Promise.all([
      admin.from("notification_events").select("id,recipient_user_id,title,body,deep_link").eq("id", queued.event_id).single(),
      admin.from("push_devices").select("expo_push_token").eq("user_id", queued.recipient_user_id).eq("enabled", true),
      admin.from("notification_preferences").select("booking_updates_enabled,event_alerts_enabled,workshop_alerts_enabled,sound_enabled").eq("user_id", queued.recipient_user_id).maybeSingle(),
      admin.from("notification_events").select("id", { count: "exact", head: true }).eq("recipient_user_id", queued.recipient_user_id).is("read_at", null),
    ]);
    const allowed = (event as EventRow | null)?.deep_link === "/staff"
      ? preference?.workshop_alerts_enabled !== false
      : (event as EventRow | null)?.deep_link === "/events"
        ? preference?.event_alerts_enabled !== false
        : preference?.booking_updates_enabled !== false;
    if (!event || !allowed || !devices?.length) {
      await admin.from("push_notification_jobs").update({ status: "cancelled", completed_at: now, last_error_code: !allowed ? "preference_disabled" : "no_registered_device", updated_at: now }).eq("id", queued.id);
      continue;
    }
    const messages = devices.map((device) => ({ to: device.expo_push_token, title: event.title, body: event.body, data: { url: event.deep_link, eventId: event.id }, badge: count ?? 0, sound: preference?.sound_enabled === false ? null : "default", channelId: "psi-bookings", priority: "high" }));
    const response = await fetch("https://exp.host/--/api/v2/push/send", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(messages) });
    const result = await response.json().catch(() => null) as { data?: Array<{ id?: string; status?: string; details?: { error?: string } }> } | null;
    const tickets = result?.data ?? [];
    const successfulTickets = tickets.filter((ticket) => ticket.status === "ok");
    const failed = !response.ok || successfulTickets.length === 0;
    for (let index = 0; index < tickets.length; index += 1) if (tickets[index]?.details?.error === "DeviceNotRegistered") await admin.from("push_devices").update({ enabled: false, updated_at: now }).eq("expo_push_token", messages[index].to);
    await admin.from("push_notification_jobs").update({ status: failed ? "failed" : "succeeded", available_at: failed ? new Date(Date.now() + 300000).toISOString() : now, completed_at: failed ? null : now, provider_ticket_id: tickets.map((ticket) => ticket.id).filter(Boolean).join(",").slice(0, 500) || null, last_error_code: failed ? "expo_push_failed" : null, updated_at: now }).eq("id", queued.id);
    if (!failed) sent += 1;
  }
  return json({ processed: jobs?.length ?? 0, sent });
});
