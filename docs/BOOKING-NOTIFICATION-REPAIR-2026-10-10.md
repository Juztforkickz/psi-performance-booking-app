# Booking notification repair, 10 October 2026

Booking emails and database inbox events succeeded, but the production push queue stopped before claiming jobs. The worker selected `ask_psi_conversation_id` and `message_alerts_enabled` unconditionally, although the separate private messaging migration was not active in production. This dependency was present before the owner vehicle artwork update.

The worker now selects the common production fields for bookings and owner test alerts. Only message jobs query the optional messaging fields. Message preference and context lookup failures retain the existing retry behavior. Booking access checks, staff AAL2 requirements, device registration, privacy safe payloads and owner sound behavior remain enforced.

The private database dispatcher retries eligible queued jobs every minute, using the existing dedicated Vault cron credential. Gateway JWT verification remains enabled. The cron credential authorizes only unrestricted queue dispatch, and app roles cannot execute the private dispatcher. Empty queues do not invoke the worker. Already read events are cancelled instead of producing delayed alerts.

## Verification

Twenty targeted tests passed across live schema compatibility, private messaging worker behavior, notification lifecycle and contact delivery. Coverage includes booking delivery with the messaging columns absent, both owner test alert jobs, disabled workshop preferences, read alert suppression, and cron credential scope and rejection.

Production worker version 36 is active. Migration `20261010051147_reliable_push_queue_dispatch` is applied and the scheduled retry completed successfully. The recovered production queue returned HTTP 200, processed five jobs, and sent one workshop alert. The remaining jobs were cancelled for read status or absent registered devices. No pending, failed or processing jobs remained after recovery.

The recovered workshop alert received an Expo receipt with `status: ok`, confirming handoff to the platform push service at approximately 4:11 pm Sydney time. The owner subsequently confirmed that the alert appeared on the iPhone. The receipt alone would not prove banner display or sound playback.

No mobile binary or OTA update is required. The private messaging feature was not activated. Owner vehicle records, artwork settings and Performance+ protection were not changed by this repair. Customer identifiers, device tokens, credentials and provider ticket identifiers are excluded from this document.
