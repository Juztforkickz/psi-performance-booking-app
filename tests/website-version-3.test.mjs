import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Version 3 presents three proportioned customer enquiry paths without showing amounts", async () => {
  const [flow, styles] = await Promise.all([
    read("app/components/BookingFlow.tsx"),
    read("app/globals.css"),
  ]);

  assert.match(flow, /Select Service, Dyno Tuning or Plan Builder to begin\./u);
  assert.match(flow, /className="type-card plan-builder-choice" href="#plan-builder"/u);
  assert.doesNotMatch(flow, /<dt>Price guide<\/dt>/u);
  assert.match(styles, /\.booking-choice-required \.type-grid\s*\{\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.website-home-preview \.booking-choice-required \.type-grid,[\s\S]*grid-template-columns: 1fr;/u);
});

test("Version 3 carries every app Plan Builder area and planning dropdown into the website", async () => {
  const [webOptions, mobileOptions, builder] = await Promise.all([
    read("app/lib/plan-builder.ts"),
    read("mobile/src/lib/plan-build-preview.ts"),
    read("app/components/PlanBuilderEnquiry.tsx"),
  ]);

  for (const label of ["Engine", "Suspension", "Exhaust", "Intake", "Repairs", "Interior", "Programming", "Other"]) {
    assert.match(webOptions, new RegExp(`label: "${label}"`, "u"));
    assert.match(mobileOptions, new RegExp(`label: '${label}'`, "u"));
  }

  for (const exportName of ["INTENDED_USE_OPTIONS", "PRIORITY_OPTIONS", "PLANNING_STAGE_OPTIONS", "TIMING_OPTIONS", "BUDGET_OPTIONS"]) {
    assert.match(webOptions, new RegExp(`export const ${exportName}`, "u"));
    assert.match(mobileOptions, new RegExp(`export const ${exportName}`, "u"));
    assert.match(builder, new RegExp(exportName, "u"));
  }

  assert.match(builder, /mailto:info@psiperformance\.com\.au/u);
  assert.match(builder, /It is an enquiry, not a quote or booking\./u);
});

test("the Shopify Version 3 handoff is self-contained, enquiry-only and responsive", async () => {
  const liquid = await read("shopify/psi-website-version-3-section.liquid");

  assert.match(liquid, /id="booking-panel"/u);
  assert.match(liquid, /\{% form 'contact'/u);
  assert.match(liquid, /data-psi-kind="service"/u);
  assert.match(liquid, /data-psi-kind="dyno"/u);
  assert.match(liquid, /data-psi-kind="plan"/u);
  assert.match(liquid, /PSI App · Coming Soon/u);
  assert.match(liquid, /@media\(max-width:760px\)/u);
  assert.match(liquid, /Book an Appointment/u);
  assert.match(liquid, /label==='contact'/u);
  assert.match(liquid, /\.psi-v3 \[hidden\]\{display:none!important\}/u);
  assert.doesNotMatch(liquid, /Payright|deposit|\$\d/iu);

  for (const area of ["Engine", "Suspension", "Exhaust", "Intake", "Repairs", "Interior", "Programming", "Other"]) {
    assert.match(liquid, new RegExp(`Plan - ${area}`, "u"));
  }
});

test("the Shopify global theme layer carries the approved PSI palette across shared components", async () => {
  const [styles, globalScript] = await Promise.all([
    read("shopify/psi-global-brand-system.css"),
    read("shopify/psi-website-version-5-global.js"),
  ]);

  for (const colour of ["#65cff8", "#155d78", "#dbe3e7", "#8f999e", "#050505"]) {
    assert.match(styles, new RegExp(colour, "iu"));
  }

  for (const selector of [".header-wrapper", ".button", ".card", ".field__input", ".pagination__item--current", ".footer"]) {
    assert.match(styles, new RegExp(selector.replaceAll(".", "\\."), "u"));
  }

  assert.match(styles, /Website Version 5/u);
  assert.match(styles, /#psi-estimator #page-title\{color:#fff!important/u);
  assert.match(styles, /@media\(max-width:749px\)[\s\S]*#psi-estimator #page-title/u);
  assert.match(globalScript, /psi-website-version-5-theme/u);
  assert.match(globalScript, /window\.location\.pathname === "\/" \? "#booking-panel" : "\/#booking-panel"/u);
  assert.match(globalScript, /Book an Appointment/u);
  assert.match(globalScript, /bookingPanel[\s\S]*upgrade-item-link[\s\S]*replaceWith/u);
  assert.match(globalScript, /#psi-estimator #page-title\{color:#fff!important/u);
  assert.doesNotMatch(styles, /yellow|#ffd700|#ffcc00|#f5c400/iu);
  assert.doesNotMatch(globalScript, /yellow|#ffd700|#ffcc00|#f5c400/iu);
});
