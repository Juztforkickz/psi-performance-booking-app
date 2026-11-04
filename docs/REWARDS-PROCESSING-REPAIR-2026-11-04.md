# Rewards processing repair

Recent invoice rewards stopped before calculation because the trusted worker reads the financial policy with `FOR SHARE`, which requires UPDATE privilege on at least one column. The worker correctly has read access to financial policy and cannot edit its rules, so the lock fails with SQLSTATE 42501. The scheduler returning HTTP 200 only indicates that the request ran; held invoices have not earned points.

Live recovery also revealed a missing backend read grant for the previously verified Xero customer links. The complete permission test now starts from production's actual permissions, reproduces both failures, applies both corrections and exercises the trusted worker role through successful calculation.

Recovery of invoices containing advance payments exposed another adapter defect: only AUTHORISED advances were accepted, while Xero also uses PAID for fully allocated prepayments and overpayments. The adapter now accepts both documented states and continues verifying receipt identity, original accounting date, currency, allocation and capacity. Voided, deleted, wrong owner and overallocated advances remain rejected. See the [official Xero Accounting schema](https://github.com/XeroAPI/Xero-OpenAPI/blob/master/xero_accounting.yaml).

The worker now retains the original provider error on its retry record when missing receipt totals would otherwise mask it. Standard points remain committed independently of unresolved bonus proof. Existing award calculations, financial rates and activation are unchanged.

## Reviewed correction

The migration `20261104032435_rewards_policy_row_lock_permission.sql` grants the existing backend `service_role` UPDATE permission on the `singleton` key only. The primary key is nonnull and constrained to true, so it cannot change to another value. This satisfies PostgreSQL row locking without allowing changes to earning rates, activation, approval, expiry rules or financial policy. Table level UPDATE, INSERT and DELETE remain denied. Customer roles gain no privileges. RLS and all security invoker functions remain unchanged.

The migration checks the existing version 2 schema contract, immutable key constraints and absence of unexpected writers before proceeding. It is idempotent and changes no balances or membership identities. The original 24 October activation and separately authorised owner lifetime double Rewards remain intact.

The second migration, `20261104034155_rewards_verified_customer_link_read.sql`, permits backend reads of only the five existing identity and verification columns used by the calculation. It grants no link writes or customer reads. It also enables RLS on this previously owner restricted private table as a second access boundary. No customer link or account is created or modified.

## Validation

80 targeted tests passed, including an actual service role invoice calculation before and after the correction. The tests reproduce the old permission failure, then verify standard and double earning, duplicate invoice replay, refunds, policy write denial, immutable key protection, migration replay, existing balances and owner grants. A separate real PostgreSQL sandbox transaction passed seven row lock and policy protection assertions and rolled back every fixture.

The final Rewards, Performance+ and Xero regression suite passed all 250 tests, with zero failures or skipped checks. This includes queue recovery tests for audit, duplicate recovery, changed revisions, active leases and ownership holds, plus paid prepayment and overpayment evidence and original provider error preservation.

## Production approval and recovery

Matt clarified the staff access misunderstanding and approved proceeding with the backend repair for all customers. The supported production migration applications succeeded, at remote versions `20261104033450` and `20261104034348`. Actual worker role checks confirm the policy lock and verified identity read now work. The financial policy, original activation, existing ledger entries and membership identities are preserved.

Nineteen existing unfinished jobs held by the permission fault or transient Xero rate limiting were requeued once, with saved previous states and 19 system audit entries. The recovery helper compares saved revisions and retry state, skips active leases and settled jobs, and refuses another reset for the same audit batch. Missing ownership and ambiguous payment holds stay for staff review. The normal existing scheduler fetches current Xero evidence and applies the established atomic, duplicate safe calculation. No balances are directly edited, no payment evidence is manufactured and no activation is replayed.

Read back actual ledger entries, balances and remaining holds before reporting recovery complete. No phone release or customer action is required for this backend correction. Private invoice evidence and recovery receipts are kept outside Git.

The corrected existing invoice worker was deployed as version 6 with JWT verification retained, and all eleven delivered files were read back and matched. It runs on the existing five minute schedule. No manual dispatcher or synthetic transaction was used to validate it.

A manual dispatcher attempt was rejected by automatic approval review because it could process the broader live queue. It was not executed or retried through another route. Recovery continues through the normal existing five minute scheduler, which has already produced a genuine paid invoice award. No synthetic financial test or test points were created.
