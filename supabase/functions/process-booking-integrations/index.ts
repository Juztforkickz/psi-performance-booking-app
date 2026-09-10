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
  | "notify_customer_service_due"
  | "sync_google_calendar_confirmed"
  | "sync_google_calendar_cancelled";

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
  service_completion_id: string | null;
  service_due_on: string | null;
  service_interval_months: 6 | 12 | null;
};

type BookingContext = {
  booking: {
    id: string;
    booking_type: "service" | "dyno";
    preferred_date: string | null;
    approved_date: string | null;
    request_notes: string | null;
    request_context: Record<string, unknown>;
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
  remindersEnabled: boolean;
};

type ProcessResult = {
  jobId: string;
  kind: JobKind;
  status: "blocked_configuration" | "failed" | "skipped" | "succeeded";
  providerReference?: string;
  errorCode?: string;
};

type WorkerRequest = {
  action?: unknown;
  bookingId?: unknown;
  limit?: unknown;
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
  "notify_customer_service_due",
]);

const env = (name: string) => Deno.env.get(name)?.trim() ?? "";

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

const json = (body: unknown, status = 200) =>
  Response.json(body, { headers: { ...corsHeaders, "Cache-Control": "no-store" }, status });

const cleanErrorCode = (value: unknown, fallback = "provider_error") => {
  const raw = value instanceof Error ? value.message : String(value ?? fallback);
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return (cleaned || fallback).slice(0, 160);
};

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);

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

const humanize = (value: string) => value
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .replaceAll("_", " ")
  .replace(/\b\w/g, (character) => character.toUpperCase());

