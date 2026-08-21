"use client";

import { type KeyboardEvent, useEffect, useState } from "react";
import Link from "next/link";

type AccountView = "garage" | "history" | "reminders";
const ACCOUNT_VIEWS: AccountView[] = ["garage", "history", "reminders"];

const viewLabels: Record<AccountView, string> = {
  garage: "My garage",
  history: "Booking history",
  reminders: "Reminders",
};

export function AccountPreview() {
  const [view, setView] = useState<AccountView>("garage");

  useEffect(() => {
    const readHash = () => {
      const next = window.location.hash.replace("#", "");
      if (next === "history" || next === "reminders") setView(next);
      if (["garage", "profile", "sign-in", "create-account"].includes(next)) setView("garage");
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
      <div className="account-tabs" role="tablist" aria-label="Customer account preview">
        {ACCOUNT_VIEWS.map((item) => (
          <button
            key={item}
            id={"account-tab-" + item}
            type="button"
            role="tab"
            aria-controls={"account-panel-" + item}
            aria-selected={view === item}
            tabIndex={view === item ? 0 : -1}
            onKeyDown={(event) => handleTabKey(event, item)}
            onClick={() => chooseView(item)}
          >
            {viewLabels[item]}
          </button>
        ))}
      </div>

      <div className="auth-safety-notice" role="status">
        <strong>Owner-review preview · Synthetic example data</strong>
        <p>No public account, password or customer record is active. These examples show the proposed experience for PSI’s review only.</p>
      </div>

      {view === "garage" && (
        <section className="account-view" id="account-panel-garage" role="tabpanel" aria-labelledby="account-tab-garage">
          <p className="eyebrow">Example customer profile</p>
          <h2>Jordan’s PSI garage.</h2>
          <p>Saved contact and vehicle details make a future booking faster. Customers will still review every detail before submitting.</p>
          <div className="account-profile-summary">
            <div><span>Name</span><strong>Jordan Taylor</strong></div>
            <div><span>Email</span><strong>jordan@example.com</strong></div>
            <div><span>Mobile</span><strong>0400 000 000</strong></div>
          </div>
          <div className="account-section-heading">
            <h3>Saved vehicles</h3>
            <span>2 example vehicles</span>
          </div>
          <div className="vehicle-preview-grid">
            <article>
              <span className="account-status-chip">Primary vehicle</span>
              <h4>2017 Holden Commodore VF SS</h4>
              <dl><div><dt>Registration</dt><dd>PSI001</dd></div><div><dt>Last visit</dt><dd>18 Feb 2026</dd></div><div><dt>Next due</dt><dd>18 Aug 2026</dd></div></dl>
            </article>
            <article>
              <span className="account-status-chip account-status-muted">Project vehicle</span>
              <h4>2015 Ford Mustang GT</h4>
              <dl><div><dt>Registration</dt><dd>PSI002</dd></div><div><dt>Last visit</dt><dd>7 Nov 2025</dd></div><div><dt>Next due</dt><dd>Not scheduled</dd></div></dl>
            </article>
          </div>
          <Link className="button button-primary" href="/#top">Start another request</Link>
        </section>
      )}

      {view === "history" && (
        <section className="account-view" id="account-panel-history" role="tabpanel" aria-labelledby="account-tab-history">
          <p className="eyebrow">Example history</p>
          <h2>Visits, requests and checkout records.</h2>
          <p>The account will keep the next confirmed booking beside completed workshop visits and verified deposit receipts.</p>
          <div className="account-history-list">
            <article className="account-history-next">
              <div><span className="account-status-chip">Next booking · Deposit paid</span><time dateTime="2026-09-16">Wed 16 Sep 2026</time></div>
              <h3>Dyno Tuning · Holden Commodore VF SS</h3>
              <p>Confirmed workshop allocation. Google Calendar and factual 7-day / 24-hour reminders will use the staff-confirmed schedule.</p>
              <dl><div><dt>Reference</dt><dd>PSI-EXAMPLE-002</dd></div><div><dt>Deposit</dt><dd>$300 AUD · receipt recorded</dd></div></dl>
            </article>
            <article>
              <div><span className="account-status-chip account-status-complete">Completed</span><time dateTime="2026-02-18">18 Feb 2026</time></div>
              <h3>Service & Report · Holden Commodore VF SS</h3>
              <p>Completed visit retained with the vehicle history.</p>
              <dl><div><dt>Reference</dt><dd>PSI-EXAMPLE-001</dd></div><div><dt>Deposit</dt><dd>$100 AUD · receipt recorded</dd></div></dl>
            </article>
            <article>
              <div><span className="account-status-chip account-status-muted">Awaiting PSI review</span><time dateTime="2026-08-21">21 Aug 2026</time></div>
              <h3>Service request · Ford Mustang GT</h3>
              <p>No payment requested. PSI is checking the requested date and workshop plan.</p>
              <dl><div><dt>Reference</dt><dd>PSI-EXAMPLE-003</dd></div><div><dt>Deposit</dt><dd>Not requested</dd></div></dl>
            </article>
          </div>
        </section>
      )}

      {view === "reminders" && (
        <section className="account-view" id="account-panel-reminders" role="tabpanel" aria-labelledby="account-tab-reminders">
          <p className="eyebrow">Example communication settings</p>
          <h2>Useful reminders. Your choice.</h2>
          <p>These controls are illustrative and do not send or schedule any message in this preview.</p>
          <div className="reminder-preview-list">
            <article>
              <div><strong>Confirmed appointment reminders</strong><span className="account-status-chip">Factual</span></div>
              <p>Approximately seven days and 24 hours before a paid, confirmed booking. A reschedule replaces the previous reminders.</p>
            </article>
            <article>
              <div><strong>6- and 12-month service check-in</strong><span className="account-status-chip account-status-complete">Example: opted in</span></div>
              <p>“Are you ready for your next service?” from PSI Performance, with a rebook/contact link and an unsubscribe that does not require sign-in.</p>
              <button type="button" disabled>Unsubscribe control preview</button>
            </article>
          </div>
          <p className="account-boundary-note">PSI will not automatically ask for reviews or promote curated vehicle packages through this reminder setting.</p>
        </section>
      )}

      <Link className="account-guest-link" href="/#booking-panel">Continue booking without an account →</Link>
    </div>
  );
}
