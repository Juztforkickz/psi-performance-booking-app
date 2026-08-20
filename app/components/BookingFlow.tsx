"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type BookingType = "service" | "dyno";
type ArrivalWindow = "morning" | "afternoon" | "any";

type TuningDetails = {
  engineState: "stock" | "modified" | "";
  engineModifications: string;
  transmissionType: "automatic" | "manual" | "";
  transmissionSetup:
    | "stock"
    | "converter"
    | "trans_cooler"
    | "converter_and_cooler"
    | "upgraded_clutch"
    | "built_transmission"
    | "other"
    | "";
  transmissionDetails: string;
  differentialType: "stock" | "truetrac" | "wavetrac" | "other" | "";
  differentialGearRatio: string;
  differentialDetails: string;
  fuelPumpType: "stock" | "upgraded" | "unknown" | "";
  fuelPumpDetails: string;
  injectorType: "stock" | "upgraded" | "unknown" | "";
  injectorDetails: string;
  fuelType: "98_ron" | "e85" | "flex_fuel" | "race_fuel" | "other" | "";
  fuelTypeDetails: string;
  intakeType: "stock" | "upgraded" | "";
  intakeDetails: string;
  previouslyTuned: "no" | "yes" | "unknown" | "";
  previousTuner: string;
  exhaustType: "stock" | "cat_back" | "full_system" | "custom" | "";
  exhaustSize: "stock" | "2_5_inch" | "3_inch" | "3_5_inch" | "4_inch" | "other" | "";
  varexControlled: "no" | "yes" | "unknown" | "";
  exhaustDetails: string;
  camshaftType: "stock" | "upgraded" | "unknown" | "";
  camshaftDetails: string;
};

type BookingFormState = {
  bookingType: BookingType | "";
  requestDetails: string;
  tuningDetails: TuningDetails;
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
  { number: 1, label: "Job & setup" },
  { number: 2, label: "You & car" },
  { number: 3, label: "Preferred date" },
  { number: 4, label: "Deposit" },
] as const;

const TUNING_FIELD_NAMES = [
  "engineState",
  "engineModifications",
  "transmissionType",
  "transmissionSetup",
  "transmissionDetails",
  "differentialType",
  "differentialGearRatio",
  "differentialDetails",
  "fuelPumpType",
  "fuelPumpDetails",
  "injectorType",
  "injectorDetails",
  "fuelType",
  "fuelTypeDetails",
  "intakeType",
  "intakeDetails",
  "previouslyTuned",
  "previousTuner",
  "exhaustType",
  "exhaustSize",
  "varexControlled",
  "exhaustDetails",
  "camshaftType",
  "camshaftDetails",
] as const;

