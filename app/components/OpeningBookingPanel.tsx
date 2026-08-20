"use client";

import { useState } from "react";
import { BOOKING_CATALOG } from "../api/v1/booking-catalog/catalog";

type CatalogChoice = (typeof BOOKING_CATALOG.choices)[number];
type CatalogBookingChoice = Extract<CatalogChoice, { kind: "booking" }>;

function requireCatalogBookingChoice(id: "service" | "dyno"): CatalogBookingChoice {
  const choice = BOOKING_CATALOG.choices.find(
    (candidate): candidate is CatalogBookingChoice =>
      candidate.kind === "booking" && candidate.id === id,
  );
  if (!choice) throw new Error(`Missing booking catalog choice: ${id}`);
  return choice;
}

function formatAudAmount(amountCents: number) {
  return `$${(amountCents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} AUD`;
}

function formatPriceGuide(choice: CatalogBookingChoice) {
  const amount = (choice.priceGuide.amountCents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: choice.priceGuide.amountCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `Price guide ${choice.priceGuide.prefix} $${amount} AUD including GST`;
}

function formatOptionPriceGuide(choice: CatalogBookingChoice) {
  return formatPriceGuide(choice).replace(/^Price guide /u, "");
}

const serviceCatalogChoice = requireCatalogBookingChoice("service");
const dynoCatalogChoice = requireCatalogBookingChoice("dyno");

const bookingChoices = {
  service: {
    title: serviceCatalogChoice.label,
    price: formatPriceGuide(serviceCatalogChoice),
    optionLabel: `${serviceCatalogChoice.label} — ${formatOptionPriceGuide(serviceCatalogChoice)}`,
    deposit: formatAudAmount(serviceCatalogChoice.deposit.amountCents),
    detail: "Workshop inspection, servicing and a clear report on what your car needs.",
    href: "#service-booking",
    action: "Start service request",
  },
  dyno: {
    title: dynoCatalogChoice.label,
    price: formatPriceGuide(dynoCatalogChoice),
    optionLabel: `${dynoCatalogChoice.label} — ${formatOptionPriceGuide(dynoCatalogChoice)}`,
    deposit: formatAudAmount(dynoCatalogChoice.deposit.amountCents),
    detail: "Hub dyno calibration focused on safe power, drivability and vehicle health.",
    href: "#dyno-booking",
    action: "Start dyno request",
  },
  parts: {
    title: "Buy some parts",
    price: "Performance parts & upgrades",
    optionLabel: "Buy some parts",
    deposit: null,
    detail: "Explore the dedicated PSI parts page and send the workshop a parts enquiry.",
    href: "/parts",
    action: "View parts",
  },
} as const;

type BookingChoice = keyof typeof bookingChoices;

export function OpeningBookingPanel() {
  const [choice, setChoice] = useState<BookingChoice | "">("");
  const selected = choice ? bookingChoices[choice] : null;

  const selectChoice = (value: BookingChoice | "") => {
    if (value === "parts") {
      window.location.assign("/parts");
      return;
    }
    setChoice(value);
  };

  const continueToBooking = () => {
    if (choice !== "service" && choice !== "dyno") return;
    const hash = choice === "service" ? "#service-booking" : "#dyno-booking";
    window.history.replaceState(null, "", hash);
    window.dispatchEvent(
      new CustomEvent("psi:booking-intent", {
        detail: { bookingType: choice },
      }),
    );
    document.getElementById("booking-panel")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    window.requestAnimationFrame(() => {
      document.getElementById("bookingType")?.focus();
    });
  };

  return (
    <div className="opening-panel">
      <p className="eyebrow">Online booking</p>
      <h2>What are you booking in for?</h2>
      <label className="opening-select-label" htmlFor="opening-booking-choice">
        Select an option
      </label>
      <div className="opening-select-wrap">
        <select
          id="opening-booking-choice"
          value={choice}
          onChange={(event) => selectChoice(event.target.value as BookingChoice | "")}
        >
          <option value="">Choose service, dyno or parts</option>
          <option value="service">{bookingChoices.service.optionLabel}</option>
          <option value="dyno">{bookingChoices.dyno.optionLabel}</option>
          <option value="parts">{bookingChoices.parts.optionLabel}</option>
        </select>
        <span aria-hidden="true">⌄</span>
      </div>

      {selected ? (
        <div className="opening-selection" aria-live="polite">
          <div>
            <strong>{selected.title}</strong>
            <span>{selected.price}</span>
          </div>
          <p>{selected.detail}</p>
          {selected.deposit && (
            <p className="opening-selection-deposit">
              <strong>{selected.deposit} deposit after approval</strong>
              <span>Nothing is payable now. PSI reviews the request and confirms or proposes a date first.</span>
            </p>
          )}
          <button
            className="button button-primary"
            type="button"
            onClick={continueToBooking}
            aria-label={selected.deposit ? `${selected.action}. No payment is required now.` : selected.action}
          >
            {selected.action}
          </button>
        </div>
      ) : (
        <p className="opening-helper">Choose the closest option. PSI will confirm the scope, date and final price.</p>
      )}

      <div className="opening-account-row">
        <span>Returning customers will be able to reuse saved details and see their PSI history.</span>
        <div>
          <a href="/account#profile">Customer account preview</a>
          <a href="https://psiperformance.com.au/products/psiperformance-gift-card" target="_blank" rel="noreferrer">Gift cards ↗</a>
        </div>
      </div>
    </div>
  );
}
