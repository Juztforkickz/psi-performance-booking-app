"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type BookingType = "service" | "dyno";
type ArrivalWindow = "morning" | "afternoon" | "any";

type BookingFormState = {
  bookingType: BookingType | "";
  serviceOption: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  registration: string;
  vin: string;
  customerName: string;
  email: string;
  phone: string;
  preferredDate: string;
  arrivalWindow: ArrivalWindow;
  notes: string;
  consent: boolean;
  company: string;
};

type BookingResult = {
  reference: string;
  status: string;
  message?: string;
};

type BookingApiResponse = Partial<BookingResult> & {
  error?:
    | string
    | {
        code?: string;
        message?: string;
        fields?: Record<string, string>;
      };
};

const SERVICE_OPTIONS = [
  { value: "logbook_service", label: "Logbook service", detail: "Scheduled servicing to keep your car on track." },
  { value: "minor_service", label: "Minor service", detail: "Oil, filters and essential safety checks." },
  { value: "major_service", label: "Major service", detail: "A deeper inspection and maintenance visit." },
  { value: "diagnostics_repairs", label: "Diagnostics or repairs", detail: "Fault-finding, warning lights and mechanical issues." },
];

const DYNO_OPTIONS = [
  { value: "dyno_tune", label: "Dyno tune", detail: "Calibration focused on safe power and drivability." },
  { value: "dyno_health_check", label: "Dyno health check", detail: "Measure, inspect and identify the next step." },
  { value: "existing_tune_review", label: "Existing tune review", detail: "Review a previous calibration or changed setup." },
  { value: "performance_consultation", label: "Performance consultation", detail: "Plan an upgrade path before workshop work begins." },
];

const BOOKING_STEPS = [
  { number: 1, label: "Job" },
  { number: 2, label: "Vehicle" },
  { number: 3, label: "Your details" },
] as const;

const INITIAL_FORM: BookingFormState = {
  bookingType: "",
  serviceOption: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleYear: "",
  registration: "",
  vin: "",
  customerName: "",
  email: "",
  phone: "",
  preferredDate: "",
  arrivalWindow: "any",
  notes: "",
  consent: false,
  company: "",
};

function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSunday(value: string) {
  return value ? new Date(`${value}T12:00:00`).getDay() === 0 : false;
}

