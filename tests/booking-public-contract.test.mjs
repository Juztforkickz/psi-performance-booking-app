import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import * as nodeModule from "node:module";
import test from "node:test";

import {
  BOOKING_CATALOG,
  DEPOSIT_AMOUNT_CENTS,
  DEPOSIT_CURRENCY,
  DEPOSIT_POLICY_VERSION,
  serviceOptionForBookingType,
} from "../app/api/v1/booking-catalog/catalog.ts";
import {
  COMPONENT_STATES,
  DIFFERENTIAL_TYPES,
  ENGINE_STATES,
  EXHAUST_SIZES,
  EXHAUST_TYPES,
  FUEL_TYPES,
  INTAKE_TYPES,
  PREVIOUS_TUNE_STATES,
  TRANSMISSION_SETUPS,
  TRANSMISSION_TYPES,
  YES_NO_UNKNOWN,
  validateTuningDetails,
} from "../app/api/v1/booking-checkouts/tuning-details.ts";

const cloudflareWorkersShim = `data:text/javascript,${encodeURIComponent(`
  export const env = new Proxy({}, {
    get(_target, property) {
      return globalThis.__psiQaCloudflareBindings?.[property];
    },
    has(_target, property) {
      return property in (globalThis.__psiQaCloudflareBindings ?? {});
    }
  });
`)}`;

