import type { Metadata } from "next";
import Image from "next/image";
import { BookingFlow } from "./components/BookingFlow";
import { PUBLIC_DEMO_CONFIG } from "./lib/public-demo";

export const metadata: Metadata = {
  title: "PSI Performance Garage | Booking preview",
  description:
    "Preview the PSI Performance Garage home-page booking experience for servicing and dyno tuning enquiries.",
};

export default function Home() {
  return (
    <main className="website-home-preview" id="top">
      <aside className="public-demo-banner" role="status">
        <strong>{PUBLIC_DEMO_CONFIG.label}</strong>
        <span>{PUBLIC_DEMO_CONFIG.notice}</span>
      </aside>

      <header className="website-header" aria-label="PSI website header preview">
        <nav className="website-nav website-nav-left" aria-label="Primary navigation">
          <a href="#top" aria-current="page">Home</a>
          <a href="https://psiperformance.com.au/collections/latest-arrivals" target="_blank" rel="noreferrer">Shop Now</a>
          <a href="https://psiperformance.com.au/pages/coding" target="_blank" rel="noreferrer">Tuning &amp; Coding</a>
          <a href="https://psiperformance.com.au/pages/contact" target="_blank" rel="noreferrer">Contact</a>
        </nav>

        <a className="website-logo" href="#top" aria-label="PSI Performance home">
          <Image src="/psi-logo.png" alt="PSI Performance Garage" width={310} height={120} priority />
        </a>

        <nav className="website-nav website-nav-actions" aria-label="Store navigation">
          <a href="https://psiperformance.com.au/search" target="_blank" rel="noreferrer">Search</a>
          <a href="https://psiperformance.com.au/account" target="_blank" rel="noreferrer">Log in</a>
          <a href="https://psiperformance.com.au/cart" target="_blank" rel="noreferrer">Cart</a>
        </nav>
      </header>

      <section className="website-hero" aria-labelledby="website-hero-heading">
        <div className="website-hero-content">
          <h1 id="website-hero-heading">Performance Services, Maintenance &amp; Repairs</h1>
          <p>From cold air intakes to full performance engine builds — we do it all.</p>
          <a className="website-hero-button" href="#booking-panel">Book an Appointment</a>
        </div>
      </section>

      <section className="website-transition" aria-label="PSI workshop promise">
        <div>
          <p>Service · Dyno Tuning · Performance</p>
          <h2>Your car. Your project. Our attention.</h2>
        </div>
        <p>
          Send the workshop the right details in one clear enquiry. PSI will review the work, check the schedule and contact you to confirm the next step.
        </p>
      </section>

      <BookingFlow />

      <section className="website-app-promo" aria-labelledby="app-promo-heading">
        <div className="website-app-icon" aria-hidden="true">
          <Image src="/psi-app-icon.png" alt="" width={120} height={120} />
        </div>
        <div>
          <p className="website-app-kicker">PSI App · Coming Soon</p>
          <h2 id="app-promo-heading">Want to make future bookings even easier?</h2>
          <p>
            The PSI mobile app will let members keep vehicle details and service history together, then start their next workshop enquiry in less time.
          </p>
        </div>
        <a href="mailto:info@psiperformance.com.au?subject=PSI%20App%20Launch%20Updates" className="website-app-button">
          Join launch updates
        </a>
      </section>

      <footer className="website-footer">
        <Image src="/psi-logo.png" alt="PSI Performance Garage" width={236} height={92} />
        <div>
          <strong>PSI Performance Garage</strong>
          <span>21 Exchange Drive, Pakenham VIC 3810</span>
          <a href="tel:+61433431781">0433 431 781</a>
          <a href="mailto:info@psiperformance.com.au">info@psiperformance.com.au</a>
        </div>
        <nav aria-label="Social links">
          <a href="https://www.facebook.com/psiperformancegarage/" target="_blank" rel="noreferrer">Facebook</a>
          <a href="https://www.instagram.com/psiperformancegarage/" target="_blank" rel="noreferrer">Instagram</a>
          <a href="https://www.youtube.com/channel/UCkJaKfpjPlHOuwOMH0xBIJQ" target="_blank" rel="noreferrer">YouTube</a>
        </nav>
      </footer>
    </main>
  );
}
