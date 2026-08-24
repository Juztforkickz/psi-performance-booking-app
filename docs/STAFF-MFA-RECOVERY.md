# PSI staff MFA recovery

This runbook covers the initial owner-only PSI staff account:
`matt@psiperformance.com.au`. It is an emergency administrative process, not a
customer-facing feature and not an MFA bypass.

## Normal device replacement

1. While the existing authenticator is still available, sign in to the private
   PSI staff portal and complete AAL2 verification.
2. Open **Manage authenticators** and add a backup authenticator on a separate
   trusted device or authenticator vault controlled by PSI.
3. Verify a fresh six-digit code from the backup device.
4. Confirm both authenticators are listed before removing the old device.
5. Removing a verified factor refreshes the Auth session. If the current factor
   was removed, complete the remaining factor challenge again.

The app prevents removal of the final verified authenticator. Authenticator QR
codes, setup URIs and manual keys remain in React memory only and are cleared
when setup finishes, is cancelled or the route closes.

## Lost final authenticator

If no verified authenticator remains available:

1. Stop. Do not weaken the database AAL2 policies, change the staff allowlist,
   create a temporary client-side bypass or place a Supabase secret key in the
   app.
2. Verify the incident through PSI-controlled channels and confirm the request
   is from Matt. Record the date, reason, affected device and person performing
   recovery in PSI's private incident register.
3. From a trusted administrator workstation, use the PSI Supabase organization
   owner account and the supported Auth Admin MFA factor-management capability.
   The service-role/secret credential must exist only in that trusted
   administrative environment.
4. Revoke the staff user's active sessions before deleting the lost verified
   factor. Existing access-token JWTs can remain valid until their short expiry,
   so workshop access must remain monitored during that interval.
5. Delete only the confirmed lost factor for Matt's Auth user. Do not delete the
   Auth user, customer records or `staff_members` row.
6. Sign in again with Matt's PSI email code, open `/staff`, enroll a new TOTP
   authenticator and reach AAL2 before any workshop-wide records load.
7. Add a separate backup authenticator immediately and record completion of the
   recovery in the incident register.

## Administrative safeguards

- Keep the Supabase organization owner's own recovery method offline in
  PSI-controlled secure storage.
- Never send authenticator QR codes, manual keys, email codes or secret API keys
  through email, SMS, social messaging or support screenshots.
- Never perform factor deletion from the Expo client, GitHub Pages, Netlify or a
  browser bundle using a service-role key.
- Matt remains the only active PSI staff identity until a separately reviewed
  staff invitation and offboarding process is approved.
- Re-run the staff AAL1/AAL2 acceptance test after every recovery or factor
  replacement.
