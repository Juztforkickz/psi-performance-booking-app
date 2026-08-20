export const DEPOSIT_AMOUNT_CENTS = 20_000;
export const DEPOSIT_CURRENCY = "AUD" as const;
export const DEPOSIT_POLICY_VERSION = "psi-deposit-v1";

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
    },
    {
      id: "dyno",
      label: "Dyno tuning",
      kind: "booking",
      priceGuide: {
        prefix: "from",
        amountCents: 35_000,
        currency: DEPOSIT_CURRENCY,
        gstExclusive: true,
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
    amountCents: DEPOSIT_AMOUNT_CENTS,
    minimumAmountCents: DEPOSIT_AMOUNT_CENTS,
    currency: DEPOSIT_CURRENCY,
    fixedForCurrentRelease: true,
  },
} as const;

export type CheckoutBookingType = "service" | "dyno";

export function serviceOptionForBookingType(type: CheckoutBookingType) {
  return type === "service" ? "service_report" : "dyno_tuning";
}
