import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

// This worker belongs only to the existing fictional review sandbox.
const SANDBOX_URL = "https://jwikoldibbpxyhbdrsow.supabase.co";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { ...cors, "Cache-Control": "no-store" } });
const env = (key: string) => Deno.env.get(key)?.trim() ?? "";
type Body = { action?: unknown; expoPushToken?: unknown; platform?: unknown; askPsiConversationId?: unknown };
type Event = { id: string; recipient_user_id: string; kind: string; created_at: string; source_event_key: string };
type Device = { id: string; user_id: string; expo_push_token: string; enabled_at: string };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (env("SUPABASE_URL") !== SANDBOX_URL) return json({ error: "private_sandbox_required" }, 403);
  if (env("PSI_ASK_PSI_DEVICE_QA_ENABLED") !== "true") return json({ error: "private_device_test_disabled" }, 503);
  const users = env("PSI_ASK_PSI_DEVICE_QA_USERS").split(",").map(value => value.trim()).filter(Boolean);
  const start = env("PSI_ASK_PSI_DEVICE_QA_SESSION_START");
  if (!users.length || users.length > 4 || users.some(id => !UUID.test(id)) || new Set(users).size !== users.length
    || !/^\d{4}-\d{2}-\d{2}T/.test(start) || !Number.isFinite(Date.parse(start))
    || !env("SUPABASE_ANON_KEY") || !env("SUPABASE_SERVICE_ROLE_KEY")) return json({ error: "private_test_configuration_required" }, 503);
  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/iu, "");
  if (!token || token === env("SUPABASE_SERVICE_ROLE_KEY")) return json({ error: "user_session_required" }, 401);
  const userClient = createClient(SANDBOX_URL, env("SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "invalid_session" }, 401);
  if (!users.includes(auth.user.id)) return json({ error: "nominated_test_account_required" }, 403);
  let body: Body;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!["register_device", "unregister_device", "dispatch"].includes(String(body.action))) return json({ error: "scoped_test_action_required" }, 400);
  const admin = createClient(SANDBOX_URL, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date().toISOString();

  if (body.action === "register_device" || body.action === "unregister_device") {
    if (typeof body.expoPushToken !== "string" || !/^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/u.test(body.expoPushToken)) return json({ error: "invalid_push_token" }, 400);
    if (body.action === "unregister_device") {
      const { error } = await admin.from("ask_psi_qa_devices").update({ enabled: false, updated_at: now }).eq("user_id", auth.user.id).eq("expo_push_token", body.expoPushToken);
      return error ? json({ error: "device_unregistration_failed" }, 500) : json({ unregistered: true });
    }
    if (body.platform !== "ios" && body.platform !== "android") return json({ error: "native_device_required" }, 400);
    const { data: previous, error: lookupError } = await admin.from("ask_psi_qa_devices").select("user_id,enabled,enabled_at").eq("expo_push_token", body.expoPushToken).maybeSingle();
    if (lookupError) return json({ error: "device_lookup_failed" }, 500);
    // Preserve opt-in time during refresh so an unread new message is not lost.
    const enabledAt = previous?.user_id === auth.user.id && previous.enabled ? previous.enabled_at : now;
    const { error } = await admin.from("ask_psi_qa_devices").upsert({
      user_id: auth.user.id, expo_push_token: body.expoPushToken, platform: body.platform,
      enabled: true, enabled_at: enabledAt, updated_at: now,
    }, { onConflict: "expo_push_token" });
    return error ? json({ error: "device_registration_failed" }, 500) : json({ registered: true });
  }

  const conversationId = typeof body.askPsiConversationId === "string" && UUID.test(body.askPsiConversationId) ? body.askPsiConversationId : null;
  if (!conversationId) return json({ error: "conversation_scope_required" }, 400);
  // Participant access uses the caller's RLS client, never the service client.
  const { data: conversation, error: accessError } = await userClient.from("ask_psi_conversations").select("id").eq("id", conversationId).maybeSingle();
  if (accessError || !conversation) return json({ error: "conversation_access_denied" }, 403);
  const { data: events, error: eventError } = await admin.from("notification_events")
    .select("id,recipient_user_id,kind,created_at,source_event_key")
    .eq("ask_psi_conversation_id", conversationId).in("recipient_user_id", users)
    .in("kind", ["customer_message_received", "staff_message_received"])
    .is("read_at", null).gte("created_at", start).order("created_at", { ascending: false }).limit(8);
  if (eventError) return json({ error: "message_lookup_failed" }, 500);
  let submitted = 0;
  for (const event of (events ?? []) as Event[]) {
    const [deviceResult, preferenceResult, countResult] = await Promise.all([
      admin.from("ask_psi_qa_devices").select("id,user_id,expo_push_token,enabled_at").eq("user_id", event.recipient_user_id).eq("enabled", true).lte("enabled_at", event.created_at).limit(4),
      admin.from("notification_preferences").select("message_alerts_enabled,sound_enabled").eq("user_id", event.recipient_user_id).maybeSingle(),
      admin.from("notification_events").select("id", { head: true, count: "exact" }).eq("recipient_user_id", event.recipient_user_id)
        .in("kind", ["customer_message_received", "staff_message_received"]).is("read_at", null).gte("created_at", start),
    ]);
    if (deviceResult.error || preferenceResult.error || countResult.error) return json({ error: "test_delivery_lookup_failed" }, 500);
    if (preferenceResult.data?.message_alerts_enabled === false) continue;
    for (const device of (deviceResult.data ?? []) as Device[]) {
      // One reservation per event and device. Unknown outcomes never auto resend.
      const { data: receipt, error: claimError } = await admin.from("ask_psi_qa_deliveries").insert({ event_id: event.id, device_id: device.id, status: "processing" }).select("id").single();
      if (claimError?.code === "23505") continue;
      if (claimError || !receipt) return json({ error: "test_delivery_reservation_failed" }, 500);
      const [freshEvent, freshDevice, freshPreference] = await Promise.all([
        admin.from("notification_events").select("read_at").eq("id", event.id).maybeSingle(),
        admin.from("ask_psi_qa_devices").select("enabled,user_id,expo_push_token").eq("id", device.id).maybeSingle(),
        admin.from("notification_preferences").select("message_alerts_enabled,sound_enabled").eq("user_id", event.recipient_user_id).maybeSingle(),
      ]);
      let status = "cancelled";
      let providerTicket: string | null = null;
      if (freshEvent.error || freshDevice.error || freshPreference.error) status = "held";
      else if (freshEvent.data && !freshEvent.data.read_at && freshDevice.data?.enabled
        && freshDevice.data.user_id === event.recipient_user_id && freshDevice.data.expo_push_token === device.expo_push_token
        && freshPreference.data?.message_alerts_enabled !== false) {
        const workshop = event.kind === "customer_message_received";
        const sound = freshPreference.data?.sound_enabled !== false;
        const message = {
          to: device.expo_push_token, title: workshop ? "New customer message" : "New message from PSI",
          body: "Private test. Open Ask PSI to read your message.",
          data: { psiAskPsiDeviceQa: true, askPsiConversationId: conversationId, kind: event.kind,
            sourceEventKey: event.source_event_key, url: workshop ? "/staff-messages" : "/messages" },
          badge: countResult.count ?? 0, sound: sound ? "default" : null,
          channelId: sound ? "psi-message-test" : "psi-message-test-silent", priority: "high",
        };
        status = "unknown";
        try {
          const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify(message), signal: AbortSignal.timeout(10000),
          });
          const result = await response.json() as { data?: { status?: string; id?: string; details?: { error?: string } } };
          if (response.ok && result.data?.status === "ok" && result.data.id) {
            status = "submitted"; providerTicket = result.data.id; submitted += 1;
          } else if (response.ok && result.data?.status === "error") {
            status = "rejected";
            if (result.data.details?.error === "DeviceNotRegistered") await admin.from("ask_psi_qa_devices").update({ enabled: false, updated_at: now }).eq("id", device.id).eq("expo_push_token", device.expo_push_token);
          }
        } catch { /* Ambiguous provider outcome stays held without a duplicate retry. */ }
      }
      const { error: saveError } = await admin.from("ask_psi_qa_deliveries").update({ status, provider_ticket_id: providerTicket, updated_at: new Date().toISOString() }).eq("id", receipt.id);
      if (saveError) return json({ error: "test_delivery_result_held" }, 500);
    }
  }
  return json({ processed: events?.length ?? 0, submitted });
});
