import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { validateTuningDetails } from "../app/api/v1/booking-checkouts/tuning-details.ts";

function validTuningDetails() {
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
    fuelPumpDetails: "Walbro 460",
    injectorType: "upgraded",
    injectorDetails: "Injector Dynamics ID1050x",
    fuelType: "flex_fuel",
    fuelTypeDetails: "",
    intakeType: "upgraded",
    intakeDetails: "OTR cold-air intake",
    previouslyTuned: "yes",
    previousTuner: "Previous workshop",
    exhaustType: "full_system",
    exhaustSize: "3_inch",
    varexControlled: "yes",
    exhaustDetails: "Three-inch stainless headers-back Varex system",
    camshaftType: "upgraded",
    camshaftDetails: "Cam code PSI-TEST; 224/228 duration",
  };
}

function readSqlConstant(source, name) {
  const pattern = `const ${name} = ` + "`([\\s\\S]*?)`;";
  const match = new RegExp(pattern, "u").exec(source);
  assert.ok(match, `Expected ${name} in db/index.ts`);
  return match[1];
}

function tableColumns(database, table) {
  return new Set(
    database.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name),
  );
}

test("accepts and normalises a complete dyno questionnaire", () => {
  const input = validTuningDetails();
  input.differentialGearRatio = "  3.46:1  ";

  const result = validateTuningDetails(input);
  assert.equal(result.errors, null);
  assert.equal(result.details?.differentialGearRatio, "3.46:1");
  assert.equal(result.details?.transmissionSetup, "converter_and_cooler");
});

test("enforces every conditional modification detail", () => {
  const input = validTuningDetails();
  input.engineModifications = "";
  input.transmissionDetails = "";
  input.fuelPumpDetails = "";
  input.injectorDetails = "";
  input.intakeDetails = "";
  input.previousTuner = "";
  input.exhaustDetails = "";
  input.camshaftDetails = "";

  const result = validateTuningDetails(input);
  assert.equal(result.details, null);
  assert.ok(result.errors?.["tuningDetails.engineModifications"]);
  assert.ok(result.errors?.["tuningDetails.transmissionDetails"]);
  assert.ok(result.errors?.["tuningDetails.fuelPumpDetails"]);
  assert.ok(result.errors?.["tuningDetails.injectorDetails"]);
  assert.ok(result.errors?.["tuningDetails.intakeDetails"]);
  assert.ok(result.errors?.["tuningDetails.previousTuner"]);
  assert.ok(result.errors?.["tuningDetails.exhaustDetails"]);
  assert.ok(result.errors?.["tuningDetails.camshaftDetails"]);
});

test("rejects transmission choices that cannot match the selected gearbox", () => {
  const manual = validTuningDetails();
  manual.transmissionType = "manual";
  manual.transmissionSetup = "converter";
  const manualResult = validateTuningDetails(manual);
  assert.match(
    manualResult.errors?.["tuningDetails.transmissionSetup"] ?? "",
    /automatic transmissions/u,
  );

  const automatic = validTuningDetails();
  automatic.transmissionSetup = "upgraded_clutch";
  const automaticResult = validateTuningDetails(automatic);
  assert.match(
    automaticResult.errors?.["tuningDetails.transmissionSetup"] ?? "",
    /manual transmission/u,
  );
});

test("rejects unsupported fields, control characters and excessive text", () => {
  const input = {
    ...validTuningDetails(),
    unsupported: "not part of the contract",
    exhaustDetails: `unsafe\u0000${"x".repeat(2_001)}`,
  };
  const result = validateTuningDetails(input);

  assert.ok(result.errors?.tuningDetails);
  assert.ok(result.errors?.["tuningDetails.exhaustDetails"]);
});

test("keeps the database migration additive and JSON-validating", async () => {
  const migration = await readFile(
    new URL("../drizzle/0003_tiresome_maelstrom.sql", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(migration, /\b(?:DROP|DELETE|TRUNCATE)\b/iu);
  assert.equal(
    (migration.match(/ADD COLUMN `tuning_details_json`/gu) ?? []).length,
    2,
  );
  assert.equal((migration.match(/json_valid\(/gu) ?? []).length, 2);
});

test("fresh runtime schema includes both JSON-checked tuning columns", async () => {
  const source = await readFile(new URL("../db/index.ts", import.meta.url), "utf8");
  const database = new DatabaseSync(":memory:");
  database.exec(readSqlConstant(source, "CREATE_BOOKINGS_TABLE_SQL"));
  database.exec(readSqlConstant(source, "CREATE_BOOKING_CHECKOUTS_TABLE_SQL"));

  assert.ok(tableColumns(database, "bookings").has("tuning_details_json"));
  assert.ok(tableColumns(database, "booking_checkouts").has("tuning_details_json"));
  for (const table of ["bookings", "booking_checkouts"]) {
    const row = database
      .prepare("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = ?")
      .get(table);
    assert.match(row.sql, /json_valid\(tuning_details_json\)/u);
  }
  database.close();
});

test("pre-0003 schema upgrades additively and remains idempotent", async () => {
  const source = await readFile(new URL("../db/index.ts", import.meta.url), "utf8");
  const database = new DatabaseSync(":memory:");
  for (const migrationName of [
    "0000_robust_black_crow.sql",
    "0001_remarkable_young_avengers.sql",
    "0002_polite_centennial.sql",
  ]) {
    const migration = await readFile(
      new URL(`../drizzle/${migrationName}`, import.meta.url),
      "utf8",
    );
    database.exec(migration.replaceAll("--> statement-breakpoint", ""));
  }

  const addIfMissing = (table, statement) => {
    if (!tableColumns(database, table).has("tuning_details_json")) {
      database.exec(statement);
    }
  };
  const bookingsUpgrade = readSqlConstant(
    source,
    "ADD_BOOKINGS_TUNING_DETAILS_JSON_SQL",
  );
  const checkoutsUpgrade = readSqlConstant(
    source,
    "ADD_BOOKING_CHECKOUTS_TUNING_DETAILS_JSON_SQL",
  );
  addIfMissing("bookings", bookingsUpgrade);
  addIfMissing("booking_checkouts", checkoutsUpgrade);
  addIfMissing("bookings", bookingsUpgrade);
  addIfMissing("booking_checkouts", checkoutsUpgrade);

  assert.ok(tableColumns(database, "bookings").has("tuning_details_json"));
  assert.ok(tableColumns(database, "booking_checkouts").has("tuning_details_json"));
  database.close();
});

test("canonical booking-request hashing handles known and inspection-mode dyno details", async () => {
  const route = await readFile(
    new URL("../app/api/v1/booking-requests/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    route,
    /setupConfidence === "known"[\s\S]*validateTuningDetails\(body\.tuningDetails\)[\s\S]*validatePartialTuningDetails\(body\.tuningDetails\)/u,
  );
  assert.match(route, /setupConfidence,\s+tuningDetails,/u);
  assert.match(route, /sha256\(JSON\.stringify\(parsed\.value\)\)/u);
});
