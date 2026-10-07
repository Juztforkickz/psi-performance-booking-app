import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { TORI_SIGNATURE_BANNER_BASE64 } from "../process-performance-trial-notifications/tori-signature-banner.ts";

const TORI_BANNER_SHA256 = "c7a33dbd43daa2bdfc0eef4e629bcb8385938465d672d88921b15c046c3ac1b2";
const TORI_BANNER_CONTENT_ID = "psi-tori-laurent-signature";

const cors = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { ...cors, "Cache-Control": "no-store" },
});

const env = (name: string) => Deno.env.get(name)?.trim() ?? "";

async function bannerIsApproved() {
  if (TORI_SIGNATURE_BANNER_BASE64.length < 100_000) return false;
  const decoded = atob(TORI_SIGNATURE_BANNER_BASE64);
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("") === TORI_BANNER_SHA256;
}

type JobRow = {
  attempt_count: number;
  conversation_id: string;
  id: string;
  message_id: string;
  recipient_user_id: string;
};

type ConversationRow = {
  customer_id: string;
  id: string;
  staff_last_read_at: string | null;
  vehicle_id: string | null;
};

type MessageRow = {
  created_at: string;
  id: string;
  recipient_read_at: string | null;
  sender_kind: string;
};

async function acquireMicrosoftGraphToken() {
  const tenantId = env("MICROSOFT_365_TENANT_ID");
  const clientId = env("MICROSOFT_365_CLIENT_ID");
  const clientSecret = env("MICROSOFT_365_CLIENT_SECRET");
  if (!tenantId || !clientId || !clientSecret) return null;

  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      scope: "https://graph.microsoft.com/.default",
    }),
  });
  if (!response.ok) return null;
  const result = await response.json().catch(() => null) as { access_token?: string } | null;
  return result?.access_token ?? null;
}

