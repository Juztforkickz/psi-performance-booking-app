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

The current tests cover every prepared question, suggested follow ups, common paraphrases, guides, scoped quote collection, side questions, consent, inbox read times, unknown questions, literal markup, bounded state and isolation. The review page at `http://127.0.0.1:8780/review.html` contains all 64 replies and 12 pricing decisions for Matt. It has no save or submission action. `node operations/boost-website-test/build-review.mjs` also saves a local HTML copy in the ignored artifacts directory.

Current validation on 9 October: 21 test groups pass, covering every prepared answer and suggested follow up as well as the scenarios above. Browser checks verified account guide buttons, both download destinations, the service enquiry and consent flow, Matt’s test reply and read time, long reply scrolling and a 320 pixel viewport with no horizontal overflow. Physical phone keyboard behaviour and actual Shopify delivery remain outside this local test.

## Research and pricing approval

Reviewed on 9 October: PSI homepage and enquiry form, Workshop Services, EV & Hybrid, Coding, Power Estimator, public Apple and Google listings, current mobile account and booking screens, and saved booking and content notes. Read 22 selected Microsoft Outlook messages from relevant customer enquiry threads. This was targeted research, not an audit of every mailbox or note. No email was sent. No raw email, customer identity, private payment instruction or individual quote was copied into browser knowledge or committed source.

Recurring topics include supply versus fitting, ECU versus TCU tuning, supporting parts, vehicle compatibility, fault diagnosis, stock and lead times. Matt subsequently confirmed Service & Report from AUD $423.50 and Dyno Tuning from AUD $649 on 9 October. The preview now gives these starting guides with the existing GST inclusive treatment and explicitly says PSI confirms the final price for the vehicle and work required. Exact inclusions and other prices still need clarification in `pricing-questions.json`. These category guides do not price a specific ECU tune, transmission tune, power run or package. Matt also confirmed that transmission tuning costs extra and varies with the vehicle, transmission, setup and modifications. Boost states this in its dyno guide and transmission answers, collects the relevant setup, and never reuses the dyno starting guide as a transmission price. The coding page has conflicting credit examples, so no coding price is automated. The Power Estimator labels its figures unapproved for customer quotations. Performance+ pricing is a verified public Australian guide, with the current store price and terms controlling the purchase.

Public evidence: [PSI website](https://psiperformance.com.au/), [Workshop Services](https://psiperformance.com.au/pages/workshop-services-pakenham), [EV & Hybrid](https://psiperformance.com.au/pages/ev-hybrid), [Coding](https://psiperformance.com.au/pages/coding), [Power Estimator](https://psiperformance.com.au/pages/power-estimator), [Apple listing](https://apps.apple.com/au/app/psi-performance-garage/id6806902732), [Google listing](https://play.google.com/store/apps/details?id=com.psiperformance.booking). Recheck changing prices, links, hours and app labels before any future launch. `knowledge.cjs` attaches source categories and the verification date to each prepared answer.

Run the relevant checks:

```powershell
node --test operations/boost-website-test/engine.test.cjs operations/boost-website-test/isolation.test.mjs
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
