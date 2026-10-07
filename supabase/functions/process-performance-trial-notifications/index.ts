import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TORI_SIGNATURE_BANNER_BASE64 } from "./tori-signature-banner.ts";

const OWNER_EMAIL = "matt@psiperformance.com.au";
const APP_STORE_URL = "https://apps.apple.com/au/app/psi-performance-garage/id6806902732";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.psiperformance.booking";
const TORI_BANNER_SHA256 = "c7a33dbd43daa2bdfc0eef4e629bcb8385938465d672d88921b15c046c3ac1b2";
const TORI_BANNER_CONTENT_ID = "psi-tori-laurent-signature";

const cors = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-psi-cron-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};
const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { ...cors, "Cache-Control": "no-store" },
});
const env = (name: string) => Deno.env.get(name)?.trim() ?? "";
const escapeHtml = (value: string | null | undefined) => (value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const cleanErrorCode = (value: unknown, fallback = "notification_failed") => {
  const raw = value instanceof Error ? value.message : String(value ?? fallback);
  return (raw.toLowerCase().replace(/[^a-z0-9_-]+/gu, "_").replace(/^_+|_+$/gu, "") || fallback).slice(0, 160);
};
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

type ExpiryJob = {
  attempt_count: number;
  customer_id: string;
  email_delivery_status: "blocked_configuration" | "failed" | "pending" | "sent";
  id: string;
  in_app_event_id: string | null;
  push_delivery_status: "failed" | "not_registered" | "sent" | null;
  trial_expires_at: string;
  trial_subscription_id: string;
};

type DeliveryResult = {
  customerId: string;
  errorCode?: string;
  status: "blocked_configuration" | "cancelled" | "failed" | "skipped" | "succeeded";
};

function decodeBase64(value: string) {
  const decoded = atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

async function bannerIsApproved() {
  if (TORI_SIGNATURE_BANNER_BASE64.length < 100_000) return false;
  const digest = await crypto.subtle.digest("SHA-256", decodeBase64(TORI_SIGNATURE_BANNER_BASE64));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("") === TORI_BANNER_SHA256;
}

async function updateJob(admin: SupabaseClient, jobId: string, values: Record<string, unknown>) {
  const { error } = await admin.from("performance_trial_expiry_notification_jobs").update(values).eq("id", jobId);
  if (error) throw new Error("trial_notification_job_update_failed");
}

async function createInAppEvent(admin: SupabaseClient, job: ExpiryJob) {
  if (job.in_app_event_id) return job.in_app_event_id;
  const sourceKey = `performance_trial_ended:${job.customer_id}`;
  const payload = {
    recipient_user_id: job.customer_id,
    booking_request_id: null,
    kind: "performance_trial_ended",
    title: "Your Performance+ access has ended",
    body: "Keep your complete PSI vehicle history, documents, reminders and upcoming work organised in one place. Continue from only $9.99 AUD per month.",
    deep_link: "/performance-plus",
    source_event_key: sourceKey,
  };
  const { data: created, error: createError } = await admin.from("notification_events")
    .upsert(payload, { onConflict: "source_event_key", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();
  if (createError) throw new Error("trial_in_app_notification_failed");
  if (created?.id) return created.id as string;
  const { data: existing, error: existingError } = await admin.from("notification_events")
    .select("id").eq("source_event_key", sourceKey).maybeSingle();
  if (existingError || !existing?.id) throw new Error("trial_in_app_notification_missing");
  return existing.id as string;
}

async function sendPush(admin: SupabaseClient, job: ExpiryJob) {
  if (job.push_delivery_status === "sent" || job.push_delivery_status === "not_registered") {
    return { providerReference: null, status: job.push_delivery_status } as const;
  }
  const [{ data: devices, error: deviceError }, { data: preference, error: preferenceError }, { count }] = await Promise.all([
    admin.from("push_devices").select("expo_push_token").eq("user_id", job.customer_id).eq("enabled", true),
    admin.from("notification_preferences").select("sound_enabled").eq("user_id", job.customer_id).maybeSingle(),
    admin.from("notification_events").select("id", { count: "exact", head: true }).eq("recipient_user_id", job.customer_id).is("read_at", null),
  ]);
  if (deviceError || preferenceError) throw new Error("trial_push_configuration_unavailable");
  if (!devices?.length) return { providerReference: null, status: "not_registered" } as const;

  const messages = devices.map((device) => ({
    to: device.expo_push_token,
    title: "Your Performance+ access has ended",
    subtitle: "PSI Performance Garage",
    body: "Keep your complete vehicle history within reach. Continue Performance+ from only $9.99 AUD per month.",
    data: {
      kind: "performance_trial_ended",
      sourceEventKey: `performance_trial_ended:${job.customer_id}`,
      url: "/performance-plus",
    },
    badge: count ?? 1,
    sound: preference?.sound_enabled === false ? null : "default",
    channelId: "psi-customer",
    priority: "high",
  }));
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });
  const result = await response.json().catch(() => null) as {
    data?: Array<{ id?: string; status?: string; details?: { error?: string } }> | { id?: string; status?: string; details?: { error?: string } };
  } | null;
  const tickets = Array.isArray(result?.data) ? result.data : result?.data ? [result.data] : [];
  for (let index = 0; index < tickets.length; index += 1) {
    if (tickets[index]?.details?.error === "DeviceNotRegistered") {
      await admin.from("push_devices").update({ enabled: false, updated_at: new Date().toISOString() })
        .eq("expo_push_token", messages[index]?.to);
    }
  }
  const successful = tickets.filter((ticket) => ticket.status === "ok");
  if (!response.ok || successful.length === 0) throw new Error("trial_push_delivery_failed");
  return {
    providerReference: successful.map((ticket) => ticket.id).filter(Boolean).join(",").slice(0, 1000) || null,
    status: "sent",
  } as const;
}

function emailContent(firstName: string) {
  const greeting = firstName || "PSI customer";
  const subject = "Your PSI vehicle history is worth keeping close";
  const text = [
    `Hi ${greeting},`,
    "",
    "Your complimentary 14 day Performance+ access has now ended.",
    "",
    "Your vehicle history becomes more valuable with every service, repair and improvement. Performance+ keeps that history organised and accessible, so you are never searching through old emails, invoices or folders when you need important information.",
    "",
    "Continue Performance+ to keep:",
    "• PSI service history and workshop records together",
    "• Dyno results, reports, invoices and saved photos easy to access",
    "• Upcoming service and repair reminders visible without checking manually",
    "• Every vehicle on your PSI account covered by one subscription",
    "• A clear history ready when it is time to maintain, improve or sell your vehicle",
    "",
    "From $9.99 AUD per month or $99 AUD per year, Performance+ gives you ongoing access to the information behind your vehicle and the work PSI has completed.",
    "",
    `Continue on iPhone: ${APP_STORE_URL}`,
    `Continue on Android: ${PLAY_STORE_URL}`,
    "",
    "Kind regards,",
    "Tori Laurent",
    "Authorised assistant for Matthew Ebert",
    "PSI Performance",
    "0433 431 781",
    "info@psiperformance.com.au",
    "psiperformance.com.au",
  ].join("\n");
  const html = `<div style="background:#050505;color:#f4f4f4;font-family:Arial,sans-serif;padding:28px"><div style="max-width:620px;margin:auto;border:1px solid #333;background:#121212;padding:26px"><div style="color:#65CFF8;font-size:12px;font-weight:700;letter-spacing:2px">PSI PERFORMANCE+</div><h1 style="font-size:26px;line-height:1.2;margin:12px 0 18px">Your vehicle history deserves more than a folder of old invoices</h1><p>Hi ${escapeHtml(greeting)},</p><p style="line-height:1.65">Your complimentary 14 day Performance+ access has now ended.</p><p style="line-height:1.65">Your vehicle history becomes more valuable with every service, repair and improvement. Performance+ keeps that history organised and accessible, so you are never searching through old emails, invoices or folders when you need important information.</p><p style="font-weight:700;margin-top:22px">Continue Performance+ to keep:</p><ul style="line-height:1.75;padding-left:20px"><li>PSI service history and workshop records together</li><li>Dyno results, reports, invoices and saved photos easy to access</li><li>Upcoming service and repair reminders visible without checking manually</li><li>Every vehicle on your PSI account covered by one subscription</li><li>A clear history ready when it is time to maintain, improve or sell your vehicle</li></ul><p style="line-height:1.65"><strong>From $9.99 AUD per month or $99 AUD per year.</strong> Keep the full story of your vehicle organised, protected and available in the palm of your hand.</p><p style="margin:24px 0"><a href="${APP_STORE_URL}" style="background:#65CFF8;color:#050505;display:inline-block;font-weight:700;padding:13px 18px;text-decoration:none;margin:0 8px 8px 0">Continue on iPhone</a><a href="${PLAY_STORE_URL}" style="border:1px solid #65CFF8;color:#65CFF8;display:inline-block;font-weight:700;padding:12px 18px;text-decoration:none;margin-bottom:8px">Continue on Android</a></p><p style="line-height:1.6">Kind regards,<br><strong>Tori Laurent</strong><br>Authorised assistant for Matthew Ebert</p><img src="cid:${TORI_BANNER_CONTENT_ID}" alt="PSI Performance. Tori Laurent. Authorised assistant for Matthew Ebert. Workshop contacts: 0433 431 781; info@psiperformance.com.au; psiperformance.com.au." width="452" height="226" style="display:block;width:100%;max-width:452px;height:auto;border:0;margin-top:18px"></div></div>`;
  return { html, subject, text };
}

async function sendEmail(profile: { email: string; first_name: string | null }, job: ExpiryJob) {
  if (job.email_delivery_status === "sent") return null;
  const apiKey = env("RESEND_API_KEY");
  const from = env("PSI_TRANSACTIONAL_FROM_EMAIL");
  const replyTo = env("PSI_OWNER_NOTIFICATION_EMAIL") || "info@psiperformance.com.au";
  if (!apiKey || !from || !(await bannerIsApproved())) throw new Error("trial_email_configuration_missing");
  const content = emailContent(profile.first_name?.trim() || "");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `psi-performance-trial-ended-v1-${job.id}`,
    },
    body: JSON.stringify({
      from,
      to: [profile.email],
      reply_to: replyTo,
      subject: content.subject,
      html: content.html,
      text: content.text,
      attachments: [{
        content: TORI_SIGNATURE_BANNER_BASE64,
        filename: "PSI-Tori-Laurent-authorised-assistant.jpg",
        content_id: TORI_BANNER_CONTENT_ID,
        content_type: "image/jpeg",
      }],
    }),
  });
  const responseBody = await response.json().catch(() => ({})) as { id?: string };
  if (!response.ok || !responseBody.id) throw new Error(`resend_${response.status}`);
  return responseBody.id;
}

