# Boost private website test

Created 8 October 2026 from the preserved Boost work, following Matt's instruction to start testing here and put nothing on the live website.

## What this test does

The test reuses the approved transparent Boost image and PSI colours. It contains visitor and workshop views in the same local session. The current 9 October expansion has 64 prepared answers across app downloads, account setup, Performance+, bookings, servicing, diagnostics, tuning, builds, parts, EV work, location and contact. Account setup and booking also have five step interactive guides. Price enquiries explain any approved starting guide, then collect the vehicle and relevant scope before the visitor chooses a handoff. Private records, actual booking changes and safety concerns require direct review. Unknown questions offer Message PSI without inventing an answer or automatically filling the inbox.

These are draft replies for Matt to inspect. They are prepared answers and conversation rules, not a connected language model, a diagnosis, a price confirmation or a live knowledge base. An FAQ answer does not create a booking. Once a conversation is handed over, further visitor messages wait for Matt instead of continuing automated replies. The conversation header then reads Waiting for PSI reply. Boost does not ask another question after announcing a handoff.

Quote intake keeps vehicle and year details already supplied, asks for the remaining scope and requires the visitor to confirm before sending the enquiry to the test inbox. A service enquiry asks for kilometres and the service due or concern. Tuning asks for setup, transmission, fuel and goal. Exhaust, cam, engine build, coding, parts, cooling and EV enquiries have relevant scope questions. Visitors can decline or skip a missing detail. Known side questions are answered without being stored as quote details; Resume quote returns to the pending question. Follow up pricing questions retain the preceding service topic. No historical individual workshop price is treated as a current public offer.

Selecting Matt's test inbox marks visitor messages as read. Sending a test reply and returning to Visitor view marks the reply as read by the visitor. These timestamps are local simulations. Closing and reopening the conversation can also be tested. Reset affects only this test session.

The character has no background and occupies separate space below the message controls. He hides while a text area has focus. This demonstrates the clearance behaviour without editing the public app or live theme. Actual floating placement beside Shopify chat, cookie notices, website controls and a real phone keyboard must be checked during a later approved integration.

## Open and try it

From the repository root, run:

```powershell
node operations/boost-website-test/serve-preview.mjs
```

Open `http://127.0.0.1:8780/` on this laptop. The page is also supplied as an interactive test in the conversation. The local URL cannot be opened from another phone or computer. The server binds only to the laptop's loopback address. Stop it with Ctrl+C when finished. No separate build or paid service is needed.

Use the sample buttons or type these commands into the visitor message field:

| Command | Local test |
| --- | --- |
| `/service` | Explain Service & Report and offer the next step |
| `/dyno` | Explain the details needed for tuning |
| `/ev` | Explain EV and hybrid service selection |
| `/app` | Offer verified iPhone and Android download links |
| `/signup` | Start the account setup guide |
| `/booking` | Start the booking request guide |
| `/quote` | Collect a proposed job for PSI review |
| `/hard` | Explain that outcomes need assessment |
| `/human` | Hand over to the simulated PSI inbox |
| `/help` | Show available commands |
| `/reset` | Clear this test and return to the greeting |

Suggested walkthrough:

1. Ask about servicing, dyno tuning and an EV.
2. Ask what servicing your 2021 Audi RS3 will cost, reply with 65,000 km and the service due. Confirm Boost asks whether to send the details before handing over. Ask about a guaranteed result and confirm he leaves that decision to PSI.
3. Try an unknown question or account question. Confirm no private data is shown.
4. Choose Message PSI, then open Matt's test inbox. Write a test reply and return to Visitor view to see it and its read time.
5. Close and reopen the conversation from the test inbox. Close the chat panel and reopen it by tapping Boost. Confirm the conversation stays in the same session.
6. Write a long message, scroll the conversation and check that the composer remains usable. Test commands and reset are available beneath the character.

Conversation text is kept only in page memory and disappears after a page refresh. The inline version may remember only its selected view, whether it is open, its latest intent and whether a test handoff occurred. It does not save message text to the conversation host, a database or browser storage.

