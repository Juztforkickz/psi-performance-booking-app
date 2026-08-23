import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CUSTOMER_ACCOUNT_CAPABILITIES,
  customerAccountsDisabledResponse,
} from "../app/lib/customer-account-foundation.ts";

test("customer account capability remains explicitly fail-closed", async () => {
  assert.deepEqual(CUSTOMER_ACCOUNT_CAPABILITIES, {
    version: 1,
    enabled: false,
    registration: "disabled",
    plannedRegistration: "invite_only",
    authentication: "not_configured",
    signInMethod: "passwordless_email_link",
    identityProvider: null,
    passwordStorage: "none",
    profileStore: "cloudflare_d1",
  });

  const response = customerAccountsDisabledResponse();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    error: {
      code: "CUSTOMER_ACCOUNTS_DISABLED",
      message:
        "Customer accounts are not enabled. No sign-in, registration or profile change was accepted.",
    },
  });
});

test("account routes expose status only and cannot trust spoofed identity", async () => {
  const [statusRoute, profileRoute, bookingRoute] = await Promise.all([
    readFile(new URL("../app/api/v1/account/status/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/account/me/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/booking-requests/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(statusRoute, /CUSTOMER_ACCOUNT_CAPABILITIES/u);
  assert.match(statusRoute, /ACCOUNT_RESPONSE_HEADERS/u);
  assert.match(profileRoute, /customerAccountsDisabledResponse/u);
  assert.doesNotMatch(profileRoute, /request\.headers|request\.json|getBookingD1|customer_profiles/iu);
  assert.doesNotMatch(bookingRoute, /INSERT INTO customer_profiles|INSERT INTO customer_vehicles/u);
});

test("account previews do not collect passwords and mobile auth stays activation-gated", async () => {
  const [webPreview, mobileAccess, mobileSetup, packageJson] = await Promise.all([
    readFile(new URL("../app/account/AccountPreview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/app/account/index.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/app/account/sign-up.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  const accountUi = `${webPreview}\n${mobileAccess}\n${mobileSetup}`;
  assert.doesNotMatch(accountUi, /type=["']password["']|secureTextEntry/u);
  assert.doesNotMatch(packageJson, /@netlify\/identity|netlify-identity-widget|gotrue-js/u);
  assert.match(mobileAccess, /six-digit sign-in code/u);
  assert.match(mobileSetup, /Nothing was submitted or stored/u);

  const mobileAuth = await readFile(
    new URL("../mobile/src/lib/supabase.ts", import.meta.url),
    "utf8",
  );
  assert.match(mobileAuth, /EXPO_PUBLIC_SUPABASE_AUTH_ENABLED/u);
  assert.match(mobileAuth, /flowType: 'pkce'/u);
  assert.doesNotMatch(mobileAuth, /service_role|sb_secret_/u);
});
