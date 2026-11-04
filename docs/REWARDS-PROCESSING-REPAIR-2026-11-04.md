# Rewards processing repair

Recent invoice rewards stopped before calculation because the trusted worker reads the financial policy with `FOR SHARE`, which requires UPDATE privilege on at least one column. The worker correctly has read access to financial policy and cannot edit its rules, so the lock fails with SQLSTATE 42501. The scheduler returning HTTP 200 only indicates that the request ran; held invoices have not earned points.

## Reviewed correction

The migration `20261104032435_rewards_policy_row_lock_permission.sql` grants the existing backend `service_role` UPDATE permission on the `singleton` key only. The primary key is nonnull and constrained to true, so it cannot change to another value. This satisfies PostgreSQL row locking without allowing changes to earning rates, activation, approval, expiry rules or financial policy. Table level UPDATE, INSERT and DELETE remain denied. Customer roles gain no privileges. RLS and all security invoker functions remain unchanged.

The migration checks the existing version 2 schema contract, immutable key constraints and absence of unexpected writers before proceeding. It is idempotent and changes no balances or membership identities. The original 24 October activation and separately authorised owner lifetime double Rewards remain intact.

## Validation

80 targeted tests passed, including an actual service role invoice calculation before and after the correction. The tests reproduce the old permission failure, then verify standard and double earning, duplicate invoice replay, refunds, policy write denial, immutable key protection, migration replay, existing balances and owner grants. A separate real PostgreSQL sandbox transaction passed seven row lock and policy protection assertions and rolled back every fixture.

The broader Rewards, Performance+ and Xero regression suite also passed all 245 tests, with zero failures or skipped checks.

## Production approval and recovery

Automatic approval review rejected the production migration because it grants a persistent production privilege and requires explicit approval of that exact security change. Production remains unchanged until that approval is received. A focused approval prompt has been sent to Matt.

After approval, verify that no previous migration or grant exists, apply the reviewed migration once and verify the resulting permissions and unchanged policy. Recover only the existing unfinished jobs held by the permission fault or transient Xero rate limiting, with a durable receipt of their previous state and a guard against concurrent processing. Keep missing ownership and ambiguous payment holds for staff review. The existing worker must fetch current Xero payment evidence and apply its existing atomic, duplicate safe calculations. Do not directly edit balances, manufacture payment evidence, replay activation or invoke the previously rejected financial smoke test.

Read back actual ledger entries, balances and remaining holds before reporting recovery complete. No phone release or customer action is required for this backend correction. Private invoice evidence and recovery receipts are kept outside Git.
