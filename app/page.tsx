import type { Metadata } from "next";
import Image from "next/image";
import { BrandMarquee } from "./components/BrandMarquee";
import { BookingFlow } from "./components/BookingFlow";
import { OpeningBookingPanel } from "./components/OpeningBookingPanel";
import { depositAmountForBookingType } from "./api/v1/booking-catalog/catalog";

export const metadata: Metadata = {
  title: "Book your car",
  description:
    "Request vehicle servicing or dyno tuning with PSI Performance Garage. PSI reviews and confirms the workshop date before sending a secure deposit link.",
};

function formatDeposit(bookingType: "service" | "dyno") {
  return `$${depositAmountForBookingType(bookingType) / 100} AUD`;
}

const trustPoints = [
  "Hub dyno tuning",
  "Logbook servicing",
  "Performance builds",
  "Diagnostics & repairs",
];

const testimonials = [
  {
    quote: "The communication was excellent, they kept me updated throughout the entire process and were always clear about the next steps. I appreciated the regular progress updates and the transparency at every stage. The handover was smooth, with everything explained in detail. The team truly cares about both the car and the customer.",
    customer: "Cale Pearson",
    theme: "2002 Monaro · Communication and personal care",
  },
  {
    quote: "Could not be happier. These guys know their stuff and will look after you through the whole process. Answering all my questions and going above and beyond to deliver a really amazing result. Thanks Matt and Dale for your work 🙏🏻",
    customer: "Cade",
    theme: "Knowledge, support and gratitude",
  },
  {
    quote: "Matt and the team rebuilt my LS1 and transmission back to factory fresh condition. I was kept up to date the whole way through the project with photos included. I can't praise enough the quality of work and professionalism of the whole team. They turned an old well used 400,000 km drive train into brand new.",
    customer: "Harry Beith",
    theme: "LS1 and transmission rebuild · Transformational result",
  },
] as const;

