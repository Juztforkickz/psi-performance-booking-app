"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./admin.module.css";

type BookingType = "service" | "dyno";
type BookingStatus =
  | "pending_staff_review"
  | "date_proposed"
  | "date_approved"
  | "awaiting_deposit"
  | "confirmed"
  | "completed"
  | "cancelled";
type StatusFilter = "all" | BookingStatus;
type AllocationMode = "all_day" | "timed";

type PreviewBooking = {
  reference: string;
  bookingType: BookingType;
  status: BookingStatus;
  receivedAt: string;
  customer: { name: string; email: string; mobile: string };
  vehicle: { year: number; make: string; model: string; registration: string; vin?: string };
  appointment: {
    mode: "specific" | "flexible";
    preferredDate?: string;
    arrivalArrangement: string;
    afterHoursCollection: boolean;
    notifyEarlierAvailability: boolean;
  };
  reminderConsent: boolean;
  requestDetails: string;
  setupConfidence?: "known" | "psi_inspection";
  tuning?: Array<{ label: string; value: string }>;
};

type PlanningState = {
  date: string;
  allocationMode: AllocationMode;
  startTime: string;
  endTime: string;
  note: string;
};

const statusLabels: Record<BookingStatus, string> = {
  pending_staff_review: "Pending staff review",
  date_proposed: "Date proposed",
  date_approved: "Date approved · Deposit link next",
  awaiting_deposit: "Deposit link sent · Awaiting payment",
  confirmed: "Deposit paid · Booking confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PREVIEW_BOOKINGS: PreviewBooking[] = [
  {
    reference: "PSI-PREVIEW-SERVICE-01",
    bookingType: "service",
    status: "pending_staff_review",
    receivedAt: "21 Aug 2026 · 9:42am",
    customer: { name: "Jordan Taylor", email: "jordan@example.com", mobile: "0400 000 000" },
    vehicle: { year: 2017, make: "Holden", model: "Commodore VF SS", registration: "PSI001" },
    appointment: {
      mode: "flexible",
      arrivalArrangement: "Before-hours drop-off requested",
      afterHoursCollection: true,
      notifyEarlierAvailability: true,
    },
    reminderConsent: true,
    requestDetails: "Service and report before a highway trip. Please inspect a light oil smell and advise before any additional repair work.",
  },
  {
    reference: "PSI-PREVIEW-DYNO-02",
    bookingType: "dyno",
    status: "pending_staff_review",
    receivedAt: "21 Aug 2026 · 11:18am",
    customer: { name: "Alex Morgan", email: "alex@example.com", mobile: "0400 000 001" },
    vehicle: { year: 2015, make: "Ford", model: "Mustang GT", registration: "PSI002", vin: "1FA6P8CF0F5000000" },
    appointment: {
      mode: "specific",
      preferredDate: "2026-09-16",
      arrivalArrangement: "During workshop hours",
      afterHoursCollection: false,
      notifyEarlierAvailability: false,
    },
    reminderConsent: false,
    setupConfidence: "known",
    requestDetails: "Health check and custom 98 RON calibration. Street car; drivability and safe power are the priority.",
    tuning: [
      { label: "Engine", value: "Modified · supercharger, valve springs and upgraded cooling" },
      { label: "Transmission", value: "Manual · upgraded clutch" },
      { label: "Differential", value: "Stock · ratio unknown" },
      { label: "Fuel", value: "Upgraded pump and injectors · 98 RON" },
      { label: "Intake", value: "Upgraded cold-air intake" },
      { label: "Previous tune", value: "Yes · previous workshop unknown" },
      { label: "Exhaust", value: "Full 3-inch system · not Varex controlled" },
      { label: "Camshaft", value: "Stock" },
    ],
  },
];

const initialPlanning: Record<string, PlanningState> = Object.fromEntries(
  PREVIEW_BOOKINGS.map((booking) => [
    booking.reference,
    {
      date: booking.appointment.preferredDate ?? "2026-09-08",
      allocationMode: "all_day",
      startTime: "08:30",
      endTime: "17:00",
      note: "",
    },
  ]),
);

