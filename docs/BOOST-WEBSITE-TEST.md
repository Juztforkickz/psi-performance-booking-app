# Boost private website test

Created 8 October 2026 from the preserved Boost work, following Matt's instruction to start testing here and put nothing on the live website.

## What this test does

The test reuses the approved transparent Boost image and PSI colours. It contains visitor and workshop views in the same local session. Servicing and location questions get short deterministic draft FAQ replies. Dyno, EV and Hybrid and pricing enquiries can collect the vehicle, year and relevant missing details before the visitor chooses a handoff. Guarantees, existing bookings, private records, unknown answers and questions needing direct workshop review explicitly hand over to a simulated PSI inbox.

These are draft replies for Matt to inspect. They are not an AI connection, a diagnosis, a price confirmation or an approved live knowledge base. An FAQ answer does not create a booking. Unknown questions receive a workshop handoff rather than invented facts. Once a conversation is handed over, further visitor messages wait for Matt instead of continuing automated replies. The conversation header then reads Waiting for PSI reply. Boost does not ask another question after announcing a handoff.

The 8 October reply revision keeps most answers to one or two short sentences. Quote intake asks for one missing detail at a time, keeps vehicle and year details already supplied and requires the visitor to confirm before sending that enquiry to the test inbox. No workshop price has been invented or added. For example, How much is it to service my 2021 Audi RS3? receives PSI will confirm the price. What’s the odometer reading? A mileage reply leads to a clear offer to send the details. Yes or Message PSI then completes the simulated handoff. Visitors can decline or skip a missing detail. Known side questions are answered; unknown side questions offer Message PSI without silently recording the question as a quote detail.

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
| `/service` | Explain Service & Report and date review |
| `/dyno` | Collect the car, year, setup and tuning goal |
| `/ev` | Collect the car, year and what needs checking |
| `/booking` | Hand over a booking confirmation request |
| `/hard` | Hand over a fault, quote and outcome request |
| `/human` | Hand over to the simulated PSI inbox |
| `/help` | Show available commands |
| `/reset` | Clear this test and return to the greeting |

Suggested walkthrough:

1. Ask about servicing, dyno tuning and an EV.
2. Ask what servicing your 2021 Audi RS3 will cost, then reply with 65,000 km. Confirm Boost asks whether to send the details before handing over. Ask about a guaranteed result and confirm he leaves that decision to PSI.
3. Try an unknown question or account question. Confirm no private data is shown.
4. Choose Message PSI, then open Matt's test inbox. Write a test reply and return to Visitor view to see it and its read time.
5. Close and reopen the conversation from the test inbox. Close the chat panel and reopen it by tapping Boost. Confirm the conversation stays in the same session.
6. Write a long message, scroll the conversation and check that the composer remains usable. Test commands and reset are available beneath the character.

Conversation text is kept only in page memory and disappears after a page refresh. The inline version may remember only its selected view, whether it is open, its latest intent and whether a test handoff occurred. It does not save message text to the conversation host, a database or browser storage.

## Isolation and validation

The server serves only the test page. It does not expose a file browser, message endpoint, email route, payment route, customer API or real booking action. Its browser policy blocks outbound connections and form submissions. Foreign hosts and origins, cross site requests, POST requests and arbitrary file paths are rejected. No credentials or production customer data are used. User messages render as literal text rather than HTML.

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
