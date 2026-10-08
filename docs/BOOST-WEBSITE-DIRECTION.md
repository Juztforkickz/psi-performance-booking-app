# Boost website direction and app pause

Recorded 8 October 2026, following Matt's instruction to pause Boost in the app, consider using him on the PSI website, remove unnecessary app staging files and preserve completed Boost work. This records the direction for review. It does not authorise website publication or production messaging activation.

## Recommended experience

Use the approved transparent Boost character as a small floating button on the existing PSI Shopify website. Keep the PSI colours and character design. On phones, place him clear of navigation, booking controls, cookie notices and the keyboard. Clicking Boost opens a compact chat panel; closing it returns to the same page and scroll position.

Offer a few clear starting topics, such as servicing, dyno tuning, an existing booking and a general question. A visitor can then write a message to PSI. Simple answers can be prepared from workshop approved wording, with an obvious option to message a person. The existing Boost implementation is direct workshop messaging. It does not currently provide AI generated replies.

Matt subsequently chose the existing Shopify Inbox as the preferred place to receive website conversations and alerts. Test the visitor prompts and workshop handoff locally first. The current public PSI app does not automatically receive these website messages. Opening website chat from the app can be considered later; directly synchronising the native Boost conversations into Shopify Inbox has not been verified. Email delivery remains disabled until separately configured and tested. Any PSI email work uses Microsoft 365.

Visitors should be able to enquire without installing PSI. A website guest flow will need its own contact and conversation identity handling. Do not assume a Shopify login and a PSI customer account are interchangeable, automatically attach an unverified visitor to customer records or expose invoices, bookings or private vehicle history.

## Work already preserved

The approved character is retained at `mobile/assets/images/boost-assistant.png`. The customer chat, workshop inbox, photo handling, sent and read times, conversation assignment, waiting state, closing and reopening, retries and access checks remain in the current source and Git history. The private inspection guides and sandbox testing records remain saved.

The separate local website test kit is now at `operations/boost-website-test/`. It reuses the approved transparent character, offers short draft FAQ replies and collects missing enquiry details before a visitor confirms a simulated Shopify Inbox handoff. It also demonstrates staff replies and read times, with a clear waiting status after handoff. It does not connect to Shopify or any messaging service. See [Boost website test guide](BOOST-WEBSITE-TEST.md).

The real website widget and guest integration have not been installed or published. The older private app inspection remains separate from this local website simulation. Website launch still needs supported Shopify chat controls, visitor identity handling, spam controls, real phone keyboard checks, notification delivery checks and Matt's approval of the finished integration.

## App pause and safe cleanup

The cleanup started from current main checkpoint `234749f6a0d488bd56f337639dca7b89840cbe32`, preserving the later trusted partner edits as well as the completed Boost checkpoint `785ac7455babf6a5b3846b9079c6055173e85e54`.

Removed only these generated, Git ignored staging resources:

* `artifacts/boost-preview/source`, a clean detached build checkout at `7e2deb98f0975d9466958429a6c4d81e6b65a481`, containing 140,541,558 bytes.
* `artifacts/boost-preview/ios`, the generated iOS JavaScript export, containing 24,883,065 bytes.

Total removed: 165,424,623 bytes, about 165 MB or 157.76 MiB. The source checkout's dependency junction was verified and unlinked without traversing its target. The real `mobile/node_modules` directory was preserved. Git removed the clean registered worktree; no branch, commit or rollback checkpoint was deleted.

Retained the separate preview configuration, helper, isolation tests, signed private installer, signing profile, build verification reports and installation guide. The installer is about 32 MB and provides a recovery copy. Preserved file hashes confirmed the app configuration, character image, launcher, messaging code, workshop inbox and shared Expo dependency were unchanged. The local cleanup evidence is `artifacts/boost-preview/cleanup-record-20261008.json`.

The private preview configuration is dormant and remains isolated from public PSI. Do not run a new Boost native build, publish a Boost OTA, submit to either store, enable notifications or activate public messaging while this work is paused. The public feature remains disabled outside the private review environment. The existing public EAS profiles and `mobile/app.json` still match the verified baseline `ce30c15`.

No external project, account, signing certificate, Apple device, channel, database record or customer data was deleted or modified for this cleanup. The existing shared signing certificate must remain intact. Owner `matt@psiperformance.com.au` keeps permanent complimentary Performance+ access.

Removing local staging files does not reverse a completed EAS build or restore its consumed build allowance. Expo accounts for executed builds and update delivery separately from these local files; see [Expo usage billing](https://docs.expo.dev/billing/usage-based-pricing/). No new build, OTA or store submission was initiated by this cleanup. The existing GitHub Pages workflow may refresh automatically after the documentation checkpoint is pushed, using its unchanged public configuration. The Shopify website remains unchanged.

If PSI Boost Preview was installed on Matt's phone and is no longer wanted, Matt can remove that separate preview app. Leave public PSI Performance Garage installed. This computer cleanup does not uninstall an app from the iPhone.

## Resume safely

Start future website work from the latest main branch and reuse the preserved Boost source, character and guides. Build and inspect a private website preview first. The disposable build checkout and export can be regenerated from their saved checkpoint if needed. Do not reset main or recreate the completed project to recover them.

Keep public app work paused until Matt explicitly resumes it. Website launch, real notifications and production messaging activation require Matt's approval of the finished preview.