if (typeof nodeModule.registerHooks === "function") {
  nodeModule.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "cloudflare:workers") {
        return { url: cloudflareWorkersShim, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  });
} else {
  const asynchronousLoader = `data:text/javascript,${encodeURIComponent(`
    export async function resolve(specifier, context, nextResolve) {
      if (specifier === "cloudflare:workers") {
        return { url: ${JSON.stringify(cloudflareWorkersShim)}, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    }
  `)}`;
  nodeModule.register(asynchronousLoader, import.meta.url);
}

let workerPromise;

function loadWorker() {
  if (!workerPromise) {
    const workerUrl = new URL("../dist/server/index.js", import.meta.url);
    workerUrl.searchParams.set("qa-contract", `${process.pid}-${Date.now()}`);
    workerPromise = import(workerUrl.href).then((module) => module.default);
  }
  return workerPromise;
}

async function fetchWorker(path = "/", init = {}, bindings = {}) {
  const worker = await loadWorker();
  globalThis.__psiQaCloudflareBindings = bindings;
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      ...bindings,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

function melbourneDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonths(isoDate, months) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function nextOpenDate() {
  let candidate = addDays(melbourneDateParts(), 3);
  while (new Date(`${candidate}T00:00:00Z`).getUTCDay() === 0) {
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

function nextSunday() {
  let candidate = addDays(melbourneDateParts(), 1);
  while (new Date(`${candidate}T00:00:00Z`).getUTCDay() !== 0) {
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

function validServicePayload(overrides = {}) {
  return {
    bookingType: "service",
    firstName: "PSI",
    lastName: "QA Service",
    email: "psi.qa.service@example.com",
    mobile: "+61 400 000 000",
    vehicleMake: "Holden",
    vehicleModel: "Commodore",
    vehicleYear: 2020,
    registration: "TEST001",
    vin: "TESTV1N0000000000",
    preferredDate: nextOpenDate(),
    arrivalWindow: "morning",
    requestDetails: "Synthetic service and report request. Do not treat as a real booking.",
    source: "web",
    consent: true,
    depositTermsAccepted: true,
    depositPolicyVersion: DEPOSIT_POLICY_VERSION,
    company: "",
    ...overrides,
  };
}

function validTuningPayload(overrides = {}) {
  return {
    engineState: "modified",
    engineModifications: "Stage 2 camshaft, valve springs and upgraded balancer",
    transmissionType: "automatic",
    transmissionSetup: "converter_and_cooler",
    transmissionDetails: "3,200 rpm converter and external transmission cooler",
    differentialType: "truetrac",
    differentialGearRatio: "3.46:1",
    differentialDetails: "Harrop Truetrac",
    fuelPumpType: "upgraded",
    fuelPumpDetails: "Synthetic QA pump",
    injectorType: "upgraded",
    injectorDetails: "Synthetic QA 1000 cc injectors",
    fuelType: "flex_fuel",
    fuelTypeDetails: "Synthetic flex-fuel setup",
    intakeType: "upgraded",
    intakeDetails: "Synthetic QA OTR intake",
    previouslyTuned: "yes",
    previousTuner: "Synthetic Previous Tuner",
    exhaustType: "full_system",
    exhaustSize: "3_inch",
    varexControlled: "yes",
    exhaustDetails: "Synthetic three-inch headers-back Varex system",
    camshaftType: "upgraded",
    camshaftDetails: "Synthetic cam code QA-224-228",
    ...overrides,
  };
}

function validDynoPayload(overrides = {}) {
  return validServicePayload({
    bookingType: "dyno",
    lastName: "QA Dyno",
    email: "psi.qa.dyno@example.com",
    registration: "TEST002",
    requestDetails: "Synthetic hub dyno calibration request. Do not treat as a real booking.",
    tuningDetails: validTuningPayload(),
    ...overrides,
  });
}

function createD1Mock({ existingRecord = null, rateCount = 1 } = {}) {
  const operations = [];
  const bookingColumns = [
    "consent_policy_version",
    "checkout_id",
    "deposit_payment_id",
    "tuning_details_json",
  ];
  const checkoutColumns = ["tuning_details_json"];

  const database = {
    operations,
    prepare(sql) {
      const operation = { sql, bindings: [] };
      operations.push(operation);
      const statement = {
        sql,
        bind(...bindings) {
          operation.bindings = bindings;
          return statement;
        },
        async run() {
          return { success: true };
        },
        async all() {
          if (/PRAGMA table_info\(bookings\)/u.test(sql)) {
            return { results: bookingColumns.map((name) => ({ name })) };
          }
          if (/PRAGMA table_info\(booking_checkouts\)/u.test(sql)) {
            return { results: checkoutColumns.map((name) => ({ name })) };
          }
          return { results: [] };
        },
        async first() {
          if (/FROM booking_checkout_idempotency_keys/u.test(sql)) {
            return existingRecord;
          }
          if (/RETURNING request_count AS requestCount/u.test(sql)) {
            return { requestCount: rateCount };
          }
          return null;
        },
      };
      return statement;
    },
    async batch(statements) {
      return statements.map(() => ({ success: true }));
    },
  };

  return database;
}

function checkoutRequest(payload, options = {}) {
  const headers = new Headers({
    "content-type": "application/json",
    "idempotency-key": options.idempotencyKey ?? "psi-qa-checkout-0001",
    ...(options.headers ?? {}),
  });
  return {
    method: "POST",
    headers,
    body: options.rawBody ?? JSON.stringify(payload),
  };
}

async function checkout(payload, database = createD1Mock(), options = {}) {
  return fetchWorker(
    "/api/v1/booking-checkouts",
    checkoutRequest(payload, options),
    { DB: database },
  );
}

async function readError(response) {
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(typeof body.error?.code, "string");
  assert.equal(typeof body.error?.message, "string");
  return body.error;
}

function canonicalCheckout(payload) {
  return {
    bookingType: payload.bookingType,
    serviceOption: serviceOptionForBookingType(payload.bookingType),
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    email: payload.email.trim().toLowerCase(),
    mobile: payload.mobile.trim(),
    vehicleMake: payload.vehicleMake.trim(),
    vehicleModel: payload.vehicleModel.trim(),
    vehicleYear: Number(payload.vehicleYear),
    registration: payload.registration.trim().toUpperCase(),
    vin: payload.vin.trim().toUpperCase(),
    preferredDate: payload.preferredDate.trim(),
    arrivalWindow: payload.arrivalWindow.trim(),
    requestDetails: payload.requestDetails.trim(),
    tuningDetails: payload.bookingType === "dyno" ? payload.tuningDetails : null,
    source: payload.source.trim(),
    consent: true,
    depositTermsAccepted: true,
    depositPolicyVersion: DEPOSIT_POLICY_VERSION,
    depositAmountCents: DEPOSIT_AMOUNT_CENTS,
    currency: DEPOSIT_CURRENCY,
  };
}

function requestHash(payload) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalCheckout(payload)))
    .digest("hex");
}

test("serves every public app/API route and the install metadata", async () => {
  const expectations = new Map([
    ["/", /Book your car \| PSI Performance/iu],
    ["/parts", /The right parts\./u],
    ["/account", /One profile\./u],
    ["/admin", /Workshop booking queue|workshop access key/iu],
    ["/manifest.webmanifest", /PSI Performance Booking/u],
    ["/robots.txt", /Disallow:\s*\//iu],
  ]);

  for (const [path, expectedContent] of expectations) {
    const response = await fetchWorker(path, { headers: { accept: "text/html" } });
    assert.equal(response.status, 200, `${path} must resolve`);
    assert.match(await response.text(), expectedContent, `${path} must render its own content`);
  }

  const catalogResponse = await fetchWorker("/api/v1/booking-catalog");
  assert.equal(catalogResponse.status, 200);
  assert.equal(catalogResponse.headers.get("cache-control"), "no-store");
});

test("keeps every internal link target, public asset and external contact link valid", async () => {
  const [rootResponse, accountResponse, pageSource, accountSource, manifest] =
    await Promise.all([
      fetchWorker("/", { headers: { accept: "text/html" } }),
      fetchWorker("/account", { headers: { accept: "text/html" } }),
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/account/AccountPreview.tsx", import.meta.url), "utf8"),
      import("../app/manifest.ts").then((module) => module.default()),
    ]);
  const rootHtml = await rootResponse.text();
  const accountHtml = await accountResponse.text();
  const combinedHtml = `${rootHtml}\n${accountHtml}`;
  const hrefs = [...combinedHtml.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>/giu)].map(
    (match) => match[1].replaceAll("&amp;", "&"),
  );

  assert.ok(hrefs.length > 10, "expected the rendered navigation and contact links");
  assert.doesNotMatch(combinedHtml, /href="\s*javascript:/iu);

  const internalPaths = new Set();
  for (const href of hrefs) {
    if (href.startsWith("#")) {
      assert.match(rootHtml, new RegExp(`id=["']${href.slice(1)}["']`, "u"));
      continue;
    }
    if (href.startsWith("/")) {
      const url = new URL(href, "http://localhost");
      internalPaths.add(url.pathname);
      if (url.hash === "#booking-panel") {
        assert.match(rootHtml, /id="booking-panel"/u);
      }
      if (["#sign-in", "#create-account", "#profile"].includes(url.hash)) {
        assert.match(accountSource, new RegExp(`next === "${url.hash.slice(1)}"`, "u"));
      }
      continue;
    }
    assert.match(href, /^(?:https:|mailto:|tel:)/u, `unsupported public link scheme: ${href}`);
  }

  for (const path of internalPaths) {
    const response = await fetchWorker(path, { headers: { accept: "text/html" } });
    assert.equal(response.status, 200, `internal link ${path} must resolve`);
  }

  for (const expectedHref of [
    "tel:+61433431781",
    "mailto:info@psiperformance.com.au",
    "https://www.instagram.com/psiperformancegarage/",
    "https://www.facebook.com/psiperformancegarage/",
    "https://maps.google.com/?q=21+Exchange+Drive+Pakenham+VIC+3810",
    "https://psiperformance.com.au/policies/privacy-policy",
  ]) {
    assert.ok(hrefs.some((href) => href.startsWith(expectedHref)), `${expectedHref} must be linked`);
  }

  for (const tag of combinedHtml.matchAll(/<a\b([^>]*)>/giu)) {
    if (/target="_blank"/iu.test(tag[1])) {
      assert.match(tag[1], /rel="[^"]*noreferrer[^"]*"/iu);
    }
  }

  const sourceAssets = [...pageSource.matchAll(/(?:src|href)="(\/[A-Za-z0-9._/-]+)"/gu)].map(
    (match) => match[1],
  );
  const manifestAssets = manifest.icons?.map((icon) => icon.src) ?? [];
  for (const asset of new Set([...sourceAssets, ...manifestAssets, "/sw.js", "/og.png"])) {
    if (!asset.includes(".")) continue;
    await access(new URL(`../public${asset}`, import.meta.url));
  }
});

test("publishes exactly the three booking catalog choices and server-owned prices", () => {
  assert.equal(BOOKING_CATALOG.heading, "What are you booking in for?");
  assert.deepEqual(
    BOOKING_CATALOG.choices.map((choice) => choice.id),
    ["service", "dyno", "parts"],
  );
  assert.deepEqual(
    BOOKING_CATALOG.choices.map((choice) => choice.kind),
    ["booking", "booking", "navigation"],
  );
  assert.equal(BOOKING_CATALOG.choices[0].priceGuide.amountCents, 38_500);
  assert.equal(BOOKING_CATALOG.choices[1].priceGuide.amountCents, 35_000);
  assert.equal(BOOKING_CATALOG.choices[0].priceGuide.gstExclusive, true);
  assert.equal(BOOKING_CATALOG.choices[1].priceGuide.gstExclusive, true);
  assert.equal(BOOKING_CATALOG.choices[2].href, "/parts");
  assert.equal(serviceOptionForBookingType("service"), "service_report");
  assert.equal(serviceOptionForBookingType("dyno"), "dyno_tuning");
  assert.deepEqual(BOOKING_CATALOG.deposit, {
    amountCents: 20_000,
    minimumAmountCents: 20_000,
    currency: "AUD",
    fixedForCurrentRelease: true,
  });
});

test("returns stable protocol errors before accepting checkout data", async () => {
  const missingKey = await fetchWorker("/api/v1/booking-checkouts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validServicePayload()),
  });
  assert.equal(missingKey.status, 400);
  assert.equal((await readError(missingKey)).code, "INVALID_IDEMPOTENCY_KEY");

  for (const invalidKey of ["short", "invalid key with spaces", `x${"a".repeat(128)}`]) {
    const response = await checkout(validServicePayload(), createD1Mock(), {
      idempotencyKey: invalidKey,
    });
    assert.equal(response.status, 400);
    assert.equal((await readError(response)).code, "INVALID_IDEMPOTENCY_KEY");
  }

  const mediaType = await fetchWorker("/api/v1/booking-checkouts", {
    method: "POST",
    headers: { "idempotency-key": "psi-qa-checkout-0002" },
    body: "not json",
  });
  assert.equal(mediaType.status, 415);
  assert.equal((await readError(mediaType)).code, "UNSUPPORTED_MEDIA_TYPE");

  const invalidJson = await checkout({}, createD1Mock(), { rawBody: "{" });
  assert.equal(invalidJson.status, 400);
  assert.equal((await readError(invalidJson)).code, "INVALID_JSON");

  const invalidShape = await checkout([], createD1Mock());
  assert.equal(invalidShape.status, 400);
  assert.equal((await readError(invalidShape)).code, "INVALID_REQUEST");

  const honeypot = await checkout(validServicePayload({ company: "spam business" }));
  assert.equal(honeypot.status, 400);
  assert.equal((await readError(honeypot)).code, "INVALID_REQUEST");

  const oversized = await checkout(validServicePayload(), createD1Mock(), {
    headers: { "content-length": "24001" },
  });
  assert.equal(oversized.status, 413);
  assert.equal((await readError(oversized)).code, "REQUEST_TOO_LARGE");
});

test("validates every required customer and vehicle field", async () => {
  const response = await checkout({ company: "" });
  assert.equal(response.status, 422);
  const error = await readError(response);
  assert.equal(error.code, "VALIDATION_FAILED");
  for (const field of [
    "bookingType",
    "firstName",
    "lastName",
    "email",
    "mobile",
    "vehicleMake",
    "vehicleModel",
    "vehicleYear",
    "registration",
    "preferredDate",
    "arrivalWindow",
    "requestDetails",
    "source",
    "consent",
    "depositTermsAccepted",
    "depositPolicyVersion",
  ]) {
    assert.equal(typeof error.fields?.[field], "string", `${field} must be rejected when absent`);
  }
});

test("rejects malformed contact, vehicle, date, consent and deposit values", async () => {
  const today = melbourneDateParts();
  const cases = [
    ["email", { email: "not-an-email" }],
    ["email", { email: "a@b.c" }],
    ["email", { email: ".qa@example.com" }],
    ["email", { email: "qa..test@example.com" }],
    ["email", { email: "qa@example..com" }],
    ["email", { email: "qa@-example.com" }],
    ["email", { email: "qa@example.123" }],
    ["email", { email: `${"q".repeat(65)}@example.com` }],
    ["mobile", { mobile: "1234567" }],
    ["mobile", { mobile: "+61 call-me" }],
    ["mobile", { mobile: "61+400000000" }],
    ["mobile", { mobile: "1234567890123456" }],
    ["vehicleYear", { vehicleYear: 1899 }],
    ["vehicleYear", { vehicleYear: "twenty twenty" }],
    ["registration", { registration: "TEST<script>" }],
    ["vin", { vin: "VIN/NOT/VALID" }],
    ["vin", { vin: "A" }],
    ["vin", { vin: "TESTVIN0000000001" }],
    ["preferredDate", { preferredDate: "2026-02-30" }],
    ["preferredDate", { preferredDate: addDays(today, -1) }],
    ["preferredDate", { preferredDate: nextSunday() }],
    ["preferredDate", { preferredDate: addMonths(today, 19) }],
    ["arrivalWindow", { arrivalWindow: "overnight" }],
    ["source", { source: "unknown-client" }],
    ["consent", { consent: false }],
    ["depositTermsAccepted", { depositTermsAccepted: false }],
    ["depositPolicyVersion", { depositPolicyVersion: "old-policy" }],
    ["depositAmountCents", { depositAmountCents: 1 }],
    ["currency", { currency: "USD" }],
    ["requestDetails", { requestDetails: "unsafe\u0000detail" }],
  ];

  for (const [field, override] of cases) {
    const response = await checkout(validServicePayload(override));
    assert.equal(response.status, 422, `${field} should return a validation error`);
    const error = await readError(response);
    assert.equal(error.code, "VALIDATION_FAILED");
    assert.equal(typeof error.fields?.[field], "string", `${field} should identify itself`);
  }
});

test("enforces the server limits for every free-text checkout field", async () => {
  const limits = {
    bookingType: 16,
    firstName: 80,
    lastName: 80,
    email: 254,
    mobile: 32,
    vehicleMake: 60,
    vehicleModel: 80,
    registration: 20,
    vin: 32,
    preferredDate: 10,
    arrivalWindow: 16,
    requestDetails: 2_000,
    source: 16,
    depositPolicyVersion: 64,
  };

  for (const [field, limit] of Object.entries(limits)) {
    const response = await checkout(validServicePayload({ [field]: "x".repeat(limit + 1) }));
    assert.equal(response.status, 422, `${field} must enforce its ${limit}-character limit`);
    const error = await readError(response);
    assert.equal(typeof error.fields?.[field], "string");
  }
});

test("accepts every selectable dyno questionnaire value in a compatible setup", () => {
  const enumCases = [
    ["engineState", ENGINE_STATES],
    ["transmissionSetup", TRANSMISSION_SETUPS],
    ["differentialType", DIFFERENTIAL_TYPES],
    ["fuelPumpType", COMPONENT_STATES],
    ["injectorType", COMPONENT_STATES],
    ["fuelType", FUEL_TYPES],
    ["intakeType", INTAKE_TYPES],
    ["previouslyTuned", PREVIOUS_TUNE_STATES],
    ["exhaustType", EXHAUST_TYPES],
    ["exhaustSize", EXHAUST_SIZES],
    ["varexControlled", YES_NO_UNKNOWN],
    ["camshaftType", COMPONENT_STATES],
  ];

  for (const [field, values] of enumCases) {
    for (const value of values) {
      const adjustments = { [field]: value };
      if (field === "transmissionSetup") {
        adjustments.transmissionType = value === "upgraded_clutch" ? "manual" : "automatic";
      }
      if (field === "fuelType" && value === "other") {
        adjustments.fuelTypeDetails = "Synthetic QA race-fuel blend";
      }
      const result = validateTuningDetails(validTuningPayload(adjustments));
      assert.equal(result.errors, null, `${field}=${value} must be accepted`);
    }
  }

  for (const transmissionType of TRANSMISSION_TYPES) {
    const result = validateTuningDetails(
      validTuningPayload({
        transmissionType,
        transmissionSetup:
          transmissionType === "manual" ? "upgraded_clutch" : "converter_and_cooler",
      }),
    );
    assert.equal(result.errors, null, `transmissionType=${transmissionType} must be accepted`);
  }
});

test("rejects invalid choices for every dyno questionnaire selector", () => {
  for (const field of [
    "engineState",
    "transmissionType",
    "transmissionSetup",
    "differentialType",
    "fuelPumpType",
    "injectorType",
    "fuelType",
    "intakeType",
    "previouslyTuned",
    "exhaustType",
    "exhaustSize",
    "varexControlled",
    "camshaftType",
  ]) {
    const result = validateTuningDetails(validTuningPayload({ [field]: "invented-option" }));
    assert.equal(result.details, null);
    assert.equal(typeof result.errors?.[`tuningDetails.${field}`], "string");
  }
});

test("accepts complete service and dyno data but stops safely before an unconfigured payment", async () => {
  for (const payload of [validServicePayload(), validDynoPayload()]) {
    const database = createD1Mock();
    const response = await checkout(payload, database);
    assert.equal(response.status, 503);
    const error = await readError(response);
    assert.equal(error.code, "PAYMENT_PROVIDER_NOT_CONFIGURED");
    assert.match(error.message, /No booking or payment was created/u);
    assert.equal(response.headers.get("idempotency-replayed"), "false");
    assert.equal(response.headers.get("ratelimit-limit"), "5");

    const boundData = JSON.stringify(database.operations.flatMap((operation) => operation.bindings));
    assert.doesNotMatch(boundData, new RegExp(payload.email, "iu"));
    assert.doesNotMatch(boundData, new RegExp(payload.registration, "iu"));
    assert.ok(
      database.operations.every(
        (operation) => !/INSERT INTO (?:bookings|booking_checkouts|deposit_payments)/iu.test(operation.sql),
      ),
      "no customer, booking or payment row may be written before a provider exists",
    );
  }
});

test("keeps idempotent replay, conflict, expiry and rate-limit contracts stable", async () => {
  const payload = validServicePayload();
  const hash = requestHash(payload);
  const payableRecord = {
    requestHash: hash,
    checkoutId: "checkout_qa_0001",
    publicReference: "PSI-00000000000000000000000000000001",
    state: "awaiting_payment",
    paymentProvider: "test-provider",
    providerCheckoutUrl: "https://payments.example.com/checkout_qa_0001",
    expiresAt: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
  };

  const replay = await checkout(payload, createD1Mock({ existingRecord: payableRecord }));
  assert.equal(replay.status, 200);
  assert.equal(replay.headers.get("cache-control"), "no-store");
  assert.equal(replay.headers.get("idempotency-replayed"), "true");
  const replayBody = await replay.json();
  assert.equal(replayBody.state, "requires_payment");
  assert.deepEqual(replayBody.deposit, { amountCents: 20_000, currency: "AUD" });
  assert.equal(replayBody.payment.checkoutUrl, payableRecord.providerCheckoutUrl);

  const conflict = await checkout(
    payload,
    createD1Mock({ existingRecord: { ...payableRecord, requestHash: "0".repeat(64) } }),
  );
  assert.equal(conflict.status, 409);
  assert.equal((await readError(conflict)).code, "IDEMPOTENCY_KEY_REUSED");

  const expired = await checkout(
    payload,
    createD1Mock({
      existingRecord: { ...payableRecord, expiresAt: new Date(Date.now() - 1_000).toISOString() },
    }),
  );
  assert.equal(expired.status, 409);
  assert.equal((await readError(expired)).code, "CHECKOUT_EXPIRED");

  const alreadyPaid = await checkout(
    payload,
    createD1Mock({ existingRecord: { ...payableRecord, state: "paid" } }),
  );
  assert.equal(alreadyPaid.status, 409);
  assert.equal((await readError(alreadyPaid)).code, "CHECKOUT_ALREADY_PAID_OR_PROCESSING");

  const cancelled = await checkout(
    payload,
    createD1Mock({ existingRecord: { ...payableRecord, state: "cancelled" } }),
  );
  assert.equal(cancelled.status, 409);
  assert.equal((await readError(cancelled)).code, "CHECKOUT_CANCELLED");

  const notPayable = await checkout(
    payload,
    createD1Mock({ existingRecord: { ...payableRecord, paymentProvider: null } }),
  );
  assert.equal(notPayable.status, 409);
  assert.equal((await readError(notPayable)).code, "CHECKOUT_NOT_PAYABLE");

  const limited = await checkout(payload, createD1Mock({ rateCount: 6 }));
  assert.equal(limited.status, 429);
  assert.equal((await readError(limited)).code, "RATE_LIMITED");
  assert.equal(limited.headers.get("ratelimit-limit"), "5");
  assert.equal(limited.headers.get("ratelimit-remaining"), "0");
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
});

test("blocks the legacy unpaid booking endpoint regardless of request contents", async () => {
  const response = await fetchWorker("/api/v1/bookings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 410);
  const error = await readError(response);
  assert.equal(error.code, "PAYMENT_REQUIRED");
  assert.match(response.headers.get("link") ?? "", /\/api\/v1\/booking-checkouts/u);
});

test("keeps customer testimonials sourced and separates PSI's 10/10 promise from review scores", async () => {
  const [page, provenance, mobilePage] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../docs/CONTENT-SOURCES.md", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/app/index.tsx", import.meta.url), "utf8"),
  ]);
  const testimonialsSection = page.match(
    /<section className="testimonials-section"[\s\S]*?<\/section>/u,
  )?.[0];
  assert.ok(testimonialsSection, "the testimonials section must remain explicit");
  assert.match(testimonialsSection, /Verified five-star customer stories/u);
  assert.match(testimonialsSection, /blockquote cite="https:\/\/psiperformance\.com\.au\/"/u);
  assert.match(testimonialsSection, /aria-label="5 out of 5 stars"/u);
  assert.doesNotMatch(testimonialsSection, /10\s*(?:\/\s*10|out of 10)/iu);
  assert.match(page, /10\/10 care/u);
  assert.match(page, /not a customer review aggregate/iu);
  for (const [customer, quote] of [
    ["Cale Pearson", "The team truly cares about both the car and the customer."],
    ["Sharad Oadd", "they provide everything with quality and reliability in one go"],
    ["Cade", "These guys know their stuff and will look after you through the whole process."],
  ]) {
    assert.ok(
      page.includes(`quote: "${quote}",\n    customer: "${customer}",`),
      `${customer}'s approved web excerpt and attribution must remain paired`,
    );
    assert.ok(
      mobilePage.includes(`customer: '${customer}',\n    quote: '${quote}',`),
      `${customer}'s approved mobile excerpt and attribution must remain paired`,
    );
  }
  assert.match(mobilePage, /PSI service commitment—not a customer review rating/u);
  assert.match(provenance, /Customer feedback provenance/u);
  assert.match(provenance, /Cale Pearson, Sharad Oadd and Cade/u);
  assert.match(provenance, /No reliable[\s\S]*literally rating the business “10\/10”/u);
});

test("keeps client retry and mobile radio states safe", async () => {
  const [webBooking, mobileBooking, mobileHome, mobileUi] = await Promise.all([
    readFile(new URL("../app/components/BookingFlow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/app/booking.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/app/index.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/components/ui.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(
    webBooking,
    /code === "CHECKOUT_EXPIRED" \|\| code === "CHECKOUT_CANCELLED"[\s\S]{0,100}idempotencyKey\.current = null/u,
  );
  assert.match(webBooking, /CHECKOUT_ALREADY_PAID_OR_PROCESSING[\s\S]{0,300}Do not try another payment/u);
  assert.doesNotMatch(
    webBooking,
    /code === "CHECKOUT_NOT_PAYABLE"[\s\S]{0,120}idempotencyKey\.current = null/u,
  );

  assert.match(
    mobileBooking,
    /error\.code === 'CHECKOUT_EXPIRED' \|\| error\.code === 'CHECKOUT_CANCELLED'[\s\S]{0,100}setIdempotencyKey\(randomUUID\(\)\)/u,
  );
  assert.match(mobileBooking, /CHECKOUT_ALREADY_PAID_OR_PROCESSING[\s\S]{0,500}Do not try another payment/u);
  assert.doesNotMatch(
    mobileBooking,
    /error\.code === 'CHECKOUT_NOT_PAYABLE'[\s\S]{0,120}setIdempotencyKey\(randomUUID\(\)\)/u,
  );

  assert.match(mobileUi, /accessibilityRole="radio"[\s\S]{0,80}accessibilityState=\{\{ checked: selected \}\}/u);
  assert.match(mobileHome, /accessibilityRole="radio"[\s\S]{0,80}accessibilityState=\{\{ checked: active \}\}/u);
  assert.match(mobileBooking, /accessibilityRole="radio"[\s\S]{0,80}accessibilityState=\{\{ checked: active \}\}/u);
  assert.match(mobileUi, /aria-checked=\{selected\}/u);
  assert.match(mobileHome, /aria-checked=\{active\}/u);
  assert.match(mobileBooking, /aria-checked=\{active\}/u);
});
