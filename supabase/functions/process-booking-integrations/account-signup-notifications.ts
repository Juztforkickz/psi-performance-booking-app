import type { SupabaseClient } from "@supabase/supabase-js";

type SignupJob = {
  customer_id: string;
  attempt_count: number;
};

type SignupResult = {
  customerId: string;
  status: "succeeded" | "failed" | "blocked_configuration" | "skipped";
  errorCode?: string;
};

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const cleanErrorCode = (value: unknown) => String(value instanceof Error ? value.message : value)
  .toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 160) || "notification_failed";

const delayUntil = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

async function updateJob(admin: SupabaseClient, customerId: string, values: Record<string, unknown>) {
  const { error } = await admin.from("account_signup_notification_jobs")
    .update(values).eq("customer_id", customerId);
  if (error) throw new Error("signup_job_update_failed");
}

async function processJob(admin: SupabaseClient, queued: SignupJob): Promise<SignupResult> {
  const now = new Date().toISOString();
  const { data: job, error: claimError } = await admin.from("account_signup_notification_jobs")
    .update({ status: "processing", attempt_count: queued.attempt_count + 1, last_attempt_at: now, last_error_code: null })
    .eq("customer_id", queued.customer_id)
    .in("status", ["pending", "failed", "blocked_configuration"])
    .lt("attempt_count", 20)
    .lte("available_at", now)
    .select("customer_id, attempt_count")
    .maybeSingle();
  if (claimError) throw new Error("signup_job_claim_failed");
  if (!job) return { customerId: queued.customer_id, status: "skipped" };

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
    const from = Deno.env.get("PSI_TRANSACTIONAL_FROM_EMAIL")?.trim();
    const recipient = Deno.env.get("PSI_OWNER_NOTIFICATION_EMAIL")?.trim();
    if (!apiKey || !from || !recipient) {
      await updateJob(admin, job.customer_id, {
        status: "blocked_configuration",
        available_at: delayUntil(15),
        last_error_code: "signup_email_configuration_missing",
      });
      return { customerId: job.customer_id, status: "blocked_configuration", errorCode: "signup_email_configuration_missing" };
    }

    const [{ data: profile, error: profileError }, { data: vehicles, error: vehicleError }, { data: staff, error: staffError }, { data: total, error: countError }] = await Promise.all([
      admin.from("customer_profiles").select("email, first_name, last_name, mobile, account_state").eq("user_id", job.customer_id).maybeSingle(),
      admin.from("customer_vehicles").select("year, make, model, registration").eq("customer_id", job.customer_id).is("archived_at", null).order("created_at", { ascending: true }),
      admin.from("staff_members").select("id").eq("user_id", job.customer_id).eq("status", "active").maybeSingle(),
      admin.rpc("count_completed_customer_accounts"),
    ]);
    if (profileError || vehicleError || staffError || countError) throw new Error("signup_account_lookup_failed");
    if (!profile || staff || profile.account_state !== "active" || !profile.first_name?.trim() || !profile.last_name?.trim() || !profile.mobile?.trim() || !vehicles?.length) {
      await updateJob(admin, job.customer_id, {
        status: "failed", available_at: delayUntil(15), last_error_code: "signup_account_incomplete",
      });
      return { customerId: job.customer_id, status: "failed", errorCode: "signup_account_incomplete" };
    }

    const name = `${profile.first_name.trim()} ${profile.last_name.trim()}`.replace(/[\r\n]+/g, " ");
    const vehicleLabels = vehicles.map((vehicle) => `${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.registration})`);
    const count = Number(total ?? 0);
    const lines = [
      "A customer has completed their PSI Performance Garage account.",
      "",
      `Name: ${name}`,
      `Email: ${profile.email}`,
      `Mobile: ${profile.mobile}`,
      `Vehicle${vehicleLabels.length === 1 ? "" : "s"}: ${vehicleLabels.join("; ")}`,
      "",
      `Current completed customer accounts: ${count}`,
      "This is an account count, not an App Store download count.",
    ];
    const html = `<p>${lines.filter(Boolean).map(escapeHtml).join("</p><p>")}</p>`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `psi-account-signup-v1-${job.customer_id}`,
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        reply_to: profile.email,
        subject: `New PSI customer account: ${name}`,
        html,
        text: lines.join("\n"),
      }),
    });
    const body = await response.json().catch(() => ({})) as { id?: string };
    if (!response.ok || !body.id) throw new Error(`resend_${response.status}`);

    await updateJob(admin, job.customer_id, {
      status: "succeeded", completed_at: new Date().toISOString(), provider_reference: body.id, last_error_code: null,
    });
    return { customerId: job.customer_id, status: "succeeded" };
  } catch (error) {
    const errorCode = cleanErrorCode(error);
    await updateJob(admin, job.customer_id, {
      status: "failed", available_at: delayUntil(5), last_error_code: errorCode,
    });
    return { customerId: job.customer_id, status: "failed", errorCode };
  }
}

export async function processAccountSignupNotifications(admin: SupabaseClient, limit: number) {
  const { data: jobs, error } = await admin.from("account_signup_notification_jobs")
    .select("customer_id, attempt_count")
    .in("status", ["pending", "failed", "blocked_configuration"])
    .lte("available_at", new Date().toISOString())
    .lt("attempt_count", 20)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error("signup_queue_unavailable");

  const results: SignupResult[] = [];
  for (const job of (jobs ?? []) as SignupJob[]) results.push(await processJob(admin, job));
  return { processed: results.filter((result) => result.status !== "skipped").length, results };
}
