import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type JobKind =
  | "notify_psi_request_received"
  | "notify_customer_request_received"
  | "notify_customer_date_proposed"
  | "notify_customer_date_approved"
  | "notify_customer_cancelled"
  | "notify_psi_booking_confirmed"
  | "notify_customer_booking_confirmed"
  | "sync_google_calendar_confirmed";

type JobStatus =
  | "pending"
  | "processing"
  | "blocked_configuration"
  | "succeeded"
  | "failed"
  | "cancelled";

type IntegrationJob = {
  id: string;
  booking_request_id: string;
  customer_id: string;
  job_kind: JobKind;
  status: JobStatus;
  dedupe_key: string;
  attempt_count: number;
};

type BookingContext = {
  booking: {
    id: string;
    booking_type: "service" | "dyno";
    preferred_date: string | null;
    approved_date: string | null;
    request_notes: string | null;
    state: string;
  };
  customer: {
    email: string;
    first_name: string | null;
    last_name: string | null;
    mobile: string | null;
  };
  vehicle: {
    registration: string;
    year: number;
    make: string;
    model: string;
  };
};

type ProcessResult = {
  jobId: string;
  kind: JobKind;
  status: "blocked_configuration" | "failed" | "skipped" | "succeeded";
  providerReference?: string;
  errorCode?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const emailJobKinds = new Set<JobKind>([
  "notify_psi_request_received",
  "notify_customer_request_received",
  "notify_customer_date_proposed",
  "notify_customer_date_approved",
  "notify_customer_cancelled",
  "notify_psi_booking_confirmed",
  "notify_customer_booking_confirmed",
]);

const env = (name: string) => Deno.env.get(name)?.trim() ?? "";

const json = (body: unknown, status = 200) =>
  Response.json(body, { headers: { ...corsHeaders, "Cache-Control": "no-store" }, status });

const cleanErrorCode = (value: unknown, fallback = "provider_error") => {
  const raw = value instanceof Error ? value.message : String(value ?? fallback);
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return (cleaned || fallback).slice(0, 160);
};

const escapeHtml = (value: string | null | undefined) =>
  (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const displayDate = (value: string | null) => {
  if (!value) return "To be arranged";
  const date = new Date(`${value}T12:00:00+10:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric" }).format(date);
};

const nextCalendarDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
};

const vehicleLabel = (context: BookingContext) =>
  `${context.vehicle.year} ${context.vehicle.make} ${context.vehicle.model} (${context.vehicle.registration})`;

const customerName = (context: BookingContext) =>
  [context.customer.first_name, context.customer.last_name].filter(Boolean).join(" ") || "PSI customer";

const bookingLabel = (context: BookingContext) =>
  context.booking.booking_type === "dyno" ? "Dyno tuning" : "Service & Workshop";

const isJobStillApplicable = (job: IntegrationJob, context: BookingContext) => {
  switch (job.job_kind) {
    case "notify_customer_date_proposed":
      return context.booking.state === "date_proposed";
    case "notify_customer_date_approved":
      return context.booking.state === "date_approved";
    case "notify_customer_cancelled":
      return context.booking.state === "cancelled";
    case "notify_customer_booking_confirmed":
    case "notify_psi_booking_confirmed":
      return context.booking.state === "confirmed" || context.booking.state === "completed";
    case "sync_google_calendar_confirmed":
      return context.booking.state === "confirmed";
    default:
      return true;
  }
};

const buildEmail = (job: IntegrationJob, context: BookingContext) => {
  const booking = bookingLabel(context);
  const vehicle = vehicleLabel(context);
  const approvedDate = displayDate(context.booking.approved_date);
  const preferredDate = displayDate(context.booking.preferred_date);
  const ownerJob = job.job_kind.startsWith("notify_psi_");
  const recipient = ownerJob ? env("PSI_OWNER_NOTIFICATION_EMAIL") : context.customer.email;
  const greeting = ownerJob ? "PSI booking desk" : customerName(context);
  const common = `Booking: ${booking}\nVehicle: ${vehicle}\nReference: ${context.booking.id}`;

  let subject: string;
  let heading: string;
  let message: string;

  switch (job.job_kind) {
    case "notify_psi_request_received":
      subject = `New ${booking} request · ${context.vehicle.registration}`;
      heading = "New private booking request";
      message = `A customer booking request is ready for review. Preferred date: ${preferredDate}.`;
      break;
    case "notify_customer_request_received":
      subject = "PSI has received your booking request";
      heading = "Request received";
      message = "Your request is in the private PSI workshop queue. No date or payment is confirmed yet.";
      break;
    case "notify_customer_date_proposed":
      subject = `PSI proposed ${approvedDate}`;
      heading = "Workshop date proposed";
      message = `PSI has proposed ${approvedDate}. Review the date in your account. This is not a confirmed booking and no payment has been taken.`;
      break;
    case "notify_customer_date_approved":
      subject = `Your PSI date is approved for ${approvedDate}`;
      heading = "Workshop date approved";
      message = `Your requested date has been approved for ${approvedDate}. The booking is not confirmed until the later deposit step is completed.`;
      break;
    case "notify_customer_cancelled":
      subject = "PSI booking request update";
      heading = "Booking request cancelled";
      message = "This booking request has been cancelled. Contact PSI if you would like to arrange another date.";
      break;
    case "notify_psi_booking_confirmed":
      subject = `Confirmed ${booking} · ${context.vehicle.registration}`;
      heading = "Booking confirmed";
      message = `${customerName(context)} is confirmed for ${approvedDate}.`;
      break;
    case "notify_customer_booking_confirmed":
      subject = `PSI booking confirmed for ${approvedDate}`;
      heading = "Booking confirmed";
      message = `Your PSI booking is confirmed for ${approvedDate}. We look forward to seeing you.`;
      break;
    default:
      throw new Error("unsupported_email_job");
  }

  const text = `Hi ${greeting},\n\n${message}\n\n${common}\n\nPSI Performance\n21 Exchange Drive, Pakenham VIC 3810\n0433431781`;
  const html = `
    <div style="background:#0a0a0a;color:#f5f5f5;font-family:Arial,sans-serif;padding:28px">
      <div style="max-width:620px;margin:auto;border:1px solid #40382a;background:#151515;padding:26px">
        <div style="color:#d7a941;font-size:12px;font-weight:700;letter-spacing:2px">PSI PERFORMANCE</div>
        <h1 style="font-size:24px;margin:12px 0 18px">${escapeHtml(heading)}</h1>
        <p>Hi ${escapeHtml(greeting)},</p>
        <p style="line-height:1.6">${escapeHtml(message)}</p>
        <div style="border-top:1px solid #333;margin-top:22px;padding-top:18px;line-height:1.7">
          <strong>${escapeHtml(booking)}</strong><br>
          ${escapeHtml(vehicle)}<br>
          <span style="color:#aaa">Reference ${escapeHtml(context.booking.id)}</span>
        </div>
        <p style="color:#aaa;font-size:12px;margin-top:24px">PSI Performance · 21 Exchange Drive, Pakenham VIC 3810 · 0433431781</p>
      </div>
    </div>`;

  return { html, recipient, subject, text };
};

const loadBookingContext = async (admin: SupabaseClient, job: IntegrationJob): Promise<BookingContext> => {
  const [bookingResult, customerResult] = await Promise.all([
    admin.from("booking_requests").select("id, booking_type, preferred_date, approved_date, request_notes, state, vehicle_id, customer_id").eq("id", job.booking_request_id).eq("customer_id", job.customer_id).single(),
    admin.from("customer_profiles").select("email, first_name, last_name, mobile").eq("user_id", job.customer_id).single(),
  ]);
  if (bookingResult.error || !bookingResult.data) throw new Error("booking_not_found");
  if (customerResult.error || !customerResult.data) throw new Error("customer_not_found");

  const vehicleResult = await admin
    .from("customer_vehicles")
    .select("registration, year, make, model")
    .eq("id", bookingResult.data.vehicle_id)
    .eq("customer_id", job.customer_id)
    .single();
  if (vehicleResult.error || !vehicleResult.data) throw new Error("vehicle_not_found");

  return {
    booking: bookingResult.data as BookingContext["booking"],
    customer: customerResult.data as BookingContext["customer"],
    vehicle: vehicleResult.data as BookingContext["vehicle"],
  };
};

const sendEmail = async (job: IntegrationJob, context: BookingContext) => {
  const apiKey = env("RESEND_API_KEY");
  const from = env("PSI_TRANSACTIONAL_FROM_EMAIL");
  const ownerEmail = env("PSI_OWNER_NOTIFICATION_EMAIL");
  const missing = [
    !apiKey && "RESEND_API_KEY",
    !from && "PSI_TRANSACTIONAL_FROM_EMAIL",
    job.job_kind.startsWith("notify_psi_") && !ownerEmail && "PSI_OWNER_NOTIFICATION_EMAIL",
  ].filter(Boolean) as string[];
  if (missing.length) return { blocked: missing } as const;

  const email = buildEmail(job, context);
  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from,
      to: [email.recipient],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": job.dedupe_key,
    },
    method: "POST",
  });
  const responseBody = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok || !responseBody.id) throw new Error(`resend_${response.status}`);
  return { providerReference: responseBody.id } as const;
};

const syncGoogleCalendar = async (admin: SupabaseClient, job: IntegrationJob, context: BookingContext) => {
  const clientId = env("GOOGLE_CALENDAR_CLIENT_ID");
  const clientSecret = env("GOOGLE_CALENDAR_CLIENT_SECRET");
  const refreshToken = env("GOOGLE_CALENDAR_REFRESH_TOKEN");
  const calendarId = env("PSI_GOOGLE_CALENDAR_ID");
  const missing = [
    !clientId && "GOOGLE_CALENDAR_CLIENT_ID",
    !clientSecret && "GOOGLE_CALENDAR_CLIENT_SECRET",
    !refreshToken && "GOOGLE_CALENDAR_REFRESH_TOKEN",
    !calendarId && "PSI_GOOGLE_CALENDAR_ID",
  ].filter(Boolean) as string[];
  if (missing.length) return { blocked: missing } as const;
  if (context.booking.state !== "confirmed" || !context.booking.approved_date) {
    throw new Error("booking_not_confirmed");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const tokenBody = await tokenResponse.json().catch(() => ({})) as { access_token?: string };
  if (!tokenResponse.ok || !tokenBody.access_token) throw new Error(`google_token_${tokenResponse.status}`);

  const eventId = `psi${job.booking_request_id.replaceAll("-", "").toLowerCase()}`;
  const booking = bookingLabel(context);
  const eventResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`,
    {
      body: JSON.stringify({
        id: eventId,
        summary: `[CONFIRMED] ${booking} · ${context.vehicle.registration}`,
        description: [
          `Customer: ${customerName(context)}`,
          `Vehicle: ${vehicleLabel(context)}`,
          `Mobile: ${context.customer.mobile ?? "Not supplied"}`,
          `PSI booking reference: ${context.booking.id}`,
          "Private PSI workshop event. Customer attendee invitations are intentionally disabled.",
        ].join("\n"),
        start: { date: context.booking.approved_date },
        end: { date: nextCalendarDate(context.booking.approved_date) },
        extendedProperties: { private: { psiBookingRequestId: context.booking.id } },
      }),
      headers: {
        Authorization: `Bearer ${tokenBody.access_token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  if (!eventResponse.ok && eventResponse.status !== 409) throw new Error(`google_calendar_${eventResponse.status}`);

  const { error: calendarRecordError } = await admin.from("booking_calendar_events").upsert({
    booking_request_id: context.booking.id,
    google_calendar_id: calendarId,
    google_event_id: eventId,
    sync_state: "synced",
    last_error: null,
  }, { onConflict: "booking_request_id" });
  if (calendarRecordError) throw new Error("calendar_record_failed");
  return { providerReference: eventId } as const;
};

const updateJob = async (
  admin: SupabaseClient,
  jobId: string,
  status: JobStatus,
  values: Record<string, unknown>,
) => {
  const { error } = await admin.from("booking_integration_jobs").update({ status, ...values }).eq("id", jobId);
  if (error) throw new Error("job_update_failed");
};

const processJob = async (admin: SupabaseClient, queuedJob: IntegrationJob): Promise<ProcessResult> => {
  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("booking_integration_jobs")
    .update({
      status: "processing",
      attempt_count: queuedJob.attempt_count + 1,
      last_attempt_at: now,
      last_error_code: null,
    })
    .eq("id", queuedJob.id)
    .in("status", ["pending", "failed", "blocked_configuration"])
    .lt("attempt_count", 20)
    .select("id, booking_request_id, customer_id, job_kind, status, dedupe_key, attempt_count")
    .maybeSingle();
  if (claimError) throw new Error("job_claim_failed");
  if (!claimed) return { jobId: queuedJob.id, kind: queuedJob.job_kind, status: "skipped" };

  const job = claimed as IntegrationJob;
  try {
    const context = await loadBookingContext(admin, job);
    if (!isJobStillApplicable(job, context)) {
      await updateJob(admin, job.id, "cancelled", {
        completed_at: new Date().toISOString(),
        last_error_code: null,
        provider_reference: null,
      });
      return { jobId: job.id, kind: job.job_kind, status: "skipped" };
    }
    const outcome = emailJobKinds.has(job.job_kind)
      ? await sendEmail(job, context)
      : await syncGoogleCalendar(admin, job, context);

    if ("blocked" in outcome) {
      const errorCode = `missing_${outcome.blocked.join("_")}`.slice(0, 160);
      await updateJob(admin, job.id, "blocked_configuration", {
        available_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        last_error_code: errorCode,
      });
      return { errorCode, jobId: job.id, kind: job.job_kind, status: "blocked_configuration" };
    }

    await updateJob(admin, job.id, "succeeded", {
      completed_at: new Date().toISOString(),
      last_error_code: null,
      provider_reference: outcome.providerReference.slice(0, 500),
    });
    return {
      jobId: job.id,
      kind: job.job_kind,
      providerReference: outcome.providerReference,
      status: "succeeded",
    };
  } catch (error) {
    const errorCode = cleanErrorCode(error);
    await updateJob(admin, job.id, "failed", {
      available_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      last_error_code: errorCode,
    });
    return { errorCode, jobId: job.id, kind: job.job_kind, status: "failed" };
  }
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization") ?? "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "server_configuration_unavailable" }, 503);
  if (!accessToken) return json({ error: "authentication_required" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !userData.user) return json({ error: "invalid_session" }, 401);

  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(accessToken);
  if (
    claimsError ||
    !claimsData?.claims ||
    claimsData.claims.sub !== userData.user.id ||
    claimsData.claims.aal !== "aal2"
  ) {
    return json({ error: "aal2_staff_access_required" }, 403);
  }

  const { data: staff, error: staffError } = await userClient
    .from("staff_members")
    .select("id, role, status")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (staffError || !staff) return json({ error: "aal2_staff_access_required" }, 403);

  let body: { limit?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const requestedLimit = typeof body.limit === "number" && Number.isFinite(body.limit) ? Math.trunc(body.limit) : 10;
  const limit = Math.min(10, Math.max(1, requestedLimit));
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: jobs, error: jobsError } = await admin
    .from("booking_integration_jobs")
    .select("id, booking_request_id, customer_id, job_kind, status, dedupe_key, attempt_count")
    .in("status", ["pending", "failed", "blocked_configuration"])
    .lte("available_at", new Date().toISOString())
    .lt("attempt_count", 20)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (jobsError) return json({ error: "integration_queue_unavailable" }, 500);

  const results: ProcessResult[] = [];
  for (const job of (jobs ?? []) as IntegrationJob[]) results.push(await processJob(admin, job));

  return json({
    processed: results.filter((result) => result.status !== "skipped").length,
    results,
    readiness: {
      calendarConfigured: Boolean(
        env("GOOGLE_CALENDAR_CLIENT_ID") &&
        env("GOOGLE_CALENDAR_CLIENT_SECRET") &&
        env("GOOGLE_CALENDAR_REFRESH_TOKEN") &&
        env("PSI_GOOGLE_CALENDAR_ID")
      ),
      emailConfigured: Boolean(env("RESEND_API_KEY") && env("PSI_TRANSACTIONAL_FROM_EMAIL") && env("PSI_OWNER_NOTIFICATION_EMAIL")),
      paymentsConfigured: false,
    },
  });
});