export function BookingFlow() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<BookingFormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [copied, setCopied] = useState(false);
  const idempotencyKey = useRef<string | null>(null);

  const today = useMemo(() => localIsoDate(new Date()), []);
  const maxDate = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 18);
    return localIsoDate(date);
  }, []);

  useEffect(() => {
    const readBookingHash = () => {
      if (window.location.hash === "#service-booking") {
        setForm((current) => ({ ...current, bookingType: "service", serviceOption: "" }));
        setStep(1);
      }
      if (window.location.hash === "#dyno-booking") {
        setForm((current) => ({ ...current, bookingType: "dyno", serviceOption: "" }));
        setStep(1);
      }
    };

    readBookingHash();
    window.addEventListener("hashchange", readBookingHash);
    return () => window.removeEventListener("hashchange", readBookingHash);
  }, []);

  const update = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const focusField = (field: string) => {
    const targetId =
      field === "bookingType"
        ? "bookingType-service"
        : field === "serviceOption"
          ? `serviceOption-${form.bookingType === "dyno" ? DYNO_OPTIONS[0].value : SERVICE_OPTIONS[0].value}`
          : field;
    window.requestAnimationFrame(() => document.getElementById(targetId)?.focus());
  };

  const validateStep = (targetStep: number) => {
    const nextErrors: Record<string, string> = {};

    if (targetStep === 1) {
      if (!form.bookingType) nextErrors.bookingType = "Choose service or dyno tuning.";
      if (!form.serviceOption) nextErrors.serviceOption = "Choose the closest job type.";
    }

    if (targetStep === 2) {
      if (!form.vehicleMake.trim()) nextErrors.vehicleMake = "Enter the vehicle make.";
      if (!form.vehicleModel.trim()) nextErrors.vehicleModel = "Enter the vehicle model.";
      const year = Number(form.vehicleYear);
      const latestYear = new Date().getFullYear() + 1;
      if (!Number.isInteger(year) || year < 1900 || year > latestYear) {
        nextErrors.vehicleYear = `Enter a year between 1900 and ${latestYear}.`;
      }
      if (!form.registration.trim()) nextErrors.registration = "Enter the registration.";
    }

    if (targetStep === 3) {
      if (!form.customerName.trim()) nextErrors.customerName = "Enter your name.";
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = "Enter a valid email address.";
      const phoneDigits = form.phone.replace(/\D/g, "");
      if (phoneDigits.length < 8 || phoneDigits.length > 15) nextErrors.phone = "Enter a valid phone number.";
      if (!form.preferredDate) nextErrors.preferredDate = "Choose a preferred drop-off date.";
      if (form.preferredDate && form.preferredDate < today) nextErrors.preferredDate = "Choose today or a future date.";
      if (isSunday(form.preferredDate)) nextErrors.preferredDate = "The workshop is closed Sundays. Choose Monday to Saturday.";
      if (!form.consent) nextErrors.consent = "Please agree so PSI can contact you about the request.";
    }

    setErrors(nextErrors);
    const [firstError] = Object.keys(nextErrors);
    if (firstError) focusField(firstError);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(3, current + 1));
    document.getElementById("booking-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const goBack = () => {
    setErrors({});
    setStep((current) => Math.max(1, current - 1));
  };

  const submitBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (!validateStep(3)) return;

    setSubmitting(true);
    try {
      idempotencyKey.current ??=
        globalThis.crypto?.randomUUID?.() ??
        `psi-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      const response = await fetch("/api/v1/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.current,
        },
        body: JSON.stringify({
          ...form,
          vehicleYear: Number(form.vehicleYear),
          source: "web",
        }),
      });
      const payload = (await response.json()) as BookingApiResponse;
      if (!response.ok) {
        if (typeof payload.error === "object" && payload.error?.fields) {
          setErrors(payload.error.fields);
          const fieldNames = Object.keys(payload.error.fields);
          if (fieldNames.some((field) => ["bookingType", "serviceOption"].includes(field))) setStep(1);
          else if (fieldNames.some((field) => ["vehicleMake", "vehicleModel", "vehicleYear", "registration", "vin"].includes(field))) setStep(2);
          window.setTimeout(() => focusField(fieldNames[0]), 0);
        }
        const message =
          typeof payload.error === "string"
            ? payload.error
            : payload.error?.message;
        throw new Error(message || "We could not submit that request. Please try again.");
      }
      if (!payload.reference || !payload.status) {
        throw new Error("The workshop returned an incomplete response. Please call PSI to confirm your request.");
      }
      setResult({ reference: payload.reference, status: payload.status, message: payload.message });
      document.getElementById("booking-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "We could not submit that request. Please call PSI instead.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyReference = async () => {
    if (!result?.reference) return;
    try {
      await navigator.clipboard.writeText(result.reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const options = form.bookingType === "dyno" ? DYNO_OPTIONS : SERVICE_OPTIONS;

  if (result) {
    return (
      <section className="booking-section booking-success" id="booking-panel" aria-live="polite">
        <div className="success-mark" aria-hidden="true">✓</div>
        <p className="eyebrow">Request received</p>
        <h2>We’ve got it.</h2>
        <p className="success-lead">
          Your preferred date is not confirmed yet. The PSI team will contact you to confirm availability and the right next step for your car.
        </p>
        <div className="reference-card">
          <span>Your reference</span>
          <strong>{result.reference}</strong>
          <button type="button" onClick={copyReference}>{copied ? "Copied" : "Copy"}</button>
        </div>
        <div className="success-actions">
          <a className="button button-primary" href="tel:+61433431781">Call PSI</a>
          <button
            className="button button-ghost-dark"
            type="button"
            onClick={() => {
              setForm(INITIAL_FORM);
              idempotencyKey.current = null;
              setResult(null);
              setStep(1);
            }}
          >
            Start another request
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="booking-section" id="booking-panel">
      <span className="booking-anchor" id="service-booking" aria-hidden="true" />
      <span className="booking-anchor" id="dyno-booking" aria-hidden="true" />

      <div className="booking-intro">
        <div>
          <p className="eyebrow">Book your car</p>
          <h2>Let’s get you sorted.</h2>
        </div>
        <p>
          Choose a service, tell us about the car and request a preferred drop-off date. PSI will contact you before the booking is confirmed.
        </p>
      </div>

      <div className="booking-workspace">
        <aside className="booking-steps" aria-label="Booking progress">
          {BOOKING_STEPS.map(({ number, label }) => (
            <button
              key={number}
              type="button"
              className={step === number ? "active" : step > number ? "complete" : ""}
              onClick={() => {
                if (number < step) {
                  setStep(number);
                  setErrors({});
                }
              }}
              aria-current={step === number ? "step" : undefined}
            >
              <span>{step > number ? "✓" : `0${number}`}</span>
              {label}
            </button>
          ))}
          <div className="request-note">
            <strong>Booking request</strong>
            <p>No payment is taken. PSI confirms the date with you directly.</p>
          </div>
        </aside>

        <form className="booking-form" onSubmit={submitBooking} noValidate>
          {step === 1 && (
            <fieldset>
              <legend>What can we help with?</legend>
              <p className="field-intro">Pick the closest option. You can explain the details later.</p>

              <div className="type-grid">
                <button
                  id="bookingType-service"
                  type="button"
                  className={`type-card ${form.bookingType === "service" ? "selected" : ""}`}
                  onClick={() => {
                    update("bookingType", "service");
                    update("serviceOption", "");
                  }}
                  aria-pressed={form.bookingType === "service"}
                  aria-describedby={errors.bookingType ? "bookingType-error" : undefined}
                >
                  <span className="type-index">01</span>
                  <strong>Vehicle service</strong>
                  <small>Maintenance, diagnostics and repairs</small>
                </button>
                <button
                  id="bookingType-dyno"
                  type="button"
                  className={`type-card ${form.bookingType === "dyno" ? "selected" : ""}`}
                  onClick={() => {
                    update("bookingType", "dyno");
                    update("serviceOption", "");
                  }}
                  aria-pressed={form.bookingType === "dyno"}
                  aria-describedby={errors.bookingType ? "bookingType-error" : undefined}
                >
                  <span className="type-index">02</span>
                  <strong>Dyno tune</strong>
                  <small>Tuning, health checks and calibration</small>
                </button>
              </div>
              {errors.bookingType && <p className="field-error" id="bookingType-error" role="alert">{errors.bookingType}</p>}

              {form.bookingType && (
                <div
                  className="option-list"
                  role="radiogroup"
                  aria-required="true"
                  aria-invalid={Boolean(errors.serviceOption)}
                  aria-describedby={errors.serviceOption ? "serviceOption-error" : undefined}
                >
                  <p className="field-label">Choose the closest job type</p>
                  {options.map((option) => (
                    <label
                      key={option.value}
                      htmlFor={`serviceOption-${option.value}`}
                      aria-label={option.label}
                      className={form.serviceOption === option.value ? "selected" : ""}
                    >
                      <input
                        id={`serviceOption-${option.value}`}
                        type="radio"
                        name="serviceOption"
                        value={option.value}
                        checked={form.serviceOption === option.value}
                        onChange={(event) => update("serviceOption", event.target.value)}
                        required
                      />
                      <span>
                        <strong>{option.label}</strong>
                        <small>{option.detail}</small>
                      </span>
                      <b aria-hidden="true" />
                    </label>
                  ))}
                  {errors.serviceOption && <p className="field-error" id="serviceOption-error" role="alert">{errors.serviceOption}</p>}
                </div>
              )}
            </fieldset>
          )}

          {step === 2 && (
            <fieldset>
              <legend>Tell us about the car.</legend>
              <p className="field-intro">The basics help PSI prepare before getting in touch.</p>
              <div className="form-grid">
                <Field label="Make" id="vehicleMake" error={errors.vehicleMake}>
                  <input id="vehicleMake" value={form.vehicleMake} onChange={(e) => update("vehicleMake", e.target.value)} autoComplete="off" maxLength={60} placeholder="e.g. Holden" required aria-invalid={Boolean(errors.vehicleMake)} aria-describedby={errors.vehicleMake ? "vehicleMake-error" : undefined} />
                </Field>
                <Field label="Model" id="vehicleModel" error={errors.vehicleModel}>
                  <input id="vehicleModel" value={form.vehicleModel} onChange={(e) => update("vehicleModel", e.target.value)} autoComplete="off" maxLength={80} placeholder="e.g. VF SS" required aria-invalid={Boolean(errors.vehicleModel)} aria-describedby={errors.vehicleModel ? "vehicleModel-error" : undefined} />
                </Field>
                <Field label="Year" id="vehicleYear" error={errors.vehicleYear}>
                  <input id="vehicleYear" type="number" inputMode="numeric" value={form.vehicleYear} onChange={(e) => update("vehicleYear", e.target.value)} min="1900" max={new Date().getFullYear() + 1} placeholder="2017" required aria-invalid={Boolean(errors.vehicleYear)} aria-describedby={errors.vehicleYear ? "vehicleYear-error" : undefined} />
                </Field>
                <Field label="Registration" id="registration" error={errors.registration}>
                  <input id="registration" value={form.registration} onChange={(e) => update("registration", e.target.value.toUpperCase())} autoCapitalize="characters" maxLength={12} placeholder="ABC123" required aria-invalid={Boolean(errors.registration)} aria-describedby={errors.registration ? "registration-error" : undefined} />
                </Field>
                <Field label="VIN" hint="Optional" id="vin" error={errors.vin} wide>
                  <input id="vin" value={form.vin} onChange={(e) => update("vin", e.target.value.toUpperCase())} autoCapitalize="characters" maxLength={17} placeholder="17-character vehicle identification number" aria-invalid={Boolean(errors.vin)} aria-describedby={errors.vin ? "vin-error" : undefined} />
                </Field>
              </div>
            </fieldset>
          )}

          {step === 3 && (
            <fieldset>
              <legend>When and how should we reach you?</legend>
              <p className="field-intro">Request a preferred date. PSI will confirm it with you before drop-off.</p>
              <div className="form-grid">
                <Field label="Your name" id="customerName" error={errors.customerName}>
                  <input id="customerName" value={form.customerName} onChange={(e) => update("customerName", e.target.value)} autoComplete="name" maxLength={100} required aria-invalid={Boolean(errors.customerName)} aria-describedby={errors.customerName ? "customerName-error" : undefined} />
                </Field>
                <Field label="Phone" id="phone" error={errors.phone}>
                  <input id="phone" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} autoComplete="tel" maxLength={30} placeholder="04xx xxx xxx" required aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "phone-error" : undefined} />
                </Field>
                <Field label="Email" id="email" error={errors.email} wide>
                  <input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} autoComplete="email" maxLength={160} placeholder="you@example.com" required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} />
                </Field>
                <Field label="Preferred drop-off date" id="preferredDate" error={errors.preferredDate}>
                  <input id="preferredDate" type="date" value={form.preferredDate} onChange={(e) => update("preferredDate", e.target.value)} min={today} max={maxDate} required aria-invalid={Boolean(errors.preferredDate)} aria-describedby={errors.preferredDate ? "preferredDate-error" : undefined} />
                </Field>
                <Field label="Arrival preference" id="arrivalWindow" error={errors.arrivalWindow}>
                  <select id="arrivalWindow" value={form.arrivalWindow} onChange={(e) => update("arrivalWindow", e.target.value as ArrivalWindow)} required aria-invalid={Boolean(errors.arrivalWindow)} aria-describedby={errors.arrivalWindow ? "arrivalWindow-error" : undefined}>
                    <option value="any">No preference</option>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                  </select>
                </Field>
                <Field label="Anything PSI should know?" hint="Optional" id="notes" error={errors.notes} wide>
                  <textarea id="notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} maxLength={1200} rows={5} placeholder="Symptoms, modifications, goals, warning lights or anything else that helps." aria-invalid={Boolean(errors.notes)} aria-describedby={errors.notes ? "notes-error" : undefined} />
                </Field>
              </div>

              <label className={`consent-row ${errors.consent ? "has-error" : ""}`}>
                <input id="consent" type="checkbox" checked={form.consent} onChange={(e) => update("consent", e.target.checked)} required aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? "consent-error" : undefined} />
                <span>
                  I agree that PSI Performance may contact me about this booking request. See the{" "}
                  <a href="https://psiperformance.com.au/policies/privacy-policy" target="_blank" rel="noreferrer">privacy policy</a>.
                </span>
              </label>
              {errors.consent && <p className="field-error" id="consent-error" role="alert">{errors.consent}</p>}

              <div className="honeypot" aria-hidden="true">
                <label htmlFor="company">Company</label>
                <input id="company" tabIndex={-1} autoComplete="off" value={form.company} onChange={(e) => update("company", e.target.value)} />
              </div>
            </fieldset>
          )}

          {formError && <div className="form-alert" role="alert">{formError} <a href="tel:+61433431781">Call 0433 431 781</a></div>}

          <div className="form-actions">
            {step > 1 && <button type="button" className="button button-ghost-dark" onClick={goBack}>Back</button>}
            {step < 3 ? (
              <button type="button" className="button button-primary" onClick={goNext}>Continue <span aria-hidden="true">→</span></button>
            ) : (
              <button type="submit" className="button button-primary" disabled={submitting}>
                {submitting ? "Sending request…" : "Send booking request"}
              </button>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}

function Field({
  label,
  hint,
  id,
  error,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  id: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`field ${wide ? "field-wide" : ""}`}>
      <label htmlFor={id}>
        {label} {hint && <span>{hint}</span>}
      </label>
      {children}
      {error && <p className="field-error" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  );
}
