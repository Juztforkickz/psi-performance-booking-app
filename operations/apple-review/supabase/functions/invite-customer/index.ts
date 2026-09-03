// ISOLATED APPLE REVIEW ONLY. Never deploy to the live project.
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const OWNER_EMAIL = "psiappreview+staff@gmail.com";
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

type InviteBody = { email?: unknown };
type ProfileRow = {
  first_name: string | null;
  last_name: string | null;
  mobile: string | null;
  user_id: string;
};

function profileStatus(profile: ProfileRow | null) {
  return profile?.first_name?.trim() && profile.last_name?.trim() && profile.mobile?.trim()
    ? "profile_complete" as const
    : "pending_profile" as const;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = env("SUPABASE_URL");
  if (supabaseUrl !== "https://jwikoldibbpxyhbdrsow.supabase.co") return json({ error: "review_project_required" }, 503);
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
  const reviewAccess = await userClient.rpc("apple_review_staff_access");
  if (reviewAccess.error || reviewAccess.data !== true) return json({ error: "review_staff_required" }, 403);

  const [{ data: claimsData, error: claimsError }, { data: staff, error: staffError }] = await Promise.all([
    userClient.auth.getClaims(token),
    userClient.from("staff_members").select("email,role,status").eq("user_id", userData.user.id).maybeSingle(),
  ]);
  if (claimsError || staffError) return json({ error: "staff_verification_unavailable" }, 503);
  if (
    !["aal1", "aal2"].includes(String(claimsData?.claims?.aal))
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
  const email = normalizeEmail(body.email);
  if (!isEmail(email)) return json({ error: "invalid_email" }, 400);
  if (!/^demo[1-5]@example\.invalid$/.test(email) && !["psiappreview@gmail.com", "psiappreview+isolation@gmail.com"].includes(email)) {
    return json({ error: "review_invites_use_demo1_to_demo5_at_example_invalid" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
  const { data: invitation, error: invitationError } = await admin
    .from("customer_invitations")
    .upsert({
      accepted_at: acceptedAt,
      auth_user_id: authUserId,
      email,
      invited_at: new Date().toISOString(),
      invited_by: userData.user.id,
      status,
      updated_at: new Date().toISOString(),
    }, { onConflict: "email" })
    .select("id,email,status,invited_at,accepted_at")
    .single();
  if (invitationError) return json({ error: "invitation_record_failed" }, 503);

  return json({
    created,
    invitation,
    nextStep: "send_testflight_invitation",
  });
});