## Isolation and validation

The server serves only the test pages. It does not expose a file browser, message endpoint, email route, payment route, customer API or real booking action. Its browser policy blocks outbound connections and form submissions. Foreign hosts and origins, cross site requests, POST requests and arbitrary file paths are rejected. No credentials or production customer data are used. User messages render as literal text rather than HTML.

The website placement preview is available at `http://127.0.0.1:8780/website.html`. See [the placement preview guide](BOOST-WEBSITE-PLACEMENT-PREVIEW.md) for its scope, assets and checks. It keeps this original conversation test available.

The latest 9 October direction supersedes the earlier website first wording. Matt now prefers app downloads and app booking guidance, with website enquiry retained as an alternative. Public store links open only after a visitor clicks. They contain no transcript or visitor details. All message handling remains local. General account and subscription instructions can be answered without accessing an account; actual account changes and refunds still require PSI.

The current tests cover every prepared question, suggested follow ups, common paraphrases, guides, scoped quote collection, side questions, consent, inbox read times, unknown questions, literal markup, bounded state and isolation. The review page at `http://127.0.0.1:8780/review.html` contains all 79 replies, confirmed business answers and 2 remaining scope questions for Matt. It has no save or submission action. `node operations/boost-website-test/build-review.mjs` also saves a local HTML copy in the ignored artifacts directory.

Current validation on 9 October after the supplementary answers: 57 test groups pass, including 20 complete fictional customer journeys, covering every prepared answer and suggested follow up as well as the scenarios above. Browser checks verified account guide buttons, both download destinations, the service enquiry and consent flow, Matt’s test reply and read time, long reply scrolling and a 320 pixel viewport with no horizontal overflow. Physical phone keyboard behaviour and actual Shopify delivery remain outside this local test.

## Research and pricing approval

Reviewed on 9 October: PSI homepage and enquiry form, Workshop Services, EV & Hybrid, Coding, Power Estimator, public Apple and Google listings, current mobile account and booking screens, and saved booking and content notes. Read 22 selected Microsoft Outlook messages from relevant customer enquiry threads. This was targeted research, not an audit of every mailbox or note. No email was sent. No raw email, customer identity, private payment instruction or individual quote was copied into browser knowledge or committed source.

Recurring topics include supply versus fitting, ECU versus TCU tuning, supporting parts, vehicle compatibility, fault diagnosis, stock and lead times. Matt subsequently confirmed Service & Report from AUD $423.50 and Dyno Tuning from AUD $649 on 9 October. The preview now gives these starting guides with the existing GST inclusive treatment and explicitly says PSI confirms the final price for the vehicle and work required. Exact inclusions and other prices still need clarification in `pricing-questions.json`. These category guides do not price a specific ECU tune, transmission tune, power run or package. Matt also confirmed that transmission tuning costs extra and varies with the vehicle, transmission, setup and modifications. Boost states this in its dyno guide and transmission answers, collects the relevant setup, and never reuses the dyno starting guide as a transmission price. The coding page has conflicting credit examples, so no coding price is automated. The Power Estimator labels its figures unapproved for customer quotations. Performance+ pricing is a verified public Australian guide, with the current store price and terms controlling the purchase.

