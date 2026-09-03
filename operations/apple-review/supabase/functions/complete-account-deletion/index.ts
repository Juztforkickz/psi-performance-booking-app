// ISOLATED APPLE REVIEW ONLY. Never deploy to the live project.
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const OWNER_EMAIL = "psiappreview+staff@gmail.com";
const PRIVATE_BUCKETS = ["vehicle-photos", "vehicle-documents"] as const;
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
const isUuid = (value: unknown): value is string => typeof value === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

type CompletionBody = {
  confirmationEmail?: unknown;
  retentionReviewConfirmed?: unknown;
  staffNote?: unknown;
  userId?: unknown;
};

type ListedStorageEntry = {
  id: string | null;
  metadata: Record<string, unknown> | null;
  name: string;
};

async function listStoragePaths(admin: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error("storage_list_failed");
    const entries = (data ?? []) as ListedStorageEntry[];
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id || entry.metadata) paths.push(path);
      else paths.push(...await listStoragePaths(admin, bucket, path));
    }
    if (entries.length < 1000) break;
    offset += entries.length;
  }
  return paths;
}

async function removePrivateStorage(admin: SupabaseClient, userId: string) {
  let removed = 0;
  for (const bucket of PRIVATE_BUCKETS) {
    const paths = await listStoragePaths(admin, bucket, userId);
    for (let index = 0; index < paths.length; index += 1000) {
      const batch = paths.slice(index, index + 1000);
      if (!batch.length) continue;
      const { data, error } = await admin.storage.from(bucket).remove(batch);
      if (error) throw new Error("storage_remove_failed");
      removed += data?.length ?? batch.length;
    }
  }
  return removed;
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

  let body: CompletionBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!isUuid(body.userId)) return json({ error: "invalid_customer_id" }, 400);
  if (body.userId === userData.user.id) return json({ error: "staff_identity_cannot_be_deleted" }, 403);
  if (body.retentionReviewConfirmed !== true) return json({ error: "retention_review_required" }, 400);
  const confirmationEmail = normalizeEmail(body.confirmationEmail);
  const staffNote = typeof body.staffNote === "string" ? body.staffNote.trim().slice(0, 500) : "";

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [{ data: targetAuth, error: targetAuthError }, { data: targetStaff, error: targetStaffError }, { data: deletionRequest, error: requestError }] = await Promise.all([
    admin.auth.admin.getUserById(body.userId),
    admin.from("staff_members").select("user_id").eq("user_id", body.userId).eq("status", "active").maybeSingle(),
    admin.from("account_deletion_requests").select("user_id,status").eq("user_id", body.userId).maybeSingle(),
  ]);
  if (targetAuthError || !targetAuth.user?.email) return json({ error: "customer_identity_not_found" }, 404);
  if (targetStaffError || requestError) return json({ error: "deletion_verification_unavailable" }, 503);
  if (targetStaff) return json({ error: "staff_identity_cannot_be_deleted" }, 403);
  if (!deletionRequest || !["requested", "in_review"].includes(deletionRequest.status)) {
    return json({ error: "active_deletion_request_required" }, 409);
  }
  if (!confirmationEmail || confirmationEmail !== normalizeEmail(targetAuth.user.email)) {
    return json({ error: "confirmation_email_mismatch" }, 400);
  }

  const { error: beginError } = await admin.rpc("begin_customer_account_deletion", {
    p_completed_by: userData.user.id,
    p_staff_note: staffNote || null,
    p_user_id: body.userId,
  });
  if (beginError) return json({ error: "deletion_lock_failed" }, 503);

  let storageObjectsRemoved = 0;
  try {
    storageObjectsRemoved = await removePrivateStorage(admin, body.userId);
  } catch {
    return json({ error: "private_storage_cleanup_failed", retryRequired: true }, 503);
  }

  const { data: databaseSummary, error: dataError } = await admin.rpc("complete_customer_account_data", {
    p_completed_by: userData.user.id,
    p_user_id: body.userId,
  });
  if (dataError) return json({ error: "customer_data_cleanup_failed", retryRequired: true }, 503);

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(body.userId);
  if (authDeleteError) return json({ error: "auth_identity_cleanup_failed", retryRequired: true }, 503);

  const { data: completion, error: finishError } = await admin.rpc("finish_customer_account_deletion", {
    p_completed_by: userData.user.id,
    p_user_id: body.userId,
  });

  return json({
    auditWarning: Boolean(finishError),
    completed: true,
    completion: finishError ? null : completion,
    databaseSummary,
    storageObjectsRemoved,
  });
});
