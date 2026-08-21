"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  isValidBookingEmail,
  isValidBookingMobile,
  isValidVin,
  isValidVehicleRegistration,
} from "../lib/booking-inputs";
import {
  BOOKING_CATALOG,
  BOOKING_POLICY_VERSION,
} from "../api/v1/booking-catalog/catalog";

type BookingType = "service" | "dyno";
type AppointmentMode = "specific" | "flexible";
type ArrivalArrangement =
  | "business_hours"
  | "before_hours_drop_off"
  | "after_hours_drop_off"
  | "flexible";
type SetupConfidence = "known" | "psi_inspection";

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
  appointmentMode: AppointmentMode;
  preferredDate: string;
  arrivalArrangement: ArrivalArrangement;
  afterHoursCollection: boolean;
  notifyEarlierAvailability: boolean;
  serviceReminderConsent: boolean;
  setupConfidence: SetupConfidence | "";
  consent: boolean;
  bookingTermsAccepted: boolean;
  company: string;
};

type BookingRequestSuccess = {
  reference: string;
  state: "pending_staff_review";
  paymentRequiredNow: false;
  message: string;
};

type BookingRequestApiResponse = Partial<BookingRequestSuccess> & {
  error?:
    | string
    | {
        code?: string;
        message?: string;
        fields?: Record<string, string>;
      };
};

type CatalogChoice = (typeof BOOKING_CATALOG.choices)[number];
type CatalogBookingChoice = Extract<CatalogChoice, { kind: "booking" }>;

function requireCatalogBookingChoice(bookingType: BookingType): CatalogBookingChoice {
  const choice = BOOKING_CATALOG.choices.find(
    (candidate): candidate is CatalogBookingChoice =>
      candidate.kind === "booking" && candidate.id === bookingType,
  );
  if (!choice) throw new Error(`Missing booking catalog choice: ${bookingType}`);
  return choice;
}

