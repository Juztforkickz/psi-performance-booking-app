# Apple purchase test recovery — 15 September 2026

## Verified cause and limits

The previous checkout rejected foreign product metadata before opening Apple's
purchase confirmation. RevenueCat documents that TestFlight can return foreign
currency metadata even for an Australian account and an AUD purchase sheet.
An app's product currency therefore does not prove the tester's account country.

The separate sandbox tester sign-in has an unresolved password/security prompt.
Screenshots confirm that the owner reached it through Settings > Developer >
Sandbox Apple Account. The prompt alone does not mean the owner used the wrong
sign-in location. No verified cause or password recovery is claimed.

Creating a sandbox tester does not create a Gmail mailbox. Do not instruct the
owner to create Gmail on an existing business Google account, or recreate Apple
testers repeatedly as an assumed fix. No tester was changed in this recovery.

## App correction

- Only the isolated iOS purchase-test configuration can tolerate foreign product
  metadata. It opens Apple's own purchase confirmation for the selected product.
- The subsequent audit found that requiring `getStorefront()` to confirm Australia
  could itself prevent the native sheet from opening. The installed SDK forwards
  Apple's reported country unchanged; a fresh call does not prove it is accurate.
  Country lookup is therefore no longer a prerequisite for test pricing or checkout.
  Missing currency still prevents checkout. Live/Android purchases still require AUD.
- The exact monthly/annual product identifiers and server entitlement verification
  are retained. Failed verification directs the user to Restore, never another
  purchase. Sandbox receipts still cannot grant production entitlement.
- When Apple's test currency disagrees, the cards explicitly show Australian
  reference prices: AUD 9.99 monthly and AUD 99.00 annually. No foreign price is
  relabelled as AUD. The action says to check the selected price with Apple.
- The tester must confirm AUD and the expected amount in Apple's own purchase
  sheet. The app cannot force that sheet's currency or establish success locally.
- Price retrieval is requested on return to the app and through Retry store prices.
  RevenueCat can serve cached offerings; this is not a forced StoreKit cache reset.
- TestFlight instructions explain that an ordinary Australian Media & Purchases
  account can be used; a separate sandbox account is optional for extra controls.

## Device acceptance still required

1. Cancel the incomplete sandbox sign-in. Sign into Media & Purchases using the
   owner's normal Apple Account and its own password; verify Country/Region is
   Australia. Do not change the device's iCloud account.
2. Reopen the updated TestFlight build 10. Keep the existing PSI review customer
   login inside the app, separate from the Apple purchase account.
3. Select a Performance+ plan and open Apple's confirmation. Verify AUD and the
   expected amount before approving. TestFlight IAPs do not charge real money.
4. Verify the transaction, server entitlement, premium files, sign-out/sign-in
   persistence and Restore against that same PSI customer. Do not mark these
   checks complete without device and server evidence.
5. If Apple still requests the failing sandbox credentials or does not show the
   expected AUD confirmation, cancel and capture that exact screen. The native
   Apple Account authentication cannot be completed remotely from this workspace.
   Do not recreate testers or change the primary Apple Account as an assumed fix.

## Account evidence

- The isolated project's confirmed PSI review customer is `psiappreview@gmail.com`.
  This is the in-app login, separate from the Apple sandbox tester and mailbox.
- A fresh password sign-in using its existing encrypted credential succeeded.
  Both owned demo vehicles returned a Free vault overview through the same RPC
  used by the app. Only the temporary audit session was signed out afterward.
- At the recovery check on 15 September, that customer had no verified
  `performance_subscriptions` record. An unlock or completed purchase is not claimed.
- The subscription sync and webhook functions are ACTIVE at version 3 and the
  isolated database allows sandbox entitlements. Current Edge Function secret
  values and the customer's RevenueCat receipt remain unverified by these reads.
- The available App Store Connect browser session was signed out. No Apple tester
  password was recovered or changed, and no iPhone sign-in was completed remotely.

## Release and rollback boundaries

- Existing build: 10; channel/branch: `apple-review`; iOS only.
- Runtime: `1.0.0-performance-purchase-test-1`.
- Pre-change source: `b44288ed60c7992ba77ae055ceadf705ff53eed9`.
- Previous OTA group: `e0555779-d465-4228-8625-c4f53da67435`.
- Country-check correction checkpoint: `c62517619b53e779dc3fb761e3ff4b767bcf6a6e`;
  corresponding OTA group: `5f86179b-5f6c-4f16-bb5f-5b2569136e40`.
- Changes cover the purchase helper, Performance+ screen, test-only terms wording,
  and 14 checkout behavior tests. There is no backend/schema/configuration change.
- Restore source with a forward revert if requested. The previous compatible OTA
  remains the release rollback target; no destructive reset is required.
- Validation: 34 focused purchase, entitlement and legal-screen tests; mobile
  TypeScript; targeted ESLint; isolated iOS export. Deployment evidence is saved
  with the local release output. Device acceptance remains pending.

## Primary sources

- [RevenueCat: Apple sandbox currency limitations](https://www.revenuecat.com/docs/test-and-launch/sandbox/apple-app-store#currency)
- [Apple: TestFlight purchases and account controls](https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox)
- [Apple: creating sandbox accounts](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/create-a-sandbox-apple-account)
