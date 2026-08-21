import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const brands = [
  ["Audi", "audi.png"],
  ["Holden", "holden.png"],
  ["Ford", "ford.png"],
  ["Mercedes-Benz", "mercedes-benz.png"],
  ["Porsche", "porsche.png"],
  ["Lamborghini", "lamborghini.png"],
  ["Škoda", "skoda.png"],
  ["Volkswagen", "volkswagen.png"],
  ["BMW", "bmw.png"],
  ["Haltech", "haltech.png"],
  ["FuelTech", "fueltech.png"],
  ["HP Tuners", "hp-tuners.png"],
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

test("uses the same official PSI brand artwork in web and native", async () => {
  for (const [, filename] of brands) {
    const [web, mobile] = await Promise.all([
      readFile(new URL(`../public/brands/${filename}`, import.meta.url)),
      readFile(new URL(`../mobile/assets/images/brands/${filename}`, import.meta.url)),
    ]);
    assert.ok(web.length > 1_000, `${filename} must be a real image asset`);
    assert.deepEqual(mobile, web, `${filename} must stay identical across web and native`);
  }
});

test("renders a seamless accessible web marquee at the bottom of the customer page", async () => {
  const [component, page, styles, serviceWorker, trademarkNotice] = await Promise.all([
    readFile(new URL("../app/components/BrandMarquee.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../TRADEMARKS.md", import.meta.url), "utf8"),
  ]);

  for (const [name, filename] of brands) {
    assert.match(component, new RegExp(`name: "${escapeRegExp(name)}"`, "u"));
    assert.match(component, new RegExp(`/brands/${escapeRegExp(filename)}`, "u"));
    assert.match(serviceWorker, new RegExp(`/brands/${escapeRegExp(filename)}`, "u"));
  }

  assert.ok(
    page.indexOf("<BrandMarquee />") < page.indexOf('<footer className="site-footer">'),
    "brand rail must sit immediately above the final footer",
  );
  assert.match(component, /<BrandList\s*\/>[\s\S]*<BrandList duplicate\s*\/>/u);
  assert.match(component, /aria-hidden=\{duplicate \|\| undefined\}/u);
  assert.match(component, /\s+unoptimized\s+/u);
  assert.match(component, /className="brand-marquee-name"/u);
  assert.match(component, /fit: "wordmark"/u);
  assert.match(component, /No affiliation or endorsement is implied/u);
  assert.match(page, /className="header-booking-cta" href="#booking-panel"/u);
  assert.doesNotMatch(page, /website-booking/u);
  assert.match(styles, /animation:\s*brand-marquee-scroll\s+54s\s+linear\s+infinite/u);
  assert.match(styles, /\.brand-marquee-logo-wordmark\s*\{[^}]*--brand-logo-scale:\s*2\.12/u);
  assert.match(styles, /\.brand-marquee-logo img\s*\{[^}]*filter:\s*grayscale\(1\)\s+contrast\(1\.08\)/u);
  assert.doesNotMatch(styles, /brightness\(0\)\s+saturate\(100%\)/u);
  assert.match(styles, /\.brand-marquee:hover \.brand-marquee-track,[\s\S]*animation-play-state:\s*paused/u);
  assert.doesNotMatch(styles, /\.brand-marquee:focus-within/u);
  assert.match(styles, /\.brand-marquee-detail button\s*\{[^}]*min-height:\s*44px/u);
  assert.match(styles, /\.footer-legal\s*\{[^}]*flex-wrap:\s*wrap/u);
  assert.match(styles, /\.footer-legal a\s*\{[^}]*flex:\s*0 0 auto[^}]*white-space:\s*nowrap/u);
  assert.match(styles, /\.footer-legal span\s*\{[^}]*flex:\s*1 0 100%/u);
  assert.match(
    styles,
    /@media \(max-width: 1040px\)[\s\S]*\.site-footer\s*\{[^}]*grid-template-columns:\s*1fr[^}]*justify-items:\s*center[\s\S]*\.site-footer \.social-links,[\s\S]*\.site-footer \.footer-legal\s*\{[^}]*flex-wrap:\s*wrap/u,
  );
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.brand-marquee-viewport\s*\{[^}]*overflow-x:\s*auto[\s\S]*\.brand-marquee-track\s*\{[^}]*animation:\s*none !important/u,
  );
  assert.match(styles, /safe-area-inset-left/u);
  assert.match(serviceWorker, /STATIC_CACHE = "psi-static-v3"/u);
  assert.match(trademarkNotice, /used\s+nominatively only/u);
  assert.match(trademarkNotice, /endorses, sponsors,[\s\S]*affiliated/u);
});

test("keeps native motion optional and exposes every brand once to assistive technology", async () => {
  const [rail, home] = await Promise.all([
    readFile(new URL("../mobile/src/components/brand-rail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/app/index.tsx", import.meta.url), "utf8"),
  ]);

  for (const [name, filename] of brands) {
    assert.match(rail, new RegExp(`name: '${escapeRegExp(name)}'`, "u"));
    assert.match(rail, new RegExp(`brands/${escapeRegExp(filename)}`, "u"));
  }

  assert.ok(
    home.indexOf("<BrandRail />") < home.indexOf("<View style={styles.footer}>"),
    "native rail must sit above the final copyright footer",
  );
  assert.match(rail, /AccessibilityInfo\.isReduceMotionEnabled\(\)/u);
  assert.match(rail, /AccessibilityInfo\.isScreenReaderEnabled\(\)/u);
  assert.match(rail, /Animated\.loop\(/u);
  assert.match(rail, /showStaticRail[\s\S]*<ScrollView/u);
  assert.match(rail, /accessibilityLabel=\{isPaused \? 'Resume brand logo animation' : 'Pause brand logo animation'\}/u);
  assert.match(rail, /onPress=\{\(\) => setIsPaused\(\(paused\) => !paused\)\}/u);
  assert.match(rail, /motionButton:\s*\{[^}]*minHeight:\s*48/u);
  assert.match(rail, /importantForAccessibility=\{decorative \? 'no-hide-descendants' : 'auto'\}/u);
  assert.match(rail, /Trademarks belong to their owners; no endorsement or[\s\S]*affiliation is implied/u);
});
