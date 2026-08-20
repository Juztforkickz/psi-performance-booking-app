import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Performance parts",
  description: "Shop PSI Performance parts and gift cards, or ask the workshop to help match the right upgrade.",
};

const categories = [
  {
    number: "01",
    title: "Forced induction",
    copy: "Turbocharger, supercharger and supporting upgrade enquiries.",
  },
  {
    number: "02",
    title: "Fuel & ignition",
    copy: "Fuel system, injector, ignition and engine-management hardware.",
  },
  {
    number: "03",
    title: "Cooling & exhaust",
    copy: "Cooling, intake, intercooler and exhaust-system components.",
  },
  {
    number: "04",
    title: "Driveline & chassis",
    copy: "Clutch, transmission, differential, brake and suspension enquiries.",
  },
];

export default function PartsPage() {
  const subject = encodeURIComponent("PSI parts enquiry");
  const body = encodeURIComponent(
    "Hi PSI,\n\nVehicle year / make / model:\nRegistration:\nPart or upgrade I am after:\nCurrent modifications:\n\nThanks,",
  );

  return (
    <main className="utility-page parts-page">
      <header className="utility-header">
        <Link href="/" aria-label="PSI Performance home">
          <Image src="/psi-logo.png" alt="PSI Performance Garage" width={300} height={100} priority />
        </Link>
        <Link className="utility-back-link" href="/">Back to booking <span aria-hidden="true">→</span></Link>
      </header>

      <section className="parts-hero">
        <div>
          <p className="eyebrow">PSI Performance parts</p>
          <h1>The right parts.<br />Properly matched.</h1>
        </div>
        <div className="parts-hero-copy">
          <p>
            Shop the current PSI catalogue on the official website, or send the workshop your vehicle and goal so the team can help match the right hardware.
          </p>
          <div className="parts-actions">
            <a className="button button-primary" href="https://psiperformance.com.au/collections/all" target="_blank" rel="noreferrer">Shop all parts <span aria-hidden="true">↗</span></a>
            <a className="button button-ghost-dark" href="https://psiperformance.com.au/products/psiperformance-gift-card" target="_blank" rel="noreferrer">Buy a PSI gift card <span aria-hidden="true">↗</span></a>
            <a className="parts-enquiry-link" href={"mailto:info@psiperformance.com.au?subject=" + subject + "&body=" + body}>Ask PSI to match a part</a>
          </div>
        </div>
      </section>

      <section className="parts-grid" aria-label="Parts enquiry categories">
        {categories.map((category) => (
          <article key={category.number}>
            <span>{category.number}</span>
            <h2>{category.title}</h2>
            <p>{category.copy}</p>
          </article>
        ))}
      </section>

      <section className="parts-contact">
        <div>
          <p className="eyebrow">Need advice now?</p>
          <h2>Talk to the workshop.</h2>
        </div>
        <div>
          <a href="https://psiperformance.com.au/collections/all" target="_blank" rel="noreferrer"><span>Official online shop</span><strong>Browse parts ↗</strong></a>
          <a href="https://psiperformance.com.au/products/psiperformance-gift-card" target="_blank" rel="noreferrer"><span>Gift cards</span><strong>Choose a gift card ↗</strong></a>
          <a href="tel:+61433431781"><span>Call</span><strong>0433 431 781</strong></a>
          <a href="mailto:info@psiperformance.com.au"><span>Email</span><strong>info@psiperformance.com.au</strong></a>
        </div>
      </section>
    </main>
  );
}
