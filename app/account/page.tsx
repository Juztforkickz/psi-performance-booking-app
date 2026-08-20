import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AccountPreview } from "./AccountPreview";

export const metadata: Metadata = {
  title: "Customer account preview",
  description: "Owner-review preview of the planned PSI Performance customer account, saved vehicles, workshop history, next booking and reminders.",
};

export default function AccountPage() {
  return (
    <main className="utility-page">
      <header className="utility-header">
        <Link href="/" aria-label="PSI Performance home">
          <Image src="/psi-logo.png" alt="PSI Performance Garage" width={300} height={100} priority />
        </Link>
        <Link className="utility-back-link" href="/#booking-panel">Book your car <span aria-hidden="true">→</span></Link>
      </header>

      <section className="account-shell">
        <div className="account-intro">
          <p className="eyebrow">Your PSI garage</p>
          <h1>One profile.<br />Every car.</h1>
          <p>
            Customer accounts will make repeat bookings faster and keep contact details, vehicles, workshop visits, the next confirmed booking and verified deposit receipts together.
          </p>
          <div className="account-benefits">
            <div><span>01</span><strong>Saved details</strong><p>Keep your contact and vehicle information ready for the next visit.</p></div>
            <div><span>02</span><strong>Past and next visits</strong><p>See requests, completed work and the next staff-confirmed date.</p></div>
            <div><span>03</span><strong>Receipts & reminders</strong><p>Keep verified deposit records and control optional service check-ins.</p></div>
          </div>
        </div>
        <AccountPreview />
      </section>
    </main>
  );
}
