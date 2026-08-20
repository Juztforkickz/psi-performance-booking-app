export const DEPOSIT_CURRENCY = "AUD" as const;
export const BOOKING_POLICY_VERSION = "psi-booking-v1" as const;
export const DEPOSIT_POLICY_VERSION = "psi-deposit-v3" as const;

export const DEPOSIT_AMOUNTS_CENTS = {
  service: 10_000,
  dyno: 30_000,
} as const;

export type CheckoutBookingType = keyof typeof DEPOSIT_AMOUNTS_CENTS;
export type DepositAmountCents =
  (typeof DEPOSIT_AMOUNTS_CENTS)[CheckoutBookingType];

export function depositAmountForBookingType(type: CheckoutBookingType) {
  return DEPOSIT_AMOUNTS_CENTS[type];
}

export const BOOKING_CATALOG = {
  heading: "What are you booking in for?",
  choices: [
    {
      id: "service",
      label: "Service & Report",
      kind: "booking",
      priceGuide: {
        prefix: "from",
        amountCents: 42_350,
        currency: DEPOSIT_CURRENCY,
        gstInclusive: true,
      },
      deposit: {
        amountCents: DEPOSIT_AMOUNTS_CENTS.service,
        currency: DEPOSIT_CURRENCY,
      },
    },
    {
      id: "dyno",
      label: "Dyno tuning",
      kind: "booking",
      priceGuide: {
        prefix: "from",
        amountCents: 76_450,
        currency: DEPOSIT_CURRENCY,
        gstInclusive: true,
      },
      deposit: {
        amountCents: DEPOSIT_AMOUNTS_CENTS.dyno,
        currency: DEPOSIT_CURRENCY,
      },
    },
    {
      id: "parts",
      label: "Buy some parts",
      kind: "navigation",
      href: "/parts",
    },
  ],
  deposit: {
    currency: DEPOSIT_CURRENCY,
    minimumAmountCents: DEPOSIT_AMOUNTS_CENTS.service,
    variesByBookingType: true,
    policyVersion: DEPOSIT_POLICY_VERSION,
    requiredAtRequest: false,
    requestedOnlyAfterStaffDateApproval: true,
    policy:
      "Once PSI has reviewed and confirmed your booking date, we will send a secure link for the applicable deposit. Once paid, the deposit ordinarily cannot be refunded because PSI reserves technician time, hoist or dyno capacity and workshop planning for your vehicle. If PSI needs to move your booking, we will work with you to reschedule and keep the deposit attached to the agreed replacement date, or provide another remedy where required. Nothing in this policy limits rights that cannot be excluded under the Australian Consumer Law.",
  },
  bookingRequest: {
    policyVersion: BOOKING_POLICY_VERSION,
    paymentRequiredNow: false,
    dateNotice:
      "Your selected date is a request only. PSI will review workshop capacity and confirm the date, or contact you to arrange another suitable date.",
    availability: {
      service: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      dyno: ["monday", "wednesday", "thursday"],
    },
  },
} as const;

export function serviceOptionForBookingType(type: CheckoutBookingType) {
  return type === "service" ? "service_report" : "dyno_tuning";
}
