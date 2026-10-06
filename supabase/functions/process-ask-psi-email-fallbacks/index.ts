import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

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
  sender_kind: string;
};

async function acquireMicrosoftGraphToken() {
  const tenantId = env("MICROSOFT_365_TENANT_ID");
  const clientId = env("MICROSOFT_365_CLIENT_ID");
  const clientSecret = env("MICROSOFT_365_CLIENT_SECRET");
  if (!tenantId || !clientId || !clientSecret) return null;

  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
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
            ].join(""),
          },
          toRecipients: [{ emailAddress: { address: recipient } }],
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
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("ask_psi_email_jobs")
    .select("id,conversation_id,message_id,recipient_user_id,attempt_count")
    .in("status", ["pending", "failed", "blocked_configuration"])
    .lte("available_at", now)
    .lt("attempt_count", 20)
    .order("created_at", { ascending: true })
    .limit(10);
  if (error) return json({ error: "message_email_queue_unavailable" }, 503);

  const accessToken = await acquireMicrosoftGraphToken();
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

    const [conversationResult, messageResult] = await Promise.all([
      admin
        .from("ask_psi_conversations")
        .select("id,customer_id,vehicle_id,staff_last_read_at")
        .eq("id", job.conversation_id)
        .single(),
      admin
        .from("ask_psi_messages")
        .select("id,created_at,sender_kind")
        .eq("id", job.message_id)
        .single(),
    ]);
    const conversation = conversationResult.data as ConversationRow | null;
    const message = messageResult.data as MessageRow | null;
    if (!conversation || !message || message.sender_kind !== "customer") {
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
      conversation.staff_last_read_at
      && new Date(conversation.staff_last_read_at).getTime() >= new Date(message.created_at).getTime()
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

    if (!accessToken) {
      await admin.from("ask_psi_email_jobs").update({
        available_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        last_error_code: "microsoft_365_not_configured",
        status: "blocked_configuration",
        updated_at: now,
      }).eq("id", job.id);
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
    const result = await sendMicrosoft365Fallback({
      accessToken,
      customerDisplay,
      registration: vehicleResult.data?.registration ?? null,
    });

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