const INITIAL_FORM: BookingFormState = {
  bookingType: "",
  requestDetails: "",
  tuningDetails: {
    engineState: "",
    engineModifications: "",
    transmissionType: "",
    transmissionSetup: "",
    transmissionDetails: "",
    differentialType: "",
    differentialGearRatio: "",
    differentialDetails: "",
    fuelPumpType: "",
    fuelPumpDetails: "",
    injectorType: "",
    injectorDetails: "",
    fuelType: "",
    fuelTypeDetails: "",
    intakeType: "",
    intakeDetails: "",
    previouslyTuned: "",
    previousTuner: "",
    exhaustType: "",
    exhaustSize: "",
    varexControlled: "",
    exhaustDetails: "",
    camshaftType: "",
    camshaftDetails: "",
  },
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

function tuningDetailsForCheckout(tuning: TuningDetails): TuningDetails {
  return {
    ...tuning,
    engineModifications: tuning.engineState === "modified" ? tuning.engineModifications.trim() : "",
    transmissionDetails: tuning.transmissionSetup !== "stock" ? tuning.transmissionDetails.trim() : "",
    differentialGearRatio: tuning.differentialGearRatio.trim(),
    differentialDetails: tuning.differentialType === "other" ? tuning.differentialDetails.trim() : "",
    fuelPumpDetails: tuning.fuelPumpType === "upgraded" ? tuning.fuelPumpDetails.trim() : "",
    injectorDetails: tuning.injectorType === "upgraded" ? tuning.injectorDetails.trim() : "",
    fuelTypeDetails: tuning.fuelType === "other" ? tuning.fuelTypeDetails.trim() : "",
    intakeDetails: tuning.intakeType === "upgraded" ? tuning.intakeDetails.trim() : "",
    previousTuner: tuning.previouslyTuned === "yes" ? tuning.previousTuner.trim() : "",
    exhaustDetails: tuning.exhaustType !== "stock" ? tuning.exhaustDetails.trim() : "",
    camshaftDetails: tuning.camshaftType === "upgraded" ? tuning.camshaftDetails.trim() : "",
  };
}

function bookingStepForField(field: string) {
  const normalisedField = field.replace(/^tuningDetails\./, "");
  if (
    ["bookingType", "requestDetails", "tuningDetails"].includes(normalisedField) ||
    TUNING_FIELD_NAMES.includes(normalisedField as (typeof TUNING_FIELD_NAMES)[number])
  ) {
    return 1;
  }
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
    ].includes(normalisedField)
  ) {
    return 2;
  }
  if (["preferredDate", "arrivalWindow"].includes(normalisedField)) return 3;
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

  const updateTuning = <K extends keyof TuningDetails>(key: K, value: TuningDetails[K]) => {
    setForm((current) => ({
      ...current,
      tuningDetails: { ...current.tuningDetails, [key]: value },
    }));
    idempotencyKey.current = null;
    setFormError("");
    setErrorCode("");
    setErrors((current) => {
      if (!current[key] && !current[`tuningDetails.${key}`]) return current;
      const next = { ...current };
      delete next[key];
      delete next[`tuningDetails.${key}`];
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
    const normalisedField = field.replace(/^tuningDetails\./, "");
    const targetId =
      normalisedField === "depositPolicyVersion" ||
      normalisedField === "depositAmountCents" ||
      normalisedField === "currency"
        ? "depositTermsAccepted"
        : normalisedField === "tuningDetails"
          ? "tuning-setup-heading"
        : normalisedField;
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

      if (form.bookingType === "dyno") {
        const tuning = form.tuningDetails;
        if (!tuning.engineState) nextErrors.engineState = "Choose whether the engine is stock or modified.";
        if (tuning.engineState === "modified" && !tuning.engineModifications.trim()) {
          nextErrors.engineModifications = "List the engine modifications PSI needs to know about.";
        }
        if (!tuning.transmissionType) nextErrors.transmissionType = "Choose automatic or manual.";
        if (!tuning.transmissionSetup) nextErrors.transmissionSetup = "Choose the current transmission setup.";
        if (tuning.transmissionSetup && tuning.transmissionSetup !== "stock" && !tuning.transmissionDetails.trim()) {
          nextErrors.transmissionDetails = "Tell PSI what converter, cooler, clutch or transmission work is fitted.";
        }
        if (!tuning.differentialType) nextErrors.differentialType = "Choose the differential type.";
        if (!tuning.differentialGearRatio.trim()) nextErrors.differentialGearRatio = "Enter the differential gear ratio, or write Unknown.";
        if (tuning.differentialType === "other" && !tuning.differentialDetails.trim()) {
          nextErrors.differentialDetails = "Describe the differential setup.";
        }
        if (!tuning.fuelPumpType) nextErrors.fuelPumpType = "Choose the fuel pump setup.";
        if (tuning.fuelPumpType === "upgraded" && !tuning.fuelPumpDetails.trim()) {
          nextErrors.fuelPumpDetails = "Enter the upgraded fuel pump brand and model.";
        }
        if (!tuning.injectorType) nextErrors.injectorType = "Choose the injector setup.";
        if (tuning.injectorType === "upgraded" && !tuning.injectorDetails.trim()) {
          nextErrors.injectorDetails = "Enter the injector brand and size or part number.";
        }
        if (!tuning.fuelType) nextErrors.fuelType = "Choose the fuel the vehicle will be tuned on.";
        if (tuning.fuelType === "other" && !tuning.fuelTypeDetails.trim()) {
          nextErrors.fuelTypeDetails = "Tell PSI which fuel you use.";
        }
        if (!tuning.intakeType) nextErrors.intakeType = "Choose the intake setup.";
        if (tuning.intakeType === "upgraded" && !tuning.intakeDetails.trim()) {
          nextErrors.intakeDetails = "Describe the intake fitted to the vehicle.";
        }
        if (!tuning.previouslyTuned) nextErrors.previouslyTuned = "Tell PSI whether the vehicle has been tuned before.";
        if (tuning.previouslyTuned === "yes" && !tuning.previousTuner.trim()) {
          nextErrors.previousTuner = "Enter who previously tuned the vehicle.";
        }
        if (!tuning.exhaustType) nextErrors.exhaustType = "Choose the exhaust type.";
        if (!tuning.exhaustSize) nextErrors.exhaustSize = "Choose the exhaust size.";
        if (!tuning.varexControlled) nextErrors.varexControlled = "Tell PSI whether the exhaust is Varex controlled.";
        if (tuning.exhaustType && tuning.exhaustType !== "stock" && !tuning.exhaustDetails.trim()) {
          nextErrors.exhaustDetails = "Describe the exact exhaust modifications.";
        }
        if (!tuning.camshaftType) nextErrors.camshaftType = "Choose the camshaft setup.";
        if (tuning.camshaftType === "upgraded" && !tuning.camshaftDetails.trim()) {
          nextErrors.camshaftDetails = "Enter the camshaft code or specifications.";
        }
      }
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
          ...(form.bookingType === "dyno"
            ? {
                tuningDetails: tuningDetailsForCheckout(form.tuningDetails),
              }
            : {}),
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
          const normalisedFields = Object.fromEntries(
            Object.entries(fields).map(([field, message]) => [field.replace(/^tuningDetails\./, ""), message]),
          );
          setErrors(normalisedFields);
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

              {form.bookingType === "dyno" && (
                <TuningSetupFields
                  tuning={form.tuningDetails}
                  errors={errors}
                  onChange={updateTuning}
                />
              )}
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

function TuningSetupFields({
  tuning,
  errors,
  onChange,
}: {
  tuning: TuningDetails;
  errors: Record<string, string>;
  onChange: <K extends keyof TuningDetails>(key: K, value: TuningDetails[K]) => void;
}) {
  type TransmissionSetupValue = Exclude<TuningDetails["transmissionSetup"], "">;
  const automaticSetups: ReadonlyArray<readonly [TransmissionSetupValue, string]> = [
    ["stock", "Stock / none"],
    ["converter", "Upgraded converter"],
    ["trans_cooler", "Transmission cooler"],
    ["converter_and_cooler", "Converter + transmission cooler"],
    ["built_transmission", "Built transmission"],
    ["other", "Other"],
  ];
  const manualSetups: ReadonlyArray<readonly [TransmissionSetupValue, string]> = [
    ["stock", "Stock / none"],
    ["upgraded_clutch", "Upgraded clutch"],
    ["built_transmission", "Built transmission"],
    ["other", "Other"],
  ];
  const transmissionSetups = tuning.transmissionType === "manual" ? manualSetups : automaticSetups;

  const changeTransmissionType = (value: TuningDetails["transmissionType"]) => {
    onChange("transmissionType", value);
    if (
      tuning.transmissionSetup &&
      !(
        value === "manual"
          ? manualSetups.some(([option]) => option === tuning.transmissionSetup)
          : automaticSetups.some(([option]) => option === tuning.transmissionSetup)
      )
    ) {
      onChange("transmissionSetup", "");
      onChange("transmissionDetails", "");
    }
  };

  return (
    <section className="tuning-setup" aria-labelledby="tuning-setup-heading">
      <div className="tuning-heading">
        <div>
          <p className="tuning-kicker">Dyno tuning · vehicle specification</p>
          <h3 id="tuning-setup-heading" tabIndex={-1}>Tell us how the car is set up.</h3>
        </div>
        <p>Choose the closest answer. Extra detail appears only where PSI needs it to prepare for your tune.</p>
      </div>

      <div className="tuning-grid">
        <section className="tuning-card" aria-labelledby="tuning-engine-heading">
          <div className="tuning-card-heading">
            <span>01</span>
            <h4 id="tuning-engine-heading">Engine</h4>
          </div>
          <Field label="Engine setup" id="engineState" error={errors.engineState} wide>
            <select
              id="engineState"
              value={tuning.engineState}
              onChange={(event) => onChange("engineState", event.target.value as TuningDetails["engineState"])}
              required
              aria-invalid={Boolean(errors.engineState)}
              aria-describedby={errors.engineState ? "engineState-error" : undefined}
            >
              <option value="">Choose stock or modified</option>
              <option value="stock">Stock</option>
              <option value="modified">Modified</option>
            </select>
          </Field>
          {tuning.engineState === "modified" && (
            <Field label="Engine modifications" hint="Required" id="engineModifications" error={errors.engineModifications} wide>
              <textarea
                id="engineModifications"
                value={tuning.engineModifications}
                onChange={(event) => onChange("engineModifications", event.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="List engine, induction, boost and internal modifications."
                required
                aria-invalid={Boolean(errors.engineModifications)}
                aria-describedby={errors.engineModifications ? "engineModifications-error" : undefined}
              />
            </Field>
          )}
        </section>

        <section className="tuning-card" aria-labelledby="tuning-transmission-heading">
          <div className="tuning-card-heading">
            <span>02</span>
            <h4 id="tuning-transmission-heading">Transmission</h4>
          </div>
          <div className="tuning-card-fields">
            <Field label="Transmission type" id="transmissionType" error={errors.transmissionType}>
              <select
                id="transmissionType"
                value={tuning.transmissionType}
                onChange={(event) => changeTransmissionType(event.target.value as TuningDetails["transmissionType"])}
                required
                aria-invalid={Boolean(errors.transmissionType)}
                aria-describedby={errors.transmissionType ? "transmissionType-error" : undefined}
              >
                <option value="">Choose type</option>
                <option value="automatic">Automatic</option>
                <option value="manual">Manual</option>
              </select>
            </Field>
            {tuning.transmissionType && (
              <Field label="Current setup" id="transmissionSetup" error={errors.transmissionSetup}>
                <select
                  id="transmissionSetup"
                  value={transmissionSetups.some(([option]) => option === tuning.transmissionSetup) ? tuning.transmissionSetup : ""}
                  onChange={(event) => onChange("transmissionSetup", event.target.value as TuningDetails["transmissionSetup"])}
                  required
                  aria-invalid={Boolean(errors.transmissionSetup)}
                  aria-describedby={errors.transmissionSetup ? "transmissionSetup-error" : undefined}
                >
                  <option value="">Choose setup</option>
                  {transmissionSetups.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
            )}
          </div>
          {tuning.transmissionSetup && tuning.transmissionSetup !== "stock" && (
            <Field label="Transmission details" hint="Required" id="transmissionDetails" error={errors.transmissionDetails} wide>
              <textarea
                id="transmissionDetails"
                value={tuning.transmissionDetails}
                onChange={(event) => onChange("transmissionDetails", event.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Brand, model, stall speed, cooler, clutch or build details."
                required
                aria-invalid={Boolean(errors.transmissionDetails)}
                aria-describedby={errors.transmissionDetails ? "transmissionDetails-error" : undefined}
              />
            </Field>
          )}
        </section>

        <section className="tuning-card" aria-labelledby="tuning-diff-heading">
          <div className="tuning-card-heading">
            <span>03</span>
            <h4 id="tuning-diff-heading">Differential</h4>
          </div>
          <div className="tuning-card-fields">
            <Field label="Differential type" id="differentialType" error={errors.differentialType}>
              <select
                id="differentialType"
                value={tuning.differentialType}
                onChange={(event) => onChange("differentialType", event.target.value as TuningDetails["differentialType"])}
                required
                aria-invalid={Boolean(errors.differentialType)}
                aria-describedby={errors.differentialType ? "differentialType-error" : undefined}
              >
                <option value="">Choose type</option>
                <option value="stock">Stock</option>
                <option value="truetrac">Truetrac</option>
                <option value="wavetrac">Wavetrac</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Gear ratio" id="differentialGearRatio" error={errors.differentialGearRatio}>
              <input
                id="differentialGearRatio"
                value={tuning.differentialGearRatio}
                onChange={(event) => onChange("differentialGearRatio", event.target.value)}
                maxLength={40}
                placeholder="e.g. 3.46 or Unknown"
                required
                aria-invalid={Boolean(errors.differentialGearRatio)}
                aria-describedby={errors.differentialGearRatio ? "differentialGearRatio-error" : undefined}
              />
            </Field>
          </div>
          {tuning.differentialType === "other" && (
            <Field label="Differential details" hint="Required" id="differentialDetails" error={errors.differentialDetails} wide>
              <input
                id="differentialDetails"
                value={tuning.differentialDetails}
                onChange={(event) => onChange("differentialDetails", event.target.value)}
                maxLength={1000}
                placeholder="Describe the differential or centre fitted."
                required
                aria-invalid={Boolean(errors.differentialDetails)}
                aria-describedby={errors.differentialDetails ? "differentialDetails-error" : undefined}
              />
            </Field>
          )}
        </section>

        <section className="tuning-card tuning-card-wide" aria-labelledby="tuning-fuel-heading">
          <div className="tuning-card-heading">
            <span>04</span>
            <h4 id="tuning-fuel-heading">Fuel system</h4>
          </div>
          <div className="tuning-card-fields tuning-card-fields-three">
            <Field label="Fuel pump" id="fuelPumpType" error={errors.fuelPumpType}>
              <select
                id="fuelPumpType"
                value={tuning.fuelPumpType}
                onChange={(event) => onChange("fuelPumpType", event.target.value as TuningDetails["fuelPumpType"])}
                required
                aria-invalid={Boolean(errors.fuelPumpType)}
                aria-describedby={errors.fuelPumpType ? "fuelPumpType-error" : undefined}
              >
                <option value="">Choose pump setup</option>
                <option value="stock">Stock</option>
                <option value="upgraded">Upgraded</option>
                <option value="unknown">Unknown</option>
              </select>
            </Field>
            <Field label="Injectors" id="injectorType" error={errors.injectorType}>
              <select
                id="injectorType"
                value={tuning.injectorType}
                onChange={(event) => onChange("injectorType", event.target.value as TuningDetails["injectorType"])}
                required
                aria-invalid={Boolean(errors.injectorType)}
                aria-describedby={errors.injectorType ? "injectorType-error" : undefined}
              >
                <option value="">Choose injector setup</option>
                <option value="stock">Stock</option>
                <option value="upgraded">Upgraded</option>
                <option value="unknown">Unknown</option>
              </select>
            </Field>
            <Field label="Fuel for tuning" id="fuelType" error={errors.fuelType}>
              <select
                id="fuelType"
                value={tuning.fuelType}
                onChange={(event) => onChange("fuelType", event.target.value as TuningDetails["fuelType"])}
                required
                aria-invalid={Boolean(errors.fuelType)}
                aria-describedby={errors.fuelType ? "fuelType-error" : undefined}
              >
                <option value="">Choose fuel</option>
                <option value="98_ron">98 RON</option>
                <option value="e85">E85</option>
                <option value="flex_fuel">Flex fuel</option>
                <option value="race_fuel">Race fuel</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </div>
          <div className="tuning-conditional-grid">
            {tuning.fuelPumpType === "upgraded" && (
              <Field label="Fuel pump details" hint="Required" id="fuelPumpDetails" error={errors.fuelPumpDetails}>
                <input id="fuelPumpDetails" value={tuning.fuelPumpDetails} onChange={(event) => onChange("fuelPumpDetails", event.target.value)} maxLength={500} placeholder="Brand and model" required aria-invalid={Boolean(errors.fuelPumpDetails)} aria-describedby={errors.fuelPumpDetails ? "fuelPumpDetails-error" : undefined} />
              </Field>
            )}
            {tuning.injectorType === "upgraded" && (
              <Field label="Injector details" hint="Required" id="injectorDetails" error={errors.injectorDetails}>
                <input id="injectorDetails" value={tuning.injectorDetails} onChange={(event) => onChange("injectorDetails", event.target.value)} maxLength={500} placeholder="Brand, size or part number" required aria-invalid={Boolean(errors.injectorDetails)} aria-describedby={errors.injectorDetails ? "injectorDetails-error" : undefined} />
              </Field>
            )}
            {tuning.fuelType === "other" && (
              <Field label="Other fuel" hint="Required" id="fuelTypeDetails" error={errors.fuelTypeDetails}>
                <input id="fuelTypeDetails" value={tuning.fuelTypeDetails} onChange={(event) => onChange("fuelTypeDetails", event.target.value)} maxLength={300} placeholder="Tell us which fuel" required aria-invalid={Boolean(errors.fuelTypeDetails)} aria-describedby={errors.fuelTypeDetails ? "fuelTypeDetails-error" : undefined} />
              </Field>
            )}
          </div>
        </section>

        <section className="tuning-card" aria-labelledby="tuning-intake-heading">
          <div className="tuning-card-heading">
            <span>05</span>
            <h4 id="tuning-intake-heading">Intake & current tune</h4>
          </div>
          <div className="tuning-card-fields">
            <Field label="Intake" id="intakeType" error={errors.intakeType}>
              <select id="intakeType" value={tuning.intakeType} onChange={(event) => onChange("intakeType", event.target.value as TuningDetails["intakeType"])} required aria-invalid={Boolean(errors.intakeType)} aria-describedby={errors.intakeType ? "intakeType-error" : undefined}>
                <option value="">Choose intake setup</option>
                <option value="stock">Stock</option>
                <option value="upgraded">Upgraded</option>
              </select>
            </Field>
            <Field label="Previously tuned?" id="previouslyTuned" error={errors.previouslyTuned}>
              <select id="previouslyTuned" value={tuning.previouslyTuned} onChange={(event) => onChange("previouslyTuned", event.target.value as TuningDetails["previouslyTuned"])} required aria-invalid={Boolean(errors.previouslyTuned)} aria-describedby={errors.previouslyTuned ? "previouslyTuned-error" : undefined}>
                <option value="">Choose an answer</option>
                <option value="no">No</option>
                <option value="yes">Yes</option>
                <option value="unknown">Unknown</option>
              </select>
            </Field>
          </div>
          <div className="tuning-conditional-grid">
            {tuning.intakeType === "upgraded" && (
              <Field label="Intake details" hint="Required" id="intakeDetails" error={errors.intakeDetails}>
                <input id="intakeDetails" value={tuning.intakeDetails} onChange={(event) => onChange("intakeDetails", event.target.value)} maxLength={1000} placeholder="Brand, style and size" required aria-invalid={Boolean(errors.intakeDetails)} aria-describedby={errors.intakeDetails ? "intakeDetails-error" : undefined} />
              </Field>
            )}
            {tuning.previouslyTuned === "yes" && (
              <Field label="Who tuned it?" hint="Required" id="previousTuner" error={errors.previousTuner}>
                <input id="previousTuner" value={tuning.previousTuner} onChange={(event) => onChange("previousTuner", event.target.value)} maxLength={200} placeholder="Tuner or workshop name" required aria-invalid={Boolean(errors.previousTuner)} aria-describedby={errors.previousTuner ? "previousTuner-error" : undefined} />
              </Field>
            )}
          </div>
        </section>

        <section className="tuning-card tuning-card-wide" aria-labelledby="tuning-exhaust-heading">
          <div className="tuning-card-heading">
            <span>06</span>
            <h4 id="tuning-exhaust-heading">Exhaust</h4>
          </div>
          <div className="tuning-card-fields tuning-card-fields-three">
            <Field label="Exhaust type" id="exhaustType" error={errors.exhaustType}>
              <select id="exhaustType" value={tuning.exhaustType} onChange={(event) => onChange("exhaustType", event.target.value as TuningDetails["exhaustType"])} required aria-invalid={Boolean(errors.exhaustType)} aria-describedby={errors.exhaustType ? "exhaustType-error" : undefined}>
                <option value="">Choose type</option>
                <option value="stock">Stock</option>
                <option value="cat_back">Cat-back</option>
                <option value="full_system">Full system</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
            <Field label="Exhaust size" id="exhaustSize" error={errors.exhaustSize}>
              <select id="exhaustSize" value={tuning.exhaustSize} onChange={(event) => onChange("exhaustSize", event.target.value as TuningDetails["exhaustSize"])} required aria-invalid={Boolean(errors.exhaustSize)} aria-describedby={errors.exhaustSize ? "exhaustSize-error" : undefined}>
                <option value="">Choose size</option>
                <option value="stock">Stock</option>
                <option value="2_5_inch">2.5 inch</option>
                <option value="3_inch">3 inch</option>
                <option value="3_5_inch">3.5 inch</option>
                <option value="4_inch">4 inch</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Varex controlled?" id="varexControlled" error={errors.varexControlled}>
              <select id="varexControlled" value={tuning.varexControlled} onChange={(event) => onChange("varexControlled", event.target.value as TuningDetails["varexControlled"])} required aria-invalid={Boolean(errors.varexControlled)} aria-describedby={errors.varexControlled ? "varexControlled-error" : undefined}>
                <option value="">Choose an answer</option>
                <option value="no">No</option>
                <option value="yes">Yes</option>
                <option value="unknown">Unknown</option>
              </select>
            </Field>
          </div>
          {tuning.exhaustType && tuning.exhaustType !== "stock" && (
            <Field label="Exact exhaust modifications" hint="Required" id="exhaustDetails" error={errors.exhaustDetails} wide>
              <textarea id="exhaustDetails" value={tuning.exhaustDetails} onChange={(event) => onChange("exhaustDetails", event.target.value)} rows={3} maxLength={2000} placeholder="Headers, cats, brand, pipe size, mufflers and any valve control." required aria-invalid={Boolean(errors.exhaustDetails)} aria-describedby={errors.exhaustDetails ? "exhaustDetails-error" : undefined} />
            </Field>
          )}
        </section>

        <section className="tuning-card tuning-card-wide" aria-labelledby="tuning-cam-heading">
          <div className="tuning-card-heading">
            <span>07</span>
            <h4 id="tuning-cam-heading">Camshaft</h4>
          </div>
          <div className="tuning-card-fields">
            <Field label="Camshaft setup" id="camshaftType" error={errors.camshaftType}>
              <select id="camshaftType" value={tuning.camshaftType} onChange={(event) => onChange("camshaftType", event.target.value as TuningDetails["camshaftType"])} required aria-invalid={Boolean(errors.camshaftType)} aria-describedby={errors.camshaftType ? "camshaftType-error" : undefined}>
                <option value="">Choose camshaft setup</option>
                <option value="stock">Stock</option>
                <option value="upgraded">Upgraded</option>
                <option value="unknown">Unknown</option>
              </select>
            </Field>
            {tuning.camshaftType === "upgraded" && (
              <Field label="Camshaft code or specifications" hint="Required" id="camshaftDetails" error={errors.camshaftDetails}>
                <input id="camshaftDetails" value={tuning.camshaftDetails} onChange={(event) => onChange("camshaftDetails", event.target.value)} maxLength={2000} placeholder="Part number, duration, lift and LSA if known" required aria-invalid={Boolean(errors.camshaftDetails)} aria-describedby={errors.camshaftDetails ? "camshaftDetails-error" : undefined} />
              </Field>
            )}
          </div>
        </section>
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
