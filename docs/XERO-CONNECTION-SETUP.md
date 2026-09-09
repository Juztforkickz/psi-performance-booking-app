# Xero connection checkpoint — 9 September 2026

## Completed

- Registered **PSI Performance Vehicle Vault**, standard Web app, in Matt's signed-in Xero developer account. App registration ID: `844f624f-5fc2-489b-82aa-54384ceb67ee`. The dashboard shows Starter, with no paid upgrade selected.
- Matt explicitly approved the developer agreements and generation/storage of the integration credential. The client ID, client secret and dedicated AES-256-GCM token-encryption key were saved directly to the main project's encrypted Edge Function secrets. Their values are not in this repository.
- Four additive migrations applied to main and the existing sandbox: `xero_oauth_connection`, `xero_owner_rpc_boundary`, `xero_explicit_owner_mfa`, `xero_organisation_confirmation`. No customer data was deleted or reset.
- Main `start-xero-connection` and `xero-oauth-callback` deployed, version 2. Anonymous start returns 401; an invalid callback state returns 400.
- Owner portal component implemented: **Xero invoices → Connect Xero → Check connection → Confirm organisation**. It is hidden from ordinary staff and the Apple review UI. Backend MFA enforcement is independent of UI visibility and the sandbox's special review login exception.
- Pure invoice matching and bounded PDF-fetching modules implemented. These are not yet wired into a publishing worker.

## First connection

1. Open the updated PSI app, sign into the existing owner portal, and complete MFA.
2. Choose **Connect Xero**. Only `offline_access accounting.invoices.read accounting.contacts.read` is requested. No payroll, bank-transaction or payment-writing scope is requested.
3. In Xero, authorise the actual **PSI PERFORMANCE** organisation.
4. Return to PSI within 15 minutes, choose **Check connection**, and confirm the provider-returned organisation.
5. Record that confirmed tenant UUID as `XERO_TENANT_ID` in the main backend's encrypted settings before enabling the invoice receiver/worker. Do not infer the UUID from the organisation's name or website shortcode.

The fixed callback URI is `https://lslhfrujyuqcavsnugfx.supabase.co/functions/v1/xero-oauth-callback`.

Initial OAuth candidates remain encrypted and require a second owner/MFA confirmation before being saved as a connection. Expired candidates cannot be confirmed; cleanup occurs on subsequent connection staging. A confirmed connection for a different tenant blocks replacement through this first-time flow. Future reauthorisation with a configured tenant must match that exact provider-returned UUID.

## Secret names

- `XERO_CLIENT_ID`: configured on main.
- `XERO_CLIENT_SECRET`: configured on main.
- `XERO_TOKEN_ENCRYPTION_KEY`: configured on main; base64 encoding of a dedicated random 32-byte AES key. Losing/replacing it requires reauthorisation; do not rotate it casually.
- `XERO_TENANT_ID`: pending actual owner-confirmed organisation UUID.
- `XERO_WEBHOOK_SIGNING_KEY`: pending webhook setup.

OAuth state contains 256 random bits and is stored only as a SHA-256 digest, expires after ten minutes and can be consumed once. Privileged table access stays behind private helpers and service-only RPCs. Token encryption authenticates the tenant ID as additional data. Never log tokens, callback codes or provider response bodies.

## Tests completed

- 40 Xero unit tests: exact matching, owner/vehicle conflicts, invoice state/currency, PDF validation and size limits, fixed provider destination, token encryption, wrong-key/tenant/tamper rejection.
- 8 existing subscription entitlement tests passed alongside them.
- 9 existing workshop uploader tests passed: compression, privacy metadata, PDFs, wrong-job rejection and interrupted uploads.
- Mobile type check and Deno server-function type checks passed.
- Sandbox transactional SQL tests passed for owner MFA, private-token access, expiring/single-use OAuth state and organisation confirmation. All test changes rolled back.
- Main security advisor: no new Xero warning. Private Xero tables intentionally have RLS without customer policies; the existing optional leaked-password protection warning remains.

## Not finished / not enabled

- Real OAuth consent and organisation confirmation have not been completed.
- Refresh-token rotation with concurrency protection, disconnect/revoke and monitored recovery remain to implement.
- Invoice queue worker, contact-link administration, review resolution, PDF persistence, correction/void reconciliation and periodic catch-up remain to implement.
- An eligible match is not publication approval. Require server-fetched invoice + verified tenant/contact/customer + exact whole job reference + current vehicle ownership, then recheck transactionally when publishing. Registration, VIN fragments, names and the most recent booking cannot substitute for the job link.
- Xero's `SentToContact` means marked as sent, not proof of email delivery.
- No invoice has been imported or exposed by this checkpoint. Payments, subscriptions, Calendar and public-launch gates remain unchanged.

## Recovery

Preserve `psi-beta-before-performance-plus-2026-09-09`. This addition does not alter that earlier recovery tag. Disable the new owner UI/endpoints to pause setup; retain encrypted connection records and customer vault records. Do not remove or recreate customer accounts as a troubleshooting step.

References: [Xero OAuth](https://developer.xero.com/documentation/guides/oauth2/auth-flow/), [granular scopes](https://developer.xero.com/documentation/guides/oauth2/scopes/), [invoices](https://developer.xero.com/documentation/api/accounting/invoices), [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api).