function workshopToday() {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function isEligibleDate(value: string, type: BookingType, minDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  if (value < minDate) return false;
  const day = new Date(`${value}T12:00:00`).getDay();
  return type === "dyno" ? [1, 3, 4].includes(day) : day >= 1 && day <= 5;
}

function formatDate(value?: string) {
  if (!value) return "Flexible. PSI to suggest";
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function AdminQueue() {
  const [bookings, setBookings] = useState(PREVIEW_BOOKINGS);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [planning, setPlanning] = useState(initialPlanning);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const today = useMemo(() => workshopToday(), []);

  const visibleBookings = useMemo(
    () => filter === "all" ? bookings : bookings.filter((booking) => booking.status === filter),
    [bookings, filter],
  );
  const earlierCandidates = bookings.filter((booking) => booking.appointment.notifyEarlierAvailability);

  const updatePlanning = <K extends keyof PlanningState>(reference: string, key: K, value: PlanningState[K]) => {
    setPlanning((current) => ({
      ...current,
      [reference]: { ...current[reference], [key]: value },
    }));
    setErrors((current) => {
      if (!current[reference]) return current;
      const next = { ...current };
      delete next[reference];
      return next;
    });
  };

  const applyDateAction = (event: { preventDefault(): void }, booking: PreviewBooking, action: "propose" | "confirm") => {
    event.preventDefault();
    const plan = planning[booking.reference];
    if (!plan.date || !isEligibleDate(plan.date, booking.bookingType, today)) {
      setErrors((current) => ({
        ...current,
        [booking.reference]: booking.bookingType === "dyno"
          ? "Choose a Monday, Wednesday or Thursday for this dyno request."
          : "Choose a Monday to Friday for this service request.",
      }));
      return;
    }
    if (plan.allocationMode === "timed" && (!plan.startTime || !plan.endTime || plan.startTime >= plan.endTime)) {
      setErrors((current) => ({ ...current, [booking.reference]: "Enter a valid start and end time, or choose all-day allocation." }));
      return;
    }
    const nextStatus: BookingStatus = action === "confirm" ? "date_approved" : "date_proposed";
    setBookings((current) => current.map((item) => item.reference === booking.reference ? { ...item, status: nextStatus } : item));
    setNotice(
      `${action === "confirm" ? "Date confirmation" : "Date proposal"} previewed for ${booking.reference}. This changed only local demo state. No customer, calendar or payment provider was contacted.`,
    );
  };

  return (
    <main className={styles.shell}>
      <header className={styles.queueHeader}>
        <div className={styles.queueBrand}>
          <Image src="/psi-logo.png" alt="PSI Performance Garage" width={300} height={100} priority />
          <span>Single-owner booking desk</span>
        </div>
        <div className={styles.headerActions}>
          <Link href="/">Customer view</Link>
          <Link href="/booking-policy">Policy draft</Link>
        </div>
      </header>

      <section className={styles.queueIntro}>
        <div>
          <p className={styles.eyebrow}>Owner-review workspace</p>
          <h1>Control the<br />workshop plan.</h1>
          <p>One PSI staff owner reviews every request, confirms or proposes the exact date, then initiates the deposit step. The customer never sees other bookings or the Google Calendar.</p>
        </div>
        <div className={styles.summaryCard}>
          <strong>{bookings.filter((booking) => booking.status === "pending_staff_review").length}</strong>
          <span>Requests to review</span>
        </div>
      </section>

      <section className={styles.queueContent}>
        <div className={styles.previewBanner} role="status">
          <div><strong>Preview example mode</strong><span>All names, vehicles, references and actions below are synthetic.</span></div>
          <p>Nothing here persists, sends email, creates a payment link or writes to Google Calendar. Public staff sign-in is not enabled.</p>
        </div>

        {notice && <div className={styles.successBanner} role="status">{notice}</div>}

        <section className={styles.workflowStrip} aria-label="Approval workflow">
          <div><span>01</span><strong>Review request</strong><p>Check customer, vehicle, scope and date preference.</p></div>
          <div><span>02</span><strong>Agree on date</strong><p>Confirm the exact allocation or propose another date.</p></div>
          <div><span>03</span><strong>Send deposit link</strong><p>$100 Service or $300 Dyno. Only after date approval.</p></div>
          <div><span>04</span><strong>Paid confirmation</strong><p>Verified payment queues receipt, email, Calendar and reminders.</p></div>
        </section>

        <section className={styles.earlierPanel} aria-labelledby="earlier-heading">
          <div>
            <p className={styles.eyebrow}>Staff-only signal</p>
            <h2 id="earlier-heading">Earlier-time candidates</h2>
            <p>No automatic offer or reschedule. You decide who to contact after checking work in progress, parts and workshop capacity.</p>
          </div>
          <div className={styles.earlierList}>
            {earlierCandidates.map((booking) => (
              <article key={booking.reference}>
                <span>Wants something sooner</span>
                <strong>{booking.customer.name}</strong>
                <p>{booking.vehicle.year} {booking.vehicle.make} {booking.vehicle.model}</p>
                <a href={`tel:${booking.customer.mobile.replace(/\s/gu, "")}`}>Contact manually</a>
              </article>
            ))}
          </div>
        </section>

        <div className={styles.toolbar}>
          <div><h2>Booking requests</h2><p>Review customer, vehicle and tuning information before changing the date state.</p></div>
          <div className={styles.filterField}>
            <label htmlFor="status-filter">Status</label>
            <select id="status-filter" value={filter} onChange={(event) => setFilter(event.target.value as StatusFilter)}>
              <option value="all">All requests</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>

        <div className={styles.bookingList}>
          {visibleBookings.map((booking) => {
            const plan = planning[booking.reference];
            return (
              <article className={styles.bookingCard} key={booking.reference}>
                <div className={styles.cardHeading}>
                  <div>
                    <span className={styles.reference}>{booking.reference} · Preview data</span>
                    <h3>{booking.bookingType === "dyno" ? "Dyno Tuning" : "Service & Report"}</h3>
                    <p>{booking.receivedAt}</p>
                  </div>
                  <span className={`${styles.statusBadge} ${styles[`status_${booking.status}`]}`}>{statusLabels[booking.status]}</span>
                </div>

                <div className={styles.detailGrid}>
                  <section><h4>Customer</h4><strong>{booking.customer.name}</strong><a href={`mailto:${booking.customer.email}`}>{booking.customer.email}</a><a href={`tel:${booking.customer.mobile.replace(/\s/gu, "")}`}>{booking.customer.mobile}</a></section>
                  <section><h4>Vehicle</h4><strong>{booking.vehicle.year} {booking.vehicle.make} {booking.vehicle.model}</strong><span>{booking.vehicle.registration}</span>{booking.vehicle.vin && <span>VIN {booking.vehicle.vin}</span>}</section>
                  <section><h4>Date request</h4><strong>{formatDate(booking.appointment.preferredDate)}</strong><span>{booking.appointment.arrivalArrangement}</span><span>{booking.appointment.afterHoursCollection ? "After-hours collection requested" : "Standard collection"}</span></section>
                  <section><h4>Preferences</h4><strong>{booking.appointment.notifyEarlierAvailability ? "Earlier opening requested" : "No earlier-time flag"}</strong><span>{booking.reminderConsent ? "6/12-month service reminders: opted in" : "Service reminders: not opted in"}</span></section>
                </div>

                <section className={styles.notes}><h4>What they need</h4><p>{booking.requestDetails}</p></section>

                {booking.bookingType === "dyno" && (
                  <section className={styles.tuningPanel}>
                    <div className={styles.tuningPanelHeading}><div><span>Dyno setup</span><h4>Customer specification</h4></div><strong>{booking.setupConfidence === "known" ? "I know my setup" : "PSI inspection requested"}</strong></div>
                    <div className={styles.tuningGrid}>
                      {booking.tuning?.map((item) => <section key={item.label}><h5>{item.label}</h5><p>{item.value}</p></section>)}
                    </div>
                  </section>
                )}

                <form className={styles.approvalPanel} onSubmit={(event) => applyDateAction(event, booking, "confirm")}>
                  <div className={styles.approvalHeading}>
                    <div><span>Owner action</span><h4>Confirm or propose the workshop allocation</h4></div>
                    <p>Use the exact date you intend to put in Google Calendar after verified payment. Do not assume a duration.</p>
                  </div>
                  <div className={styles.approvalFields}>
                    <label><span>Workshop date</span><input type="date" min={today} value={plan.date} onChange={(event) => updatePlanning(booking.reference, "date", event.target.value)} /></label>
                    <label><span>Allocation</span><select value={plan.allocationMode} onChange={(event) => updatePlanning(booking.reference, "allocationMode", event.target.value as AllocationMode)}><option value="all_day">All-day workshop allocation</option><option value="timed">Specific start and end</option></select></label>
                    {plan.allocationMode === "timed" && <><label><span>Start</span><input type="time" value={plan.startTime} onChange={(event) => updatePlanning(booking.reference, "startTime", event.target.value)} /></label><label><span>End</span><input type="time" value={plan.endTime} onChange={(event) => updatePlanning(booking.reference, "endTime", event.target.value)} /></label></>}
                    <label className={styles.approvalNote}><span>Internal planning note</span><textarea rows={2} value={plan.note} onChange={(event) => updatePlanning(booking.reference, "note", event.target.value)} placeholder="Optional owner-only note" /></label>
                  </div>
                  {errors[booking.reference] && <p className={styles.inlineError} role="alert">{errors[booking.reference]}</p>}
                  <div className={styles.approvalActions}>
                    <button type="button" onClick={(event) => applyDateAction(event, booking, "propose")}>Preview proposed date</button>
                    <button type="submit">Preview confirm date</button>
                    <button type="button" disabled title="Payment provider is not connected">Create & send {booking.bookingType === "dyno" ? "$300" : "$100"} deposit link</button>
                  </div>
                  <p className={styles.providerGate}>Deposit link disabled in preview. When enabled, only date-approved requests can create one. Paid verification, not this button, will queue the PSI/customer email, receipt, internal Calendar event and factual 7-day / 24-hour reminders.</p>
                </form>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
