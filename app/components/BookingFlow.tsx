"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type BookingType = "service" | "dyno";
type ArrivalWindow = "morning" | "afternoon" | "any";

type BookingFormState = {
  bookingType: BookingType | "";
  requestDetails: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  registration: string;
  vin: string;
  preferredDate: string;
  arrivalWindow: ArrivalWindow;
  consent: boolean;
  depositTermsAccepted: boolean;
  company: string;
};

type CheckoutSuccess = {
  checkoutId: string;
  reference: string;
  state: "requires_payment";
  deposit: {
    amountCents: number;
    currency: "AUD";
  };
  payment: {
    provider: string;
    checkoutUrl: string;
  };
};

type CheckoutApiResponse = Partial<CheckoutSuccess> & {
  error?:
    | string
    | {
        code?: string;
        message?: string;
        fields?: Record<string, string>;
      };
};

const BOOKING_TYPES = {
  service: {
    label: "Service & Report",
    price: "From $385 + GST",
    detail: "Servicing, inspection and a clear report on what your car needs.",
  },
  dyno: {
    label: "Dyno tuning",
    price: "From $350 + GST",
    detail: "Hub dyno calibration focused on safe power, drivability and vehicle health.",
  },
} as const;

const BOOKING_STEPS = [
  { number: 1, label: "Job" },
  { number: 2, label: "You & car" },
  { number: 3, label: "Preferred date" },
  { number: 4, label: "Deposit" },
] as const;

const INITIAL_FORM: BookingFormState = {
  bookingType: "",
  requestDetails: "",
  firstName: "",
  lastName: "",
  email: "",
  mobile: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleYear: "",
  registration: "",
  vin: "",
  preferredDate: "",
  arrivalWindow: "any",
  consent: false,
  depositTermsAccepted: false,
  company: "",
};

function workshopIsoDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";
  return value("year") + "-" + value("month") + "-" + value("day");
}

function calendarIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function addMonthsToIsoDate(value: string, months: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function dateFromIso(value: string) {
  const parts = value.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
}

function isSunday(value: string) {
  return value ? dateFromIso(value).getDay() === 0 : false;
}

function displayDate(value: string) {
  if (!value) return "Not selected";
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(dateFromIso(value));
}

function bookingStepForField(field: string) {
  if (["bookingType", "requestDetails"].includes(field)) return 1;
  if (
    [
      "firstName",
      "lastName",
      "email",
      "mobile",
      "vehicleMake",
      "vehicleModel",
      "vehicleYear",
      "registration",
      "vin",
      "consent",
    ].includes(field)
  ) {
    return 2;
  }
  if (["preferredDate", "arrivalWindow"].includes(field)) return 3;
  return 4;
}

export function BookingFlow() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<BookingFormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKey = useRef<string | null>(null);

  const today = useMemo(() => workshopIsoDate(new Date()), []);
  const maxDate = useMemo(() => addMonthsToIsoDate(workshopIsoDate(new Date()), 18), []);

  useEffect(() => {
    const applyType = (bookingType: BookingType) => {
      setForm((current) => ({ ...current, bookingType }));
      idempotencyKey.current = null;
      setErrors({});
      setFormError("");
      setErrorCode("");
      setStep(1);
    };

    const readBookingHash = () => {
      if (window.location.hash === "#service-booking") {
        applyType("service");
        window.requestAnimationFrame(() => document.getElementById("bookingType")?.focus());
      }
      if (window.location.hash === "#dyno-booking") {
        applyType("dyno");
        window.requestAnimationFrame(() => document.getElementById("bookingType")?.focus());
      }
    };

    const readBookingIntent = (event: Event) => {
      const detail = (event as CustomEvent<{ bookingType?: BookingType }>).detail;
      if (detail?.bookingType === "service" || detail?.bookingType === "dyno") {
        applyType(detail.bookingType);
      }
    };

    readBookingHash();
    window.addEventListener("hashchange", readBookingHash);
    window.addEventListener("psi:booking-intent", readBookingIntent);
    return () => {
      window.removeEventListener("hashchange", readBookingHash);
      window.removeEventListener("psi:booking-intent", readBookingIntent);
    };
  }, []);

  const update = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    idempotencyKey.current = null;
    setFormError("");
    setErrorCode("");
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const chooseBookingType = (value: string) => {
    if (value === "parts") {
      window.location.assign("/parts");
      return;
    }
    if (value !== "service" && value !== "dyno") {
      update("bookingType", "");
      return;
    }
    update("bookingType", value);
  };

  const focusField = (field: string) => {
    const targetId =
      field === "depositPolicyVersion" ||
      field === "depositAmountCents" ||
      field === "currency"
        ? "depositTermsAccepted"
        : field;
    window.requestAnimationFrame(() => document.getElementById(targetId)?.focus());
  };

  const showStep = (nextStep: number) => {
    setStep(nextStep);
    window.requestAnimationFrame(() => {
      document.getElementById("booking-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("booking-step-" + nextStep + "-heading")?.focus();
    });
  };

  const validateStep = (targetStep: number) => {
    const nextErrors: Record<string, string> = {};

    if (targetStep === 1) {
      if (!form.bookingType) nextErrors.bookingType = "Choose Service & Report or Dyno tuning.";
      if (!form.requestDetails.trim()) nextErrors.requestDetails = "Tell PSI exactly what you are after.";
    }

    if (targetStep === 2) {
      if (!form.firstName.trim()) nextErrors.firstName = "Enter your first name.";
      if (!form.lastName.trim()) nextErrors.lastName = "Enter your last name.";
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = "Enter a valid email address.";
      const phoneDigits = form.mobile.replace(/\D/g, "");
      if (phoneDigits.length < 8 || phoneDigits.length > 15) nextErrors.mobile = "Enter a valid mobile number.";
      if (!form.vehicleMake.trim()) nextErrors.vehicleMake = "Enter the vehicle make.";
      if (!form.vehicleModel.trim()) nextErrors.vehicleModel = "Enter the vehicle model.";
      const year = Number(form.vehicleYear);
      const latestYear = Number(workshopIsoDate(new Date()).slice(0, 4)) + 1;
      if (!Number.isInteger(year) || year < 1900 || year > latestYear) {
        nextErrors.vehicleYear = "Enter a year between 1900 and " + latestYear + ".";
      }
      if (!form.registration.trim()) nextErrors.registration = "Enter the registration.";
      if (form.vin.trim() && form.vin.trim().length !== 17) nextErrors.vin = "A VIN must contain 17 characters.";
      if (!form.consent) nextErrors.consent = "Please agree so PSI can contact you about this request.";
    }

    if (targetStep === 3) {
      if (!form.preferredDate) nextErrors.preferredDate = "Choose a preferred drop-off date.";
      if (form.preferredDate && form.preferredDate < today) nextErrors.preferredDate = "Choose today or a future date.";
      if (form.preferredDate && form.preferredDate > maxDate) nextErrors.preferredDate = "Choose a date within the next 18 months.";
      if (isSunday(form.preferredDate)) nextErrors.preferredDate = "The workshop is closed Sundays. Choose Monday to Saturday.";
    }

    if (targetStep === 4 && !form.depositTermsAccepted) {
      nextErrors.depositTermsAccepted = "Confirm the deposit and date terms before continuing to payment.";
    }

    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) focusField(firstError);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    showStep(Math.min(4, step + 1));
  };

  const goBack = () => {
    setErrors({});
    setFormError("");
    setErrorCode("");
    showStep(Math.max(1, step - 1));
  };

  const startCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setErrorCode("");
    if (!validateStep(4) || !form.bookingType) return;

    setSubmitting(true);
    try {
      idempotencyKey.current ??=
        globalThis.crypto?.randomUUID?.() ??
        "psi-" +
          Date.now() +
          "-" +
          Math.random().toString(36).slice(2) +
          "-" +
          Math.random().toString(36).slice(2);

      const response = await fetch("/api/v1/booking-checkouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.current,
        },
        body: JSON.stringify({
          bookingType: form.bookingType,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          mobile: form.mobile.trim(),
          vehicleMake: form.vehicleMake.trim(),
          vehicleModel: form.vehicleModel.trim(),
          vehicleYear: Number(form.vehicleYear),
          registration: form.registration.trim().toUpperCase(),
          vin: form.vin.trim().toUpperCase(),
          preferredDate: form.preferredDate,
          arrivalWindow: form.arrivalWindow,
          requestDetails: form.requestDetails.trim(),
          source: "web",
          consent: true,
          depositTermsAccepted: true,
          depositPolicyVersion: "psi-deposit-v1",
          company: form.company,
        }),
      });

      const raw = await response.text();
      let payload: CheckoutApiResponse = {};
      try {
        payload = raw ? (JSON.parse(raw) as CheckoutApiResponse) : {};
      } catch {
        payload = {};
      }

      if (!response.ok) {
        const apiError = payload.error;
        const fields = typeof apiError === "object" ? apiError.fields : undefined;
        if (fields && Object.keys(fields).length > 0) {
          setErrors(fields);
          const firstField = Object.keys(fields)[0];
          setStep(bookingStepForField(firstField));
          window.setTimeout(() => focusField(firstField), 0);
        }
        const code = typeof apiError === "object" ? apiError.code || "" : "";
        const message =
          typeof apiError === "string"
            ? apiError
            : apiError?.message || "Secure checkout could not be started. Please try again.";
        setErrorCode(code);
        if (code === "PAYMENT_PROVIDER_NOT_CONFIGURED") {
          setFormError(
            "Online deposit payments are not connected yet. Your request has not been submitted and no payment has been taken.",
          );
          return;
        }
        setFormError(message);
        return;
      }

      const replayed = response.headers.get("Idempotency-Replayed") === "true";
      if (response.status !== 201 && !(response.status === 200 && replayed)) {
        setFormError("PSI returned an unexpected checkout state. No payment has been taken; please try again.");
        return;
      }

      const checkoutUrl = payload.payment?.checkoutUrl;
      if (
        payload.state !== "requires_payment" ||
        payload.deposit?.amountCents !== 20_000 ||
        payload.deposit.currency !== "AUD" ||
        !checkoutUrl
      ) {
        setFormError("PSI returned an incomplete checkout. No payment has been taken; please try again.");
        return;
      }

      let destination: URL;
      try {
        destination = new URL(checkoutUrl);
      } catch {
        setFormError("PSI returned an invalid checkout address. No payment has been taken.");
        return;
      }
      if (destination.protocol !== "https:" || destination.username || destination.password) {
        setFormError("The secure checkout address could not be verified. No payment has been taken.");
        return;
      }

      window.location.assign(destination.toString());
    } catch {
      setFormError("Secure checkout could not be reached. No payment has been taken; check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = form.bookingType ? BOOKING_TYPES[form.bookingType] : null;

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
          Tell us what you need, choose a preferred date and secure the request with a $200 AUD deposit. PSI confirms the date after review.
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
                  setErrors({});
                  setFormError("");
                  setErrorCode("");
                  showStep(number);
                }
              }}
              aria-current={step === number ? "step" : undefined}
            >
              <span>{step > number ? "✓" : "0" + number}</span>
              {label}
            </button>
          ))}
          <div className="request-note">
            <strong>Deposit required</strong>
            <p>No request or booking is submitted until secure checkout confirms payment. Your date still remains pending PSI approval.</p>
          </div>
        </aside>

        <form className="booking-form" onSubmit={startCheckout} noValidate>
          {step === 1 && (
            <fieldset>
              <legend id="booking-step-1-heading" tabIndex={-1}>What are you booking in for?</legend>
              <p className="field-intro">Choose the closest option, then tell PSI exactly what you want checked or completed.</p>

              <Field label="Booking type" id="bookingType" error={errors.bookingType} wide>
                <select
                  id="bookingType"
                  value={form.bookingType}
                  onChange={(event) => chooseBookingType(event.target.value)}
                  required
                  aria-invalid={Boolean(errors.bookingType)}
                  aria-describedby={errors.bookingType ? "bookingType-error" : undefined}
                >
                  <option value="">Choose service, dyno or parts</option>
                  <option value="service">Service & Report — from $385 + GST</option>
                  <option value="dyno">Dyno tuning — from $350 + GST</option>
                  <option value="parts">Buy some parts</option>
                </select>
              </Field>

              {selectedType && (
                <div className="selected-job-card" aria-live="polite">
                  <div>
                    <strong>{selectedType.label}</strong>
                    <span>{selectedType.price}</span>
                  </div>
                  <p>{selectedType.detail}</p>
                </div>
              )}

              <Field label="What exactly are you after?" id="requestDetails" error={errors.requestDetails} wide>
                <textarea
                  id="requestDetails"
                  value={form.requestDetails}
                  onChange={(event) => update("requestDetails", event.target.value)}
                  maxLength={2000}
                  rows={7}
                  placeholder="Describe the service, symptoms, modifications, tuning goals or parts fitted. Include anything that will help PSI prepare."
                  required
                  aria-invalid={Boolean(errors.requestDetails)}
                  aria-describedby={errors.requestDetails ? "requestDetails-error" : undefined}
                />
              </Field>
              <div className="character-count">{form.requestDetails.length}/2000</div>
            </fieldset>
          )}

          {step === 2 && (
            <fieldset>
              <legend id="booking-step-2-heading" tabIndex={-1}>You and your car.</legend>
              <p className="field-intro">
                Customer accounts are being prepared. <a className="inline-gold-link" href="/account#sign-in">View the account preview</a>, or continue below without one.
              </p>
              <div className="form-grid">
                <Field label="First name" id="firstName" error={errors.firstName}>
                  <input id="firstName" value={form.firstName} onChange={(event) => update("firstName", event.target.value)} autoComplete="given-name" maxLength={60} required aria-invalid={Boolean(errors.firstName)} aria-describedby={errors.firstName ? "firstName-error" : undefined} />
                </Field>
                <Field label="Last name" id="lastName" error={errors.lastName}>
                  <input id="lastName" value={form.lastName} onChange={(event) => update("lastName", event.target.value)} autoComplete="family-name" maxLength={60} required aria-invalid={Boolean(errors.lastName)} aria-describedby={errors.lastName ? "lastName-error" : undefined} />
                </Field>
                <Field label="Email" id="email" error={errors.email}>
                  <input id="email" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" maxLength={254} placeholder="you@example.com" required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} />
                </Field>
                <Field label="Mobile" id="mobile" error={errors.mobile}>
                  <input id="mobile" type="tel" value={form.mobile} onChange={(event) => update("mobile", event.target.value)} autoComplete="tel" inputMode="tel" maxLength={32} placeholder="04xx xxx xxx" required aria-invalid={Boolean(errors.mobile)} aria-describedby={errors.mobile ? "mobile-error" : undefined} />
                </Field>
                <Field label="Make" id="vehicleMake" error={errors.vehicleMake}>
                  <input id="vehicleMake" value={form.vehicleMake} onChange={(event) => update("vehicleMake", event.target.value)} autoComplete="off" maxLength={60} placeholder="e.g. Holden" required aria-invalid={Boolean(errors.vehicleMake)} aria-describedby={errors.vehicleMake ? "vehicleMake-error" : undefined} />
                </Field>
                <Field label="Model" id="vehicleModel" error={errors.vehicleModel}>
                  <input id="vehicleModel" value={form.vehicleModel} onChange={(event) => update("vehicleModel", event.target.value)} autoComplete="off" maxLength={80} placeholder="e.g. VF SS" required aria-invalid={Boolean(errors.vehicleModel)} aria-describedby={errors.vehicleModel ? "vehicleModel-error" : undefined} />
                </Field>
                <Field label="Year" id="vehicleYear" error={errors.vehicleYear}>
                  <input id="vehicleYear" type="number" inputMode="numeric" value={form.vehicleYear} onChange={(event) => update("vehicleYear", event.target.value)} min="1900" max={new Date().getFullYear() + 1} placeholder="2017" required aria-invalid={Boolean(errors.vehicleYear)} aria-describedby={errors.vehicleYear ? "vehicleYear-error" : undefined} />
                </Field>
                <Field label="Registration" id="registration" error={errors.registration}>
                  <input id="registration" value={form.registration} onChange={(event) => update("registration", event.target.value.toUpperCase())} autoCapitalize="characters" maxLength={20} placeholder="ABC123" required aria-invalid={Boolean(errors.registration)} aria-describedby={errors.registration ? "registration-error" : undefined} />
                </Field>
                <Field label="VIN" hint="Optional" id="vin" error={errors.vin} wide>
                  <input id="vin" value={form.vin} onChange={(event) => update("vin", event.target.value.toUpperCase())} autoCapitalize="characters" maxLength={17} placeholder="17-character vehicle identification number" aria-invalid={Boolean(errors.vin)} aria-describedby={errors.vin ? "vin-error" : undefined} />
                </Field>
              </div>

              <label className={"consent-row " + (errors.consent ? "has-error" : "")}>
                <input id="consent" type="checkbox" checked={form.consent} onChange={(event) => update("consent", event.target.checked)} required aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? "consent-error" : undefined} />
                <span>
                  I agree that PSI Performance may use these details to manage this request and contact me. See the{" "}
                  <a href="https://psiperformance.com.au/policies/privacy-policy" target="_blank" rel="noreferrer">privacy policy</a>.
                </span>
              </label>
              {errors.consent && <p className="field-error" id="consent-error" role="alert">{errors.consent}</p>}
            </fieldset>
          )}

          {step === 3 && (
            <fieldset>
              <legend id="booking-step-3-heading" tabIndex={-1}>Choose a preferred date.</legend>
              <p className="field-intro">Select any available-to-request Monday–Saturday date. Existing bookings are private and are not displayed.</p>

              <CalendarPicker
                value={form.preferredDate}
                min={today}
                max={maxDate}
                error={errors.preferredDate}
                onChange={(value) => update("preferredDate", value)}
              />

              <div className="date-selection-footer">
                <div>
                  <span>Preferred date</span>
                  <strong>{displayDate(form.preferredDate)}</strong>
                </div>
                <Field label="Arrival preference" id="arrivalWindow" error={errors.arrivalWindow}>
                  <select
                    id="arrivalWindow"
                    value={form.arrivalWindow}
                    onChange={(event) => update("arrivalWindow", event.target.value as ArrivalWindow)}
                    required
                    aria-invalid={Boolean(errors.arrivalWindow)}
                    aria-describedby={errors.arrivalWindow ? "arrivalWindow-error" : undefined}
                  >
                    <option value="any">No preference</option>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                  </select>
                </Field>
              </div>
              <p className="date-disclaimer">This is a preferred date, not a confirmed appointment. PSI will review it after your deposit is paid.</p>
            </fieldset>
          )}

          {step === 4 && (
            <fieldset>
              <legend id="booking-step-4-heading" tabIndex={-1}>Secure your request.</legend>
              <p className="field-intro">Review the details below. Only a completed, verified secure checkout submits this request.</p>

              <div className="deposit-layout">
                <div className="deposit-summary">
                  <p className="deposit-kicker">Booking summary</p>
                  <dl>
                    <div><dt>Job</dt><dd>{selectedType?.label}</dd></div>
                    <div><dt>Price guide</dt><dd>{selectedType?.price}</dd></div>
                    <div><dt>Customer</dt><dd>{form.firstName} {form.lastName}</dd></div>
                    <div><dt>Vehicle</dt><dd>{form.vehicleYear} {form.vehicleMake} {form.vehicleModel}<br />{form.registration}</dd></div>
                    <div><dt>Preferred date</dt><dd>{displayDate(form.preferredDate)}</dd></div>
                    <div className="deposit-total"><dt>Deposit due today</dt><dd>$200.00 AUD</dd></div>
                  </dl>
                  <p>The final workshop total is confirmed by PSI after the scope is reviewed. The deposit is recorded against the request only after the payment provider confirms it.</p>
                </div>

                <div className="bank-panel">
                  <p className="deposit-kicker">Manual bank transfer</p>
                  <h3>Available after verification setup.</h3>
                  <p>Bank instructions will be shown only after PSI has a unique payment-reference and staff verification workflow. This prevents unidentified deposits. Contact the workshop if you need to arrange a manual transfer.</p>
                </div>
              </div>

              <label className={"deposit-terms " + (errors.depositTermsAccepted ? "has-error" : "")}>
                <input
                  id="depositTermsAccepted"
                  type="checkbox"
                  checked={form.depositTermsAccepted}
                  onChange={(event) => update("depositTermsAccepted", event.target.checked)}
                  required
                  aria-invalid={Boolean(errors.depositTermsAccepted)}
                  aria-describedby={errors.depositTermsAccepted ? "depositTermsAccepted-error" : undefined}
                />
                <span>I understand the $200 AUD deposit is required before PSI reviews this request, and my preferred date is not confirmed until PSI contacts me.</span>
              </label>
              {errors.depositTermsAccepted && <p className="field-error" id="depositTermsAccepted-error" role="alert">{errors.depositTermsAccepted}</p>}

              <div className="honeypot" aria-hidden="true">
                <label htmlFor="company">Company</label>
                <input id="company" tabIndex={-1} autoComplete="off" value={form.company} onChange={(event) => update("company", event.target.value)} />
              </div>
            </fieldset>
          )}

          {formError && (
            <div className={"form-alert " + (errorCode === "PAYMENT_PROVIDER_NOT_CONFIGURED" ? "form-alert-notice" : "")} role="alert">
              <strong>{errorCode === "PAYMENT_PROVIDER_NOT_CONFIGURED" ? "Secure payments coming online" : "Checkout could not start"}</strong>
              <span>{formError}</span>
              <a href="tel:+61433431781">Call PSI on 0433 431 781</a>
            </div>
          )}

          <div className="form-actions">
            {step > 1 && <button type="button" className="button button-ghost-dark" onClick={goBack}>Back</button>}
            {step < 4 ? (
              <button type="button" className="button button-primary" onClick={goNext}>Continue <span aria-hidden="true">→</span></button>
            ) : (
              <button type="submit" className="button button-primary payment-button" disabled={submitting}>
                {submitting ? "Opening secure checkout…" : "Pay $200 deposit & submit"}
              </button>
            )}
          </div>
          {step === 4 && <p className="secure-checkout-note">No payment is taken on this page. You will be redirected only when secure checkout is available.</p>}
        </form>
      </div>
    </section>
  );
}

