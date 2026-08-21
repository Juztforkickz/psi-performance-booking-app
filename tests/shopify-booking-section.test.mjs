import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the future Shopify handoff neutral and self-contained", async () => {
  const [page, flow, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BookingFlow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /className="header-booking-cta" href="#booking-panel"/u);
  assert.match(flow, /const chooseBookingType = \(bookingType: BookingType\)/u);
  assert.match(flow, /\(\["service", "dyno"\] as const\)\.map/u);
  assert.match(flow, /className="type-card"/u);
  assert.match(flow, /Looking for parts instead\? View PSI parts/u);
  assert.doesNotMatch(flow, /replaceState\(null, "", "#top"\)/u);

  assert.match(
    styles,
    /\.booking-section\s*\{[^}]*--signal:\s*#f2f2f2;[^}]*background:\s*#000;/su,
  );
  assert.match(
    styles,
    /\.field input,[\s\S]*border:\s*1\.6px solid rgb\(224, 224, 224\);[\s\S]*border-radius:\s*8px;[\s\S]*background:\s*transparent;/u,
  );
  assert.match(
    styles,
    /\.booking-section \.button-primary\s*\{[^}]*min-height:\s*47px;[^}]*padding-right:\s*30px;[^}]*background:\s*#fff;[^}]*color:\s*#000;/su,
  );
});
