# Stage 5, Chat bot in app

Status: Private review sandbox and hidden interface foundation in progress. Nothing is live or visible in the public app or website.

Recorded 4 October 2026.

Backend work authorised 6 October 2026.

## Current private checkpoint

The local project contains a Supabase messaging foundation for review and private testing. The schema and workers are available only in the isolated PSI Apple Review Sandbox. They have not been applied to the production Supabase project and no public customer or workshop screen exposes them.

The foundation includes:

1. Customer and vehicle linked conversations.
2. Immutable text and photo message records.
3. Customer and PSI read timestamps.
4. Unread conversation state for both sides.
5. Customer and workshop push notification jobs using the existing Expo delivery system.
6. A private ten megabyte photo bucket with customer isolation and MFA protected staff access.
7. A fifteen minute unread email fallback queue designed only for Microsoft 365.
8. Automatic cancellation of the email fallback when PSI reads the message first.
9. Account deletion coverage for private chat photos.
10. A separate SQL acceptance test for customer isolation, staff MFA, immutable history and read state.
11. Foreign key indexes for account cleanup, conversation ownership and email fallback processing.

The Microsoft 365 fallback worker is fail closed until its Microsoft Graph application credentials, sender mailbox, recipient mailbox and workshop portal URL are deliberately configured. No email provider is substituted.

## Hidden interface checkpoint

The source now includes a complete customer conversation screen, a floating Boost launcher, photo messages, keyboard safe scrolling, realtime refresh, read receipts and a protected PSI workshop inbox. The workshop inbox requires an active staff identity and authenticator verification.

Every interface is guarded by `EXPO_PUBLIC_ASK_PSI_PRIVATE_PREVIEW=true` together with either a local development build or the isolated review environment. Normal production builds therefore keep the launcher and workshop link hidden. Direct access to either route returns to the normal customer or workshop screen without exposing the private feature.

The existing Apple review and Google performance test profiles include the private flag. No public, beta, App Store release, Android internal, Google Play internal or production profile includes it. This allows a later private build to exercise the feature without changing any public app.

Local Apple review and Google review native bundle exports passed with the private flag enabled. These checks compiled the customer screen, workshop inbox, photo picker, notification routing and sandbox connection into both platform bundles without uploading either bundle.

The photo workflow uploads to the private bucket first, then registers the message and attachment together in one database transaction. A failed database registration removes the uploaded object so it does not leave an unattached private file.

The two messaging migrations and required workers are deployed only to the PSI Apple Review Sandbox. Production database checks confirm that the messaging tables and photo function are absent there. No Expo update, Apple build, Google build or website change has been published.

The sandbox follows its existing App Review identity rules. Its staff policies require the exact review identity, expected token issuer and an active review session. The production migration acceptance test passed with customer isolation, staff authenticator protection, immutable messages and read state verified inside a rolled back transaction.

The two database functions flagged by the Supabase security advisor deliberately use definer access so they can update read state and conversation workflow without granting customers direct update access. Both perform their own authenticated participant or active staff checks, use a fixed search path and expose only the intended operation.

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
7. Let controlled assistant responses answer approved general questions and collect information.
8. Transfer workshop decisions and commitments to a PSI person.

## Safety boundaries

The assistant must not independently confirm bookings, promise prices, diagnose safety concerns, alter invoices, modify vehicle records, publish workshop records or provide tuning instructions.

Existing bookings, customer records, Xero invoices, Performance+, vehicle sales, workshop uploads and owner account protection must remain unchanged.

## Expected delivery

A production ready direct messaging system is expected to take about two weeks of implementation and testing. Adding controlled assistant responses is expected to bring the total close to three weeks.

Plan for new Apple and Google app versions after private testing. Store privacy information and Google Data Safety answers must cover messages, photos and any assistant provider used.

## Reminder

Tori's combined daily wake up message and recap is active at 9:00 AM Sydney time. It reviews confirmed priorities, waiting items, pinned and active tasks, and parked future work. It includes Stage 5 as parked future work and asks whether Matt wants to keep it parked or begin planning. It must not start implementation without explicit approval.

## New chat handover command

```text
Continue from the current canonical main branch of the existing PSI Performance booking application. This is Stage 5, Chat bot in app. Read docs/STAGE-5-CHAT-BOT.md and inspect the current app and workshop portal before proposing any changes. Preserve all approved Apple, Android, Expo, Supabase, Performance+, Xero, workshop computer, website and customer data work. Do not create a new app, repository, Expo project or Supabase project.

Begin by confirming the current messaging and notification capabilities, then prepare a concrete implementation plan for the agreed Ask PSI feature. The intended first release is secure customer to workshop messaging with guided questions, customer and vehicle linking, a workshop Messages inbox under Menu, unread status, text and photo messages, conversation history, push notifications, banners, sounds and Microsoft 365 backup alerts. Keep the customer navigation clean and do not add another bottom tab.

Controlled assistant answers may explain approved PSI services and collect information, but must transfer workshop decisions to a PSI person. It must not confirm bookings, promise prices, diagnose safety concerns, alter invoices or records, publish workshop files or provide tuning instructions. Keep the matt@psiperformance.com.au owner account permanently protected.

Do not implement anything until you have inspected the current system, reported the smallest safe design, identified whether new native notification or photo permissions are required, and received my approval of the final plan. Plan for private Apple and Android testing, updated privacy declarations and a normal reviewed store release if the feature changes native capabilities or materially changes app functionality.
```
