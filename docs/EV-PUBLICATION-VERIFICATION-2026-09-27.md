# EV publication verification

Verified on 27 September 2026, Australia/Sydney.

## Public iPhone app

Apple's Australian lookup for app `6806902732` reports version `1.0.1` and five screenshots.

Expo build `11488722-3535-4145-99a2-d202b49c79d6` is finished, version `1.0.1`, build `18`, profile and channel `app-store-release`, runtime `1.0.0-app-store-release-1`.

The latest Apple public OTA workflow is successful:

* Workflow run: `01a0e212-84e3-7b64-b0b0-3552886a5ef5`.
* Published commit: `f879c21287be7f23af817276a28c89c2428efe80`.
* Finished: `2026-09-27T08:57:16.884Z`, 18:57 Sydney time.
* Update group: `8b3533fb-a137-440e-ab3e-37fb27042efc`.
* iOS update: `01a0e215-32f5-73f3-a4a8-f75ddd3decae`.
* Runtime: `1.0.0-app-store-release-1`.

A direct request to the public Expo update endpoint using that runtime, iOS platform and public channel returned HTTP 200 and the expected update ID and runtime.

Git ancestry confirms that this published commit contains both the EV booking change `524d285` and Xero reference fix `95764c5`. No mobile file differs between that published commit and checkpoint `b2c3253`. No duplicate OTA was necessary.

This verifies publication and build compatibility. It does not prove that a particular customer's phone has downloaded the update or that Luke's invoice was retried successfully.

## Website

The public website links to `https://psiperformance.com.au/pages/ev-hybrid` in its navigation.

Published the expanded footer in active Shopify theme `130077360257`, asset `global.js`, after Matt completed Shopify's passkey verification. The exact editor content was compared with the syntax checked proposal before saving.

The live footer now contains 23 brands, including BYD, Tesla and Polestar. Mobile has two columns and desktop has three. Browser checks found no horizontal page overflow at either tested size. Visual checks confirmed complete brand names and retained PSI footer styling.

The targeted change and its screenshots were moved on 9 October 2026 to the local ignored archive `artifacts/archive/2026-10-09/output/footer-release-2026-09-27/`. This retains `global.before.js`, `global.after.js`, `footer-mobile.png` and `footer-desktop.png`, with SHA256 verification in the archive manifest. The archive is a local recovery copy and is not hosted on GitHub Pages.

Code checkpoint `b2c3253` was pushed to main. GitHub workflow `36317099785` successfully built and deployed the web app.

## Social media

Matt's supplied Instagram screenshot says “Servicing incl. EVs”. His Facebook screenshot says “Servicing, including EVs”. These confirm the bios shown in the screenshots. A separate EV highlight and pinned launch post were not verified or published in this task.

## Validation

* JavaScript syntax check passed for the proposed complete theme asset.
* Targeted Shopify global theme test passed.
* EV Shopify page and public booking contract tests passed, 21 tests.
* Public Expo update response and Apple listing were checked directly.
* Live footer was checked at phone and desktop sizes.

App, customer data, account permissions and update configuration were not changed during this verification and footer publication.