export default function Home() {
  return (
    <main>
      <section className="hero-shell">
        <header className="site-header">
          <a href="#top" className="brand-link" aria-label="PSI Performance home">
            <Image className="brand-mark" src="/psi-logo.png" alt="PSI Performance Garage" width={310} height={120} priority />
          </a>
          <nav className="site-nav" aria-label="Primary navigation">
            <a href="#services">Services</a>
            <a href="/parts">Parts</a>
            <a href="#why-psi">Why PSI</a>
            <a href="#reviews">Reviews</a>
            <a href="#contact">Contact</a>
            <a href="/account">Account preview</a>
          </nav>
          <a className="header-call" href="tel:+61433431781">
            <span>Talk to the workshop</span>
            0433 431 781
          </a>
        </header>

        <div className="opening-layout" id="top">
          <OpeningBookingPanel />
          <div className="opening-intro">
            <p className="eyebrow">PSI Performance Garage · Pakenham</p>
            <h1>Book your car<br />now.</h1>
            <p className="opening-promise">One workshop. Your vehicle. A plan built around you.</p>
            <div className="opening-details">
              <div>
                <span>Shop hours</span>
                <strong>Mon–Fri · 8:30am–5pm</strong>
                <small>Saturday · By appointment only</small>
              </div>
              <div>
                <span>Contact number</span>
                <a href="tel:+61433431781">0433 431 781</a>
              </div>
              <div>
                <span>Email</span>
                <a href="mailto:info@psiperformance.com.au">info@psiperformance.com.au</a>
              </div>
              <div>
                <span>Address</span>
                <a href="https://maps.google.com/?q=21+Exchange+Drive+Pakenham+VIC+3810" target="_blank" rel="noreferrer">
                  21 Exchange Drive, Pakenham VIC 3810
                </a>
              </div>
            </div>
            <div className="opening-social-links" aria-label="PSI Performance social media">
              <span>Follow the workshop</span>
              <a href="https://www.instagram.com/psiperformancegarage/" target="_blank" rel="noreferrer">Instagram <span aria-hidden="true">↗</span></a>
              <a href="https://www.facebook.com/psiperformancegarage/" target="_blank" rel="noreferrer">Facebook <span aria-hidden="true">↗</span></a>
            </div>
            <p className="opening-deposit-note">
              Nothing is payable when you send a request. PSI confirms or proposes the workshop date first, then sends a secure deposit link: {formatDeposit("service")} for service or {formatDeposit("dyno")} for dyno tuning.
            </p>
          </div>
        </div>

        <div className="hero-foot">
          <a href="https://maps.google.com/?q=21+Exchange+Drive+Pakenham+VIC+3810" target="_blank" rel="noreferrer">
            21 Exchange Drive, Pakenham
          </a>
          <span>Mon–Fri 8:30am–5pm · Saturday by appointment</span>
        </div>
      </section>

      <section className="trust-strip" aria-label="PSI workshop services">
        {trustPoints.map((point, index) => (
          <div key={point}>
            <span>0{index + 1}</span>
            <strong>{point}</strong>
          </div>
        ))}
      </section>

      <section className="partnership-section" aria-labelledby="partnership-heading">
        <div className="partnership-heading">
          <p className="eyebrow">One stop. Never one-size-fits-all.</p>
          <h2 id="partnership-heading">Everything your vehicle needs.<br />Attention that stays personal.</h2>
        </div>
        <div className="partnership-copy">
          <p>
            From preventative servicing and diagnostics to carefully planned performance work and hub dyno tuning, PSI keeps the whole journey in one conversation.
          </p>
          <p>
            You are not another registration on a job card. Tell us where the vehicle is today and where you want it to go—then let us protect it, build it and develop the project with you.
          </p>
          <a className="text-link partnership-link" href="#service-booking">Build your plan with PSI <span aria-hidden="true">→</span></a>
        </div>
        <div className="partnership-standard" aria-label="PSI service standard">
          <span>Our service standard</span>
          <strong>10/10 care</strong>
          <p>Clear advice, careful workmanship and respect for you, your goals and your vehicle.</p>
          <small>PSI service commitment—not a customer review aggregate.</small>
        </div>
        <div className="partnership-pillars" aria-label="How PSI supports your vehicle">
          <article><span>01</span><strong>Protect</strong><p>Service, inspect and diagnose before small issues become expensive ones.</p></article>
          <article><span>02</span><strong>Plan</strong><p>Build a clear, staged path around your priorities, budget and intended use.</p></article>
          <article><span>03</span><strong>Build & tune</strong><p>Bring mechanical work and measured calibration together under one roof.</p></article>
        </div>
      </section>

      <section className="services-section" id="services">
        <div className="section-heading">
          <p className="eyebrow">Protection to performance</p>
          <h2>Protect what you love.<br />Build what you imagine.</h2>
          <p>
            Daily driver, weekend car or long-term project—PSI approaches every job with the same care, measured thinking and straight communication.
          </p>
        </div>

        <div className="service-showcase">
          <article className="service-feature service-feature-light">
            <div className="service-image service-image-maintenance" role="img" aria-label="Performance car in the PSI workshop" />
            <div className="service-feature-copy">
              <span className="service-kicker">01 · Workshop</span>
              <h3>Vehicle service</h3>
              <p>Keep your daily, weekend car or pride and joy healthy with clear communication and workmanship you can trust.</p>
              <ul>
                <li>Logbook, minor and major servicing</li>
                <li>Diagnostics and mechanical fault-finding</li>
                <li>Brake, clutch and cooling system work</li>
                <li>Performance upgrades and repairs</li>
              </ul>
              <a className="text-link" href="#service-booking">Request a service <span aria-hidden="true">→</span></a>
            </div>
          </article>

          <article className="service-feature service-feature-dark">
            <div className="service-image service-image-dyno" role="img" aria-label="Turbocharged performance engine" />
            <div className="service-feature-copy">
              <span className="service-kicker">02 · Performance</span>
              <h3>Dyno tune</h3>
              <p>Custom calibration and health checks built around safe power, drivability and the mechanical limits of your setup.</p>
              <ul>
                <li>Hub dyno tuning and testing</li>
                <li>Australian, European and JDM vehicles</li>
                <li>Turbo, supercharger and engine packages</li>
                <li>Existing tune and vehicle health reviews</li>
              </ul>
              <a className="text-link" href="#dyno-booking">Request a dyno tune <span aria-hidden="true">→</span></a>
            </div>
          </article>
        </div>
      </section>

      <BookingFlow />

      <section className="why-section" id="why-psi">
        <picture className="why-image">
          <source media="(max-width: 760px)" srcSet="/psi-gtsr-porsche-mobile.jpg" />
          <Image
            src="/psi-gtsr-porsche.jpg"
            alt="Black VF GTSR and grey Porsche 911 GT3 RS parked together outside the PSI workshop"
            width={1744}
            height={901}
            sizes="100vw"
            loading="lazy"
          />
        </picture>
        <div className="why-copy">
          <p className="eyebrow">Why PSI</p>
          <h2>Done properly.<br />Explained clearly.</h2>
          <p className="why-lead">
            The strongest theme in verified PSI customer feedback is not only the result. It is the communication, regular updates and confidence that both the person and the vehicle are being looked after.
          </p>
          <div className="why-grid">
            <div><span>01</span><strong>Clear advice</strong><p>Understand what your car needs and why.</p></div>
            <div><span>02</span><strong>Measured results</strong><p>Calibrate and diagnose with real data.</p></div>
            <div><span>03</span><strong>No shortcuts</strong><p>Work built around reliability and detail.</p></div>
            <div><span>04</span><strong>Your car, your plan</strong><p>Advice shaped around your goals—not a generic package.</p></div>
          </div>
        </div>
      </section>

      <section className="testimonials-section" id="reviews" aria-labelledby="reviews-heading">
        <div className="section-heading compact-heading">
          <p className="eyebrow">Genuine five-star customer feedback</p>
          <h2 id="reviews-heading">Real owners.<br />Real care. Real results.</h2>
          <p>Verbatim excerpts from customer stories published on PSI Performance&apos;s official website.</p>
        </div>
        <div className="testimonial-grid">
          {testimonials.map((testimonial) => (
            <figure key={testimonial.customer}>
              <div className="stars" aria-label="5 out of 5 stars">★★★★★</div>
              <blockquote cite="https://psiperformance.com.au/">“{testimonial.quote}”</blockquote>
              <figcaption>
                <strong>{testimonial.customer}</strong>
                <span>{testimonial.theme} · Verified on PSI&apos;s website</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="testimonial-source-row">
          <p>Real customer words, attributed accurately and excerpted only for length.</p>
          <a href="https://psiperformance.com.au/" target="_blank" rel="noreferrer">Read PSI customer stories <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <section className="contact-section" id="contact">
        <div>
          <p className="eyebrow">PSI Performance Garage</p>
          <h2>Protect it.<br />Build it.<br />Together.</h2>
        </div>
        <div className="contact-panel">
          <div className="contact-grid">
            <a href="tel:+61433431781"><span>Call</span><strong>0433 431 781</strong></a>
            <a href="mailto:info@psiperformance.com.au"><span>Email</span><strong>info@psiperformance.com.au</strong></a>
            <a href="https://maps.google.com/?q=21+Exchange+Drive+Pakenham+VIC+3810" target="_blank" rel="noreferrer"><span>Workshop</span><strong>21 Exchange Drive<br />Pakenham VIC 3810</strong></a>
            <div><span>Hours</span><strong>Mon–Fri · 8:30am–5pm<br />Saturday · By appointment</strong></div>
            <a href="https://www.instagram.com/psiperformancegarage/" target="_blank" rel="noreferrer"><span>Instagram</span><strong>@psiperformancegarage ↗</strong></a>
            <a href="https://www.facebook.com/psiperformancegarage/" target="_blank" rel="noreferrer"><span>Facebook</span><strong>PSI Performance Garage ↗</strong></a>
          </div>
          <div className="contact-qr-card">
            <div>
              <span>PSI in your phone</span>
              <strong>Scan to save PSI contact</strong>
              <p>Phone, email, workshop address and website—ready to save.</p>
            </div>
            <Image src="/psi-contact-qr.png" alt="QR code to save PSI Performance contact details" width={180} height={180} />
          </div>
        </div>
      </section>

      <BrandMarquee />

      <footer className="site-footer">
        <Image src="/psi-logo.png" alt="PSI Performance Garage" width={236} height={92} />
        <div className="social-links">
          <a href="https://www.facebook.com/psiperformancegarage/" target="_blank" rel="noreferrer">Facebook</a>
          <a href="https://www.instagram.com/psiperformancegarage/" target="_blank" rel="noreferrer">Instagram</a>
          <a href="https://www.youtube.com/channel/UCkJaKfpjPlHOuwOMH0xBIJQ" target="_blank" rel="noreferrer">YouTube</a>
        </div>
        <div className="footer-legal">
          <a href="https://psiperformance.com.au/policies/privacy-policy" target="_blank" rel="noreferrer">Privacy</a>
          <a href="/booking-policy">Booking policy preview</a>
          <a href="https://psiperformance.com.au/collections/all" target="_blank" rel="noreferrer">Shop parts</a>
          <a href="https://psiperformance.com.au/products/psiperformance-gift-card" target="_blank" rel="noreferrer">Gift cards</a>
          <span>© {new Date().getFullYear()} PSI Performance™ · All rights reserved</span>
        </div>
      </footer>
    </main>
  );
}
