"use client";

import { useState } from "react";

const bookingChoices = {
  service: {
    title: "Service & Report",
    price: "Price guide from $385 + GST",
    detail: "Workshop inspection, servicing and a clear report on what your car needs.",
    href: "#service-booking",
    action: "Start service request",
  },
  dyno: {
    title: "Dyno tuning",
    price: "Price guide from $350 + GST",
    detail: "Hub dyno calibration focused on safe power, drivability and vehicle health.",
    href: "#dyno-booking",
    action: "Start dyno request",
  },
  parts: {
    title: "Buy some parts",
    price: "Performance parts & upgrades",
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
          <option value="service">Service & Report — from $385 + GST</option>
          <option value="dyno">Dyno tuning — from $350 + GST</option>
          <option value="parts">Buy some parts</option>
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
          <button className="button button-primary" type="button" onClick={continueToBooking}>
            {selected.action}
          </button>
        </div>
      ) : (
        <p className="opening-helper">Choose the closest option. PSI will confirm the scope, date and final price.</p>
      )}

      <div className="opening-account-row">
        <span>Customer accounts are being prepared. Preview the planned sign-in and saved-vehicle experience.</span>
        <div>
          <a href="/account#sign-in">Sign-in preview</a>
          <a href="/account#create-account">Account preview →</a>
        </div>
      </div>
    </div>
  );
}