function formatAudAmount(amountCents: number, includeCents = false) {
  const amount = (amountCents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: includeCents || amountCents % 100 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `$${amount} AUD`;
}

function formatPriceGuide(choice: CatalogBookingChoice, sentenceCase = true) {
  const prefix = sentenceCase
    ? choice.priceGuide.prefix.charAt(0).toUpperCase() + choice.priceGuide.prefix.slice(1)
    : choice.priceGuide.prefix;
  const amount = (choice.priceGuide.amountCents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: choice.priceGuide.amountCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${prefix} $${amount} AUD including GST`;
}

function formatOptionPriceGuide(choice: CatalogBookingChoice) {
  const amount = (choice.priceGuide.amountCents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: choice.priceGuide.amountCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${choice.priceGuide.prefix} $${amount} incl. GST`;
}

const serviceCatalogChoice = requireCatalogBookingChoice("service");
const dynoCatalogChoice = requireCatalogBookingChoice("dyno");

const BOOKING_TYPES = {
  service: {
    label: serviceCatalogChoice.label,
    price: formatPriceGuide(serviceCatalogChoice),
    optionLabel: `${serviceCatalogChoice.label} ${formatOptionPriceGuide(serviceCatalogChoice)}`,
    depositAmountCents: serviceCatalogChoice.deposit.amountCents,
    detail: "Servicing, inspection and a clear report on what your car needs.",
  },
  dyno: {
    label: dynoCatalogChoice.label,
    price: formatPriceGuide(dynoCatalogChoice),
    optionLabel: `${dynoCatalogChoice.label} ${formatOptionPriceGuide(dynoCatalogChoice)}`,
    depositAmountCents: dynoCatalogChoice.deposit.amountCents,
    detail: "Hub dyno calibration focused on safe power, drivability and vehicle health.",
  },
} as const;

const BOOKING_STEPS = [
  { number: 1, label: "Job & setup" },
  { number: 2, label: "You & car" },
  { number: 3, label: "Preferred date" },
  { number: 4, label: "Review request" },
] as const;

const DRAFT_STORAGE_KEY = "psi_booking_draft_v1";
const DRAFT_VERSION = 1;
const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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
  appointmentMode: "specific",
  preferredDate: "",
  arrivalArrangement: "flexible",
  afterHoursCollection: false,
  notifyEarlierAvailability: false,
  serviceReminderConsent: false,
  setupConfidence: "",
  consent: false,
  bookingTermsAccepted: false,
  company: "",
};

type RestoredDraft = {
  form: BookingFormState;
  step: number;
  savedAt: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function draftText(source: Record<string, unknown>, key: string, maxLength: number) {
  const value = source[key];
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function draftChoice<T extends string>(
  source: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T,
) {
  const value = source[key];
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

function isRealDraftDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  return calendarIsoDate(dateFromIso(value)) === value;
}

function restoreDraft(value: unknown, now = Date.now()): RestoredDraft | null {
  if (!isPlainObject(value) || value.version !== DRAFT_VERSION) return null;
  if (typeof value.savedAt !== "number" || !Number.isFinite(value.savedAt)) return null;
  if (value.savedAt <= 0 || value.savedAt > now + 5 * 60 * 1000) return null;
  if (now - value.savedAt > DRAFT_TTL_MS) return null;
  if (!isPlainObject(value.form)) return null;

  const raw = value.form;
  const rawTuning = isPlainObject(raw.tuningDetails) ? raw.tuningDetails : {};
  const bookingType = draftChoice(raw, "bookingType", ["", "service", "dyno"] as const, "");
  const appointmentMode = draftChoice(raw, "appointmentMode", ["specific", "flexible"] as const, "specific");
  const arrivalArrangement = draftChoice(
    raw,
    "arrivalArrangement",
    ["business_hours", "before_hours_drop_off", "after_hours_drop_off", "flexible"] as const,
    "flexible",
  );
  const setupConfidence = draftChoice(raw, "setupConfidence", ["", "known", "psi_inspection"] as const, "");

  const tuningDetails: TuningDetails = {
    engineState: draftChoice(rawTuning, "engineState", ["", "stock", "modified"] as const, ""),
    engineModifications: draftText(rawTuning, "engineModifications", 2_000),
    transmissionType: draftChoice(rawTuning, "transmissionType", ["", "automatic", "manual"] as const, ""),
    transmissionSetup: draftChoice(rawTuning, "transmissionSetup", ["", "stock", "converter", "trans_cooler", "converter_and_cooler", "upgraded_clutch", "built_transmission", "other"] as const, ""),
    transmissionDetails: draftText(rawTuning, "transmissionDetails", 1_000),
    differentialType: draftChoice(rawTuning, "differentialType", ["", "stock", "truetrac", "wavetrac", "other"] as const, ""),
    differentialGearRatio: draftText(rawTuning, "differentialGearRatio", 40),
    differentialDetails: draftText(rawTuning, "differentialDetails", 1_000),
    fuelPumpType: draftChoice(rawTuning, "fuelPumpType", ["", "stock", "upgraded", "unknown"] as const, ""),
    fuelPumpDetails: draftText(rawTuning, "fuelPumpDetails", 500),
    injectorType: draftChoice(rawTuning, "injectorType", ["", "stock", "upgraded", "unknown"] as const, ""),
    injectorDetails: draftText(rawTuning, "injectorDetails", 500),
    fuelType: draftChoice(rawTuning, "fuelType", ["", "98_ron", "e85", "flex_fuel", "race_fuel", "other"] as const, ""),
    fuelTypeDetails: draftText(rawTuning, "fuelTypeDetails", 300),
    intakeType: draftChoice(rawTuning, "intakeType", ["", "stock", "upgraded"] as const, ""),
    intakeDetails: draftText(rawTuning, "intakeDetails", 1_000),
    previouslyTuned: draftChoice(rawTuning, "previouslyTuned", ["", "no", "yes", "unknown"] as const, ""),
    previousTuner: draftText(rawTuning, "previousTuner", 200),
    exhaustType: draftChoice(rawTuning, "exhaustType", ["", "stock", "cat_back", "full_system", "custom"] as const, ""),
    exhaustSize: draftChoice(rawTuning, "exhaustSize", ["", "stock", "2_5_inch", "3_inch", "3_5_inch", "4_inch", "other"] as const, ""),
    varexControlled: draftChoice(rawTuning, "varexControlled", ["", "no", "yes", "unknown"] as const, ""),
    exhaustDetails: draftText(rawTuning, "exhaustDetails", 2_000),
    camshaftType: draftChoice(rawTuning, "camshaftType", ["", "stock", "upgraded", "unknown"] as const, ""),
    camshaftDetails: draftText(rawTuning, "camshaftDetails", 2_000),
  };

  return {
    savedAt: value.savedAt,
    step: typeof value.step === "number" && Number.isInteger(value.step)
      ? Math.min(4, Math.max(1, value.step))
      : 1,
    form: {
      bookingType,
      requestDetails: draftText(raw, "requestDetails", 2_000),
      tuningDetails,
      firstName: draftText(raw, "firstName", 60),
      lastName: draftText(raw, "lastName", 60),
      email: draftText(raw, "email", 254),
      mobile: draftText(raw, "mobile", 32),
      vehicleMake: draftText(raw, "vehicleMake", 60),
      vehicleModel: draftText(raw, "vehicleModel", 80),
      vehicleYear: draftText(raw, "vehicleYear", 4),
      registration: draftText(raw, "registration", 20),
      vin: draftText(raw, "vin", 17),
      appointmentMode,
      preferredDate: isRealDraftDate(draftText(raw, "preferredDate", 10))
        ? draftText(raw, "preferredDate", 10)
        : "",
      arrivalArrangement,
      afterHoursCollection: raw.afterHoursCollection === true,
      notifyEarlierAvailability: raw.notifyEarlierAvailability === true,
      // Optional marketing-style reminders require a fresh affirmative choice.
      serviceReminderConsent: false,
      setupConfidence: bookingType === "dyno" ? setupConfidence : "",
      consent: false,
      bookingTermsAccepted: false,
      company: "",
    },
  };
}

function hasMeaningfulDraft(form: BookingFormState) {
  return Boolean(
    form.bookingType ||
    form.requestDetails.trim() ||
    form.firstName.trim() ||
    form.lastName.trim() ||
    form.email.trim() ||
    form.mobile.trim() ||
    form.vehicleMake.trim() ||
    form.vehicleModel.trim() ||
    form.vehicleYear.trim() ||
    form.registration.trim() ||
    form.vin.trim() ||
    form.preferredDate ||
    form.afterHoursCollection ||
    form.notifyEarlierAvailability ||
    form.serviceReminderConsent ||
    form.setupConfidence ||
    form.consent ||
    form.bookingTermsAccepted ||
    Object.values(form.tuningDetails).some((value) => value.trim()),
  );
}

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

function isAllowedBookingDay(value: string, bookingType: BookingType | "") {
  if (!value || !bookingType) return false;
  const day = dateFromIso(value).getDay();
  return bookingType === "dyno" ? [1, 3, 4].includes(day) : day >= 1 && day <= 5;
}

function displayDate(value: string, mode: AppointmentMode = "specific") {
  if (mode === "flexible") return "I’m flexible. PSI can suggest a date";
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

function normaliseApiField(field: string) {
  if (field.startsWith("tuningDetails.")) return field.replace(/^tuningDetails\./u, "");
  if (field === "appointmentPreference.preferredDate") return "preferredDate";
  if (field === "appointmentPreference" || field === "appointmentPreference.mode") return "appointmentMode";
  if (field === "bookingPolicyVersion") return "bookingTermsAccepted";
  return field;
}

function bookingStepForField(field: string) {
  const normalisedField = normaliseApiField(field);
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
  if (
    [
      "appointmentPreference",
      "appointmentMode",
      "preferredDate",
      "arrivalArrangement",
      "afterHoursCollection",
      "notifyEarlierAvailability",
    ].includes(normalisedField)
  ) return 3;
  return 4;
}

export function BookingFlow() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<BookingFormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState<BookingRequestSuccess | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavingEnabled, setDraftSavingEnabled] = useState(true);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [draftNotice, setDraftNotice] = useState("");
  const idempotencyKey = useRef<string | null>(null);
  const bookingIntent = useRef<BookingType | null>(null);
  const submittingRef = useRef(false);

  const today = useMemo(() => workshopIsoDate(new Date()), []);
  const maxDate = useMemo(() => addMonthsToIsoDate(workshopIsoDate(new Date()), 18), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (raw) {
          const draft = restoreDraft(JSON.parse(raw));
          if (!draft) {
            window.localStorage.removeItem(DRAFT_STORAGE_KEY);
            setDraftNotice("An expired or incompatible booking draft was removed from this device.");
          } else {
            const restoredBookingType = bookingIntent.current || draft.form.bookingType;
            setForm({
              ...draft.form,
              bookingType: restoredBookingType,
              // Optional reminder marketing always requires a fresh choice.
              serviceReminderConsent: false,
              setupConfidence: restoredBookingType === "dyno" ? draft.form.setupConfidence : "",
            });
            setStep(bookingIntent.current ? 1 : draft.step);
            setDraftSavedAt(draft.savedAt);
            setDraftNotice("Your unfinished booking request was restored from this device.");
          }
        }
      } catch {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        setDraftNotice("The saved draft could not be read, so a fresh form was opened.");
      } finally {
        setDraftReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!draftReady || !draftSavingEnabled || submittedRequest || !hasMeaningfulDraft(form)) return;
    const timer = window.setTimeout(() => {
      try {
        const savedAt = Date.now();
        window.localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({ version: DRAFT_VERSION, form: { ...form, company: "" }, step, savedAt }),
        );
        setDraftSavedAt(savedAt);
      } catch {
        setDraftNotice("This browser could not save the draft. Keep this page open while completing it.");
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [draftReady, draftSavingEnabled, form, step, submittedRequest]);

  useEffect(() => {
    const applyType = (bookingType: BookingType) => {
      if (submittingRef.current) return;
      bookingIntent.current = bookingType;
      setDraftSavingEnabled(true);
      setForm((current) => ({
        ...current,
        bookingType,
        serviceReminderConsent: bookingType === "service" && current.serviceReminderConsent,
        setupConfidence: bookingType === "dyno" ? current.setupConfidence : "",
      }));
      idempotencyKey.current = null;
      setErrors({});
      setFormError("");
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
    if (submittingRef.current) return;
    setDraftSavingEnabled(true);
    setForm((current) => ({ ...current, [key]: value }));
    idempotencyKey.current = null;
    setFormError("");
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const updateTuning = <K extends keyof TuningDetails>(key: K, value: TuningDetails[K]) => {
    if (submittingRef.current) return;
    setDraftSavingEnabled(true);
    setForm((current) => ({
      ...current,
      tuningDetails: { ...current.tuningDetails, [key]: value },
    }));
    idempotencyKey.current = null;
    setFormError("");
    setErrors((current) => {
      if (!current[key] && !current[`tuningDetails.${key}`]) return current;
      const next = { ...current };
      delete next[key];
      delete next[`tuningDetails.${key}`];
      return next;
    });
  };

  const focusField = (field: string) => {
    const normalisedField = normaliseApiField(field);
    const targetId =
      normalisedField === "bookingTermsAccepted"
        ? "bookingTermsAccepted"
        : normalisedField === "appointmentMode"
          ? "appointmentMode-specific"
        : normalisedField === "setupConfidence"
          ? "setupConfidence-known"
        : normalisedField === "tuningDetails"
          ? "tuning-setup-heading"
        : normalisedField;
    window.requestAnimationFrame(() => document.getElementById(targetId)?.focus());
  };

  const showStep = (nextStep: number) => {
    if (submittingRef.current) return;
    setStep(nextStep);
    window.requestAnimationFrame(() => {
      document.getElementById("booking-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("booking-step-" + nextStep + "-heading")?.focus();
    });
  };

  const errorsForStep = (targetStep: number) => {
    const nextErrors: Record<string, string> = {};

    if (targetStep === 1) {
      if (!form.bookingType) nextErrors.bookingType = "Choose Service & Report or Dyno Tuning.";
      if (!form.requestDetails.trim()) nextErrors.requestDetails = "Tell PSI exactly what you are after.";

      if (form.bookingType === "dyno") {
        if (!form.setupConfidence) {
          nextErrors.setupConfidence = "Tell PSI whether you know the vehicle setup or would like it inspected.";
        }
      }

      if (form.bookingType === "dyno" && form.setupConfidence === "known") {
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
      if (!isValidBookingEmail(form.email)) nextErrors.email = "Enter a valid email address.";
      if (!isValidBookingMobile(form.mobile)) {
        nextErrors.mobile = "Use 8 to 15 digits and only +, spaces, brackets, dots or hyphens.";
      }
      if (!form.vehicleMake.trim()) nextErrors.vehicleMake = "Enter the vehicle make.";
      if (!form.vehicleModel.trim()) nextErrors.vehicleModel = "Enter the vehicle model.";
      const year = Number(form.vehicleYear);
      const latestYear = Number(workshopIsoDate(new Date()).slice(0, 4)) + 1;
      if (!Number.isInteger(year) || year < 1900 || year > latestYear) {
        nextErrors.vehicleYear = "Enter a year between 1900 and " + latestYear + ".";
      }
      if (!form.registration.trim()) nextErrors.registration = "Enter the registration.";
      if (form.registration.trim() && !isValidVehicleRegistration(form.registration)) {
        nextErrors.registration = "Use only letters, numbers, spaces, dots or hyphens.";
      }
      if (form.vin.trim() && !isValidVin(form.vin)) {
        nextErrors.vin = "Enter a 17-character VIN. The letters I, O and Q are not used.";
      }
      if (!form.consent) nextErrors.consent = "Please agree so PSI can contact you about this request.";
    }

    if (targetStep === 3 && form.appointmentMode === "specific") {
      if (!form.preferredDate) nextErrors.preferredDate = "Choose a preferred date or select I’m flexible.";
      if (form.preferredDate && form.preferredDate < today) nextErrors.preferredDate = "Choose today or a future date.";
      if (form.preferredDate && form.preferredDate > maxDate) nextErrors.preferredDate = "Choose a date within the next 18 months.";
      if (form.preferredDate && !isAllowedBookingDay(form.preferredDate, form.bookingType)) {
        nextErrors.preferredDate = form.bookingType === "dyno"
          ? "Dyno requests are available Monday, Wednesday or Thursday."
          : "Service requests are available Monday to Friday.";
      }
    }

    if (targetStep === 4 && !form.bookingTermsAccepted) {
      nextErrors.bookingTermsAccepted = "Confirm the request, date and deposit policy before submitting.";
    }

    return nextErrors;
  };

  const validateStep = (targetStep: number) => {
    const nextErrors = errorsForStep(targetStep);
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
    showStep(Math.max(1, step - 1));
  };

  const submitBookingRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setFormError("");
    const allErrors = Object.assign(
      {},
      errorsForStep(1),
      errorsForStep(2),
      errorsForStep(3),
      errorsForStep(4),
    );
    const firstError = Object.keys(allErrors)[0];
    if (firstError || !form.bookingType) {
      setErrors(allErrors);
      const targetField = firstError || "bookingType";
      setStep(bookingStepForField(targetField));
      window.setTimeout(() => focusField(targetField), 0);
      return;
    }

    submittingRef.current = true;
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

      const response = await fetch("/api/v1/booking-requests", {
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
          appointmentPreference: form.appointmentMode === "flexible"
            ? { mode: "flexible" }
            : { mode: "specific", preferredDate: form.preferredDate },
          arrivalArrangement: form.arrivalArrangement,
          afterHoursCollection: form.afterHoursCollection,
          notifyEarlierAvailability: form.notifyEarlierAvailability,
          serviceReminderConsent: form.bookingType === "service" && form.serviceReminderConsent,
          requestDetails: form.requestDetails.trim(),
          ...(form.bookingType === "dyno"
            ? {
                setupConfidence: form.setupConfidence,
                ...(form.setupConfidence === "known"
                  ? { tuningDetails: tuningDetailsForCheckout(form.tuningDetails) }
                  : {}),
              }
            : {}),
          source: "web",
          consent: form.consent,
          bookingTermsAccepted: form.bookingTermsAccepted,
          bookingPolicyVersion: BOOKING_POLICY_VERSION,
          company: form.company,
        }),
      });

      const raw = await response.text();
      let payload: BookingRequestApiResponse = {};
      try {
        payload = raw ? (JSON.parse(raw) as BookingRequestApiResponse) : {};
      } catch {
        payload = {};
      }

      if (!response.ok) {
        const apiError = payload.error;
        const fields = typeof apiError === "object" ? apiError.fields : undefined;
        if (fields && Object.keys(fields).length > 0) {
          const normalisedFields = Object.fromEntries(
            Object.entries(fields).map(([field, message]) => [normaliseApiField(field), message]),
          );
          setErrors(normalisedFields);
          const firstField = Object.keys(fields)[0];
          setStep(bookingStepForField(firstField));
          window.setTimeout(() => focusField(firstField), 0);
        }
        const message =
          typeof apiError === "string"
            ? apiError
            : apiError?.message || "The booking request could not be submitted. Please try again.";
        setFormError(message);
        return;
      }

      const replayed = response.headers.get("Idempotency-Replayed") === "true";
      if (response.status !== 201 && !(response.status === 200 && replayed)) {
        setFormError("PSI returned an unexpected request state. Nothing has been charged; please try again.");
        return;
      }

      if (
        payload.state !== "pending_staff_review" ||
        payload.paymentRequiredNow !== false ||
        typeof payload.reference !== "string" ||
        !payload.reference
      ) {
        setFormError("PSI returned an incomplete request confirmation. Nothing has been charged; please contact the workshop before resubmitting.");
        return;
      }
      const confirmation: BookingRequestSuccess = {
        reference: payload.reference,
        state: "pending_staff_review",
        paymentRequiredNow: false,
        message: payload.message || "PSI will review your request and contact you to confirm or propose a date.",
      };
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      setDraftSavedAt(null);
      setSubmittedRequest(confirmation);
      window.setTimeout(() => document.getElementById("request-success-heading")?.focus(), 0);
    } catch {
      setFormError("The booking request could not reach PSI. Nothing has been charged; check your connection and try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const selectedType = form.bookingType ? BOOKING_TYPES[form.bookingType] : null;
  const selectedDeposit = selectedType
    ? formatAudAmount(selectedType.depositAmountCents)
    : null;
  const selectedDepositWithCents = selectedType
    ? formatAudAmount(selectedType.depositAmountCents, true)
    : null;

  const clearSavedDraft = () => {
    if (submittingRef.current) return;
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    setDraftSavingEnabled(false);
    setDraftSavedAt(null);
    setDraftNotice("The saved copy was cleared from this device. Your open fields remain until you leave or edit again.");
  };

  const chooseBookingType = (bookingType: BookingType) => {
    if (submittingRef.current) return;
    bookingIntent.current = bookingType;
    setDraftSavingEnabled(true);
    setForm((current) => ({
      ...current,
      bookingType,
      serviceReminderConsent: bookingType === "service" && current.serviceReminderConsent,
      setupConfidence: bookingType === "dyno" ? current.setupConfidence : "",
    }));
    idempotencyKey.current = null;
    setErrors({});
    setFormError("");
    setStep(1);
    window.history.replaceState(null, "", "#booking-panel");
    window.requestAnimationFrame(() => document.getElementById("requestDetails")?.focus());
  };

  const changeBookingType = () => {
    if (submittingRef.current) return;
    bookingIntent.current = null;
    update("bookingType", "");
    setStep(1);
    window.history.replaceState(null, "", "#booking-panel");
    document.getElementById("booking-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.requestAnimationFrame(() => document.getElementById("bookingType")?.focus());
  };

  if (submittedRequest) {
    return (
      <section className="booking-section booking-success-section" id="booking-panel">
        <div className="request-success">
          <p className="eyebrow" role="status">Request received · No payment taken</p>
          <h2 id="request-success-heading" tabIndex={-1}>PSI will check the workshop plan.</h2>
          <p className="request-success-reference">Reference <strong>{submittedRequest.reference}</strong></p>
          <p>{submittedRequest.message}</p>
          <ol>
            <li><strong>PSI reviews your request.</strong><span>We check the requested work, workshop capacity and your preferred date.</span></li>
            <li><strong>We confirm or propose a date.</strong><span>If your choice is unavailable, we will contact you to reschedule the vehicle.</span></li>
            <li><strong>You receive a secure deposit link.</strong><span>Only after the date is agreed: {selectedDepositWithCents} for this request.</span></li>
            <li><strong>Payment confirms the booking.</strong><span>A receipt and booking confirmation will be sent to you and PSI.</span></li>
          </ol>
          <p className="request-success-policy">Once paid, the deposit is ordinarily non-refundable because PSI allocates technicians and reserves hoist, dyno and workshop capacity. If PSI needs to move the booking, the deposit can be transferred to the agreed replacement date or refunded. Your rights under the Australian Consumer Law are not excluded.</p>
          <div className="success-actions">
            <a className="button button-primary" href="/account#profile">View account preview</a>
            <a className="button button-ghost-dark" href="/booking-policy">Read booking policy</a>
          </div>
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
          Send a request first. Nothing is payable today. PSI checks the work and workshop plan, then confirms your date or offers another option before sending a secure deposit link.
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
                  showStep(number);
                }
              }}
              disabled={submitting || number > step}
              aria-current={step === number ? "step" : undefined}
            >
              <span>{step > number ? "✓" : "0" + number}</span>
              {label}
            </button>
          ))}
          <div className="request-note" aria-live="polite" aria-atomic="true">
            <strong>Approval before payment</strong>
            <p>Your request is reviewed by PSI first. A deposit link is sent only after a workshop date is agreed.</p>
          </div>
        </aside>

        <form className="booking-form" onSubmit={submitBookingRequest} noValidate>
          <div className="draft-safety">
            <div>
              <strong aria-live="polite">{draftNotice || "Your unfinished form is saved only on this device."}</strong>
              <span>
                It is never sent to PSI until you submit. The saved copy expires after 30 days; clear it on a shared device.
                {draftSavedAt ? ` Last saved ${new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit" }).format(draftSavedAt)}.` : ""}
              </span>
            </div>
            <button type="button" onClick={clearSavedDraft} disabled={submitting || !draftSavedAt}>Clear saved draft</button>
          </div>
          {selectedType && selectedDeposit && (
            <div className="booking-rate-banner" role="status" aria-live="polite" aria-atomic="true">
              <span>{selectedType.label} · {selectedType.price}</span>
              <strong>{selectedDeposit} deposit after approval</strong>
            </div>
          )}

          {step === 1 && (
            <fieldset>
              <legend id="booking-step-1-heading" tabIndex={-1}>Tell us about the work.</legend>
              <p className="field-intro">Choose the job once, then tell PSI exactly what your vehicle needs.</p>

              {selectedType && (
                <div className="selected-job-card" aria-live="polite">
                  <div>
                    <strong>{selectedType.label}</strong>
                    <span>{selectedType.price}</span>
                  </div>
                  <p>{selectedType.detail}</p>
                  <button type="button" className="inline-change-button" onClick={changeBookingType} disabled={submitting}>Change booking type</button>
                </div>
              )}

              {!selectedType && (
                <div className="booking-choice-required" id="bookingType" tabIndex={-1}>
                  <div>
                    <p className="booking-choice-kicker">What are you booking in for?</p>
                    <strong>Select Service or Dyno Tuning to begin.</strong>
                  </div>
                  <div className="type-grid" role="group" aria-label="Booking type">
                    {(["service", "dyno"] as const).map((bookingType, index) => {
                      const booking = BOOKING_TYPES[bookingType];
                      return (
                        <button
                          key={bookingType}
                          type="button"
                          className="type-card"
                          onClick={() => chooseBookingType(bookingType)}
                          aria-label={`${booking.label}. ${booking.price}`}
                        >
                          <strong>{booking.label}</strong>
                          <small>{booking.price}<br />{booking.detail}</small>
                          <span className="type-index" aria-hidden="true">0{index + 1}</span>
                        </button>
                      );
                    })}
                  </div>
                  <a className="booking-parts-link" href="/parts">Looking for parts instead? View PSI parts <span aria-hidden="true">→</span></a>
                  {errors.bookingType && <p className="field-error" id="bookingType-error" role="alert">{errors.bookingType}</p>}
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
                <section className="setup-confidence" aria-labelledby="setupConfidence-heading">
                  <div>
                    <p className="eyebrow">Dyno preparation</p>
                    <h3 id="setupConfidence-heading" tabIndex={-1}>How well do you know the setup?</h3>
                    <p>Give PSI the full specification if you know it, or ask the workshop to inspect and identify the setup with you.</p>
                  </div>
                  <div className="setup-confidence-options" role="radiogroup" aria-labelledby="setupConfidence-heading" aria-describedby={errors.setupConfidence ? "setupConfidence-error" : undefined}>
                    <label className={form.setupConfidence === "known" ? "selected" : ""}>
                      <input id="setupConfidence-known" type="radio" name="setupConfidence" value="known" checked={form.setupConfidence === "known"} onChange={() => update("setupConfidence", "known")} />
                      <strong>I know my setup</strong>
                      <span>Complete the detailed engine, driveline, fuel, intake, tune, exhaust and camshaft questionnaire.</span>
                    </label>
                    <label className={form.setupConfidence === "psi_inspection" ? "selected" : ""}>
                      <input id="setupConfidence-inspection" type="radio" name="setupConfidence" value="psi_inspection" checked={form.setupConfidence === "psi_inspection"} onChange={() => update("setupConfidence", "psi_inspection")} />
                      <strong>I’m not sure. Can PSI inspect it?</strong>
                      <span>Tell us what you do know in the request notes. PSI can inspect the vehicle before confirming the tuning plan.</span>
                    </label>
                  </div>
                  {errors.setupConfidence && <p className="field-error" id="setupConfidence-error" role="alert">{errors.setupConfidence}</p>}

                  {form.setupConfidence === "psi_inspection" && (
                    <div className="inspection-note" role="note">
                      <strong>No guesswork required.</strong>
                      <span>The detailed setup fields are optional for this path. PSI will clarify inspection requirements, timing and any additional cost before the booking is confirmed.</span>
                    </div>
                  )}

                  {form.setupConfidence === "known" && (
                    <TuningSetupFields
                      tuning={form.tuningDetails}
                      errors={errors}
                      onChange={updateTuning}
                    />
                  )}
                </section>
              )}
            </fieldset>
          )}

          {step === 2 && (
            <fieldset>
              <legend id="booking-step-2-heading" tabIndex={-1}>You and your car.</legend>
              <p className="field-intro">
                A future customer account can reuse these details and keep vehicle history together. <a className="inline-gold-link" href="/account#profile">View the owner-review preview</a>, or continue below.
              </p>
              <div className="form-grid">
                <Field label="First name" id="firstName" error={errors.firstName}>
                  <input id="firstName" value={form.firstName} onChange={(event) => update("firstName", event.target.value)} autoComplete="given-name" maxLength={60} required aria-invalid={Boolean(errors.firstName)} aria-describedby={errors.firstName ? "firstName-error" : undefined} />
                </Field>
                <Field label="Last name" id="lastName" error={errors.lastName}>
                  <input id="lastName" value={form.lastName} onChange={(event) => update("lastName", event.target.value)} autoComplete="family-name" maxLength={60} required aria-invalid={Boolean(errors.lastName)} aria-describedby={errors.lastName ? "lastName-error" : undefined} />
                </Field>
                <Field label="Email" hint="Receipt & updates" id="email" error={errors.email}>
                  <input id="email" type="email" inputMode="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} placeholder="you@example.com" required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} />
                </Field>
                <Field label="Mobile" hint="8–15 digits" id="mobile" error={errors.mobile}>
                  <input id="mobile" type="tel" value={form.mobile} onChange={(event) => update("mobile", event.target.value)} autoComplete="tel" inputMode="tel" maxLength={32} pattern="\+?[0-9() .-]+" placeholder="04xx xxx xxx" required aria-invalid={Boolean(errors.mobile)} aria-describedby={errors.mobile ? "mobile-error" : undefined} />
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
                <Field label="Registration" hint="Letters & numbers" id="registration" error={errors.registration}>
                  <input id="registration" value={form.registration} onChange={(event) => update("registration", event.target.value.toUpperCase())} autoCapitalize="characters" spellCheck={false} maxLength={20} pattern="[A-Za-z0-9][A-Za-z0-9 .-]*" placeholder="ABC123" required aria-invalid={Boolean(errors.registration)} aria-describedby={errors.registration ? "registration-error" : undefined} />
                </Field>
                <Field label="VIN" hint="Optional · 17 characters" id="vin" error={errors.vin} wide>
                  <input id="vin" value={form.vin} onChange={(event) => update("vin", event.target.value.toUpperCase())} autoCapitalize="characters" spellCheck={false} minLength={17} maxLength={17} pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}" placeholder="17-character vehicle identification number" aria-invalid={Boolean(errors.vin)} aria-describedby={errors.vin ? "vin-error" : undefined} />
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

              {form.bookingType === "service" && (
                <label className="reminder-consent-row">
                  <input
                    id="serviceReminderConsent"
                    type="checkbox"
                    checked={form.serviceReminderConsent}
                    onChange={(event) => update("serviceReminderConsent", event.target.checked)}
                  />
                  <span>
                    <strong>Optional 6- and 12-month service reminders</strong>
                    PSI Performance may ask “Are you ready for your next service?” by email or SMS, with a link to rebook or contact the workshop. I can unsubscribe at any time without signing in.
                  </span>
                </label>
              )}
            </fieldset>
          )}

          {step === 3 && (
            <fieldset>
              <legend id="booking-step-3-heading" tabIndex={-1}>Choose a preferred date or stay flexible.</legend>
              <p className="field-intro">
                {form.bookingType === "dyno"
                  ? "Dyno requests can be made for Monday, Wednesday or Thursday."
                  : "Service requests can be made Monday to Friday."}
                {" "}Existing bookings remain private and are never shown here.
              </p>

              <div className="appointment-mode" role="radiogroup" aria-label="Date preference">
                <label className={form.appointmentMode === "specific" ? "selected" : ""}>
                  <input id="appointmentMode-specific" type="radio" name="appointmentMode" value="specific" checked={form.appointmentMode === "specific"} onChange={() => update("appointmentMode", "specific")} />
                  <strong>I have a preferred date</strong>
                  <span>Choose one eligible date for PSI to review.</span>
                </label>
                <label className={form.appointmentMode === "flexible" ? "selected" : ""}>
                  <input id="appointmentMode-flexible" type="radio" name="appointmentMode" value="flexible" checked={form.appointmentMode === "flexible"} onChange={() => { update("appointmentMode", "flexible"); update("preferredDate", ""); }} />
                  <strong>I’m flexible</strong>
                  <span>PSI can suggest a date that fits the workshop plan.</span>
                </label>
              </div>

              {form.appointmentMode === "specific" && (
                <CalendarPicker
                  value={form.preferredDate}
                  min={today}
                  max={maxDate}
                  bookingType={form.bookingType}
                  error={errors.preferredDate}
                  onChange={(value) => update("preferredDate", value)}
                />
              )}

              <div className="date-selection-footer">
                <div>
                  <span>Date preference</span>
                  <strong>{displayDate(form.preferredDate, form.appointmentMode)}</strong>
                </div>
                <Field label="Drop-off preference" id="arrivalArrangement" error={errors.arrivalArrangement}>
                  <select
                    id="arrivalArrangement"
                    value={form.arrivalArrangement}
                    onChange={(event) => update("arrivalArrangement", event.target.value as ArrivalArrangement)}
                    required
                    aria-invalid={Boolean(errors.arrivalArrangement)}
                    aria-describedby={errors.arrivalArrangement ? "arrivalArrangement-error" : undefined}
                  >
                    <option value="business_hours">During workshop hours</option>
                    <option value="before_hours_drop_off">Before-hours drop-off</option>
                    <option value="after_hours_drop_off">After-hours drop-off</option>
                    <option value="flexible">I’m flexible</option>
                  </select>
                </Field>
              </div>
              <div className="schedule-options">
                <label>
                  <input type="checkbox" checked={form.afterHoursCollection} onChange={(event) => update("afterHoursCollection", event.target.checked)} />
                  <span><strong>After-hours collection may help me</strong>PSI will confirm whether this can be arranged for the booking.</span>
                </label>
                <label>
                  <input type="checkbox" checked={form.notifyEarlierAvailability} onChange={(event) => update("notifyEarlierAvailability", event.target.checked)} />
                  <span><strong>Tell me if something earlier becomes available</strong>This flags your request for PSI staff only. Nothing is offered or moved automatically; PSI will contact you if a suitable opening appears.</span>
                </label>
              </div>
              <p className="date-disclaimer">This is a request, not a confirmed appointment. If the date is unavailable, PSI will contact you to rebook or schedule the vehicle. Before-hours and after-hours arrangements are possible by confirmation, not guaranteed.</p>
            </fieldset>
          )}

          {step === 4 && (
            <fieldset>
              <legend id="booking-step-4-heading" tabIndex={-1}>Review and send your request.</legend>
              <p className="field-intro">No payment is requested at this step. PSI will review the work and confirm or propose a date first.</p>

              <div className="deposit-layout">
                <div className="deposit-summary">
                  <p className="deposit-kicker">Request summary</p>
                  <dl>
                    <div><dt>Job</dt><dd>{selectedType?.label}</dd></div>
                    <div><dt>Price guide</dt><dd>{selectedType?.price}</dd></div>
                    <div><dt>Customer</dt><dd>{form.firstName} {form.lastName}</dd></div>
                    <div><dt>Vehicle</dt><dd>{form.vehicleYear} {form.vehicleMake} {form.vehicleModel}<br />{form.registration}</dd></div>
                    <div><dt>Date preference</dt><dd>{displayDate(form.preferredDate, form.appointmentMode)}</dd></div>
                    <div className="deposit-total"><dt>Deposit after date approval</dt><dd>{selectedDepositWithCents}</dd></div>
                  </dl>
                  <p>The guide price is not a final quote. PSI confirms the scope and any additional costs before work outside the agreed scope proceeds.</p>
                </div>

                <div className="bank-panel">
                  <p className="deposit-kicker">Approval before payment</p>
                  <h3>Request now. Pay only after confirmation.</h3>
                  <p>PSI checks workshop capacity and either confirms your preferred date or contacts you with another option. Once agreed, PSI sends the secure {selectedDeposit} deposit link. No bank or card details are requested here.</p>
                </div>
              </div>

              <label className={"deposit-terms " + (errors.bookingTermsAccepted ? "has-error" : "")}>
                <input
                  id="bookingTermsAccepted"
                  type="checkbox"
                  checked={form.bookingTermsAccepted}
                  onChange={(event) => update("bookingTermsAccepted", event.target.checked)}
                  required
                  aria-invalid={Boolean(errors.bookingTermsAccepted)}
                  aria-describedby={errors.bookingTermsAccepted ? "bookingTermsAccepted-error" : undefined}
                />
                <span>
                  I understand this is a request only. PSI will confirm or propose a date before sending the {selectedDeposit} deposit link. Once paid, the deposit is ordinarily non-refundable because technician time and hoist, dyno or workshop capacity are reserved. If PSI must move the booking, it can be transferred to the agreed replacement date or otherwise remedied as required. Nothing limits rights that cannot be excluded under the Australian Consumer Law.
                </span>
              </label>
              {errors.bookingTermsAccepted && <p className="field-error" id="bookingTermsAccepted-error" role="alert">{errors.bookingTermsAccepted}</p>}
              <p className="booking-policy-link"><a href="/booking-policy" target="_blank">Read the owner-review booking policy draft <span aria-hidden="true">↗</span></a></p>

              <div className="honeypot" aria-hidden="true">
                <label htmlFor="company">Company</label>
                <input id="company" tabIndex={-1} autoComplete="off" value={form.company} onChange={(event) => update("company", event.target.value)} />
              </div>
            </fieldset>
          )}

          {formError && (
            <div className="form-alert" role="alert">
              <strong>Request could not be submitted</strong>
              <span>{formError}</span>
              <a href="tel:+61433431781">Call PSI on 0433 431 781</a>
            </div>
          )}

          <div className="form-actions">
            {step > 1 && <button type="button" className="button button-ghost-dark" onClick={goBack} disabled={submitting}>Back</button>}
            {step < 4 ? (
              <button type="button" className="button button-primary" onClick={goNext} disabled={submitting}>Continue <span aria-hidden="true">→</span></button>
            ) : (
              <button
                type="submit"
                className="button button-primary payment-button"
                disabled={submitting}
                aria-label={selectedType ? `Submit ${selectedType.label} request for PSI review. No payment is taken.` : undefined}
              >
                {submitting ? "Sending request…" : "Submit request · No payment now"}
              </button>
            )}
          </div>
          {step === 4 && <p className="secure-checkout-note">After PSI and the customer agree on a date, a separate secure deposit link will be sent. This preview does not send email, charge a payment or create a Google Calendar event.</p>}
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
          <p className="tuning-kicker">Dyno Tuning · Vehicle Specification</p>
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
  bookingType,
  error,
  onChange,
}: {
  value: string;
  min: string;
  max: string;
  bookingType: BookingType | "";
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
      <div className="calendar-grid" role="group" aria-label={`${monthLabel} preferred dates`}>
        {cells.map((day, index) => {
          if (day === null) return <span key={"empty-" + index} className="calendar-empty" aria-hidden="true" />;
          const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day, 12, 0, 0);
          const iso = calendarIsoDate(date);
          const eligible = isAllowedBookingDay(iso, bookingType);
          const disabled = iso < min || iso > max || !eligible;
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
              disabled={disabled}
              className={selected ? "selected" : ""}
              aria-label={label + (!eligible
                ? bookingType === "dyno"
                  ? ", dyno requests unavailable"
                  : ", service requests unavailable"
                : "")}
              aria-pressed={selected}
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