async function sendMicrosoft365Fallback(input: {
  accessToken: string;
  customerDisplay: string;
  registration: string | null;
}) {
  const sender = env("PSI_MICROSOFT_365_SENDER_EMAIL").toLowerCase();
  const recipient = env("PSI_OWNER_NOTIFICATION_EMAIL").toLowerCase();
  const portalUrl = env("PSI_WORKSHOP_PORTAL_URL");
  if (!sender || !recipient || !portalUrl) return { configured: false, sent: false };

  const vehicleText = input.registration ? ` for ${input.registration}` : "";
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: `Unread Ask PSI message${vehicleText}`,
          body: {
            contentType: "HTML",
            content: [
              "<p>A customer message is still unread in the private PSI Workshop portal.</p>",
              `<p><strong>Customer:</strong> ${escapeHtml(input.customerDisplay)}</p>`,
              input.registration ? `<p><strong>Vehicle:</strong> ${escapeHtml(input.registration)}</p>` : "",
              `<p><a href="${escapeHtml(portalUrl)}">Open PSI Workshop Messages</a></p>`,
              "<p>The private message content is available only after signing in to the PSI portal.</p>",
              `<img src="cid:${TORI_BANNER_CONTENT_ID}" alt="PSI Performance. Tori Laurent. Authorised assistant for Matthew Ebert. Workshop contacts: 0433 431 781; info@psiperformance.com.au; psiperformance.com.au." width="452" height="226" style="display:block;width:452px;max-width:100%;height:auto;border:0;margin-top:18px">`,
            ].join(""),
          },
          toRecipients: [{ emailAddress: { address: recipient } }],
          attachments: [{
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: "PSI-Tori-Laurent-authorised-assistant.jpg",
            contentType: "image/jpeg",
            contentId: TORI_BANNER_CONTENT_ID,
            isInline: true,
            contentBytes: TORI_SIGNATURE_BANNER_BASE64,
          }],
        },
        saveToSentItems: true,
      }),
    },
  );

  return {
    configured: true,
    sent: response.status === 202,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_configuration_unavailable" }, 503);
  if (!token || token !== serviceRoleKey) return json({ error: "service_role_required" }, 403);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  // Private preparation must never start sending merely because shared Graph
  // credentials are added for some other PSI integration.
  const configured = env("PSI_ASK_PSI_EMAIL_DELIVERY_ENABLED") === "true"
    && ["MICROSOFT_365_TENANT_ID", "MICROSOFT_365_CLIENT_ID", "MICROSOFT_365_CLIENT_SECRET",
      "PSI_MICROSOFT_365_SENDER_EMAIL", "PSI_OWNER_NOTIFICATION_EMAIL", "PSI_WORKSHOP_PORTAL_URL"]
      .every((name) => Boolean(env(name)));
  if (!configured) return json({ configured: false, processed: 0, sent: 0 });
  if (!(await bannerIsApproved())) return json({ error: "approved_tori_banner_unavailable", processed: 0, sent: 0 }, 503);

  let accessToken: string | null;
  try {
    accessToken = await acquireMicrosoftGraphToken();
  } catch {
    return json({ error: "microsoft_365_authentication_unavailable", processed: 0, sent: 0 }, 503);
  }
  if (!accessToken) return json({ error: "microsoft_365_authentication_unavailable", processed: 0, sent: 0 }, 503);
  const now = new Date().toISOString();
  // A terminated worker may already have reached Microsoft. Hold these jobs for
  // inspection instead of risking a second email after an unknown outcome.
  await admin.from("ask_psi_email_jobs").update({
    last_error_code: "delivery_outcome_unknown",
    status: "failed",
    updated_at: now,
  }).eq("status", "processing").lt("last_attempt_at", new Date(Date.now() - 10 * 60_000).toISOString());
  const { data, error } = await admin
    .from("ask_psi_email_jobs")
    .select("id,conversation_id,message_id,recipient_user_id,attempt_count")
    .in("status", ["pending", "failed", "blocked_configuration"])
    .or("last_error_code.is.null,last_error_code.neq.delivery_outcome_unknown")
    .lte("available_at", now)
    .lt("attempt_count", 20)
    .order("created_at", { ascending: true })
    .limit(10);
  if (error) return json({ error: "message_email_queue_unavailable" }, 503);

  let cancelled = 0;
  let sent = 0;

  for (const job of (data ?? []) as JobRow[]) {
    const { data: claimed } = await admin
      .from("ask_psi_email_jobs")
      .update({
        attempt_count: job.attempt_count + 1,
        last_attempt_at: now,
        status: "processing",
        updated_at: now,
      })
      .eq("id", job.id)
      .in("status", ["pending", "failed", "blocked_configuration"])
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const [conversationResult, messageResult, recipientResult, preferenceResult] = await Promise.all([
      admin
        .from("ask_psi_conversations")
        .select("id,customer_id,vehicle_id,staff_last_read_at")
        .eq("id", job.conversation_id)
        .single(),
      admin
        .from("ask_psi_messages")
        .select("id,created_at,sender_kind,recipient_read_at")
        .eq("id", job.message_id)
        .single(),
      admin.from("staff_members").select("status,role").eq("user_id", job.recipient_user_id).maybeSingle(),
      admin.from("notification_preferences").select("message_email_fallback_enabled").eq("user_id", job.recipient_user_id).maybeSingle(),
    ]);
    if (conversationResult.error || messageResult.error || recipientResult.error || preferenceResult.error) {
      await admin.from("ask_psi_email_jobs").update({
        available_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        last_error_code: "message_context_query_failed", status: "failed", updated_at: now,
      }).eq("id", job.id).eq("status", "processing");
      continue;
    }
    const conversation = conversationResult.data as ConversationRow | null;
    const message = messageResult.data as MessageRow | null;
    if (!conversation || !message || message.sender_kind !== "customer"
      || recipientResult.data?.status !== "active" || recipientResult.data?.role !== "owner"
      || preferenceResult.data?.message_email_fallback_enabled === false) {
      await admin.from("ask_psi_email_jobs").update({
        completed_at: now,
        last_error_code: "message_context_unavailable",
        status: "cancelled",
        updated_at: now,
      }).eq("id", job.id);
      cancelled += 1;
      continue;
    }

    if (
      message.recipient_read_at
    ) {
      await admin.from("ask_psi_email_jobs").update({
        completed_at: now,
        last_error_code: "read_before_email_fallback",
        status: "cancelled",
        updated_at: now,
      }).eq("id", job.id);
      cancelled += 1;
      continue;
    }

    const [profileResult, vehicleResult] = await Promise.all([
      admin
        .from("customer_profiles")
        .select("email,first_name,last_name")
        .eq("user_id", conversation.customer_id)
        .single(),
      conversation.vehicle_id
        ? admin.from("customer_vehicles").select("registration").eq("id", conversation.vehicle_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const profile = profileResult.data;
    const customerDisplay = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ")
      || profile?.email
      || "Customer";
    // Recheck after preparing the email in case PSI opened the conversation.
    const { data: latestMessage, error: latestReadError } = await admin.from("ask_psi_messages")
      .select("recipient_read_at").eq("id", job.message_id).maybeSingle();
    if (latestReadError) {
      await admin.from("ask_psi_email_jobs").update({ status: "failed", last_error_code: "message_read_check_failed", available_at: new Date(Date.now() + 5 * 60_000).toISOString() }).eq("id", job.id).eq("status", "processing");
      continue;
    }
    if (!latestMessage || latestMessage.recipient_read_at) {
      await admin.from("ask_psi_email_jobs").update({ status: "cancelled", completed_at: now, last_error_code: "read_before_email_fallback" }).eq("id", job.id).eq("status", "processing");
      cancelled += 1;
      continue;
    }
    let result: { configured: boolean; sent: boolean };
    try {
      result = await sendMicrosoft365Fallback({ accessToken, customerDisplay, registration: vehicleResult.data?.registration ?? null });
    } catch {
      await admin.from("ask_psi_email_jobs").update({ status: "failed", last_error_code: "delivery_outcome_unknown", updated_at: now }).eq("id", job.id).eq("status", "processing");
      continue;
    }

    if (!result.configured) {
      await admin.from("ask_psi_email_jobs").update({
        available_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        last_error_code: "microsoft_365_not_configured",
        status: "blocked_configuration",
        updated_at: now,
      }).eq("id", job.id);
      continue;
    }

    await admin.from("ask_psi_email_jobs").update({
      available_at: result.sent ? now : new Date(Date.now() + 5 * 60_000).toISOString(),
      completed_at: result.sent ? now : null,
      last_error_code: result.sent ? null : "microsoft_graph_send_failed",
      provider_reference: result.sent ? `microsoft_graph:${job.id}` : null,
      status: result.sent ? "succeeded" : "failed",
      updated_at: now,
    }).eq("id", job.id);
    if (result.sent) sent += 1;
  }

  return json({ cancelled, processed: data?.length ?? 0, sent });
});
