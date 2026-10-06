import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const OWNER_EMAIL = "matt@psiperformance.com.au";
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
const normalizeEmail = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";
const isEmail = (value: string) => value.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const APP_STORE_URL = "https://apps.apple.com/au/app/psi-performance-garage/id6806902732";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.psiperformance.booking";

type InviteBody = { email?: unknown; workshopContactId?: unknown };
type ProfileRow = {
  first_name: string | null;
  last_name: string | null;
  mobile: string | null;
  user_id: string;
};

type WorkshopContact = {
  display_name: string;
  email: string | null;
  id: string;
  status: "active" | "archived" | "claimed";
};

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const cleanErrorCode = (value: unknown) => String(value instanceof Error ? value.message : value)
  .toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 160) || "invitation_email_failed";

function profileStatus(profile: ProfileRow | null) {
  return profile?.first_name?.trim() && profile.last_name?.trim() && profile.mobile?.trim()
    ? "profile_complete" as const
    : "pending_profile" as const;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "server_configuration_unavailable" }, 503);
  if (!token) return json({ error: "authentication_required" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "invalid_session" }, 401);

  const [{ data: claimsData, error: claimsError }, { data: staff, error: staffError }] = await Promise.all([
    userClient.auth.getClaims(token),
    userClient.from("staff_members").select("email,role,status").eq("user_id", userData.user.id).maybeSingle(),
  ]);
  if (claimsError || staffError) return json({ error: "staff_verification_unavailable" }, 503);
  if (
    claimsData?.claims?.aal !== "aal2"
    || staff?.status !== "active"
    || staff.role !== "owner"
    || normalizeEmail(staff.email) !== OWNER_EMAIL
    || normalizeEmail(userData.user.email) !== OWNER_EMAIL
  ) {
    return json({ error: "owner_aal2_required" }, 403);
  }

  let body: InviteBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const workshopContactId = isUuid(body.workshopContactId) ? body.workshopContactId : null;
  let workshopContact: WorkshopContact | null = null;
  if (body.workshopContactId !== undefined && !workshopContactId) {
    return json({ error: "invalid_workshop_contact" }, 400);
  }
  if (workshopContactId) {
    const { data, error } = await admin
      .from("workshop_contacts")
      .select("id,display_name,email,status")
      .eq("id", workshopContactId)
      .eq("status", "active")
      .maybeSingle();
    if (error) return json({ error: "workshop_contact_lookup_failed" }, 503);
    if (!data || !isEmail(normalizeEmail(data.email))) return json({ error: "workshop_contact_email_required" }, 409);
    workshopContact = data as WorkshopContact;
  }

  const requestedEmail = normalizeEmail(body.email);
  const email = workshopContact ? normalizeEmail(workshopContact.email) : requestedEmail;
  if (!isEmail(email)) return json({ error: "invalid_email" }, 400);
  if (workshopContact && requestedEmail && requestedEmail !== email) {
    return json({ error: "workshop_contact_email_mismatch" }, 409);
  }

  const { data: staffMatch, error: staffMatchError } = await admin
    .from("staff_members")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (staffMatchError) return json({ error: "staff_email_check_failed" }, 503);
  if (staffMatch) return json({ error: "staff_email_not_allowed" }, 409);

  let { data: existingProfile, error: profileError } = await admin
    .from("customer_profiles")
    .select("user_id,first_name,last_name,mobile")
    .eq("email", email)
    .maybeSingle();
  if (profileError) return json({ error: "customer_lookup_failed" }, 503);

  let authUserId = existingProfile?.user_id ?? null;
  let created = false;
  if (!authUserId) {
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createError) {
      return json({ error: createError.message.toLowerCase().includes("registered") ? "customer_already_approved" : "customer_creation_failed" }, createError.message.toLowerCase().includes("registered") ? 409 : 503);
    }
    if (!createdUser.user) return json({ error: "customer_creation_failed" }, 503);
    authUserId = createdUser.user.id;
    created = true;

    const { data: syncedProfile, error: syncedProfileError } = await admin
      .from("customer_profiles")
      .select("user_id,first_name,last_name,mobile")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (syncedProfileError) return json({ error: "customer_profile_sync_failed" }, 503);
    if (!syncedProfile) {
      const { data: insertedProfile, error: insertProfileError } = await admin
        .from("customer_profiles")
        .insert({ user_id: authUserId, email })
        .select("user_id,first_name,last_name,mobile")
        .single();
      if (insertProfileError) return json({ error: "customer_profile_sync_failed" }, 503);
      existingProfile = insertedProfile;
    } else {
      existingProfile = syncedProfile;
    }
  }

  const status = profileStatus(existingProfile as ProfileRow | null);
  const acceptedAt = status === "profile_complete" ? new Date().toISOString() : null;
  const invitedAt = new Date().toISOString();
  const { data: invitation, error: invitationError } = await admin
    .from("customer_invitations")
    .upsert({
      accepted_at: acceptedAt,
      auth_user_id: authUserId,
      email,
      email_delivery_status: "not_sent",
      email_last_error_code: null,
      email_provider_reference: null,
      email_sent_at: null,
      invited_at: invitedAt,
      invited_by: userData.user.id,
      status,
      updated_at: new Date().toISOString(),
      workshop_contact_id: workshopContactId,
    }, { onConflict: "email" })
    .select("id,email,status,invited_at,accepted_at,workshop_contact_id,email_delivery_status,email_sent_at,email_last_error_code")
    .single();
  if (invitationError) return json({ error: "invitation_record_failed" }, 503);

  if (status === "profile_complete") {
    return json({
      created,
      emailDelivery: { status: "not_required" },
      invitation,
      nextStep: "customer_ready",
    });
  }

  const apiKey = env("RESEND_API_KEY");
  const from = env("PSI_TRANSACTIONAL_FROM_EMAIL");
  const replyTo = env("PSI_OWNER_NOTIFICATION_EMAIL") || "info@psiperformance.com.au";
  if (!apiKey || !from) {
    const errorCode = "invitation_email_configuration_missing";
    const { data: failedInvitation } = await admin.from("customer_invitations").update({
      email_delivery_status: "failed",
      email_last_error_code: errorCode,
      updated_at: new Date().toISOString(),
    }).eq("id", invitation.id).select("id,email,status,invited_at,accepted_at,workshop_contact_id,email_delivery_status,email_sent_at,email_last_error_code").single();
    return json({
      created,
      emailDelivery: { errorCode, status: "failed" },
      invitation: failedInvitation ?? invitation,
      nextStep: "await_customer_setup",
    });
  }

  const customerName = workshopContact?.display_name?.trim() || "PSI customer";
  const safeName = escapeHtml(customerName);
  const subject = "Your PSI Performance Garage app invitation";
  const text = [
    `Hi ${customerName},`,
    "",
    "PSI Performance has invited you to access your private PSI Performance Garage app account.",
    "",
    `Apple App Store: ${APP_STORE_URL}`,
    `Google Play: ${PLAY_STORE_URL}`,
    "",
    "Install the app, open My Account, and use this exact email address to request your six digit sign in code:",
    email,
    "",
    "Complete your name and mobile number in the app. Any PSI workshop history and vehicles selected for this invitation will then connect to your account automatically.",
    "",
    "If you did not expect this invitation, reply to this email or contact PSI Performance on 0433 431 781.",
    "",
    "PSI Performance",
    "0433 431 781",
    "info@psiperformance.com.au",
    "https://psiperformance.com.au",
  ].join("\n");
  const html = `
    <p>Hi ${safeName},</p>
    <p>PSI Performance has invited you to access your private PSI Performance Garage app account.</p>
    <p><a href="${APP_STORE_URL}">Download for iPhone</a><br><a href="${PLAY_STORE_URL}">Download for Android</a></p>
    <p>Install the app, open <strong>My Account</strong>, and use this exact email address to request your six digit sign in code:</p>
    <p><strong>${escapeHtml(email)}</strong></p>
    <p>Complete your name and mobile number in the app. Any PSI workshop history and vehicles selected for this invitation will then connect to your account automatically.</p>
    <p>If you did not expect this invitation, reply to this email or contact PSI Performance on 0433 431 781.</p>
    <p>PSI Performance<br>0433 431 781<br><a href="mailto:info@psiperformance.com.au">info@psiperformance.com.au</a><br><a href="https://psiperformance.com.au">psiperformance.com.au</a></p>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `psi-app-invite-v1-${invitation.id}-${Date.parse(invitedAt)}`,
      },
      body: JSON.stringify({ from, to: [email], reply_to: replyTo, subject, html, text }),
    });
    const responseBody = await response.json().catch(() => ({})) as { id?: string };
    if (!response.ok || !responseBody.id) throw new Error(`resend_${response.status}`);
    const sentAt = new Date().toISOString();
    const { data: sentInvitation, error: sentUpdateError } = await admin.from("customer_invitations").update({
      email_delivery_status: "sent",
      email_last_error_code: null,
      email_provider_reference: responseBody.id,
      email_sent_at: sentAt,
      updated_at: sentAt,
    }).eq("id", invitation.id).select("id,email,status,invited_at,accepted_at,workshop_contact_id,email_delivery_status,email_sent_at,email_last_error_code").single();
    if (sentUpdateError) return json({ error: "invitation_delivery_record_failed" }, 503);
    return json({
      created,
      emailDelivery: { providerReference: responseBody.id, sentAt, status: "sent" },
      invitation: sentInvitation,
      nextStep: "await_customer_setup",
    });
  } catch (error) {
    const errorCode = cleanErrorCode(error);
    const { data: failedInvitation } = await admin.from("customer_invitations").update({
      email_delivery_status: "failed",
      email_last_error_code: errorCode,
      updated_at: new Date().toISOString(),
    }).eq("id", invitation.id).select("id,email,status,invited_at,accepted_at,workshop_contact_id,email_delivery_status,email_sent_at,email_last_error_code").single();
    return json({
      created,
      emailDelivery: { errorCode, status: "failed" },
      invitation: failedInvitation ?? invitation,
      nextStep: "await_customer_setup",
    });
  }
});
