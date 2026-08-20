import {
  BOOKING_POLICY_VERSION,
  DEPOSIT_POLICY_VERSION,
  type CheckoutBookingType,
} from "../booking-catalog/catalog";

export { BOOKING_POLICY_VERSION, DEPOSIT_POLICY_VERSION };

export const ARRIVAL_ARRANGEMENTS = [
  "business_hours",
  "before_hours_drop_off",
  "after_hours_drop_off",
  "flexible",
] as const;

export type ArrivalArrangement = (typeof ARRIVAL_ARRANGEMENTS)[number];
export type BookingRequestState =
  | "pending_staff_review"
  | "date_proposed"
  | "date_approved"
  | "awaiting_deposit"
  | "confirmed"
  | "completed"
  | "cancelled";

export const BOOKING_REQUEST_STATES: readonly BookingRequestState[] = [
  "pending_staff_review",
  "date_proposed",
  "date_approved",
  "awaiting_deposit",
  "confirmed",
  "completed",
  "cancelled",
];

export function getMelbourneDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(value("year")),
    isoDate: `${value("year")}-${value("month")}-${value("day")}`,
  };
}

export function addMonthsToIsoDate(value: string, months: number) {
  const [year, month, day] = value.split("-").map(Number);
  // This is civil-date arithmetic; UTC components prevent the host timezone from shifting the day.
  const targetMonth = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  targetMonth.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return targetMonth.toISOString().slice(0, 10);
}

export function isRealIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isEligibleBookingDate(type: CheckoutBookingType, value: string) {
  if (!isRealIsoDate(value)) return false;
  const day = new Date(`${value}T00:00:00Z`).getUTCDay();
  return type === "dyno" ? day === 1 || day === 3 || day === 4 : day >= 1 && day <= 5;
}

export function dateEligibilityMessage(type: CheckoutBookingType) {
  return type === "dyno"
    ? "Dyno bookings are currently available on Monday, Wednesday and Thursday."
    : "Service bookings are available Monday to Friday.";
}

export function isArrivalArrangement(value: unknown): value is ArrivalArrangement {
  return (
    typeof value === "string" &&
    (ARRIVAL_ARRANGEMENTS as readonly string[]).includes(value)
  );
}
