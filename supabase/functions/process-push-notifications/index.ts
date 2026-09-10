import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const cors = { "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Origin": "*" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { ...cors, "Cache-Control": "no-store" } });
const env = (name: string) => Deno.env.get(name)?.trim() ?? "";
const isProjectServiceRoleToken = (token: string, supabaseUrl: string) => {
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return false;
    const paddedPayload = encodedPayload.replace(/-/gu, "+").replace(/_/gu, "/").padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    const claims = JSON.parse(atob(paddedPayload)) as { iss?: unknown; ref?: unknown; role?: unknown };
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    return claims.iss === "supabase" && claims.ref === projectRef && claims.role === "service_role";
  } catch {
    return false;
  }
};

type ActionBody = { action?: unknown; bookingId?: unknown; expoPushToken?: unknown; platform?: unknown };
type EventRow = { body: string; deep_link: string; id: string; kind: string; recipient_user_id: string; title: string };
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
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let body: ActionBody = {};
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const bookingId = typeof body.bookingId === "string" && /^[0-9a-f-]{36}$/iu.test(body.bookingId) ? body.bookingId : null;
  const isInternalServiceCall = token === serviceRoleKey || isProjectServiceRoleToken(token, supabaseUrl);
  const userClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  let userId = "";
  let isAal2Staff = false;

  if (isInternalServiceCall) {
    if (body.action !== "process_due_service_reminders" || !bookingId) return json({ error: "internal_booking_id_required" }, 400);
  } else {
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "invalid_session" }, 401);
    userId = userData.user.id;
    const [{ data: staff }, { data: claims }] = await Promise.all([
      userClient.from("staff_members").select("id").eq("user_id", userId).eq("status", "active").maybeSingle(),
      userClient.auth.getClaims(token),
    ]);
    isAal2Staff = Boolean(staff && claims?.claims?.aal === "aal2");
  }

  if (body.action === "register_device") {
    if (isInternalServiceCall) return json({ error: "action_not_allowed" }, 403);
    if (typeof body.expoPushToken !== "string" || !/^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/.test(body.expoPushToken)) return json({ error: "invalid_push_token" }, 400);
    if (body.platform !== "ios" && body.platform !== "android") return json({ error: "invalid_platform" }, 400);
    await admin.from("push_devices").update({ enabled: false, updated_at: new Date().toISOString() }).eq("expo_push_token", body.expoPushToken).neq("user_id", userId);
    const { error } = await admin.from("push_devices").upsert({ user_id: userId, expo_push_token: body.expoPushToken, platform: body.platform, enabled: true, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "expo_push_token" });
    return error ? json({ error: "device_registration_failed" }, 500) : json({ registered: true });
  }

  if (body.action === "unregister_device") {
    if (isInternalServiceCall) return json({ error: "action_not_allowed" }, 403);
    if (typeof body.expoPushToken !== "string") return json({ error: "invalid_push_token" }, 400);
    const { error } = await admin.from("push_devices").update({ enabled: false, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("expo_push_token", body.expoPushToken);
    return error ? json({ error: "device_unregistration_failed" }, 500) : json({ unregistered: true });
  }

  let testJobs: JobRow[] | null = null;
  if (body.action === "send_test_alerts") {
    if (isInternalServiceCall) return json({ error: "action_not_allowed" }, 403);
    if (!isAal2Staff) return json({ error: "aal2_staff_access_required" }, 403);
    const testPrefix = `owner_push_test:${userId}:`;
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: recentTestCount, error: recentTestError } = await admin
      .from("notification_events")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", userId)
      .like("source_event_key", `${testPrefix}%`)
      .gte("created_at", oneMinuteAgo);
    if (recentTestError) return json({ error: "notification_test_unavailable" }, 500);
    if ((recentTestCount ?? 0) > 0) return json({ error: "notification_test_rate_limited" }, 429);

    const { data: staleTestEvents, error: staleTestError } = await admin
      .from("notification_events")
      .select("id")
      .eq("recipient_user_id", userId)
      .like("source_event_key", `${testPrefix}%`)
      .lt("created_at", oneMinuteAgo);
    if (staleTestError) return json({ error: "notification_test_unavailable" }, 500);
    const staleEventIds = (staleTestEvents ?? []).map((event) => event.id);
    if (staleEventIds.length) {
      const now = new Date().toISOString();
      const { error: staleJobError } = await admin.from("push_notification_jobs").update({
        status: "cancelled", completed_at: now, last_error_code: "test_superseded", updated_at: now,
      }).in("event_id", staleEventIds).in("status", ["pending", "failed"]);
      if (staleJobError) return json({ error: "notification_test_unavailable" }, 500);
    }

    const batchId = crypto.randomUUID();
    const { data: testEvents, error: testEventError } = await admin.from("notification_events").insert([
      {
        recipient_user_id: userId,
        booking_request_id: null,
        kind: "new_booking_request",
        title: "PSI notification test",
        body: "Test alert for the protected PSI workshop inbox.",
        deep_link: "/staff",
        source_event_key: `${testPrefix}${batchId}:psi`,
      },
      {
        recipient_user_id: userId,
        booking_request_id: null,
        kind: "booking_request_received",
        title: "Personal notification test",
        body: "Test alert for your private customer inbox.",
        deep_link: "/bookings",
        source_event_key: `${testPrefix}${batchId}:account`,
      },
    ]).select("id,recipient_user_id");
    if (testEventError || !testEvents || testEvents.length !== 2) return json({ error: "notification_test_unavailable" }, 500);

    const { data: createdJobs, error: testJobError } = await admin.from("push_notification_jobs").insert(
      testEvents.map((event) => ({ event_id: event.id, booking_request_id: null, recipient_user_id: event.recipient_user_id })),
    ).select("id,event_id,booking_request_id,recipient_user_id,attempt_count");
    if (testJobError || !createdJobs || createdJobs.length !== 2) return json({ error: "notification_test_unavailable" }, 500);
    testJobs = createdJobs as JobRow[];
  }
  if (bookingId && !isInternalServiceCall) {
    const { data: owned } = await userClient.from("booking_requests").select("id").eq("id", bookingId).eq("customer_id", userId).maybeSingle();
    if (!owned && !isAal2Staff) return json({ error: "booking_access_denied" }, 403);
  } else if (!bookingId && !isAal2Staff) {
    return json({ error: "aal2_staff_access_required" }, 403);
  }

  let jobs: JobRow[] | null = testJobs;
  if (!jobs) {
    let jobsQuery = admin.from("push_notification_jobs").select("id,event_id,booking_request_id,recipient_user_id,attempt_count").in("status", ["pending", "failed"]).lte("available_at", new Date().toISOString()).lt("attempt_count", 20).order("created_at", { ascending: true }).limit(25);
    if (bookingId) jobsQuery = jobsQuery.eq("booking_request_id", bookingId);
    if (isInternalServiceCall) {
      const { data: reminderEvents, error: reminderEventsError } = await admin
        .from("notification_events")
        .select("id")
        .eq("booking_request_id", bookingId)
        .eq("kind", "service_reminder");
      if (reminderEventsError) return json({ error: "notification_queue_unavailable" }, 500);
      const reminderEventIds = (reminderEvents ?? []).map((event) => event.id);
      if (!reminderEventIds.length) return json({ processed: 0, sent: 0 });
      jobsQuery = jobsQuery.in("event_id", reminderEventIds);
    }
    const { data, error } = await jobsQuery;
    if (error) return json({ error: "notification_queue_unavailable" }, 500);
    jobs = data as JobRow[] | null;
  }
  let sent = 0;
  for (const queued of (jobs ?? []) as JobRow[]) {
    const now = new Date().toISOString();
    const { data: claimed } = await admin.from("push_notification_jobs").update({ status: "processing", attempt_count: queued.attempt_count + 1, last_attempt_at: now, updated_at: now }).eq("id", queued.id).in("status", ["pending", "failed"]).select("id").maybeSingle();
    if (!claimed) continue;
    const [{ data: event }, { data: devices }, { data: preference }, { count }] = await Promise.all([
      admin.from("notification_events").select("id,recipient_user_id,title,body,deep_link,kind").eq("id", queued.event_id).single(),
      admin.from("push_devices").select("expo_push_token").eq("user_id", queued.recipient_user_id).eq("enabled", true),
      admin.from("notification_preferences").select("booking_reminders_enabled,booking_updates_enabled,event_alerts_enabled,workshop_alerts_enabled,sound_enabled").eq("user_id", queued.recipient_user_id).maybeSingle(),
      admin.from("notification_events").select("id", { count: "exact", head: true }).eq("recipient_user_id", queued.recipient_user_id).is("read_at", null),
    ]);
    const allowed = (event as EventRow | null)?.kind === "service_reminder"
      ? preference?.booking_reminders_enabled !== false
      : (event as EventRow | null)?.deep_link === "/staff"
      ? preference?.workshop_alerts_enabled !== false
      : (event as EventRow | null)?.deep_link === "/events"
        ? preference?.event_alerts_enabled !== false
        : preference?.booking_updates_enabled !== false;
    if (!event || !allowed || !devices?.length) {
      await admin.from("push_notification_jobs").update({ status: "cancelled", completed_at: now, last_error_code: !allowed ? "preference_disabled" : "no_registered_device", updated_at: now }).eq("id", queued.id);
      continue;
    }
    const workshopAlert = event.deep_link === "/staff";
    const messages = devices.map((device) => ({
      to: device.expo_push_token,
      title: "PSI update received",
      subtitle: workshopAlert ? "PSI workshop" : "Customer account",
      body: workshopAlert ? "Open the protected workshop portal to review it." : "Open PSI to view your private update.",
      data: { url: event.deep_link },
      badge: count ?? 0,
      sound: preference?.sound_enabled === false ? null : "default",
      channelId: workshopAlert ? "psi-workshop" : "psi-customer",
      priority: "high",
    }));
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
