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
  assert.match(html, /Public demo/i);
  assert.match(html, /Booking submissions are disabled/i);
  assert.match(html, /What are you booking in for\?/);
  assert.match(html, /Service &amp; Report/);
  assert.match(html, /Dyno Tuning/);
  assert.match(html, /\$100 AUD(?:<!-- -->)? for Service/);
  assert.match(html, /\$300 AUD(?:<!-- -->)? for Dyno Tuning/);
  assert.match(html, /\$423\.50 AUD including GST/);
  assert.match(html, /\$649 AUD including GST/);
  assert.match(html, /Service &amp; Report from \$423\.50 incl\. GST/);
  assert.match(html, /Dyno Tuning from \$649 incl\. GST/);
  assert.match(html, /Let’s get you sorted\./);
  assert.match(html, /0433 431 781/);
  assert.match(html, /info@psiperformance\.com\.au/);
  assert.match(html, /21 Exchange Drive/);
  assert.match(html, /psiperformancegarage/);
  assert.match(html, /psi-contact-qr\.png/);
  assert.match(html, /PSI Performance™ · All rights reserved/);
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
  assert.match(flow, /fetch\("\/api\/v1\/booking-requests"/);
  assert.match(flow, /PUBLIC_DEMO_CONFIG\.submissionsDisabled/);
  assert.match(flow, /Demo only · Submission disabled/);
  assert.match(flow, /"Idempotency-Key"/);
  assert.match(flow, /bookingPolicyVersion: BOOKING_POLICY_VERSION/);
  assert.match(flow, /payload\.state !== "pending_staff_review"/);
  assert.match(flow, /payload\.paymentRequiredNow !== false/);
  assert.match(flow, /source: "web"/);
  assert.match(flow, /form\.bookingType === "dyno"[\s\S]*tuningDetails:/);
  assert.match(flow, /function TuningSetupFields/);
  assert.match(flow, /Engine modifications/);
  assert.match(flow, /Differential gear ratio|Gear ratio/);
  assert.match(flow, /Varex controlled/);
  assert.match(flow, /Camshaft code or specifications/);
  assert.match(flow, /pending|not confirmed/i);
  assert.doesNotMatch(flow, /fetch\("\/api\/v1\/bookings"/);
  assert.match(openingPanel, /Buy Some Parts/);
  assert.match(openingPanel, /Choose Service, Dyno or Parts/);
  assert.doesNotMatch(openingPanel, /optionLabel:[^\n]*—/);
  assert.match(legacyRoute, /APPROVAL_REQUIRED/);
  assert.match(layout, /PSI Performance Booking/);
  assert.match(serviceWorker, /psi-contact-qr\.png/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("../app/_sites-preview/", import.meta.url)));
  await access(new URL("../public/psi-logo.png", import.meta.url));
  await access(new URL("../public/psi-hero.jpg", import.meta.url));
  await access(new URL("../public/psi-gtsr-porsche-clean.jpg", import.meta.url));
  await access(new URL("../public/psi-gtsr-porsche-mobile-clean.jpg", import.meta.url));
  await access(new URL("../public/psi-contact-qr.png", import.meta.url));
  await access(new URL("../mobile/assets/images/psi-contact-qr.png", import.meta.url));
  await access(new URL("../mobile/assets/images/psi-gtsr-porsche-clean.jpg", import.meta.url));
  await access(new URL("../mobile/assets/images/psi-gtsr-porsche-mobile-clean.jpg", import.meta.url));
  await access(new URL("../LICENSE", import.meta.url));
  await access(new URL("../TRADEMARKS.md", import.meta.url));
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

test("keeps the Why PSI two-car media and copy responsive", async () => {
  const [styles, page, mobilePage] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/app/index.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(styles, /\.why-section\s*{[^}]*grid-template-columns:\s*1fr;[^}]*min-height:\s*0;/s);
  assert.match(styles, /\.why-image\s*{[^}]*aspect-ratio:\s*1744 \/ 901;[^}]*overflow:\s*hidden;/s);
  assert.match(styles, /\.why-image img\s*{[^}]*object-fit:\s*cover;/s);
  assert.match(styles, /\.why-copy\s*{[^}]*container-type:\s*inline-size;/s);
  assert.match(styles, /\.why-copy\s*{[^}]*grid-template-columns:\s*minmax\(0, 0\.82fr\) minmax\(0, 1\.18fr\)/s);
  assert.match(styles, /\.why-copy h2\s*{[^}]*max-width:\s*100%;[^}]*overflow-wrap:\s*anywhere;[^}]*min\(5\.5vw, 12cqi\)/s);
  assert.match(styles, /\.testimonial-grid\s*{[^}]*grid-auto-flow:\s*column;[^}]*overflow-x:\s*auto;[^}]*scroll-snap-type:\s*x mandatory;/s);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.why-image\s*{[^}]*aspect-ratio:\s*1744 \/ 901;[\s\S]*\.testimonial-grid\s*{[^}]*grid-auto-columns:\s*min\(84vw, 360px\)/s);
  assert.match(page, /<picture className="why-image">[\s\S]*src="\/psi-gtsr-porsche-clean\.jpg"[\s\S]*loading="lazy"/s);
  assert.doesNotMatch(page, /psi-gtsr-porsche-mobile-clean\.jpg/u);
  assert.match(mobilePage, /<Image\s+accessible\s+accessibilityLabel="Black VF GTSR[\s\S]*accessibilityRole="image"/s);
  assert.match(mobilePage, /resizeMode="contain"[\s\S]*source=\{require\('\.\.\/\.\.\/assets\/images\/psi-gtsr-porsche-clean\.jpg'\)\}[\s\S]*height: standardPhotoHeight/s);
  assert.match(mobilePage, /<ScrollView[\s\S]*horizontal[\s\S]*snapToInterval=\{storyCardWidth \+ spacing\.sm\}/s);
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

test("keeps deposit values server-owned and blocks pay-first bypasses", async () => {
  const [catalog, requestRoute, checkoutRoute, legacyRoute, webFlow, mobileGateway] = await Promise.all([
    readFile(new URL("../app/api/v1/booking-catalog/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/booking-requests/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/booking-checkouts/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/bookings/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BookingFlow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/lib/booking.ts", import.meta.url), "utf8"),
  ]);

  assert.match(catalog, /service:\s*10_000/);
  assert.match(catalog, /dyno:\s*30_000/);
  assert.match(catalog, /DEPOSIT_POLICY_VERSION = "psi-deposit-v3"/);
  assert.match(catalog, /amountCents: 42_350/);
  assert.match(catalog, /amountCents: 64_900/);
  assert.match(catalog, /variesByBookingType: true/);
  assert.match(catalog, /gstInclusive: true/);
  assert.match(catalog, /requiredAtRequest: false/);
  assert.match(catalog, /id: "parts"[\s\S]*kind: "navigation"[\s\S]*href: "\/parts"/);
  assert.match(requestRoute, /Object\.hasOwn\(body, "depositAmountCents"\)/);
  assert.match(requestRoute, /depositAmountForBookingType\(value\.bookingType\)/);
  assert.match(requestRoute, /paymentRequiredNow:\s*false/);
  assert.match(checkoutRoute, /status:\s*410/);
  assert.match(checkoutRoute, /APPROVAL_REQUIRED/);
  assert.match(legacyRoute, /errorResponse\(\s*410,/);
  assert.match(legacyRoute, /APPROVAL_REQUIRED/);
  assert.doesNotMatch(webFlow, /\bBSB\b|Account number/);
  assert.match(webFlow, /response\.status === 200 && replayed/);
  assert.match(webFlow, /errorsForStep\(1\)[\s\S]*errorsForStep\(2\)[\s\S]*errorsForStep\(3\)[\s\S]*errorsForStep\(4\)/);
  assert.match(webFlow, /consent:\s*form\.consent/);
  assert.match(webFlow, /bookingTermsAccepted:\s*form\.bookingTermsAccepted/);
  assert.match(webFlow, /serviceReminderConsent:\s*false/);
  assert.doesNotMatch(webFlow, /role="grid(?:cell)?"/);
  assert.match(webFlow, /className="calendar-grid" role="group"/);
  assert.match(mobileGateway, /EXPO_PUBLIC_API_BASE_URL/);
  assert.match(mobileGateway, /secureProductionOrigin/);
  assert.match(mobileGateway, /origin\.username/);
  assert.match(mobileGateway, /BOOKING_POLICY_VERSION = 'psi-booking-v1'/);
  assert.match(mobileGateway, /depositAmountForBookingType/);
  assert.match(mobileGateway, /booking-requests/);
  assert.doesNotMatch(mobileGateway, /DEFAULT_API_BASE_URL/);

  const [mobileBooking, adminQueue] = await Promise.all([
    readFile(new URL("../mobile/src/app/booking.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminQueue.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(mobileBooking, /PSI will email a receipt|emailed receipt/i);
  assert.match(adminQueue, /PREVIEW_BOOKINGS/);
  assert.match(adminQueue, /Nothing here persists, sends email, creates a payment link or writes to Google Calendar/);
  assert.doesNotMatch(adminQueue, /fetch\(/);
});
