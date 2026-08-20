import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function fetchWorker(path = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the PSI booking experience", async () => {
  const response = await fetchWorker("/", {
    headers: { accept: "text/html" },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Book your car \| PSI Performance/i);
  assert.match(html, /What are you booking in for\?/);
  assert.match(html, /Service &amp; Report/);
  assert.match(html, /Dyno tuning/);
  assert.match(html, /\$200 AUD deposit/);
  assert.match(html, /Let’s get you sorted\./);
  assert.match(html, /0433 431 781/);
  assert.match(html, /info@psiperformance\.com\.au/);
  assert.match(html, /21 Exchange Drive/);
  assert.match(html, /psiperformancegarage/);
  assert.match(html, /psi-contact-qr\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps the booking UI and starter cleanup in source", async () => {
  const [page, flow, openingPanel, legacyRoute, layout, packageJson, serviceWorker] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BookingFlow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/OpeningBookingPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/bookings/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<OpeningBookingPanel \/>/);
  assert.match(page, /<BookingFlow \/>/);
  assert.match(flow, /fetch\("\/api\/v1\/booking-checkouts"/);
  assert.match(flow, /"Idempotency-Key"/);
  assert.match(flow, /depositPolicyVersion: "psi-deposit-v1"/);
  assert.match(flow, /PAYMENT_PROVIDER_NOT_CONFIGURED/);
  assert.match(flow, /source: "web"/);
  assert.match(flow, /form\.bookingType === "dyno"[\s\S]*tuningDetails:/);
  assert.match(flow, /function TuningSetupFields/);
  assert.match(flow, /Engine modifications/);
  assert.match(flow, /Differential gear ratio|Gear ratio/);
  assert.match(flow, /Varex controlled/);
  assert.match(flow, /Camshaft code or specifications/);
  assert.match(flow, /pending|not confirmed/i);
  assert.doesNotMatch(flow, /fetch\("\/api\/v1\/bookings"/);
  assert.match(openingPanel, /Buy some parts/);
  assert.match(legacyRoute, /PAYMENT_REQUIRED/);
  assert.match(layout, /PSI Performance Booking/);
  assert.match(serviceWorker, /psi-contact-qr\.png/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("../app/_sites-preview/", import.meta.url)));
  await access(new URL("../public/psi-logo.png", import.meta.url));
  await access(new URL("../public/psi-hero.jpg", import.meta.url));
  await access(new URL("../public/psi-contact-qr.png", import.meta.url));
  await access(new URL("../mobile/assets/images/psi-contact-qr.png", import.meta.url));
});

test("sizes the mobile calendar from the usable layout container", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(styles, /--calendar-mobile-width:\s*min\(\s*440px,\s*calc\(100% \+ 74px\)/);
  assert.match(styles, /@media \(max-width: 360px\)[\s\S]*--calendar-mobile-width:\s*calc\(100% \+ 34px\)/);
  assert.match(styles, /margin-inline:\s*calc\(\(100% - var\(--calendar-mobile-width\)\) \/ 2\)/);
  assert.doesNotMatch(styles, /--calendar-mobile-width:[^;]*(?:100vw|100dvw)/);

  const narrowCalendarWidth = (clientWidth) => clientWidth - 38 + 34;
  assert.equal(narrowCalendarWidth(320), 316);
  assert.equal(narrowCalendarWidth(305), 301);
  assert.ok(narrowCalendarWidth(305) <= 305);
});

test("sizes the Why PSI headline from its real content column", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(styles, /\.why-copy\s*{[^}]*container-type:\s*inline-size;/s);
  assert.match(styles, /\.why-copy h2\s*{[^}]*max-width:\s*100%;[^}]*overflow-wrap:\s*anywhere;[^}]*min\(5\.5vw, 12cqi\)/s);
  assert.match(styles, /@media \(min-width: 1041px\) and \(max-width: 1700px\)[\s\S]*grid-template-columns:\s*minmax\(360px, 0\.9fr\) minmax\(0, 1\.1fr\)/);

  for (const viewportWidth of [1041, 1100, 1280, 1366, 1440]) {
    const copyTrack = viewportWidth * 0.55;
    const inlinePadding = Math.max(30, Math.min(viewportWidth * 0.04, 110));
    const contentColumn = copyTrack - inlinePadding * 2;
    const fontSize = Math.max(36.8, Math.min(viewportWidth * 0.055, contentColumn * 0.12, 94.4));
    const reproducedTextWidth = 581 * (fontSize / 79.2);
    assert.ok(reproducedTextWidth < contentColumn, `${viewportWidth}px Why PSI headline must fit its column`);
  }
});

