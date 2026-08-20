import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Performance parts",
  description: "Discuss performance parts, upgrades and supporting hardware with PSI Performance Garage.",
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
            PSI’s online parts catalogue is the next stage of this app. For now, send the workshop your vehicle and goal so the team can recommend the correct package.
          </p>
          <a className="button button-primary" href={"mailto:info@psiperformance.com.au?subject=" + subject + "&body=" + body}>
            Start a parts enquiry
          </a>
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
          <a href="tel:+61433431781"><span>Call</span><strong>0433 431 781</strong></a>
          <a href="mailto:info@psiperformance.com.au"><span>Email</span><strong>info@psiperformance.com.au</strong></a>
        </div>
      </section>
    </main>
  );
}
