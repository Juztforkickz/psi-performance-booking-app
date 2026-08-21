"use client";

import Image from "next/image";
import { useState } from "react";

const brands = [
  { name: "Audi", src: "/brands/audi.png", fit: "lockup" },
  { name: "Holden", src: "/brands/holden.png", fit: "badge" },
  { name: "Ford", src: "/brands/ford.png", fit: "wordmark" },
  { name: "Mercedes-Benz", src: "/brands/mercedes-benz.png", fit: "lockup" },
  { name: "Porsche", src: "/brands/porsche.png", fit: "crest" },
  { name: "Lamborghini", src: "/brands/lamborghini.png", fit: "badge" },
  { name: "Škoda", src: "/brands/skoda.png", fit: "badge" },
  { name: "Volkswagen", src: "/brands/volkswagen.png", fit: "badge" },
  { name: "BMW", src: "/brands/bmw.png", fit: "badge" },
  { name: "Haltech", src: "/brands/haltech.png", fit: "wordmark" },
  { name: "FuelTech", src: "/brands/fueltech.png", fit: "wordmark" },
  { name: "HP Tuners", src: "/brands/hp-tuners.png", fit: "wordmark" },
] as const;

function BrandList({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <ul className="brand-marquee-list" aria-hidden={duplicate || undefined}>
      {brands.map((brand) => (
        <li key={brand.name}>
          <span className={`brand-marquee-logo brand-marquee-logo-${brand.fit}`}>
            <Image
              src={brand.src}
              alt=""
              fill
              unoptimized
              sizes="(max-width: 760px) 126px, 152px"
            />
          </span>
          <span className="brand-marquee-name">{brand.name}</span>
        </li>
      ))}
    </ul>
  );
}

export function BrandMarquee() {
  const [paused, setPaused] = useState(false);

  return (
    <section className={`brand-marquee${paused ? " brand-marquee-paused" : ""}`} aria-labelledby="brand-marquee-heading">
      <div className="brand-marquee-heading">
        <p className="eyebrow">Experience across the spectrum</p>
        <h2 id="brand-marquee-heading">Brands &amp; platforms we work with</h2>
        <div className="brand-marquee-detail">
          <p>
            Brand names and marks identify vehicles and tuning platforms PSI works with. No affiliation or endorsement is implied.
          </p>
          <button type="button" aria-pressed={paused} onClick={() => setPaused((current) => !current)}>
            {paused ? "Resume logos" : "Pause logos"}
          </button>
        </div>
      </div>

      <div className="brand-marquee-viewport">
        <div className="brand-marquee-track">
          <BrandList />
          <BrandList duplicate />
        </div>
      </div>
    </section>
  );
}
