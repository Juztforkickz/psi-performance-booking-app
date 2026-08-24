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
