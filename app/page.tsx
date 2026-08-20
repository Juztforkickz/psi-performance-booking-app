import type { Metadata } from "next";
import Image from "next/image";
import { BookingFlow } from "./components/BookingFlow";
import { OpeningBookingPanel } from "./components/OpeningBookingPanel";

export const metadata: Metadata = {
  title: "Book your car",
  description:
    "Request vehicle servicing or dyno tuning with PSI Performance Garage, choose a preferred date and continue to a secure $200 AUD deposit.",
};

const trustPoints = [
  "Hub dyno tuning",
  "Logbook servicing",
  "Performance builds",
  "Diagnostics & repairs",
];

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
              Booking requests are secured with a fixed $200 AUD deposit. PSI confirms the requested date after payment.
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

      <section className="services-section" id="services">
        <div className="section-heading">
          <p className="eyebrow">Two ways in</p>
          <h2>Street manners.<br />Track-bred thinking.</h2>
          <p>
            From routine maintenance to a carefully calibrated performance setup, PSI approaches every job with the same attention to detail.
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
        <div className="why-image" role="img" aria-label="Performance vehicle outside the PSI workshop" />
        <div className="why-copy">
          <p className="eyebrow">Why PSI</p>
          <h2>Done properly.<br />Explained clearly.</h2>
          <p className="why-lead">
            The strongest theme across PSI customer feedback is not just the result—it is the communication, updates and confidence that the car is being looked after.
          </p>
          <div className="why-grid">
            <div><span>01</span><strong>Clear advice</strong><p>Understand what your car needs and why.</p></div>
            <div><span>02</span><strong>Measured results</strong><p>Calibrate and diagnose with real data.</p></div>
            <div><span>03</span><strong>No shortcuts</strong><p>Work built around reliability and detail.</p></div>
            <div><span>04</span><strong>One workshop</strong><p>Servicing, mechanical work and tuning together.</p></div>
          </div>
        </div>
      </section>

      <section className="testimonials-section" aria-labelledby="reviews-heading">
        <div className="section-heading compact-heading">
          <p className="eyebrow">Customer stories</p>
          <h2 id="reviews-heading">Built on trust.</h2>
        </div>
        <div className="testimonial-grid">
          <figure>
            <div className="stars" aria-label="5 out of 5 stars">★★★★★</div>
            <blockquote>“The communication was excellent. They kept me updated throughout the entire process and were always clear about the next steps.”</blockquote>
            <figcaption>Cale Pearson · Monaro</figcaption>
          </figure>
          <figure>
            <div className="stars" aria-label="5 out of 5 stars">★★★★★</div>
            <blockquote>“Matt cleaned it up, took fuel out and extracted more power—and it was still a safe tune.”</blockquote>
            <figcaption>Brad Young · CV8-Z</figcaption>
          </figure>
          <figure>
            <div className="stars" aria-label="5 out of 5 stars">★★★★★</div>
            <blockquote>“From dyno tuning to basic car services, they provide everything with quality and reliability in one go.”</blockquote>
            <figcaption>Sharad Oadd</figcaption>
          </figure>
        </div>
      </section>

      <section className="contact-section" id="contact">
        <div>
          <p className="eyebrow">PSI Performance Garage</p>
          <h2>Ready when<br />you are.</h2>
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

      <footer className="site-footer">
        <Image src="/psi-logo.png" alt="PSI Performance Garage" width={236} height={92} />
        <div className="social-links">
          <a href="https://www.facebook.com/psiperformancegarage/" target="_blank" rel="noreferrer">Facebook</a>
          <a href="https://www.instagram.com/psiperformancegarage/" target="_blank" rel="noreferrer">Instagram</a>
          <a href="https://www.youtube.com/channel/UCkJaKfpjPlHOuwOMH0xBIJQ" target="_blank" rel="noreferrer">YouTube</a>
        </div>
        <div className="footer-legal">
          <a href="https://psiperformance.com.au/policies/privacy-policy" target="_blank" rel="noreferrer">Privacy</a>
          <span>© {new Date().getFullYear()} PSI Performance</span>
        </div>
      </footer>
    </main>
  );
}