test("lets the parts headline reflow on narrow layout viewports", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(styles, /@media \(max-width: 500px\)[\s\S]*\.parts-hero h1\s*{[^}]*overflow-wrap:\s*anywhere;[^}]*font-size:\s*clamp\(2\.2rem, 11\.5vw, 4\.6rem\)/s);

  const reproducedWidth = 304;
  const originalFontSize = 43.2;
  const compactFontSize = 320 * 0.115;
  assert.ok(reproducedWidth * (compactFontSize / originalFontSize) < 265);
});

test("keeps installed web surfaces inside landscape safe areas", async () => {
  const [styles, adminStyles] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/admin.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(styles, /\.trust-strip\s*{[^}]*padding-right:\s*env\(safe-area-inset-right, 0px\);[^}]*padding-left:\s*env\(safe-area-inset-left, 0px\);/s);
  assert.match(adminStyles, /\.loginHeader,[\s\S]*?\.queueHeader\s*{[^}]*safe-area-inset-right[^}]*safe-area-inset-left/s);
  assert.match(adminStyles, /\.queueIntro\s*{[^}]*safe-area-inset-right[^}]*safe-area-inset-left/s);
  assert.match(adminStyles, /\.queueContent\s*{[^}]*safe-area-inset-right[^}]*safe-area-inset-left/s);
  assert.match(adminStyles, /\.loginPanel\s*{[^}]*safe-area-inset-left[^}]*safe-area-inset-right/s);
});

test("keeps deposit values server-owned and blocks unpaid booking bypasses", async () => {
  const [catalog, checkoutRoute, legacyRoute, webFlow, mobileGateway] = await Promise.all([
    readFile(new URL("../app/api/v1/booking-catalog/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/booking-checkouts/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/bookings/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BookingFlow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/lib/booking.ts", import.meta.url), "utf8"),
  ]);

  assert.match(catalog, /DEPOSIT_AMOUNT_CENTS = 20_000/);
  assert.match(catalog, /amountCents: 38_500/);
  assert.match(catalog, /amountCents: 35_000/);
  assert.match(catalog, /gstExclusive: true/);
  assert.match(catalog, /id: "parts"[\s\S]*kind: "navigation"[\s\S]*href: "\/parts"/);
  assert.match(checkoutRoute, /Object\.hasOwn\(body, "depositAmountCents"\)/);
  assert.match(checkoutRoute, /PAYMENT_PROVIDER_NOT_CONFIGURED/);
  assert.match(checkoutRoute, /state: "requires_payment"/);
  assert.match(checkoutRoute, /"Idempotency-Replayed": "true"/);
  assert.match(legacyRoute, /errorResponse\(\s*410,/);
  assert.match(legacyRoute, /PAYMENT_REQUIRED/);
  assert.doesNotMatch(webFlow, /\bBSB\b|Account number/);
  assert.match(webFlow, /response\.status === 200 && replayed/);
  assert.match(mobileGateway, /EXPO_PUBLIC_API_BASE_URL/);
  assert.match(mobileGateway, /secureProductionOrigin/);
  assert.match(mobileGateway, /origin\.username/);
  assert.doesNotMatch(mobileGateway, /DEFAULT_API_BASE_URL/);

  const [mobileBooking, adminQueue] = await Promise.all([
    readFile(new URL("../mobile/src/app/booking.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminQueue.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(mobileBooking, /PSI will email a receipt|emailed receipt/i);
  assert.match(adminQueue, /if \(!tuningEnumFields\.has\(key\)\) return value/);
});