function CalendarPicker({
  value,
  min,
  max,
  error,
  onChange,
}: {
  value: string;
  min: string;
  max: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const initialDate = value ? dateFromIso(value) : dateFromIso(min);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const firstDayIndex = (visibleMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstDayIndex }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthKey = visibleMonth.getFullYear() * 12 + visibleMonth.getMonth();
  const minDate = dateFromIso(min);
  const maxDate = dateFromIso(max);
  const minMonthKey = minDate.getFullYear() * 12 + minDate.getMonth();
  const maxMonthKey = maxDate.getFullYear() * 12 + maxDate.getMonth();
  const monthLabel = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric" }).format(visibleMonth);

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return (
    <div
      id="preferredDate"
      className={"calendar-card " + (error ? "has-error" : "")}
      tabIndex={-1}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? "preferredDate-error" : undefined}
    >
      <div className="calendar-header">
        <button type="button" onClick={() => moveMonth(-1)} disabled={monthKey <= minMonthKey} aria-label="Show previous month">←</button>
        <strong aria-live="polite">{monthLabel}</strong>
        <button type="button" onClick={() => moveMonth(1)} disabled={monthKey >= maxMonthKey} aria-label="Show next month">→</button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="calendar-grid" role="grid" aria-label={monthLabel}>
        {cells.map((day, index) => {
          if (day === null) return <span key={"empty-" + index} className="calendar-empty" aria-hidden="true" />;
          const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day, 12, 0, 0);
          const iso = calendarIsoDate(date);
          const disabled = iso < min || iso > max || date.getDay() === 0;
          const selected = value === iso;
          const label = new Intl.DateTimeFormat("en-AU", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(date);
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              disabled={disabled}
              className={selected ? "selected" : ""}
              aria-label={label + (date.getDay() === 0 ? ", workshop closed" : "")}
              aria-selected={selected}
              onClick={() => onChange(iso)}
            >
              {day}
            </button>
          );
        })}
      </div>
      {error && <p className="field-error" id="preferredDate-error" role="alert">{error}</p>}
    </div>
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
    <div className={"field " + (wide ? "field-wide" : "")}>
      <label htmlFor={id}>
        {label} {hint && <span>{hint}</span>}
      </label>
      {children}
      {error && <p className="field-error" id={id + "-error"} role="alert">{error}</p>}
    </div>
  );
}
