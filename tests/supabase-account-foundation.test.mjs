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
const protectedServiceHistory = await readFile(
  new URL("../supabase/migrations/20260823101228_protect_service_history.sql", import.meta.url),
  "utf8",
);
const combinedServicePolicies = await readFile(
  new URL("../supabase/migrations/20260823101520_combine_service_history_policies.sql", import.meta.url),
  "utf8",
);
const dataApiGrants = await readFile(
  new URL("../supabase/migrations/20260823140259_tighten_data_api_grants.sql", import.meta.url),
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

test("Supabase Data API grants are explicit and least-privileged", () => {
  assert.match(dataApiGrants, /revoke all privileges on all tables in schema public from anon, authenticated/u);
  assert.match(dataApiGrants, /revoke all privileges on schema public from anon/u);
  assert.match(dataApiGrants, /grant usage on schema public to authenticated/u);
  assert.match(dataApiGrants, /grant select, insert on public\.service_completions to authenticated/u);
  assert.match(dataApiGrants, /grant select on public\.vehicle_service_summary to authenticated/u);
  assert.match(dataApiGrants, /alter default privileges for role postgres in schema public[\s\S]*revoke all privileges on tables from anon, authenticated/u);
  assert.doesNotMatch(dataApiGrants, /grant (?:all|delete|truncate|trigger|references)/iu);
});

test("completed PSI services are linked, immutable and source-separated", () => {
  assert.match(protectedServiceHistory, /create table public\.service_completions/u);
  assert.match(protectedServiceHistory, /booking_request_id uuid not null unique/u);
  assert.match(protectedServiceHistory, /Only active PSI staff can complete a service/u);
  assert.match(protectedServiceHistory, /A service booking must be confirmed before completion/u);
  assert.match(protectedServiceHistory, /Complete the linked PSI service record before closing this booking/u);
  assert.match(protectedServiceHistory, /Linked PSI service records are immutable/u);
  assert.match(protectedServiceHistory, /record_source in \('customer_entry', 'psi_record'\)/u);
  assert.match(protectedServiceHistory, /create view public\.vehicle_service_summary[\s\S]*security_invoker = true/u);
  assert.doesNotMatch(protectedServiceHistory, /grant[\s\S]{0,80}(update|delete)[\s\S]{0,80}service_completions/iu);
  assert.match(combinedServicePolicies, /customers or staff can add source-bound odometer readings/u);
});
