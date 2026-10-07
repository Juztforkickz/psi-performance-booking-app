# Stage 5, Chat bot in app

Status: Private inspection and hardening. Matt has authorised implementation and private testing, with no public launch until he inspects and approves it. Nothing is live or visible in the public app or website.

Recorded 4 October 2026.

Backend work authorised 6 October 2026.

Private preparation continued 7 October 2026. See [Ask PSI private inspection](ASK-PSI-PRIVATE-INSPECTION.md) for the customer and workshop walkthrough, remaining device checks, privacy declaration draft and rollback procedure.

## Current private checkpoint

The local project contains a Supabase messaging foundation for review and private testing. The schema and workers are available only in the isolated PSI Apple Review Sandbox. They have not been applied to the production Supabase project and no public customer or workshop screen exposes them.

The foundation includes:

1. Customer and vehicle linked conversations.
2. Immutable text and photo message records.
3. A recorded recipient read time for each message, with reads limited to the latest message actually loaded and visible in the foreground conversation.
4. Incoming unread message counts for both sides. Sending a reply does not automatically mark an incoming message as read.
5. Customer and workshop push notification jobs using the existing Expo delivery system.
6. A private ten megabyte photo bucket with customer isolation and MFA protected staff access.
7. A fifteen minute unread email fallback queue designed only for Microsoft 365.
8. Automatic cancellation of the email fallback when PSI reads the message first.
9. Account deletion coverage for private chat photos.
10. A separate SQL acceptance test for customer isolation, staff MFA, immutable history and read state.
11. Foreign key indexes for account cleanup, conversation ownership and email fallback processing.
12. Stable request identifiers for safe retries of new conversations, text and photo messages.
13. Verification that registered photo attachments match the actual private upload, its owner, type and size.

Microsoft 365 email delivery is explicitly disabled. The worker requires `PSI_ASK_PSI_EMAIL_DELIVERY_ENABLED=true` as well as valid Graph credentials, sender mailbox, recipient mailbox and workshop portal URL. Adding shared Graph credentials for another PSI feature cannot enable Ask PSI emails. The approved Tori banner must also be available before delivery. Sender configuration, scheduling and a specifically authorised test delivery remain separate preparation work. No email provider is substituted.

## Hidden interface checkpoint

The source includes a customer conversation screen, floating Boost launcher, photo messages, keyboard handling, realtime and foreground refresh, message read times and a protected PSI workshop inbox. The workshop inbox requires an active staff identity and the applicable authenticator check. Session changes immediately hide the previous staff snapshot while access is checked again.

The inbox has explicit unread counts, customer and vehicle context, assignment, waiting, close and reopen controls, a workshop return action and recoverable connection errors. Customer and workshop conversations preserve older scroll positions, offer a latest messages action and open photos in a separate full view. Failed sends retain text or the pending photo for safe retry.

Boost now has a transparent, app optimised turbo robot character asset. The hidden launcher uses a compact portrait and the Ask PSI screen introduces the full character without changing the normal customer navigation.

Every interface requires both `EXPO_PUBLIC_ASK_PSI_PRIVATE_PREVIEW=true` and `REVIEW_ENVIRONMENT.enabled`. A development build alone does not bypass the review restriction. Messaging client calls also require the private review environment. Normal production builds keep the launcher and workshop link hidden. Direct access to either route returns to the normal customer or workshop screen without exposing the private feature.

The existing Apple review and Google performance test profiles include the private flag. No public, beta, App Store release, Android internal, Google Play internal or production profile includes it. This allows a later private build to exercise the feature without changing any public app.

Local Apple review and Google review native bundle exports passed with the private flag enabled. These checks compiled the customer screen, workshop inbox, photo picker, notification routing and sandbox connection into both platform bundles without uploading either bundle.

The photo workflow uploads to the private bucket first, then registers the message and attachment together in one database transaction. An ambiguous network failure retains the uploaded object and stable identifiers because registration might already have committed. Retry first checks for the saved message and recovers an existing upload without creating another message. Cleanup removes an unregistered object only after a confirmed database failure and a successful check that no message was saved.

HEIC and HEIF photos are prepared as JPEG before upload. JPEG, PNG and WebP remain supported, with the private upload size limit applied to the prepared file. Actual device conversion, permissions, keyboard behaviour and notifications still require native testing.

The repository contains four Ask PSI migration files:

1. `20261006125247_ask_psi_messaging_foundation.sql`
2. `20261007075301_register_ask_psi_photo_messages.sql`
3. `20261007082034_index_ask_psi_foreign_keys.sql`
4. `20261007093904_harden_private_ask_psi_delivery.sql`

All four migrations have been applied to the PSI Apple Review Sandbox. Ask PSI schema and worker deployment is restricted to that sandbox. Production database checks confirm that the messaging tables and photo function are absent there. No Ask PSI OTA, Apple build, Google build or public website feature has been published.

