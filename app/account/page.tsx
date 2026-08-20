import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AccountPreview } from "./AccountPreview";

export const metadata: Metadata = {
  title: "Customer account preview",
  description: "Preview the planned PSI Performance customer account for saved vehicles, booking requests and verified deposit receipts.",
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
            Customer accounts will make repeat bookings faster, keep vehicle details together and provide one place for booking references and deposit receipts.
          </p>
          <div className="account-benefits">
            <div><span>01</span><strong>Saved details</strong><p>Keep your contact and vehicle information ready for the next visit.</p></div>
            <div><span>02</span><strong>Booking history</strong><p>See requests, preferred dates and confirmation status.</p></div>
            <div><span>03</span><strong>Deposit receipts</strong><p>Retrieve verified payment records from a protected profile.</p></div>
          </div>
        </div>
        <AccountPreview />
      </section>
    </main>
  );
}
