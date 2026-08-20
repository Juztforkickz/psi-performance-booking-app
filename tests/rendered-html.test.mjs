import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
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
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Book a service or dyno tune \| PSI Performance<\/title>/i);
  assert.match(html, /Your car\./);
  assert.match(html, /Vehicle service/);
  assert.match(html, /Dyno tune/);
  assert.match(html, /Let’s get you sorted\./);
  assert.match(html, /0433 431 781/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps the booking UI and starter cleanup in source", async () => {
  const [page, flow, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BookingFlow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<BookingFlow \/>/);
  assert.match(flow, /fetch\("\/api\/v1\/bookings"/);
  assert.match(flow, /source: "web"/);
  assert.match(flow, /pending|not confirmed/i);
  assert.match(layout, /PSI Performance Booking/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("../app/_sites-preview/", import.meta.url)));
  await access(new URL("../public/psi-logo.png", import.meta.url));
  await access(new URL("../public/psi-hero.jpg", import.meta.url));
});
