"use client";

import { type KeyboardEvent, useEffect, useState } from "react";
import Link from "next/link";

type AccountView = "sign-in" | "create-account" | "profile";
const ACCOUNT_VIEWS: AccountView[] = ["sign-in", "create-account", "profile"];

export function AccountPreview() {
  const [view, setView] = useState<AccountView>("sign-in");

  useEffect(() => {
    const readHash = () => {
      const next = window.location.hash.replace("#", "");
      if (next === "sign-in" || next === "create-account" || next === "profile") {
        setView(next);
      }
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  const chooseView = (next: AccountView) => {
    setView(next);
    window.history.replaceState(null, "", "#" + next);
  };

  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>, current: AccountView) => {
    const currentIndex = ACCOUNT_VIEWS.indexOf(current);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % ACCOUNT_VIEWS.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + ACCOUNT_VIEWS.length) % ACCOUNT_VIEWS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = ACCOUNT_VIEWS.length - 1;
    if (nextIndex === currentIndex && !["Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = ACCOUNT_VIEWS[nextIndex];
    chooseView(next);
    window.requestAnimationFrame(() => document.getElementById("account-tab-" + next)?.focus());
  };

  return (
    <div className="account-panel">
      <div className="account-tabs" role="tablist" aria-label="Customer account">
        <button id="account-tab-sign-in" type="button" role="tab" aria-controls="account-panel-sign-in" aria-selected={view === "sign-in"} tabIndex={view === "sign-in" ? 0 : -1} onKeyDown={(event) => handleTabKey(event, "sign-in")} onClick={() => chooseView("sign-in")}>Sign-in preview</button>
        <button id="account-tab-create-account" type="button" role="tab" aria-controls="account-panel-create-account" aria-selected={view === "create-account"} tabIndex={view === "create-account" ? 0 : -1} onKeyDown={(event) => handleTabKey(event, "create-account")} onClick={() => chooseView("create-account")}>Account preview</button>
        <button id="account-tab-profile" type="button" role="tab" aria-controls="account-panel-profile" aria-selected={view === "profile"} tabIndex={view === "profile" ? 0 : -1} onKeyDown={(event) => handleTabKey(event, "profile")} onClick={() => chooseView("profile")}>Profile preview</button>
      </div>

      <div className="auth-safety-notice" role="status">
        <strong>Protected accounts are being connected.</strong>
        <p>PSI is not collecting or storing passwords in this preview. Sign-in will open only after a managed identity provider is configured and tested.</p>
      </div>

      {view === "sign-in" && (
        <section className="account-view" id="account-panel-sign-in" role="tabpanel" aria-labelledby="account-tab-sign-in">
          <p className="eyebrow">Returning customer</p>
          <h2>Welcome back.</h2>
          <p>Your managed sign-in provider will appear here. The disabled field shows the intended experience without accepting personal information.</p>
          <label htmlFor="preview-sign-in-email">Email address</label>
          <input id="preview-sign-in-email" type="email" placeholder="you@example.com" disabled />
          <button className="button button-primary" type="button" disabled>Managed sign-in not connected</button>
        </section>
      )}

      {view === "create-account" && (
        <section className="account-view" id="account-panel-create-account" role="tabpanel" aria-labelledby="account-tab-create-account">
          <p className="eyebrow">New customer</p>
          <h2>Create your garage.</h2>
          <p>The live account form will securely save these details through the managed account provider. Nothing entered here is accepted yet.</p>
          <div className="account-preview-grid" aria-disabled="true">
            <PreviewField label="First name" placeholder="First name" />
            <PreviewField label="Last name" placeholder="Last name" />
            <PreviewField label="Email" placeholder="you@example.com" />
            <PreviewField label="Mobile" placeholder="04xx xxx xxx" />
            <PreviewField label="Vehicle make" placeholder="e.g. Holden" />
            <PreviewField label="Vehicle model" placeholder="e.g. VF SS" />
            <PreviewField label="Vehicle year" placeholder="2017" />
            <PreviewField label="Registration" placeholder="ABC123" />
          </div>
          <button className="button button-primary" type="button" disabled>Account creation not connected</button>
        </section>
      )}

      {view === "profile" && (
        <section className="account-view" id="account-panel-profile" role="tabpanel" aria-labelledby="account-tab-profile">
          <p className="eyebrow">Profile preview</p>
          <h2>Your PSI garage.</h2>
          <p>This is the signed-in destination that will be unlocked by the managed account service.</p>
          <div className="profile-preview">
            <article><span>Saved vehicles</span><strong>Vehicle profiles</strong><p>Make, model, year, registration and optional VIN.</p></article>
            <article><span>Current requests</span><strong>Booking status</strong><p>Paid request, PSI confirmation and preferred date.</p></article>
            <article><span>Payment records</span><strong>Deposit receipts</strong><p>Verified service and dyno deposit receipts with booking references.</p></article>
          </div>
        </section>
      )}

      <Link className="account-guest-link" href="/#booking-panel">Continue booking without an account →</Link>
    </div>
  );
}

function PreviewField({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label>
      <span>{label}</span>
      <input type="text" placeholder={placeholder} disabled />
    </label>
  );
}
