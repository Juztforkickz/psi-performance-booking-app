# Xero production connection — 10 September 2026

## Live status

- **PSI Performance Vehicle Vault** is registered as a standard Xero Web app. App registration ID: `844f624f-5fc2-489b-82aa-54384ceb67ee`.
- PSI’s Xero organisation is owner-confirmed and stored with encrypted, tenant-bound OAuth tokens. Refresh-token rotation is concurrency protected.
- The live webhook is configured for invoice events and Xero reports its delivery status as **OK**.
- `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_TOKEN_ENCRYPTION_KEY`, `XERO_TENANT_ID` and `XERO_WEBHOOK_SIGNING_KEY` are configured only as encrypted main-project Edge Function secrets. Their values are not stored in this repository or the app.
- The portal’s **Check status** action now refreshes the token and makes a bounded, read-only invoice API request. It does not create or change an invoice.
- Automatic publication remains deliberately off. Every invoice requires an exact owner-confirmed customer, vehicle and PSI job-reference match.

## Import workflow

1. An invoice create or update webhook is authenticated with Xero’s signing key and queued idempotently.
2. The server refreshes the OAuth token under a database lock and fetches the invoice directly from Xero.
3. Tenant, invoice, contact, active customer, current vehicle ownership, AUD currency, final invoice state and exact PSI job reference are checked.
4. Any ambiguity stays in **Review imports and unfinished drafts** for owner/AAL2 review.
5. After the owner confirms the exact relationship, the server fetches the original PDF from Xero, hashes it, stores it privately and publishes the verified record to that vehicle.

The integration uses only `offline_access accounting.invoices.read accounting.contacts.read`. It cannot write invoices, payroll, payments, bank transactions or other Xero records.

No real invoice has been imported yet. The first end-to-end acceptance check requires one controlled PSI invoice whose Reference exactly matches a PSI job reference. Creating or editing that accounting record remains a deliberate operator action.

## Security and recovery

OAuth state is single use, stored only as a SHA-256 digest and expires after ten minutes. Privileged token and matching logic stays in the private schema with explicit owner/AAL2 checks; the public Data API exposes only caller-privilege wrappers. Provider bodies, credentials and tokens are never logged or returned to the app.

Preserve `psi-beta-before-performance-plus-2026-09-09`. To pause imports, disable the webhook or worker while retaining encrypted connection and vault records. Do not remove or recreate customer accounts as a troubleshooting step.

References: [Xero OAuth](https://developer.xero.com/documentation/guides/oauth2/auth-flow/), [granular scopes](https://developer.xero.com/documentation/guides/oauth2/scopes/), [invoices](https://developer.xero.com/documentation/api/accounting/invoices), [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api).
