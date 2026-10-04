# Stage 5, Chat bot in app

Status: Parked for later. No implementation is authorised yet.

Recorded 4 October 2026.

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

Tori's daily recap is active at 9:00 AM Sydney time. It includes Stage 5 as parked future work and asks whether Matt wants to keep it parked or begin planning. It must not start implementation without explicit approval.

## New chat handover command

```text
Continue from the current canonical main branch of the existing PSI Performance booking application. This is Stage 5, Chat bot in app. Read docs/STAGE-5-CHAT-BOT.md and inspect the current app and workshop portal before proposing any changes. Preserve all approved Apple, Android, Expo, Supabase, Performance+, Xero, workshop computer, website and customer data work. Do not create a new app, repository, Expo project or Supabase project.

Begin by confirming the current messaging and notification capabilities, then prepare a concrete implementation plan for the agreed Ask PSI feature. The intended first release is secure customer to workshop messaging with guided questions, customer and vehicle linking, a workshop Messages inbox under Menu, unread status, text and photo messages, conversation history, push notifications, banners, sounds and Microsoft 365 backup alerts. Keep the customer navigation clean and do not add another bottom tab.

Controlled assistant answers may explain approved PSI services and collect information, but must transfer workshop decisions to a PSI person. It must not confirm bookings, promise prices, diagnose safety concerns, alter invoices or records, publish workshop files or provide tuning instructions. Keep the matt@psiperformance.com.au owner account permanently protected.

Do not implement anything until you have inspected the current system, reported the smallest safe design, identified whether new native notification or photo permissions are required, and received my approval of the final plan. Plan for private Apple and Android testing, updated privacy declarations and a normal reviewed store release if the feature changes native capabilities or materially changes app functionality.
```
