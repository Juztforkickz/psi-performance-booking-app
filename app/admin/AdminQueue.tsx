"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./admin.module.css";

const SESSION_KEY = "psi_admin_key";

const STATUS_OPTIONS = ["requested", "confirmed", "completed", "cancelled"] as const;

type BookingStatus = (typeof STATUS_OPTIONS)[number];
type StatusFilter = "all" | BookingStatus;

type Booking = {
  reference: string;
  status: BookingStatus;
  bookingType: string;
  serviceOption: string;
  customerName: string;
  email: string;
  phone: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string | number;
  registration?: string | null;
  vin?: string | null;
  preferredDate?: string | null;
  arrivalWindow?: string | null;
  notes?: string | null;
  source?: string | null;
  createdAt?: string | number | null;
};

type BookingsResponse = {
  bookings?: Booking[];
  error?: string | { message?: string };
  message?: string;
};

const statusLabels: Record<BookingStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Australia/Melbourne",
});

const timestampFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Melbourne",
});

function humanise(value?: string | null) {
  if (!value) return "Not provided";
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPreferredDate(value?: string | null) {
  if (!value) return "No preference supplied";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function formatTimestamp(value?: string | number | null) {
  if (value === undefined || value === null || value === "") return "Received recently";
  const normalised =
    typeof value === "number" && value < 10_000_000_000
      ? value * 1000
      : typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(value)
        ? `${value.replace(" ", "T")}Z`
        : value;
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? "Received recently" : `Received ${timestampFormatter.format(date)}`;
}

function responseMessage(payload: BookingsResponse | null, fallback: string) {
  if (!payload) return fallback;
  if (typeof payload.error === "string") return payload.error;
  if (payload.error?.message) return payload.error.message;
  return payload.message || fallback;
}

function serviceTitle(booking: Booking) {
  return booking.bookingType.toLowerCase().includes("dyno") ? "Dyno tune" : "Vehicle service";
}

export function AdminQueue() {
  const [isReady, setIsReady] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(false);
  const [updatingReference, setUpdatingReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const clearAccess = useCallback((message?: string) => {
    window.sessionStorage.removeItem(SESSION_KEY);
    setAdminKey("");
    setBookings([]);
    setNotice(null);
    setError(message || null);
  }, []);

  const loadBookings = useCallback(
    async (key: string, showLoading = true) => {
      if (showLoading) setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/v1/admin/bookings", {
          headers: { Authorization: `Bearer ${key}` },
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as BookingsResponse | null;

        if (response.status === 401 || response.status === 403) {
          clearAccess("That staff access key was not accepted. Please try again.");
          return;
        }
        if (!response.ok) {
          throw new Error(responseMessage(payload, "The booking queue could not be loaded."));
        }
        if (!payload || !Array.isArray(payload.bookings)) {
          throw new Error("The booking queue returned an unexpected response.");
        }

        setBookings(payload.bookings);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The booking queue could not be loaded.");
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [clearAccess],
  );

  useEffect(() => {
    const savedKey = window.sessionStorage.getItem(SESSION_KEY);
    const restoreSession = window.setTimeout(() => {
      setIsReady(true);
      if (savedKey) {
        setAdminKey(savedKey);
        void loadBookings(savedKey);
      }
    }, 0);

    return () => window.clearTimeout(restoreSession);
  }, [loadBookings]);

  const visibleBookings = useMemo(
    () => (filter === "all" ? bookings : bookings.filter((booking) => booking.status === filter)),
    [bookings, filter],
  );

  const counts = useMemo(
    () =>
      STATUS_OPTIONS.reduce<Record<BookingStatus, number>>(
        (summary, status) => ({
          ...summary,
          [status]: bookings.filter((booking) => booking.status === status).length,
        }),
        { requested: 0, confirmed: 0, completed: 0, cancelled: 0 },
      ),
    [bookings],
  );

  async function submitAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = keyDraft.trim();
    if (!key) {
      setError("Enter the staff access key.");
      return;
    }

    window.sessionStorage.setItem(SESSION_KEY, key);
    setAdminKey(key);
    setNotice(null);
    await loadBookings(key);
  }

  async function updateStatus(booking: Booking, nextStatus: BookingStatus) {
    if (booking.status === nextStatus || updatingReference) return;

    const approved = window.confirm(
      `Change ${booking.reference} from ${statusLabels[booking.status]} to ${statusLabels[nextStatus]}?`,
    );
    if (!approved) return;

    setUpdatingReference(booking.reference);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/v1/admin/bookings", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${adminKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reference: booking.reference, status: nextStatus }),
      });
      const payload = (await response.json().catch(() => null)) as BookingsResponse | null;

      if (response.status === 401 || response.status === 403) {
        clearAccess("Your staff session is no longer authorised. Enter the access key again.");
        return;
      }
      if (!response.ok) {
        throw new Error(responseMessage(payload, `Could not update ${booking.reference}.`));
      }

      setBookings((current) =>
        current.map((item) => (item.reference === booking.reference ? { ...item, status: nextStatus } : item)),
      );
      setNotice(`${booking.reference} is now ${statusLabels[nextStatus].toLowerCase()}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not update ${booking.reference}.`);
    } finally {
      setUpdatingReference(null);
    }
  }

  if (!isReady) {
    return (
      <main className={styles.shell} aria-busy="true">
        <div className={styles.loadingPanel}>Opening the workshop queue…</div>
      </main>
    );
  }

  if (!adminKey) {
    return (
      <main className={styles.shell}>
        <header className={styles.loginHeader}>
          <Link href="/" aria-label="Return to the PSI Performance booking site">
            <Image src="/psi-logo.png" alt="PSI Performance Garage" width={155} height={60} priority />
          </Link>
          <span>Workshop staff</span>
        </header>

        <section className={styles.loginPanel} aria-labelledby="staff-access-heading">
          <p className={styles.eyebrow}>Private booking queue</p>
          <h1 id="staff-access-heading">Staff access</h1>
          <p className={styles.loginCopy}>
            Enter the workshop access key to review and update customer booking requests.
          </p>

          {error ? <div className={styles.errorBanner} role="alert">{error}</div> : null}

          <form className={styles.loginForm} onSubmit={submitAccess}>
            <label htmlFor="admin-access-key">Staff access key</label>
            <input
              id="admin-access-key"
              type="password"
              value={keyDraft}
              onChange={(event) => setKeyDraft(event.target.value)}
              autoComplete="current-password"
              spellCheck={false}
              disabled={loading}
            />
            <button type="submit" disabled={loading}>
              {loading ? "Checking…" : "Open booking queue"}
            </button>
          </form>

          <p className={styles.sessionNote}>The key is kept only for this browser session and is cleared when you sign out.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.queueHeader}>
        <div className={styles.queueBrand}>
          <Link href="/" aria-label="Return to the PSI Performance booking site">
            <Image src="/psi-logo.png" alt="PSI Performance Garage" width={155} height={60} priority />
          </Link>
          <span>Workshop queue</span>
        </div>
        <div className={styles.headerActions}>
          <button type="button" onClick={() => void loadBookings(adminKey)} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" className={styles.signOutButton} onClick={() => clearAccess()}>
            Sign out
          </button>
        </div>
      </header>

      <section className={styles.queueIntro}>
        <div>
          <p className={styles.eyebrow}>PSI Performance Garage</p>
          <h1>Booking requests</h1>
          <p>Requests stay pending until the workshop confirms a time with the customer.</p>
        </div>
        <div className={styles.summaryCard}>
          <strong>{counts.requested}</strong>
          <span>Awaiting review</span>
        </div>
      </section>

      <section className={styles.queueContent} aria-labelledby="queue-heading">
        <div className={styles.toolbar}>
          <div>
            <h2 id="queue-heading">Recent requests</h2>
            <p>{bookings.length} total · {visibleBookings.length} shown</p>
          </div>
          <div className={styles.filterField}>
            <label htmlFor="status-filter">Filter by status</label>
            <select
              id="status-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value as StatusFilter)}
            >
              <option value="all">All ({bookings.length})</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{statusLabels[status]} ({counts[status]})</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.messages} aria-live="polite">
          {error ? <div className={styles.errorBanner} role="alert">{error}</div> : null}
          {notice ? <div className={styles.successBanner} role="status">{notice}</div> : null}
        </div>

        {loading && bookings.length === 0 ? (
          <div className={styles.emptyState} aria-busy="true">Loading booking requests…</div>
        ) : visibleBookings.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>No requests here</strong>
            <span>{filter === "all" ? "New customer requests will appear here." : `There are no ${statusLabels[filter].toLowerCase()} requests.`}</span>
          </div>
        ) : (
          <div className={styles.bookingList}>
            {visibleBookings.map((booking) => {
              const isUpdating = updatingReference === booking.reference;
              return (
                <article className={styles.bookingCard} key={booking.reference}>
                  <div className={styles.cardHeading}>
                    <div>
                      <span className={styles.reference}>{booking.reference}</span>
                      <h3>{serviceTitle(booking)}</h3>
                      <p>{humanise(booking.serviceOption)} · {formatTimestamp(booking.createdAt)}</p>
                    </div>
                    <span className={`${styles.statusBadge} ${styles[`status_${booking.status}`]}`}>
                      {statusLabels[booking.status]}
                    </span>
                  </div>

                  <div className={styles.detailGrid}>
                    <section>
                      <h4>Customer</h4>
                      <strong>{booking.customerName}</strong>
                      <a href={`tel:${booking.phone.replace(/[^+\d]/g, "")}`}>{booking.phone}</a>
                      <a href={`mailto:${booking.email}`}>{booking.email}</a>
                    </section>
                    <section>
                      <h4>Vehicle</h4>
                      <strong>{booking.vehicleYear} {booking.vehicleMake} {booking.vehicleModel}</strong>
                      <span>Registration: {booking.registration || "Not supplied"}</span>
                      {booking.vin ? <span>VIN: {booking.vin}</span> : null}
                    </section>
                    <section>
                      <h4>Preferred arrival</h4>
                      <strong>{formatPreferredDate(booking.preferredDate)}</strong>
                      <span>{humanise(booking.arrivalWindow)}</span>
                    </section>
                    <section>
                      <h4>Submitted via</h4>
                      <strong>{humanise(booking.source || "web")}</strong>
                      <span>Customer booking request</span>
                    </section>
                  </div>

                  {booking.notes ? (
                    <div className={styles.notes}>
                      <h4>Customer notes</h4>
                      <p>{booking.notes}</p>
                    </div>
                  ) : null}

                  <div className={styles.statusControl}>
                    <label htmlFor={`status-${booking.reference}`}>Update status</label>
                    <select
                      id={`status-${booking.reference}`}
                      value={booking.status}
                      disabled={isUpdating || Boolean(updatingReference)}
                      onChange={(event) => void updateStatus(booking, event.target.value as BookingStatus)}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{statusLabels[status]}</option>
                      ))}
                    </select>
                    <span>{isUpdating ? "Saving change…" : "You will be asked to confirm before saving."}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