async function processJob(admin: SupabaseClient, queued: ExpiryJob): Promise<DeliveryResult> {
  const now = new Date().toISOString();
  const { data: job, error: claimError } = await admin.from("performance_trial_expiry_notification_jobs")
    .update({
      status: "processing",
      attempt_count: queued.attempt_count + 1,
      last_attempt_at: now,
      last_error_code: null,
      updated_at: now,
    })
    .eq("id", queued.id)
    .in("status", ["pending", "failed", "blocked_configuration"])
    .lte("available_at", now)
    .lt("attempt_count", 20)
    .select("id,customer_id,trial_subscription_id,trial_expires_at,attempt_count,in_app_event_id,push_delivery_status,email_delivery_status")
    .maybeSingle();
  if (claimError) throw new Error("trial_notification_job_claim_failed");
  if (!job) return { customerId: queued.customer_id, status: "skipped" };
  const claimed = job as ExpiryJob;

  try {
    const [{ data: profile, error: profileError }, { data: staff, error: staffError }, { data: trial, error: trialError }, { data: subscriptions, error: subscriptionError }] = await Promise.all([
      admin.from("customer_profiles").select("email,first_name,account_state,created_at").eq("user_id", claimed.customer_id).maybeSingle(),
      admin.from("staff_members").select("id").eq("user_id", claimed.customer_id).eq("status", "active").maybeSingle(),
      admin.from("performance_subscriptions").select("id,provider,provider_reference,environment,expires_at,is_permanent").eq("id", claimed.trial_subscription_id).maybeSingle(),
      admin.from("performance_subscriptions").select("id,provider,provider_reference,environment,status,expires_at,is_permanent").eq("customer_id", claimed.customer_id).eq("environment", "production").in("status", ["active", "grace_period"]),
    ]);
    if (profileError || staffError || trialError || subscriptionError) throw new Error("trial_notification_account_lookup_failed");
    const email = profile?.email?.trim().toLowerCase() ?? "";
    const trialExpired = Boolean(trial
      && trial.provider === "complimentary"
      && trial.provider_reference === `trial:${claimed.customer_id}`
      && trial.environment === "production"
      && !trial.is_permanent
      && trial.expires_at
      && Date.parse(trial.expires_at) <= Date.now());
    const otherAccess = (subscriptions ?? []).some((subscription) => subscription.id !== claimed.trial_subscription_id
      && (subscription.is_permanent || (subscription.expires_at && Date.parse(subscription.expires_at) > Date.now())));
    if (!profile || profile.account_state !== "active" || staff || email === OWNER_EMAIL || !trialExpired || otherAccess) {
      await updateJob(admin, claimed.id, {
        status: "cancelled",
        completed_at: now,
        last_error_code: otherAccess ? "performance_plus_already_active" : "customer_not_eligible",
      });
      return { customerId: claimed.customer_id, status: "cancelled" };
    }

    const eventId = await createInAppEvent(admin, claimed);
    await updateJob(admin, claimed.id, { in_app_event_id: eventId });

    const push = await sendPush(admin, claimed);
    await updateJob(admin, claimed.id, {
      push_delivery_status: push.status,
      push_provider_reference: push.providerReference,
    });

    let emailProviderReference: string | null = null;
    try {
      emailProviderReference = await sendEmail(profile, claimed);
    } catch (error) {
      const errorCode = cleanErrorCode(error);
      const blocked = errorCode === "trial_email_configuration_missing";
      await updateJob(admin, claimed.id, {
        status: blocked ? "blocked_configuration" : "failed",
        email_delivery_status: blocked ? "blocked_configuration" : "failed",
        available_at: new Date(Date.now() + (blocked ? 15 : 5) * 60_000).toISOString(),
        last_error_code: errorCode,
      });
      return { customerId: claimed.customer_id, errorCode, status: blocked ? "blocked_configuration" : "failed" };
    }

    await updateJob(admin, claimed.id, {
      status: "succeeded",
      completed_at: new Date().toISOString(),
      email_delivery_status: "sent",
      email_provider_reference: emailProviderReference,
      last_error_code: null,
    });
    return { customerId: claimed.customer_id, status: "succeeded" };
  } catch (error) {
    const errorCode = cleanErrorCode(error);
    await updateJob(admin, claimed.id, {
      status: "failed",
      available_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      last_error_code: errorCode,
      push_delivery_status: errorCode.startsWith("trial_push_") ? "failed" : claimed.push_delivery_status,
    });
    return { customerId: claimed.customer_id, errorCode, status: "failed" };
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/iu, "");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "server_configuration_unavailable" }, 503);
  if (!accessToken) return json({ error: "authentication_required" }, 401);

  let body: { action?: unknown; limit?: unknown } = {};
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (body.action !== "process_queue") return json({ error: "unsupported_action" }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const cronToken = request.headers.get("x-psi-cron-token")?.trim() ?? "";
  let validCronToken = false;
  if (cronToken) {
    const verified = await admin.rpc("verify_service_reminder_cron_token", { p_token: cronToken });
    validCronToken = !verified.error && verified.data === true;
  }
  if (!(validCronToken || accessToken === serviceRoleKey || isProjectServiceRoleToken(accessToken, supabaseUrl))) {
    return json({ error: "internal_access_required" }, 403);
  }

  const requestedLimit = typeof body.limit === "number" && Number.isFinite(body.limit) ? Math.trunc(body.limit) : 10;
  const limit = Math.min(25, Math.max(1, requestedLimit));
  const { data: jobs, error: jobsError } = await admin.from("performance_trial_expiry_notification_jobs")
    .select("id,customer_id,trial_subscription_id,trial_expires_at,attempt_count,in_app_event_id,push_delivery_status,email_delivery_status")
    .in("status", ["pending", "failed", "blocked_configuration"])
    .lte("available_at", new Date().toISOString())
    .lt("attempt_count", 20)
    .order("available_at", { ascending: true })
    .limit(limit);
  if (jobsError) return json({ error: "trial_notification_queue_unavailable" }, 500);

  const results: DeliveryResult[] = [];
  for (const job of (jobs ?? []) as ExpiryJob[]) results.push(await processJob(admin, job));
  return json({
    processed: results.filter((result) => result.status !== "skipped").length,
    results,
  });
});
