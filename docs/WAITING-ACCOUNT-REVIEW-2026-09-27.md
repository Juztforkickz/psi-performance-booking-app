# Clear waiting account review

Luke's INV-1615 was checked again in production on 27 September 2026. It is published against 1TX4SZ, has one ready PDF, and the customer account and production Performance+ access are active. Authorised PSI staff can read the record. Luke's physical device was not inspected.

The confusing waiting entry belongs to Vince Tavete, invoice INV-1640, reference VZ OVERHAUL TYC767. It is intentionally waiting for an account match and is separate from Luke's completed import.

`StaffVaultReview` now has two tabs. Review & drafts is selected initially. Waiting for account holds the private waiting list and explains automatic syncing after a secure account and vehicle match, with no owner alerts or duplicate uploads needed. Its cards display contact name, invoice number, job reference, AUD total and paid state when available. Internal tenant and invoice IDs are not rendered. Missing metadata has an explicit readable fallback.

No database, invoice matching, notification scheduling or customer access rules changed. The tab controls wrap on narrow screens and have a minimum 48 point touch height.

Checkpoint: `e0b5a8e8ce96a177acf70368f2a5df518d147930`.

Validation: mobile TypeScript and lint passed. All 48 targeted staff workflow and Xero matching tests passed, including switching tabs, hiding internal IDs and keeping waiting files away from manual import actions. GitHub deployment `36320637537` succeeded. Existing Expo public OTA workflow: `01a0e2ef-a899-7b77-a62e-6cd3428b6003`.

Rollback: the previous public OTA group is `7229d545-8f3a-47f3-ab15-46512279e4d2`. Keep the existing release workflow and channel when reverting a display regression.

Public publication succeeded: update group 868b4d93-fb34-491e-96a3-c094e316a280, iOS update 01a0e2f3-2271-7f17-9bf3-7cedea4ceb71. The public app-store-release endpoint returned HTTP 200 and the exact update ID for runtime 1.0.0-app-store-release-1.