const requestContextLines = (context: Record<string, unknown>) => {
  const lines: string[] = [];
  if (typeof context.arrivalArrangement === "string") lines.push(`Arrival: ${humanize(context.arrivalArrangement)}`);
  if (context.afterHoursCollection === true) lines.push("Collection: After-hours requested");
  if (context.notifyEarlierAvailability === true) lines.push("Earlier opening: Customer requested contact");
  if (context.serviceReminderConsent === true) lines.push("Service reminders: Customer opted in");
  if (typeof context.setupConfidence === "string") lines.push(`Dyno setup: ${humanize(context.setupConfidence)}`);
  if (context.tuningDetails && typeof context.tuningDetails === "object" && !Array.isArray(context.tuningDetails)) {
    Object.entries(context.tuningDetails as Record<string, unknown>)
      .filter(([, value]) => typeof value === "string" && value.trim())
      .slice(0, 12)
      .forEach(([key, value]) => lines.push(`${humanize(key)}: ${humanize(value as string)}`));
  }
  return lines;
};

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
      return context.booking.state === "confirmed" || context.booking.state === "completed";
    case "sync_google_calendar_cancelled":
      return context.booking.state === "cancelled";
    case "notify_customer_service_due":
      return context.booking.state === "completed" &&
        context.booking.request_context.serviceReminderConsent === true &&
        context.remindersEnabled &&
        job.service_due_on !== null &&
        (job.service_interval_months === 6 || job.service_interval_months === 12);
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
  const enquiry = context.booking.request_notes?.trim() || "No additional enquiry notes supplied.";
  const visitDetails = requestContextLines(context.booking.request_context);
  const serviceReminder = job.job_kind === "notify_customer_service_due";
  const serviceReminderTest = serviceReminder && context.booking.request_context.serviceReminderTest === true;
  const commonLines = ownerJob
    ? [
        `Customer: ${customerName(context)}`,
        `Email: ${context.customer.email}`,
        `Mobile: ${context.customer.mobile || "Not supplied"}`,
        `Booking: ${booking}`,
        `Vehicle: ${vehicle}`,
        `Enquiry: ${enquiry}`,
        ...visitDetails,
        `Reference: ${context.booking.id}`,
      ]
    : serviceReminder
      ? [
          `Vehicle: ${vehicle}`,
          `Service due: ${displayDate(job.service_due_on)}`,
          `Service interval: ${job.service_interval_months} months`,
          "Book in the PSI app or contact the workshop:",
           "Email: info@psiperformance.com.au",
           "Phone: 0433 431 781",
           "To stop future reminders, turn off Service & visit reminders in PSI Settings.",
        ]
      : [
        `Booking: ${booking}`,
        `Vehicle: ${vehicle}`,
        `Your enquiry: ${enquiry}`,
        `Reference: ${context.booking.id}`,
        ];
  const common = commonLines.join("\n");

  let subject: string;
  let heading: string;
  let message: string;

  switch (job.job_kind) {
    case "notify_psi_request_received":
      subject = `New ${booking} request · ${context.vehicle.registration}`;
      heading = "New private booking request";
      message = `${customerName(context)} sent a booking enquiry. Preferred date: ${preferredDate}. Their contact details and full request are below.`;
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
    case "notify_customer_service_due":
      subject = `${serviceReminderTest ? "[PSI QA TEST] " : ""}Your ${job.service_interval_months}-month PSI service is coming up`;
      heading = serviceReminderTest ? "Service reminder test" : "Your next service is due soon";
      message = `${serviceReminderTest ? "This is a labelled end-to-end PSI reminder test. " : ""}${vehicle} is due for its ${job.service_interval_months}-month service around ${displayDate(job.service_due_on)}. Would you like to arrange a booking with PSI?`;
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
          ${commonLines.map((line, index) => `${index === 0 ? "<strong>" : ""}${escapeHtml(line)}${index === 0 ? "</strong>" : ""}<br>`).join("\n")}
        </div>
        ${ownerJob ? `<p style="margin-top:22px"><a href="mailto:${escapeHtml(context.customer.email)}" style="background:#65CFF8;color:#050505;display:inline-block;font-weight:700;padding:12px 18px;text-decoration:none">Reply to ${escapeHtml(customerName(context))}</a></p>` : ""}
        ${serviceReminder ? `<p style="margin-top:22px"><a href="mailto:info@psiperformance.com.au?subject=${encodeURIComponent(`Service booking · ${context.vehicle.registration}`)}" style="background:#65CFF8;color:#050505;display:inline-block;font-weight:700;padding:12px 18px;text-decoration:none">Email PSI to book</a>&nbsp;<a href="tel:+61433431781" style="border:1px solid #65CFF8;color:#65CFF8;display:inline-block;font-weight:700;padding:11px 18px;text-decoration:none">Call PSI</a></p>` : ""}
        <p style="color:#aaa;font-size:12px;margin-top:24px">PSI Performance · 21 Exchange Drive, Pakenham VIC 3810 · 0433431781</p>
      </div>
    </div>`;

  return { html, recipient, subject, text };
};

const queueServiceReminderNotification = async (
  admin: SupabaseClient,
  job: IntegrationJob,
  context: BookingContext,
) => {
  if (job.job_kind !== "notify_customer_service_due" || !job.service_due_on || !job.service_interval_months) return;
  const eventKey = `service_reminder:${job.id}`;
  const serviceReminderTest = context.booking.request_context.serviceReminderTest === true;
  const title = `${serviceReminderTest ? "QA TEST · " : ""}${job.service_interval_months}-month service due soon`;
  const body = `${vehicleLabel(context)} is due around ${displayDate(job.service_due_on)}. Book with PSI or call 0433 431 781.`;
  const { data: event, error: eventError } = await admin.from("notification_events").upsert({
    recipient_user_id: job.customer_id,
    booking_request_id: job.booking_request_id,
    kind: "service_reminder",
    title: title.slice(0, 80),
    body: body.slice(0, 240),
    deep_link: "/booking",
    source_event_key: eventKey,
  }, { onConflict: "source_event_key", ignoreDuplicates: true }).select("id,recipient_user_id").maybeSingle();
  if (eventError) throw new Error("service_reminder_event_failed");

  let eventId = event?.id;
  if (!eventId) {
    const { data: existing, error: existingError } = await admin
      .from("notification_events")
      .select("id")
      .eq("source_event_key", eventKey)
      .single();
    if (existingError || !existing) throw new Error("service_reminder_event_missing");
    eventId = existing.id;
  }

  const { error: pushError } = await admin.from("push_notification_jobs").upsert({
    event_id: eventId,
    booking_request_id: job.booking_request_id,
    recipient_user_id: job.customer_id,
  }, { onConflict: "event_id", ignoreDuplicates: true });
  if (pushError) throw new Error("service_reminder_push_queue_failed");
};

const dispatchServiceReminderPush = async (bookingId: string) => {
  const supabaseUrl = env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${supabaseUrl}/functions/v1/process-push-notifications`, {
    body: JSON.stringify({ action: "process_due_service_reminders", bookingId }),
    headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
    method: "POST",
  });
  await response.body?.cancel();
  if (!response.ok) throw new Error(`service_reminder_push_${response.status}`);
};

