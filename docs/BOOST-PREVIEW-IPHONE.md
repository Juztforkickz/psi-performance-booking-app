# PSI Boost Preview on iPhone

Prepared 8 October 2026 from checkpoint `ce30c15`. This is a separate private install of the existing PSI app source, with completed Boost work preserved. It does not create another Expo, Supabase or App Store project.

## Identity and distribution

* Display name: PSI Boost Preview
* iOS bundle identifier: `au.com.psiperformance.garage.boostpreview`
* URL scheme: `psiboostpreview`
* Existing Expo project: `e62e9cdf-867c-4eb7-b8c5-a2610f969286`
* EAS build profile, update channel and update branch: `boost-preview`
* Runtime: `1.0.0-boost-preview-1`
* iOS distribution: internal, Apple ad hoc provisioning for registered devices
* In app indicator: PSI BOOST PREVIEW · TEST DATA ONLY

The separate bundle identifier and URL scheme let this app coexist with public PSI, with separate application storage and credentials. The private runtime and channel isolate future updates. No submit profile is configured for this preview. Do not run EAS Submit, auto submit, App Store review or TestFlight for this build. Public version 1.0.3 requires Matt's later explicit approval.

## Sandbox boundaries

The profile inherits the existing Apple review sandbox `jwikoldibbpxyhbdrsow`. It pins the sandbox URL and public key, enables closed fictional account login and Boost, and rejects production configuration. Registration, selectable live mode, RevenueCat purchase keys and purchase testing are disabled. Existing review guards keep calendar changes, payments, emails and external notification registration closed. Sandbox bookings and test messages may be created only in the existing sandbox. No production schema, records, subscriptions, devices or protected owner entitlement are changed.

This first separate preview deliberately keeps the private push exception off. Its private config plugin removes the APNs entitlement after Expo's automatic entitlement actions, so Apple push capability is not requested. Message, reply, attachment and read time inspection can run in the sandbox. Phone notification delivery and sounds need a separately authorised sandbox delivery session and a new native preview build with the required capability. Microsoft 365 fallback remains disabled. Boost currently provides direct messages to the workshop, without an AI response provider.

Use the existing fictional review credentials retained privately in `artifacts/apple-review-private/PSI-APPLE-REVIEW-SANDBOX-credentials.clixml`. The customer and staff fixture accounts are distinct from Matt's public owner account. The public account retains permanent complimentary Performance+ access. Never copy production credentials or customer data into the preview.

## Device and signing

On 8 October, Apple and Expo showed one enabled iPhone registered on 29 August 2026. Its identifier ends in `2401C`. Matt confirmed this is his current iPhone and authorised using only that device; no new device registration is authorised. Do not register another UDID or broaden the ad hoc device list without Matt's specific approval.

Apple ad hoc distribution uses a distribution certificate and an ad hoc provisioning profile, rather than TestFlight or an App Store submission. Only devices in that profile can install. Reuse existing signing where possible without revoking or replacing the public certificate or profile. A separate profile must target the preview bundle identifier.

## Validation

The six preview isolation tests passed, along with 75 existing Boost messaging, worker, inbox, sandbox account and device guard checks. Native Expo introspection confirms that the preview requests no APNs entitlement, while the public resolved configurations remain unchanged. TypeScript and lint passed. Expo resolved the iOS profile as internal, using the private bundle and runtime. The local iOS JavaScript export passed. These checks do not establish native installation or phone behaviour.

A broader purchase test run found two pre-existing Android fixture failures: fixtures still use Apple product identifiers while the implementation expects Google base plan identifiers. Both the test and purchase implementation match `ce30c15` unchanged. This task does not repair or change those unrelated files.

Tests compare every pre-existing EAS build and submit profile against `ce30c15`. Resolved public Apple, public Android, Apple review and the prior device QA configurations remain identical. `mobile/app.json` remains unchanged. The public OTA workflow retains its owner approval gate; do not approve it for this preview change.

## Local and future update commands

```powershell
./scripts/Invoke-PsiBoostPreview.ps1 -Action Validate
./scripts/Invoke-PsiBoostPreview.ps1 -Action Export
```

When a later private Boost JavaScript change is approved, use:

```powershell
./scripts/Invoke-PsiBoostPreview.ps1 -Action Update -Message 'Private Boost inspection update'
```

The helper clears inherited public environment values, pins this profile and validates identity and runtime before publishing. It accepts no public channel or branch parameter and restores the original process environment. A native dependency or permission change requires another signed internal build; JavaScript updates alone cannot change the installed bundle identifier or provisioning profile.

## Completion and rollback

Configuration checkpoint `b1f0d88` is committed and pushed. The private channel ID is `01a11980-124a-714f-a594-f9ebc50e4edd`, mapped only to the `boost-preview` branch ID `01a11980-1105-7997-812d-ab643514e0fe`. No private OTA has been published yet. A clean detached checkout of that checkpoint under ignored `artifacts/boost-preview/source` passed the 80 relevant checks, excluding concurrent unfinished edits. Existing mobile dependencies are reused through a directory junction, without copying them or changing the main checkout.

The previous same-identifier TestFlight submission `05b07768-c975-42f9-a89f-1d8510ac38be` had already entered `ERRORED` before this task. It was not retried. No new build or submission uses that route.

Apple created the separate App ID and ad hoc profile `PSI Boost Preview Ad Hoc Matt 20261008`, profile ID `V8PDV7NH7T`, UUID `a59e8a49-e1f4-489b-9049-03c8096b3675`. The downloaded profile was checked for the exact preview bundle, only the confirmed iPhone, no push entitlement and the unchanged existing distribution certificate. It expires on 29 August 2027. EAS has associated that existing certificate with the preview identifier. No existing profile or certificate was revoked or replaced.

The signed preview build and installation link are still pending completion of EAS signing. Specific approval to export a protected local copy of the existing distribution private key is pending; alternatively Matt can complete Apple sign in personally within EAS. Do not export that key before approval. The prepared profile is retained under the protected, Git ignored `artifacts/boost-preview/signing` folder. Save the build ID, source checkpoint and installation URL here once verified. No native preview build has been submitted to Apple or TestFlight.

To stop testing, uninstall only PSI Boost Preview. Public PSI and its data remain installed. To undo source preparation, use a reviewed forward revert of this task's changes from its checkpoint, preserving subsequent work. Do not reset main, remove the owner, revoke public signing credentials, alter subscriptions or delete sandbox history.