Public evidence: [PSI website](https://psiperformance.com.au/), [Workshop Services](https://psiperformance.com.au/pages/workshop-services-pakenham), [EV & Hybrid](https://psiperformance.com.au/pages/ev-hybrid), [Coding](https://psiperformance.com.au/pages/coding), [Power Estimator](https://psiperformance.com.au/pages/power-estimator), [Apple listing](https://apps.apple.com/au/app/psi-performance-garage/id6806902732), [Google listing](https://play.google.com/store/apps/details?id=com.psiperformance.booking). Recheck changing prices, links, hours and app labels before any future launch. `knowledge.cjs` attaches source categories and the verification date to each prepared answer.

Run the relevant checks:

```powershell
node --test operations/boost-website-test/engine.test.cjs operations/boost-website-test/journeys.test.cjs operations/boost-website-test/isolation.test.mjs
```

The build helper can create the standalone inline fragment without installing packages:

```powershell
node operations/boost-website-test/build-preview.mjs
```

Its default generated copy goes into the ignored `artifacts/boost-website-test/` directory. Source, tests and this guide are kept in Git. The original character image is reused without modification.

Initial validation completed 8 October 2026: all 12 automated checks passed. The visitor FAQ, difficult question handoff, Matt's reply, both read timestamps, commands, conversation closing and reopening, literal HTML input, reset and transparent launcher were exercised in the Codex browser. A 320 pixel viewport had no horizontal overflow and the original character loaded correctly. The browser reported no warnings or errors. The reply revision adds quote collection, existing vehicle details, handoff confirmation, declining, skipping, side questions and concise handoff wording checks; all 19 automated checks pass. The revised Audi service question, mileage follow up, explicit Yes handoff, staff reply and read times were also verified in the Codex browser. A physical phone keyboard and real Shopify notifications have not been tested by this simulation.

No public app file, Expo profile, OTA channel, subscription, owner entitlement, native build, store listing or Shopify theme is changed by this test kit. No real customer communications or notifications are sent. App Boost remains paused. The repository has a shared working directory; unrelated app edits made by other work must not be staged into this checkpoint.

## Before connecting Shopify

Matt's preferred destination is the existing Shopify Inbox. The local inbox shown here is a simulation, not a Shopify screen or a verified connection. Previous research identified Shopify's own online store chat and instant answers, but this test does not assert that a public API can import native app conversations or that a custom transparent character can control Shopify's chat widget.

After Matt approves the behaviour and FAQ wording, inspect the supported chat controls and store availability in a separately authorised private Shopify theme test. Verify the actual handoff, conversation identity, available hours and notifications. Preserve the current website and public app until the finished implementation is approved for launch.

Reference documentation previously reviewed: [Shopify Inbox](https://help.shopify.com/en/manual/inbox), [instant answers](https://help.shopify.com/en/manual/inbox/chat-settings-and-appearance/instant-answers), [notifications](https://help.shopify.com/en/manual/inbox/configure-inbox/inbox-notifications) and [availability and first reply](https://help.shopify.com/en/manual/inbox/chat-settings-and-appearance/availability-and-first-reply).

## Conversation rehearsal expansion, 9 October

The private engine now remembers the stated phone platform, existing app installation and website booking preference within the current session. It retains vehicle details offered before a quote, recognises selected spelling variants and tuning follow ups such as gearbox, and answers up to three separate questions in one message. Multiple workshop price requests offer the approved guides and ask which work to discuss first. Safety and private account actions retain priority. No new workshop prices or inclusions were inferred.

The simulated inbox includes an expandable Request summary for PSI with vehicle details as supplied, work, odometer, setup, questions for review and recent visitor messages. Unknown values remain labelled as not supplied. This summary uses session data only and sends nothing outside the preview.

`journeys.cjs` contains 20 fictional conversations covering service, dyno, transmission, corrections, app signup, website preference, combined questions, safety, unknown prices, parts, coding, EV scope, Performance+, staff handoff and consent. The baseline met all checks in 4 of 20; the remaining journeys exposed missing context handling or the planned summary feature. All 20 now meet their checks. Run the complete suite with `node --test operations/boost-website-test/engine.test.cjs operations/boost-website-test/journeys.test.cjs operations/boost-website-test/isolation.test.mjs`.

`http://127.0.0.1:8780/rehearsals.html` shows the actual generated conversations and test summaries. Build a saved copy with `node operations/boost-website-test/build-rehearsals.mjs`. This remains a prepared response engine, with limited wording recognition. Real Shopify delivery, alerts, physical phone keyboard testing, outstanding pricing decisions and public launch are still separate work.

## Owner business answers applied, 9 October 2026

This later checkpoint supersedes the earlier pricing research gaps above where Matt has now supplied answers. It adds routine engine service inclusions and prior approval for extra work, engine ECU dyno scope, labour at AUD $187 including GST per hour with no minimum labour charge, diagnostic scans at AUD $88 including GST, and entry cam packages from AUD $3,795 including GST. A scan is not a complete diagnosis or repair quote. The cam guide does not guarantee eligible engines or unspecified parts and tuning inclusions.

Additional transmission, unlocking, CPC, fuel pump and other module costs remain individually quoted. The OTR and tune option and typical cam supporting upgrades are explained without publishing the supplementary figures whose GST and fitting details remain unclear. Mercedes coding links retain compatibility checks, include the owner approved remote dongle option and do not calculate prices from inconsistent website credit examples.

Deposits, timely agreed date transfers, quote expiry, customer supplied parts, workmanship warranty and transport policies are recorded. No policy reply performs or approves a refund, cancellation, date change, liability decision or warranty claim. Blanket exclusions of consumer rights are not used. Reference: [ACCC consumer rights and guarantees](https://www.accc.gov.au/consumers/buying-products-and-services/consumer-rights-and-guarantees), checked 9 October 2026. The owner’s commercial policy is qualified by applicable consumer rights and assessment of the circumstances.

The review now records answered topics separately from three clarification groups: supplementary GST and fitting, cam eligibility and exact inclusions, and ambiguous service lubrication wording plus EV scope. The answer numbered 7 concerned servicing, not forced induction. Unanswered work stays quote only; no reply time, job duration, warranty duration or notice cutoff is invented.

Validation: 52 checks passed, including all 20 existing conversation journeys, pricing and policy regression cases, consent, safe handoff and local server isolation. Built all four local artifacts. Browser verification confirmed the updated diagnostic price reply and the revised review page. Screenshot: `artifacts/boost-website-test/boost-approved-pricing.jpg`. No native app, public OTA configuration, customer account, Shopify theme or external message integration changed. The normal main branch GitHub Pages workflow exports only `mobile/dist`; this local Boost kit is not part of that export.

Rollback is the preceding Git checkpoint `db19d05`. Revert this checkpoint’s scoped files if needed without resetting unrelated app or website work.

## Supplementary prices and LS scope confirmed, 9 October 2026

Matt clarified that all four supplementary figures are plus GST. Customer replies now give CNC head porting at AUD $1,705 including GST, valve seat upgrade work at AUD $825 including GST, the oil pump and CHE trunnion combination at AUD $1,012 including GST, and Holden or HSV supplied and fitted OTR with tuning from AUD $1,650 including GST.

CNC and valve seat prices cover the stated machining or upgrade work, not the complete installed head job. Cylinder head removal and associated parts and labour cost extra. The pump and trunnion combination adds no fitting labour when performed during the cam job. This does not include standalone fitting or imply that the optional parts are included in the entry cam price. Combined head and cam requests are collected for a full quote rather than calculating a misleading package total from component prices.

The entry cam guide applies to Holden and Chevrolet LS1, LS2, LS3, LSA, L77, L76 and L98. L77 and L76 require a DOD delete kit with the camshaft upgrade. The other listed engines do not require that kit for these packages, subject to the actual engine and existing modifications. The DOD kit has no separately approved price, and the engine list does not establish a complete included parts and tuning list. The CNC and supporting upgrades can be considered across the listed LS combinations. Other engine families and other vehicle OTR packages retain individual pricing.

The routine engine service now explicitly includes the full vehicle check and report, wheel nut torque, reporting of damage and mechanical work needing attention, and door, bonnet and boot hinge and latch lubrication where applicable. The EV and hybrid price was not answered by this clarification and remains model specific. The review records the confirmed facts and only retains the exact entry cam contents and EV pricing as scope questions.

Validation: all 57 checks pass, including 20 existing conversation journeys and additional machining, conditional labour, LS scope, DOD, service report and pricing tests. The four local preview artifacts were rebuilt. Browser verification confirmed the CNC price with the extra head removal and labour wording. Screenshot: `artifacts/boost-website-test/boost-ls-pricing.png`.

Changes are confined to the Boost test knowledge, conversation routing, tests, review records and this guide. No app, OTA, owner entitlement, Shopify theme or live delivery changes are included. Work began from `db18e05`, preserving the newer customer onboarding release checkpoints. Roll back only this scoped commit if necessary; do not reset those unrelated releases.

## Supplementary price presentation, 9 October 2026

At Matt’s request, the four supplementary guides now show the amount before GST followed by + GST. The equivalent GST inclusive amount immediately follows in the same text style. CNC porting is AUD $1,550 + GST, AUD $1,705 including GST; valve seat upgrade work is AUD $750 + GST, AUD $825 including GST; the oil pump and CHE trunnion combination is AUD $920 + GST, AUD $1,012 including GST; and Holden or HSV OTR with tune starts from AUD $1,500 + GST, AUD $1,650 including GST.

The [ACCC price display guidance](https://www.accc.gov.au/consumers/pricing/price-displays), checked 9 October 2026, requires customer prices to include applicable GST and the total to be at least as prominent as a partial price. The total is therefore not hidden in small print, a link or a separate step. This is a presentation change only; the scope, actual charges, service and dyno starting guides remain unchanged. The existing price tests now check the four tax conversions and adjacent paired figures. This private checkpoint can be reversed independently from its predecessor, `a4b7d69`.

Validation: all 57 engine, conversation and isolation checks passed. All four local review artifacts rebuilt, and the CNC price reply was verified in the browser with both amounts in the same text style. Screenshot: `artifacts/boost-website-test/boost-plus-gst-pricing.png`. No public app or deployment configuration changed.

## Cam inclusions and fully electric service confirmed, 9 October 2026

Matt confirmed the standard cam package contents: camshaft, valve springs, locks, retainers and stem seals, heavy duty pushrods, ARP camshaft and crankshaft bolts, timing cover and water pump gaskets, front crank seal, timing chain, coolant, labour and engine ECU dyno tuning. A three bolt camshaft gear is included where conversion from a single bolt gear is required. The guide remains from AUD $3,450 + GST, AUD $3,795 including GST, for the approved LS combinations and vehicle scope. Lifters and cylinder head removal are additional; other listed gaskets, bolts and spark plugs can also be extra depending on the job.

The additional head removal and lifter package is AUD $2,000 + GST, AUD $2,200 including GST, during a cam job. It covers removal and refitting labour, genuine MLS head gaskets, LS7 lifters, LS2 lifter buckets and bolts, cleaning and preparation of the block, and GM head bolts. It is a parts and labour package, not labour alone. CNC porting and valve seat upgrades remain separately quoted options while the heads are removed.

Matt explicitly confirmed that L77 and L76 cam jobs require that head removal and lifter package plus AUD $750 + GST for the DOD work, which covers valley plate replacement, gasket and oil gallery blocking with welch plugs. The combined extras are AUD $2,750 + GST, AUD $3,025 including GST, above the base cam package. The engine checks the stated L77 or L76 context before adding the mandatory extra guide and does not price a DOD kit for an LS3 or other listed engine that does not require it. Complete modified builds still require a written quote.

Fully electric BEV servicing starts from AUD $325 including GST, with no engine oil or engine oil filter change. That is AUD $98.50 below the AUD $423.50 engine service starting guide. The BEV amount is not applied to HEV or PHEV models, which retain combustion engines and require model specific scope and pricing confirmation. EV servicing intake asks for make, model, year and powertrain rather than an engine, then mileage and the service due or concern.

Both requested clarification groups are answered and archived into the approved facts. The review now contains 83 prepared replies and shows Pricing clarifications complete, while individually quoted work remains explicit. All 60 engine, conversation and isolation checks passed, including approved cam parts versus extras, conditional head and lifter pricing, L77/L76 additions, LS3 exclusions, BEV mileage collection and hybrid price separation. This checkpoint begins from `eee4396`, preserving unrelated release artifact cleanup. Only the private Boost test kit and this guide change; no live Shopify, inbox, app or OTA configuration is altered.

All four local artifacts rebuilt. Browser verification exercised the BEV price reply, cam inclusions, the head and lifter package and the DOD follow up buttons. Screenshots: `artifacts/boost-website-test/boost-bev-service-confirmed.png` and `artifacts/boost-website-test/boost-cam-extras-confirmed.png`. The existing private server was refreshed. No messages were sent externally. Real delivery and notifications remain a separate integration step.

## Sump gasket price and scope confirmed, 9 October 2026

Matt confirmed AUD $750 including GST to supply and fit the sump gasket, including parts and labour and blocking off the oil pressure relief valve where fitted. This is an additional job to the base cam package, distinct from the routine service sump plug washer. The guide is recorded in the existing LS work context; other vehicles require an individual scope confirmation rather than automatic reuse of the figure. No GST is added again and no extra fitting charge is implied. The valve work is conditional on the valve being fitted, not a universal modification or a remote diagnosis of low oil pressure.

Added a prepared reply, cam extras follow up, scoped quote collection and fitting follow up routing. The private knowledge now contains 84 replies. All 61 engine, conversation and isolation checks passed, including the fixed GST inclusive amount, included fitting, conditional valve work, separate routine service and DOD prices, and other vehicle exclusions. The predecessor checkpoint is `b61e1f6`. Only the private Boost test kit and this guide change; no app, Shopify theme or external delivery is modified.

All four local artifacts rebuilt and the private server refreshed. Browser verification confirmed the AUD $750 including GST supply and fit reply and its conditional valve scope. Screenshot: `artifacts/boost-website-test/boost-sump-gasket-confirmed.png`.

## Inspection, quote and approval presentation, 9 October 2026

Matt directed Boost to lead with the requested starting package, rather than automatically adding optional work into a package total. The general cam guide now explains that PSI inspects the vehicle, notifies the customer about concerns or proposed additional work, quotes it and gets approval before commencing additional repairs. Approved supplementary prices and fitting conditions remain available for direct questions and relevant follow ups.

Known L77 and L76 head removal, lifter and DOD requirements remain clearly disclosed as separately quoted work. They are not described as optional upgrades or unexpected inspection findings. A general engine requirement answer no longer adds the supplementary figures automatically. A distinct direct price reply retains the confirmed AUD $2,750 + GST, AUD $3,025 including GST combined extras. This supersedes the earlier general quote behaviour described above. Combined optional upgrade enquiries still require a complete scoped quote rather than an automatically calculated total.

The knowledge now contains 85 prepared replies. All 62 engine, conversation and isolation checks passed, including general versus direct pricing, mandatory engine scope, inspection and prior approval wording, and all 20 conversation journeys. The predecessor checkpoint is `9d0d747`. Changes remain confined to the private test kit and this guide; no public app, owner access, OTA, Shopify theme or external delivery changes are included.

All four local artifacts rebuilt and the private server refreshed. Browser verification confirmed a general L77 cam quote without automatically adding supplementary prices, the direct DOD cost follow up with stored figures, and the prior approval reply. Screenshot: `artifacts/boost-website-test/boost-inspection-approval.png`. No messages were sent externally.

## App encouragement before website enquiries, 10 October 2026

Matt requested a brief recommendation of the PSI app before the website enquiry fallback. General booking guidance now explains that the free app keeps vehicles and booking requests together. The first website enquiry answer offers the relevant store download links before the website form instructions, while keeping the enquiry link immediately available. A known phone platform receives only its matching store link.

The invitation is offered once per conversation and skipped if the visitor already has the app or explicitly declines it. Subsequent website requests respect that preference without repeating the invitation. No download or Performance+ purchase is required, and asking for website help does not start signup, submit an enquiry or queue a message. All approved prices and inspection, quote and approval rules are preserved.

All 63 engine, conversation and isolation checks passed, including store link selection, repeat requests, explicit refusals, existing installations and the 20 conversation journeys. The predecessor checkpoint is `5b0b869`. Only the private Boost kit and this guide change; no Shopify, app, OTA or real delivery is enabled.

All four local artifacts rebuilt and the server refreshed. Browser verification confirmed the first online booking enquiry recommends the app and offers both store links alongside the website enquiry. Screenshot: `artifacts/boost-website-test/boost-app-encouragement.png`.