const loadBookingContext = async (admin: SupabaseClient, job: IntegrationJob): Promise<BookingContext> => {
  const [bookingResult, customerResult, preferenceResult] = await Promise.all([
    admin.from("booking_requests").select("id, booking_type, preferred_date, approved_date, request_notes, request_context, state, vehicle_id, customer_id").eq("id", job.booking_request_id).eq("customer_id", job.customer_id).single(),
    admin.from("customer_profiles").select("email, first_name, last_name, mobile").eq("user_id", job.customer_id).single(),
    admin.from("notification_preferences").select("booking_reminders_enabled").eq("user_id", job.customer_id).maybeSingle(),
  ]);
  if (bookingResult.error || !bookingResult.data) throw new Error("booking_not_found");
  if (customerResult.error || !customerResult.data) throw new Error("customer_not_found");
  if (preferenceResult.error) throw new Error("notification_preferences_unavailable");

  const vehicleResult = await admin
    .from("customer_vehicles")
    .select("registration, year, make, model")
    .eq("id", bookingResult.data.vehicle_id)
    .eq("customer_id", job.customer_id)
    .single();
  if (vehicleResult.error || !vehicleResult.data) throw new Error("vehicle_not_found");

  return {
    booking: { ...bookingResult.data, request_context: bookingResult.data.request_context ?? {} } as BookingContext["booking"],
    customer: customerResult.data as BookingContext["customer"],
    vehicle: vehicleResult.data as BookingContext["vehicle"],
    remindersEnabled: preferenceResult.data?.booking_reminders_enabled !== false,
  };
};

const googleCalendarConfiguration = () => {
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
  return { calendarId, clientId, clientSecret, missing, refreshToken };
};

const googleCalendarAccessToken = async () => {
  const config = googleCalendarConfiguration();
  if (config.missing.length) return { blocked: config.missing } as const;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: config.refreshToken,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const tokenBody = await tokenResponse.json().catch(() => ({})) as { access_token?: string };
  if (!tokenResponse.ok || !tokenBody.access_token) throw new Error(`google_token_${tokenResponse.status}`);
  return { accessToken: tokenBody.access_token, calendarId: config.calendarId } as const;
};

