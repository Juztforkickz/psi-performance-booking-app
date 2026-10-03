import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { ...cors, "Cache-Control": "no-store" } });
const env = (name: string) => Deno.env.get(name)?.trim() ?? "";
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
const escapeHtml = (value: string | null | undefined) => (value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const cleanErrorCode = (value: unknown, fallback = "provider_error") => {
  const raw = value instanceof Error ? value.message : String(value ?? fallback);
  return (raw.toLowerCase().replace(/[^a-z0-9_-]+/gu, "_").replace(/^_+|_+$/gu, "") || fallback).slice(0, 160);
};

type EmailJob = {
  attempt_count: number;
  id: string;
  listing_id: string;
  recipient_user_id: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/iu, "");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "server_configuration_unavailable" }, 503);
  if (!token) return json({ error: "authentication_required" }, 401);

  let body: { listingId?: unknown } = {};
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!isUuid(body.listingId)) return json({ error: "invalid_listing_id" }, 400);

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "invalid_session" }, 401);
  const [{ data: staff }, { data: claims }] = await Promise.all([
    userClient.from("staff_members").select("id").eq("user_id", userData.user.id).eq("status", "active").maybeSingle(),
    userClient.auth.getClaims(token),
  ]);
  if (!staff || claims?.claims?.aal !== "aal2") return json({ error: "aal2_staff_access_required" }, 403);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: listing, error: listingError } = await admin
    .from("customer_car_listings")
    .select("id,title,registration,asking_price_cents,kilometres,transmission,status")
    .eq("id", body.listingId)
    .maybeSingle();
  if (listingError) return json({ error: "listing_unavailable" }, 500);
  if (!listing || !["published", "under_offer"].includes(listing.status)) return json({ error: "listing_not_published" }, 409);

  const { data: jobs, error: jobsError } = await admin
    .from("car_sale_email_jobs")
    .select("id,listing_id,recipient_user_id,attempt_count")
    .eq("listing_id", body.listingId)
    .in("status", ["pending", "failed", "blocked_configuration"])
    .lte("available_at", new Date().toISOString())
    .lt("attempt_count", 20)
    .order("created_at", { ascending: true })
    .limit(100);
  if (jobsError) return json({ error: "email_queue_unavailable" }, 500);

  const apiKey = env("RESEND_API_KEY");
  const from = env("PSI_TRANSACTIONAL_FROM_EMAIL");
  const replyTo = env("PSI_OWNER_NOTIFICATION_EMAIL") || "info@psiperformance.com.au";
  let sent = 0;
  let cancelled = 0;
  let failed = 0;

  for (const queued of (jobs ?? []) as EmailJob[]) {
    const now = new Date().toISOString();
    const { data: claimed } = await admin.from("car_sale_email_jobs").update({
      status: "processing",
      attempt_count: queued.attempt_count + 1,
      last_attempt_at: now,
      updated_at: now,
    }).eq("id", queued.id).in("status", ["pending", "failed", "blocked_configuration"]).select("id").maybeSingle();
    if (!claimed) continue;

    const [{ data: profile }, { data: preference }] = await Promise.all([
      admin.from("customer_profiles").select("email,first_name,account_state").eq("user_id", queued.recipient_user_id).maybeSingle(),
      admin.from("notification_preferences").select("car_sale_emails_enabled").eq("user_id", queued.recipient_user_id).maybeSingle(),
    ]);
    if (!profile || profile.account_state !== "active" || preference?.car_sale_emails_enabled !== true) {
      await admin.from("car_sale_email_jobs").update({ status: "cancelled", completed_at: now, last_error_code: "email_preference_disabled", updated_at: now }).eq("id", queued.id);
      cancelled += 1;
      continue;
    }
    if (!apiKey || !from) {
      await admin.from("car_sale_email_jobs").update({ status: "blocked_configuration", available_at: new Date(Date.now() + 15 * 60_000).toISOString(), last_error_code: "email_configuration_missing", updated_at: now }).eq("id", queued.id);
      failed += 1;
      continue;
    }

    const customerName = profile.first_name?.trim() || "PSI customer";
    const price = `${new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(listing.asking_price_cents / 100)} AUD`;
    const kilometres = `${new Intl.NumberFormat("en-AU").format(listing.kilometres)} km`;
    const subject = `New customer car for sale at PSI: ${listing.title}`;
    const message = `${listing.title} is now available through Customer Cars for Sale in the PSI app.`;
    const text = `Hi ${customerName},\n\n${message}\n\nPrice: ${price}\nKilometres: ${kilometres}\nTransmission: ${listing.transmission}\nReference: ${listing.registration}\n\nOpen the PSI app and choose Customer Cars for Sale to view the listing or enquire.\n\nTo stop Customer Cars for Sale emails, turn off Cars for Sale emails in PSI Settings, or reply to this email with Unsubscribe in the subject line.\n\nPSI Performance\n21 Exchange Drive, Pakenham VIC 3810\n0433 431 781\ninfo@psiperformance.com.au`;
    const html = `<div style="background:#050505;color:#f4f4f4;font-family:Arial,sans-serif;padding:28px"><div style="max-width:620px;margin:auto;border:1px solid #333;background:#121212;padding:26px"><div style="color:#65CFF8;font-size:12px;font-weight:700;letter-spacing:2px">PSI PERFORMANCE</div><h1 style="font-size:24px;margin:12px 0 18px">New customer car for sale</h1><p>Hi ${escapeHtml(customerName)},</p><p style="line-height:1.6">${escapeHtml(message)}</p><div style="border-top:1px solid #333;margin-top:22px;padding-top:18px;line-height:1.8"><strong>${escapeHtml(listing.title)}</strong><br>Price: ${escapeHtml(price)}<br>Kilometres: ${escapeHtml(kilometres)}<br>Transmission: ${escapeHtml(listing.transmission)}<br>Reference: ${escapeHtml(listing.registration)}</div><p style="line-height:1.6">Open the PSI app and choose Customer Cars for Sale to view the listing or enquire.</p><p style="border-top:1px solid #333;color:#b7b7b7;font-size:12px;line-height:1.6;margin-top:24px;padding-top:18px">To stop Customer Cars for Sale emails, turn off Cars for Sale emails in PSI Settings, or reply to this email with Unsubscribe in the subject line.</p><p style="color:#b7b7b7;font-size:12px;line-height:1.6">PSI Performance<br>21 Exchange Drive, Pakenham VIC 3810<br>0433 431 781<br>info@psiperformance.com.au</p></div></div>`;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `psi-car-sale-${queued.id}` },
        body: JSON.stringify({ from, to: [profile.email], reply_to: replyTo, subject, html, text }),
      });
      const responseBody = await response.json().catch(() => ({})) as { id?: string };
      if (!response.ok || !responseBody.id) throw new Error(`resend_${response.status}`);
      await admin.from("car_sale_email_jobs").update({ status: "succeeded", completed_at: now, provider_reference: responseBody.id, last_error_code: null, updated_at: now }).eq("id", queued.id);
      sent += 1;
    } catch (error) {
      await admin.from("car_sale_email_jobs").update({ status: "failed", available_at: new Date(Date.now() + 5 * 60_000).toISOString(), last_error_code: cleanErrorCode(error), updated_at: now }).eq("id", queued.id);
      failed += 1;
    }
  }

  return json({ processed: jobs?.length ?? 0, sent, cancelled, failed });
});
