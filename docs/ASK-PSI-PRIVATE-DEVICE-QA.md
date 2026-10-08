# Ask PSI private phone testing

Prepared 7 October 2026. This prepares the next inspection step. It does not authorise public launch or real notification delivery.

## Prepared and verified

The workshop alert count now includes message inbox links. Incoming customer messages open the workshop conversation. Replies open the customer's conversation. The message alert preference updates its own setting and leaves the sound preference independent.

The existing Expo project has a private `ask-psi-device-test` build profile. Its iOS override uses store signing and an incremented build number for TestFlight. Android retains internal APK distribution. It inherits the existing `apple-review` sandbox profile, retains the app identifiers and uses the existing review channel with its own runtime, `1.0.0-ask-psi-device-test-1`. It cannot be substituted into a public build profile. Existing production, App Store and Google profiles remain unchanged.

Only the existing fictional customer and staff accounts are nominated. The client requires the pinned sandbox, closed registration, private messaging flag, matching build marker and matching runtime before allowing device registration. Ordinary review builds continue to suppress external notification registration and delivery. Unrelated QA accounts cannot use the exception.

The dedicated `process-ask-psi-device-qa` worker and additive device and delivery tables are installed only in sandbox `jwikoldibbpxyhbdrsow`. Its platform JWT check remains enabled and the handler independently validates the user session and nomination. Conversation access uses the existing participant policies. No service key belongs in the client.

An authenticated sandbox call returned `503 private_device_test_disabled`. Direct customer access to the QA registry returned `403`. Both tables have RLS enabled, no customer or anonymous table grants, and service worker access only. The registry contains no test devices or delivery receipts. Security advisor notices about absent RLS policies are intentional for these service only tables; customer access remains denied. The relevant [advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) describes this notice. Existing unrelated sandbox advisories were preserved.

Local phone bundle exports passed for iOS and Android. TypeScript, lint, worker typechecking, messaging regression checks and review isolation checks passed. These exports are JavaScript bundles, not installable signed phone builds. They do not prove native keyboard, banner, background delivery or sound behaviour.

## Delivery boundaries

The QA worker defaults to disabled. It uses only `ask_psi_qa_devices`, never the normal `push_devices` registry. The ordinary sandbox queue therefore cannot use these QA tokens for legacy booking or other alerts.

Only nominated accounts, unread Ask PSI events within the selected conversation, messages created after the test session begins and messages created after device opt-in are eligible. Registration refresh preserves opt-in time. Message preferences are checked again before dispatch. Payloads contain a generic test notice and conversation identifiers, without private message text or photos.

One reservation is allowed per event and device. An accepted Expo ticket means submitted to the provider, not delivered to the phone. Unknown, held and rejected outcomes are retained for inspection and never automatically resent. A token rejected as unregistered is disabled only in the QA registry. There is no new cron job or unrestricted queue action.

Private Android testing uses separate audible and silent message channels. The actual phone's permission, notification channel settings, volume, silent mode and Focus settings still apply. No cash receipt sound or owner account preference is changed.

Booking, event, vehicle sale and owner test sends remain blocked in all review builds, including this QA build. Microsoft 365 email fallback remains disabled. No OTA, store submission, public messaging activation or website change is part of this preparation.

## Local preparation command

```powershell
./scripts/Export-PsiAskPsiDeviceQa.ps1 -Platform all
```

The script expands the existing profile, validates its sandbox and runtime, exports locally and restores the previous process environment. Exports are retained in ignored `artifacts/ask-psi-private-review/device-qa`. It does not upload an EAS build or publish an OTA.

## Next inspection step

1. Matt inspects the existing customer chat and workshop inbox in the local browser preview.
2. Prepare the iOS TestFlight build using the existing Expo project and `ask-psi-device-test` profile. Set `EAS_BUILD_PROFILE=ask-psi-device-test` and `EXPO_NO_DOTENV=1` when resolving the configuration locally. TestFlight uses the existing App Store Connect app and store signing, without ad hoc device registration. Uploading to TestFlight is not submission for public App Store review. Restrict this build to Matt's existing internal group and do not add it to the external group. Android retains an installable private APK.
3. Use disposable test phones and the protected fictional credentials. This profile retains the existing app identifier, so an installation can replace the public PSI installation on that phone. Prefer devices without an existing production push registration. A phone already registered for public PSI can still receive production pushes until that registration is disabled through the public app. The QA registry does not alter production device registrations.
4. After Matt authorises the private device delivery test, configure only the sandbox worker secrets: `PSI_ASK_PSI_DEVICE_QA_ENABLED=true`, `PSI_ASK_PSI_DEVICE_QA_USERS` matching the two nominated fixture IDs in the profile, and `PSI_ASK_PSI_DEVICE_QA_SESSION_START` with a fresh UTC ISO timestamp. Missing or malformed configuration keeps the worker closed. Do not enable production workers or Microsoft email fallback.
5. In each installed QA build sign in to its designated fictional account and enable device alerts in Settings. Send a new harmless message and reply. Verify foreground, background and closed app banners, sounds, badges and correct conversation taps. Check opt-out, denied permissions and silent preference. Inspect provider receipts separately when diagnosing delivery.
6. Complete native long message, keyboard scrolling, photo permission, read time, reconnect and duplicate retry checks from the main inspection guide. A successful browser or bundle check does not replace these checks.
7. Disable `PSI_ASK_PSI_DEVICE_QA_ENABLED` after the inspection session. Preserve the additive sandbox schema and receipts. Do not delete customer or production data to stop a test.

Public release still requires Matt's inspection and approval, completion of the native checks and accurate store privacy declarations. This is direct customer to workshop messaging. Boost does not use an AI response provider.

## Checkpoint and rollback

### Private TestFlight preparation, 8 October 2026

Matt authorised the private iPhone beta. Configuration checkpoint `89baf943aa9b3d0924fa8a926b66165eadff611c` passed 35 targeted messaging and device isolation tests, TypeScript, lint and the resolved EAS iOS profile checks. The build archive excludes the existing local Android release download without deleting it.

App Store Connect showed the existing internal group `Team (Expo)` has one tester, Matt Ebert, using `info@psiperformance.com.au`. The external group has no testers and no public invitation link. No testers or group settings were changed.

Version 1.0.2 build 21 was started from this checkpoint, EAS build `e558ad58-77af-4431-a31f-6e8ed2dddd86`. Submission `05b07768-c975-42f9-a89f-1d8510ac38be` is queued for that exact build and existing internal group, using the existing Apple credentials and app ID 6806902732. The last verified build state was `IN_PROGRESS`. This record does not confirm Apple processing, install availability or phone checks. Verify those separately before telling Matt to install. No public App Store review or public OTA was requested. The sandbox notification worker remains disabled.

The checkpoint immediately before this task is `2a5cb86b744a5789742890b291e14a054fcfe058`. Save this preparation as an additive commit on the existing main branch. If it needs to be removed, disable the private worker and prepare a reviewed forward revert of this task's source changes. Preserve subsequent unrelated work and keep the sandbox tables and history. Do not reset main, drop tables, overwrite live data or publish a rollback automatically.