const verifyGoogleCalendar = async () => {
  const access = await googleCalendarAccessToken();
  if ("blocked" in access) return access;
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(access.calendarId)}/events`);
  url.searchParams.set("maxResults", "1");
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("timeMin", new Date().toISOString());
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${access.accessToken}` },
    method: "GET",
  });
  await response.body?.cancel();
  if (!response.ok) throw new Error(`google_calendar_health_${response.status}`);
  return { verified: true } as const;
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
      reply_to: job.job_kind.startsWith("notify_psi_") ? context.customer.email : ownerEmail,
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
  const access = await googleCalendarAccessToken();
  if ("blocked" in access) return access;
  const { accessToken, calendarId } = access;
  const cancellation = job.job_kind === "sync_google_calendar_cancelled";
  if (!cancellation && !["confirmed", "completed"].includes(context.booking.state)) throw new Error("booking_not_confirmed");
  if (!cancellation && !context.booking.approved_date) throw new Error("booking_date_missing");
  const approvedDate = context.booking.approved_date;

  const eventId = `psi${job.booking_request_id.replaceAll("-", "").toLowerCase()}`;
  const eventUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`;
  if (cancellation) {
    const removeResponse = await fetch(`${eventUrl}?sendUpdates=none`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      method: "DELETE",
    });
    if (![204, 404, 410].includes(removeResponse.status)) throw new Error(`google_calendar_delete_${removeResponse.status}`);
    const { error: removedError } = await admin.from("booking_calendar_events").upsert({
      booking_request_id: context.booking.id,
      google_calendar_id: calendarId,
      google_event_id: eventId,
      sync_state: "removed",
      last_error: null,
    }, { onConflict: "booking_request_id" });
    if (removedError) throw new Error("calendar_record_failed");
    return { providerReference: eventId } as const;
  }

  const booking = bookingLabel(context);
  const eventBody = {
    id: eventId,
    summary: `[CONFIRMED] ${booking} · ${context.vehicle.registration}`,
    description: [
      `Customer: ${customerName(context)}`,
      `Vehicle: ${vehicleLabel(context)}`,
      `Mobile: ${context.customer.mobile ?? "Not supplied"}`,
      `PSI booking reference: ${context.booking.id}`,
      "PSI workshop event. Customer attendee invitations are intentionally disabled.",
    ].join("\n"),
    start: { date: approvedDate },
    end: { date: nextCalendarDate(approvedDate!) },
    attendees: [],
    visibility: "default",
    extendedProperties: { private: { psiBookingRequestId: context.booking.id } },
  };
  const commonHeaders = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const lookupResponse = await fetch(eventUrl, { headers: { Authorization: `Bearer ${accessToken}` }, method: "GET" });
  if (!lookupResponse.ok && lookupResponse.status !== 404) throw new Error(`google_calendar_lookup_${lookupResponse.status}`);
  const eventResponse = lookupResponse.status === 404
    ? await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`, { body: JSON.stringify(eventBody), headers: commonHeaders, method: "POST" })
    : await fetch(`${eventUrl}?sendUpdates=none`, { body: JSON.stringify(eventBody), headers: commonHeaders, method: "PUT" });
  if (!eventResponse.ok) throw new Error(`google_calendar_write_${eventResponse.status}`);

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
    .select("id, booking_request_id, customer_id, job_kind, status, dedupe_key, attempt_count, service_completion_id, service_due_on, service_interval_months")
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

    if (job.job_kind === "notify_customer_service_due") {
      await queueServiceReminderNotification(admin, job, context);
      await dispatchServiceReminderPush(job.booking_request_id);
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

  let body: WorkerRequest = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (body.bookingId !== undefined && !isUuid(body.bookingId)) return json({ error: "invalid_booking_id" }, 400);
  const bookingId = body.bookingId ?? null;
  const dueReminderRun = body.action === "process_due_service_reminders";
  const requestedLimit = typeof body.limit === "number" && Number.isFinite(body.limit) ? Math.trunc(body.limit) : 10;
  const limit = Math.min(10, Math.max(1, requestedLimit));
  // Supabase can rotate the runtime service-role secret independently from a
  // still-valid legacy service-role JWT. The gateway validates the JWT before
  // this protected function runs, so accept either exact secret or a validated
  // service-role token scoped to this project.
  const isInternalServiceCall = accessToken === serviceRoleKey || isProjectServiceRoleToken(accessToken, supabaseUrl);
  let isAal2Staff = isInternalServiceCall;

  if (isInternalServiceCall) {
    if (!bookingId && !dueReminderRun) return json({ error: "internal_booking_id_required" }, 400);
  } else {
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !userData.user) return json({ error: "invalid_session" }, 401);

    const [{ data: claimsData }, { data: staff, error: staffError }] = await Promise.all([
      userClient.auth.getClaims(accessToken),
      userClient
        .from("staff_members")
        .select("id, role, status")
        .eq("user_id", userData.user.id)
        .eq("status", "active")
        .maybeSingle(),
    ]);
    isAal2Staff = Boolean(
      !staffError &&
      staff &&
      claimsData?.claims?.sub === userData.user.id &&
      claimsData.claims.aal === "aal2",
    );

    if (!bookingId && !isAal2Staff) return json({ error: "aal2_staff_access_required" }, 403);
    if (bookingId && !isAal2Staff) {
      const { data: ownedBooking, error: ownedBookingError } = await userClient
        .from("booking_requests")
        .select("id")
        .eq("id", bookingId)
        .eq("customer_id", userData.user.id)
        .maybeSingle();
      if (ownedBookingError || !ownedBooking) return json({ error: "booking_access_denied" }, 403);
    }
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let jobsQuery = admin
    .from("booking_integration_jobs")
    .select("id, booking_request_id, customer_id, job_kind, status, dedupe_key, attempt_count, service_completion_id, service_due_on, service_interval_months")
    .in("status", ["pending", "failed", "blocked_configuration"])
    .lte("available_at", new Date().toISOString())
    .lt("attempt_count", 20)
    .order("created_at", { ascending: true });
  if (bookingId) jobsQuery = jobsQuery.eq("booking_request_id", bookingId);
  if (dueReminderRun) jobsQuery = jobsQuery.eq("job_kind", "notify_customer_service_due");
  if (!isAal2Staff) {
    jobsQuery = jobsQuery.in("job_kind", [
      "notify_psi_request_received",
      "notify_customer_request_received",
    ]);
  }
  const { data: jobs, error: jobsError } = await jobsQuery.limit(limit);
  if (jobsError) return json({ error: "integration_queue_unavailable" }, 500);

  const results: ProcessResult[] = [];
  for (const job of (jobs ?? []) as IntegrationJob[]) results.push(await processJob(admin, job));

  const calendarConfigured = googleCalendarConfiguration().missing.length === 0;
  let calendarHealth: "needs_configuration" | "unavailable" | "verified" = calendarConfigured ? "unavailable" : "needs_configuration";
  if (!bookingId && isAal2Staff && calendarConfigured) {
    try {
      const health = await verifyGoogleCalendar();
      calendarHealth = "verified" in health ? "verified" : "needs_configuration";
    } catch {
      calendarHealth = "unavailable";
    }
  }

  return json({
    processed: results.filter((result) => result.status !== "skipped").length,
    results,
    readiness: {
      calendarConfigured,
      emailConfigured: Boolean(env("RESEND_API_KEY") && env("PSI_TRANSACTIONAL_FROM_EMAIL") && env("PSI_OWNER_NOTIFICATION_EMAIL")),
      paymentsConfigured: Boolean(
        env("STRIPE_SECRET_KEY") &&
        env("STRIPE_WEBHOOK_SECRET") &&
        env("PSI_PAYMENT_RETURN_ORIGIN")
      ),
    },
    providerHealth: {
      calendar: calendarHealth,
      email: Boolean(env("RESEND_API_KEY") && env("PSI_TRANSACTIONAL_FROM_EMAIL") && env("PSI_OWNER_NOTIFICATION_EMAIL")) ? "configured" : "needs_configuration",
    },
  });
});