The sandbox follows its existing App Review identity rules. Its staff policies require the exact review identity, expected token issuer and an active review session. The production migration acceptance test passed with customer isolation, staff authenticator protection, immutable messages and read state verified inside a rolled back transaction.

Privileged database functions update read state and conversation workflow without granting customers general update access. They perform authenticated participant or active staff checks, use a fixed search path and expose only the intended operation.

The local inspection entry is `http://127.0.0.1:8773/__review`. Open that page in two separate tabs, then open the customer view in one and workshop view in the other. Each button opens in its current tab. This is the actual app using fictional sandbox accounts, available only on this computer while the review launcher runs. It is not a public website deployment.

## Website option

The same private conversation records can support an Ask PSI control on the PSI website. The safest first version requires the customer to sign in with the same PSI account before a conversation opens. This preserves the customer and vehicle link and avoids a second disconnected inbox.

A public guest enquiry may be added later as a separate intake path with spam protection and limited data collection. It should not receive access to private conversation history.

## Agreed direction

1. Add an **Ask PSI** shortcut to the customer Home screen without adding another bottom navigation tab.
2. Start with secure customer to workshop messaging and guided questions.
3. Link each conversation to the signed in customer and the relevant vehicle.
4. Add a **Messages** inbox to the workshop portal under Menu, including unread counts.
5. Support text, photos, conversation history, read status, push notifications, banners and sounds.
6. Use Microsoft 365 for backup alerts when appropriate.
7. Consider controlled assistant responses for approved general questions and information collection after the direct messaging release is inspected. No AI response provider is currently connected and no automated AI answers are enabled.
8. Transfer workshop decisions and commitments to a PSI person.

## Safety boundaries

The assistant must not independently confirm bookings, promise prices, diagnose safety concerns, alter invoices, modify vehicle records, publish workshop records or provide tuning instructions.

Existing bookings, customer records, Xero invoices, Performance+, vehicle sales, workshop uploads and owner account protection must remain unchanged.

## Remaining preparation

The workshop message alert count, conversation notification links and message preference mapping are corrected. A restricted internal phone profile and separate sandbox message notification worker are prepared, with delivery disabled and no devices registered. Read `docs/ASK-PSI-PRIVATE-DEVICE-QA.md` before preparing signed builds or starting a private delivery test. No phone build upload, public messaging launch or OTA has been authorised by this preparation.

Complete Matt's private inspection, the iOS and Android device checks, notification delivery checks and any resulting fixes. Microsoft 365 fallback remains disabled until its separate configuration and authorised delivery tests pass. The browser preview and compiled bundles do not establish native device behaviour.

Review the release route and store requirements after private testing. Store privacy information and Google Data Safety answers must accurately cover messages, photos and enabled processing. The inspection document contains a draft declaration only; it has not been submitted. Public release still requires Matt's inspection and approval.

## Reminder

The earlier reminder record states that Tori's combined daily wake up message and recap is active at 9:00 AM Sydney time. It reviews confirmed priorities, waiting items, pinned and active tasks, and parked future work. Stage 5 was originally included as parked work awaiting implementation approval.

Matt has now explicitly authorised private implementation and testing. Stage 5 is in private inspection, with public launch awaiting his approval. This document update does not change or reverify Tori's automation; any recap should use the current authorised status rather than treating the implementation as still unapproved.

## New chat handover command

```text
Continue from the current canonical main branch of the existing PSI Performance booking application. This is Stage 5, Chat bot in app. Read docs/STAGE-5-CHAT-BOT.md and inspect the current app and workshop portal before proposing any changes. Preserve all approved Apple, Android, Expo, Supabase, Performance+, Xero, workshop computer, website and customer data work. Do not create a new app, repository, Expo project or Supabase project.

Read docs/ASK-PSI-PRIVATE-INSPECTION.md as well. Continue the authorised private inspection and remaining preparation from the current checkpoint. Confirm the private environment and current implementation before changing it. The first release is secure customer to workshop messaging with topics, customer and vehicle linking, a workshop Messages inbox under Menu, incoming unread counts, text and photos, conversation history and recorded read times. Keep the customer navigation clean and do not add another bottom tab. Native push, banner, sound and keyboard checks remain device tests. Microsoft 365 backup delivery remains explicitly disabled.

Boost is currently the interface character for private workshop messages. No AI response provider is connected. Any later controlled assistant must transfer workshop decisions to a PSI person. It must not confirm bookings, promise prices, diagnose safety concerns, alter invoices or records, publish workshop files or provide tuning instructions. Keep the matt@psiperformance.com.au owner account permanently protected.

Private implementation is authorised. Do not enable Ask PSI publicly, change production Supabase, send emails, publish an OTA, submit a store update or launch the website feature before Matt inspects and approves that release. Keep testing in the existing sandbox and preserve its additive schema during any reviewed forward revert. Prepare the remaining checks and store privacy drafts without claiming they have passed or been submitted.
```
