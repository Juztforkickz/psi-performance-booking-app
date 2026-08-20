import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BOOKING_POLICY_VERSION, DEPOSIT_POLICY_VERSION } from "../api/v1/booking-catalog/catalog";

export const metadata: Metadata = {
  title: "Booking policy preview",
  description: "Owner-review draft of the PSI Performance booking and deposit policy.",
  robots: {
    index: false,
    follow: false,
  },
};

const policySections = [
  {
    number: "01",
    title: "Request first. Payment later.",
    body: "A preferred date is a request, not a confirmed appointment. PSI reviews the work and workshop capacity, then confirms that date or contacts the customer to agree on another date. No deposit is requested until a date is agreed.",
  },
  {
    number: "02",
    title: "Deposit after approval",
    body: "After PSI confirms the date, the customer receives a secure deposit link: $100 AUD for Service & Report or $300 AUD for Dyno tuning. The booking becomes confirmed only after the payment provider verifies the deposit.",
  },
  {
    number: "03",
    title: "Why a paid deposit is ordinarily non-refundable",
    body: "Once paid, the deposit ordinarily cannot be refunded because PSI allocates technician time and reserves hoist, dyno and workshop capacity for that vehicle. It is credited to the agreed booking, not charged when the initial request is sent.",
  },
  {
    number: "04",
    title: "Changes, cancellations and no-shows",
    body: "Customers should contact PSI as early as possible if plans change. Where a customer cancels or does not attend after resources have been reserved, the deposit may be retained to reflect that allocation. PSI will consider serious illness and exceptional circumstances fairly. Any transfer to a new date must be agreed by PSI.",
  },
  {
    number: "05",
    title: "If PSI needs to move the booking",
    body: "Workshop work can expand, parts can be delayed and vehicles may need additional repairs. If PSI must move a booking, the team will contact the customer and keep the deposit attached to the agreed replacement date, offer a refund, or provide another remedy where required.",
  },
  {
    number: "06",
    title: "Consumer rights remain",
    body: "Nothing in this draft limits rights or remedies that cannot be excluded under the Australian Consumer Law. The final public wording should be reviewed for PSI's specific services before launch.",
  },
] as const;

export default function BookingPolicyPage() {
  return (
    <main className="utility-page policy-page">
      <header className="utility-header">
        <Link href="/" aria-label="PSI Performance home">
          <Image src="/psi-logo.png" alt="PSI Performance Garage" width={300} height={100} priority />
        </Link>
        <Link className="utility-back-link" href="/#booking-panel">Back to booking <span aria-hidden="true">→</span></Link>
      </header>

      <section className="policy-hero">
        <div>
          <p className="eyebrow">Owner-review draft · Preview only</p>
          <h1>Clear before<br />you commit.</h1>
        </div>
        <div className="policy-hero-copy">
          <strong>This is a working policy for review—not the final public terms or legal advice.</strong>
          <p>It explains the intended approval-before-payment journey in plain language. No payment, email or calendar integration is activated by this preview.</p>
          <small>Review identifiers: {BOOKING_POLICY_VERSION} · {DEPOSIT_POLICY_VERSION}</small>
        </div>
      </section>

      <section className="policy-grid" aria-label="Draft booking policy">
        {policySections.map((section) => (
          <article key={section.number}>
            <span>{section.number}</span>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>

      <section className="policy-supporting">
        <article>
          <p className="eyebrow">Dates and workshop access</p>
          <h2>Availability by request.</h2>
          <p>Service requests are available Monday to Friday. Dyno requests are available Monday, Wednesday and Thursday. Before-hours drop-off, after-hours drop-off and after-hours collection can be requested but require PSI confirmation.</p>
          <p>Customers can ask to be told if an earlier opening appears. This creates a staff-only flag; the system never offers or moves a booking automatically.</p>
        </article>
        <article>
          <p className="eyebrow">Privacy and reminders</p>
          <h2>Useful, not intrusive.</h2>
          <p>An unfinished form stays only in that browser for up to 30 days and has a visible clear action. It is not sent to PSI until submitted.</p>
          <p>Paid bookings may receive factual appointment reminders approximately seven days and 24 hours before the confirmed date; rescheduling replaces the old reminders. Separate six- and twelve-month “Ready for your next service?” messages are service-only, require explicit consent, identify PSI and include a simple unsubscribe.</p>
        </article>
      </section>

      <section className="policy-contact">
        <div>
          <p className="eyebrow">Questions before booking?</p>
          <h2>Talk to PSI first.</h2>
        </div>
        <div>
          <a href="tel:+61433431781"><span>Call</span><strong>0433 431 781</strong></a>
          <a href="mailto:info@psiperformance.com.au"><span>Email</span><strong>info@psiperformance.com.au</strong></a>
        </div>
      </section>
    </main>
  );
}
