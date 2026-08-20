export const DEPOSIT_CURRENCY = "AUD" as const;
export const DEPOSIT_POLICY_VERSION = "psi-deposit-v2";

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
        amountCents: 38_500,
        currency: DEPOSIT_CURRENCY,
        gstExclusive: true,
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
        amountCents: 69_500,
        currency: DEPOSIT_CURRENCY,
        gstExclusive: true,
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
  },
} as const;

export function serviceOptionForBookingType(type: CheckoutBookingType) {
  return type === "service" ? "service_report" : "dyno_tuning";
}
