import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const foundation = await readFile(
  new URL("../supabase/migrations/20260823092418_psi_account_foundation.sql", import.meta.url),
  "utf8",
);
const ownership = await readFile(
  new URL("../supabase/migrations/20260823093054_enforce_record_editor_ownership.sql", import.meta.url),
  "utf8",
);
const mobileEnvironment = await readFile(
  new URL("../mobile/.env.example", import.meta.url),
  "utf8",
);
const mobileClient = await readFile(
  new URL("../mobile/src/lib/supabase.ts", import.meta.url),
  "utf8",
);
const authStorage = await readFile(
  new URL("../mobile/src/lib/supabase-auth-storage.ts", import.meta.url),
  "utf8",
);

test("Supabase customer data and file access remain RLS-protected", () => {
  for (const table of [
    "customer_profiles",
    "customer_vehicles",
    "booking_requests",
    "dyno_records",
    "repair_records",
    "recommended_work",
    "invoices",
    "vehicle_files",
  ]) {
    assert.match(foundation, new RegExp(`alter table public\\.${table} enable row level security`, "u"));
  }

  assert.match(foundation, /'vehicle-photos',[\s\S]*?false/iu);
  assert.match(foundation, /'vehicle-documents',[\s\S]*?false/iu);
  assert.match(foundation, /auth\.jwt\(\) ->> 'aal'\) = 'aal2'/u);
});

test("staff allowlist and editor ownership match the approved PSI model", () => {
  assert.match(foundation, /'matt@psiperformance\.com\.au', 'owner', 'pending'/u);
  assert.match(foundation, /'dale@psiperformance\.com\.au', 'staff', 'pending'/u);
  assert.match(foundation, /'jamie@psiperformance\.com\.au', 'staff', 'pending'/u);
  assert.match(ownership, /prevent_created_by_change/u);
  assert.match(ownership, /staff creators or owner can update dyno records/u);
  assert.match(ownership, /staff uploaders or owner can remove private files/u);
});

test("mobile Supabase connection is public-key-only and activation-gated", () => {
  assert.match(mobileEnvironment, /EXPO_PUBLIC_SUPABASE_AUTH_ENABLED=false/u);
  assert.doesNotMatch(`${mobileEnvironment}\n${mobileClient}`, /service_role|sb_secret_/u);
  assert.match(mobileClient, /EXPO_PUBLIC_SUPABASE_AUTH_ENABLED === 'true'/u);
  assert.match(mobileClient, /flowType: 'pkce'/u);
  assert.match(authStorage, /expo-secure-store/u);
  assert.doesNotMatch(authStorage, /AsyncStorage|window\.localStorage|localStorage\./u);
});
