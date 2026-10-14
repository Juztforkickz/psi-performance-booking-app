import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.112.3";
import { cors, env, json, uuid } from "../_shared/xero-runtime.ts";
import {
  openXeroTokens,
  sealXeroTokens,
} from "../_shared/xero-token-crypto.ts";
import {
  parseXeroTokenSet,
  requestXeroTokenRefresh,
} from "../_shared/xero-token-refresh.ts";
import {
  allowFinancialWrite,
  cents,
  requireDepositScopes,
  selectBookingInvoice,
  verifyDepositInvoice,
  verifyStripeDeposit,
} from "../_shared/xero-deposit-policy.ts";

type Row = Record<string, any>;
// Account identities verified in the approved PSI reconciliation. No client supplied accounts.
const PSI = {
  tenant: "e0ed54cc-662b-4e45-9fdd-7de6b2d333cf",
  bank: "7394dff2-8bec-4937-8c53-c8b86a50fbd5",
  fees: "514",
  stripe: "7775d1d0-8593-4f87-855b-a35765300c11",
};
const now = () => new Date().toISOString();
async function access(admin: SupabaseClient) {
  if (env("XERO_TENANT_ID") !== PSI.tenant) {
    throw new Error("xero_organisation_requires_review");
  }
  const { data: claim, error } = await admin.rpc("claim_xero_refresh", {
    p_tenant_id: PSI.tenant,
  });
  if (error || !claim || !uuid(claim.lock_token)) {
    throw new Error("xero_refresh_busy");
  }
  let committed = false;
  try {
    const current = parseXeroTokenSet(
      await openXeroTokens(
        claim.sealed_tokens,
        PSI.tenant,
        env("XERO_TOKEN_ENCRYPTION_KEY"),
      ),
    );
    const refreshed = await requestXeroTokenRefresh(
      current.refresh_token,
      env("XERO_CLIENT_ID"),
      env("XERO_CLIENT_SECRET"),
    );
    const scope = refreshed.scope ?? current.scope;
    const sealed = await sealXeroTokens(
      { ...refreshed, scope, refreshed_at: now() },
      PSI.tenant,
      env("XERO_TOKEN_ENCRYPTION_KEY"),
    );
    const saved = await admin.rpc("commit_xero_refresh", {
      p_tenant_id: PSI.tenant,
      p_lock_token: claim.lock_token,
      p_expected_revision: Number(claim.revision),
      p_sealed_tokens: sealed,
    });
    if (saved.error) throw new Error("xero_refresh_conflict");
    committed = true;
    requireDepositScopes(scope);
    return refreshed.access_token;
  } finally {
    if (!committed) {
      await admin.rpc("release_xero_refresh", {
        p_tenant_id: PSI.tenant,
        p_lock_token: claim.lock_token,
      });
    }
  }
}
function xero(token: string) {
  return async (
    path: string,
    method = "GET",
    body?: Row,
    key?: string,
  ): Promise<Row> => {
    const response = await fetch(`https://api.xero.com/api.xro/2.0/${path}`, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${token}`,
        "xero-tenant-id": PSI.tenant,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(
        response.status === 403
          ? "xero_deposit_consent_required"
          : "xero_request_failed",
      );
    }
    if (!response.headers.get("content-type")?.includes("application/json")) {
      await response.body?.cancel();
      throw new Error("xero_invalid_response");
    }
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error("xero_response_too_large");
    const result = JSON.parse(text);
    if (!result || typeof result !== "object") {
      throw new Error("xero_invalid_response");
    }
    return result;
  };
}
type Xero = ReturnType<typeof xero>;
async function verifyAccounts(api: Xero) {
  const result = await api("Accounts");
  const bank = result.Accounts?.find((a: Row) => a.AccountID === PSI.bank);
  const fee = result.Accounts?.find((a: Row) => a.Code === PSI.fees);
  if (
    bank?.Type !== "BANK" || bank.Status !== "ACTIVE" ||
    bank.CurrencyCode !== "AUD" ||
    fee?.Status !== "ACTIVE" || fee.Type !== "EXPENSE" ||
    fee.TaxType !== "BASEXCLUDED"
  ) throw new Error("account_mapping_requires_review");
  const supplier = await api(`Contacts/${PSI.stripe}`);
  if (
    supplier.Contacts?.length !== 1 ||
    supplier.Contacts[0].ContactStatus !== "ACTIVE" ||
    supplier.Contacts[0].Name !== "Stripe"
  ) throw new Error("stripe_contact_requires_review");
}
async function save(admin: SupabaseClient, row: Row, values: Row) {
  const result = await admin.from("booking_xero_deposit_sync").update({
    ...values,
    updated_at: now(),
  })
    .eq("payment_attempt_id", row.payment_attempt_id).eq(
      "lease_token",
      row.lease_token,
    ).select("payment_attempt_id");
  if (result.error || result.data?.length !== 1) {
    throw new Error("deposit_lease_lost");
  }
  Object.assign(row, values);
}
async function write(
  admin: SupabaseClient,
  row: Row,
  operation: string,
  action: () => Promise<string>,
) {
  allowFinancialWrite(row.write_intents?.[operation]);
  await save(admin, row, {
    write_intents: { ...row.write_intents, [operation]: { started_at: now() } },
  });
  // Persist intent BEFORE transmission. Any uncertain result requires lookup or owner review.
  return await action();
}
async function stripe(attempt: Row) {
  if (
    !/^pi_[A-Za-z0-9]+$/u.test(attempt.provider_payment_id ?? "") ||
    !env("STRIPE_SECRET_KEY")
  ) throw new Error("stripe_configuration_required");
  const response = await fetch(
    `https://api.stripe.com/v1/payment_intents/${attempt.provider_payment_id}?expand[]=latest_charge.balance_transaction`,
    {
      headers: { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}` },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("stripe_verification_unavailable");
  }
  return verifyStripeDeposit(await response.json(), attempt);
}
async function processDeposit(admin: SupabaseClient, api: Xero, row: Row) {
  const { data: attempt, error } = await admin.from("booking_payment_attempts")
    .select("*").eq("id", row.payment_attempt_id).single();
  if (
    error || attempt.state !== "paid" || attempt.provider !== "stripe" ||
    attempt.currency !== "AUD" ||
    ![10000, 30000].includes(attempt.amount_cents)
  ) throw new Error("booking_payment_requires_review");
  const verified = await stripe(attempt);
  await save(admin, row, { fee_cents: verified.fee, net_cents: verified.net });
  const { data: booking } = await admin.from("booking_requests").select(
    "id,customer_id,vehicle_id,state",
  ).eq("id", attempt.booking_request_id).single();
  if (
    !booking || booking.customer_id !== attempt.customer_id ||
    !["confirmed", "completed"].includes(booking.state)
  ) throw new Error("booking_identity_requires_review");
  const { data: job } = await admin.from("workshop_jobs").select(
    "id,customer_id,vehicle_id",
  ).eq("booking_request_id", booking.id).maybeSingle();
  if (!job) {
    await save(admin, row, {
      status: "waiting_invoice",
      available_at: new Date(Date.now() + 300000).toISOString(),
      last_error: null,
    });
    return;
  }
  if (
    job.customer_id !== booking.customer_id ||
    job.vehicle_id !== booking.vehicle_id
  ) throw new Error("job_identity_requires_review");
  const {data: links,error: linkLookupError} = await admin.from('vault_import_queue')
    .select('id,source,source_key,status,job_id,record_id').eq('source','xero')
    .eq('status','imported').eq('job_id',job.id).limit(2);
  if (linkLookupError) throw new Error('invoice_lookup_failed');
  if (!links?.length) {
    await save(admin, row, {
      status: "waiting_invoice",
      available_at: new Date(Date.now() + 300000).toISOString(),
      last_error: null,
    });
    return;
  }
  if (links.length !== 1 || !uuid(links[0].record_id)) throw new Error('invoice_identity_requires_review');
  const recordLookup = await admin.from('vault_records')
    .select('id,job_id,customer_id,vehicle_id,kind,published_at').eq('id',links[0].record_id).maybeSingle();
  if (recordLookup.error) throw new Error('invoice_lookup_failed');
  const invoiceId = selectBookingInvoice(links,recordLookup.data,{tenantId:PSI.tenant,jobId:job.id,customerId:booking.customer_id,vehicleId:booking.vehicle_id});
  if (!invoiceId) throw new Error('invoice_identity_requires_review');
  const invoiceResponse = await api(`Invoices/${invoiceId}`);
  if (invoiceResponse.Invoices?.length !== 1) {
    throw new Error("invoice_identity_requires_review");
  }
  const invoice = invoiceResponse.Invoices[0];
  const contactId = invoice.Contact?.ContactID;
  if (!uuid(contactId)) throw new Error("contact_identity_requires_review");
  const { data: link, error: linkError } = await admin.rpc(
    "xero_customer_link_context",
    { p_tenant_id: PSI.tenant, p_contact_id: contactId },
  );
  if (linkError || link?.customer_id !== booking.customer_id) {
    throw new Error("verified_contact_link_required");
  }
  if (
    invoice.InvoiceID !== invoiceId || invoice.Type !== "ACCREC" ||
    invoice.CurrencyCode !== "AUD" ||
    !["AUTHORISED", "PAID"].includes(invoice.Status)
  ) throw new Error("invoice_identity_requires_review");
  await save(admin, row, { invoice_id: invoiceId });
  const reference = `PSI app deposit ${attempt.provider_payment_id}`;
  const paymentLookup = await api(
    `Payments?where=${encodeURIComponent(`Reference=="${reference}"`)}&page=1`,
  );
  const payments: Row[] = paymentLookup.Payments ?? [];
  if (payments.length > 1) throw new Error("duplicate_deposit_requires_review");
  let paymentId = row.payment_id;
  if (payments.length === 1) {
    const p = payments[0];
    if (
      p.Invoice?.InvoiceID !== invoiceId || p.Account?.AccountID !== PSI.bank ||
      cents(p.Amount) !== attempt.amount_cents ||
      p.Status !== "AUTHORISED" || !uuid(p.PaymentID)
    ) throw new Error("existing_payment_requires_review");
    if (paymentId && paymentId !== p.PaymentID) {
      throw new Error("existing_payment_requires_review");
    }
    paymentId = p.PaymentID;
    await save(admin, row, { payment_id: paymentId });
  } else {
    if (paymentId) throw new Error("stored_payment_missing_requires_review");
    // A matching amount already applied without PSI's reference may be a manual
    // deposit entry. Never add another credit until its identity is reviewed.
    if (
      invoice.Payments?.some((p: Row) =>
        cents(p.Amount) === attempt.amount_cents
      )
    ) throw new Error("possible_manual_deposit_requires_review");
    verifyDepositInvoice(invoice, contactId, attempt.amount_cents);
    paymentId = await write(admin, row, "payment", async () => {
      const result = await api("Payments", "PUT", {
        Payments: [{
          Invoice: { InvoiceID: invoiceId },
          Account: { AccountID: PSI.bank },
          Date: verified.paidDate,
          Amount: attempt.amount_cents / 100,
          Reference: reference,
        }],
      }, `psi-deposit-${attempt.id}`);
      const p = result.Payments?.[0];
      if (
        result.Payments?.length !== 1 || !uuid(p?.PaymentID) ||
        p.HasValidationErrors ||
        cents(p.Amount) !== attempt.amount_cents ||
        p.Invoice?.InvoiceID !== invoiceId
      ) throw new Error("payment_write_unverified");
      return p.PaymentID;
    });
    await save(admin, row, { payment_id: paymentId });
  }
  if (verified.fee > 0) {
    const feeLookup = await api(
      `BankTransactions?where=${
        encodeURIComponent(`Reference=="${attempt.provider_payment_id}"`)
      }&page=1`,
    );
    const fees: Row[] = feeLookup.BankTransactions ?? [];
    if (fees.length > 1) throw new Error("duplicate_fee_requires_review");
    if (fees.length === 1) {
      const f = fees[0];
      if (
        f.Type !== "SPEND" || f.Status !== "AUTHORISED" ||
        f.Contact?.ContactID !== PSI.stripe ||
        f.BankAccount?.AccountID !== PSI.bank ||
        cents(f.Total) !== verified.fee || !uuid(f.BankTransactionID) ||
        f.LineItems?.length !== 1 ||
        f.LineItems[0].AccountCode !== PSI.fees ||
        f.LineItems[0].TaxType !== "BASEXCLUDED"
      ) throw new Error("existing_fee_requires_review");
      if (
        row.fee_transaction_id && row.fee_transaction_id !== f.BankTransactionID
      ) throw new Error("existing_fee_requires_review");
      await save(admin, row, { fee_transaction_id: f.BankTransactionID });
    } else {
      if (row.fee_transaction_id) {
        throw new Error("stored_fee_missing_requires_review");
      }
      const feeId = await write(admin, row, "fee", async () => {
        const result = await api("BankTransactions", "PUT", {
          BankTransactions: [{
            Type: "SPEND",
            Contact: { ContactID: PSI.stripe },
            BankAccount: { AccountID: PSI.bank },
            Date: verified.paidDate,
            Reference: attempt.provider_payment_id,
            LineAmountTypes: "Inclusive",
            LineItems: [{
              Description:
                `Stripe processing fee for PSI booking deposit ${attempt.provider_payment_id}`,
              Quantity: 1,
              UnitAmount: verified.fee / 100,
              AccountCode: PSI.fees,
              TaxType: "BASEXCLUDED",
            }],
          }],
        }, `psi-deposit-fee-${attempt.id}`);
        const f = result.BankTransactions?.[0];
        if (
          result.BankTransactions?.length !== 1 ||
          !uuid(f?.BankTransactionID) || f.HasValidationErrors ||
          cents(f.Total) !== verified.fee
        ) throw new Error("fee_write_unverified");
        return f.BankTransactionID;
      });
      await save(admin, row, { fee_transaction_id: feeId });
    }
  }
  // Refresh current Xero balance and status. Duplicate protection retains an
  // existing workshop PC PDF instead of creating a second invoice record.
  const refreshed = await admin.from("vault_import_queue").update({
    status: "matched",
    available_at: now(),
    attempt_count: 0,
    last_error_code: null,
  })
    .eq("source", "xero").eq("source_key", `${PSI.tenant}:${invoiceId}`).eq(
      "job_id",
      job.id,
    ).eq("status", "imported").select("id");
  if (refreshed.error || refreshed.data?.length !== 1) {
    throw new Error("invoice_refresh_requires_review");
  }
  const imported = await admin.functions.invoke("process-xero-imports", {
    body: { action: "process_queue", queueId: refreshed.data[0].id, limit: 1 },
  });
  if (imported.error || imported.data?.results?.[0]?.status !== "imported") {
    throw new Error("invoice_refresh_requires_review");
  }
  await save(admin, row, { status: "synced", last_error: null });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  const body = await request.json().catch(() => ({}));
  if (!["status", "enable", "disable", "process_queue"].includes(body.action)) {
    return json({ error: "invalid_action" }, 400);
  }
  const admin = createClient(
    env("SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const token = (request.headers.get("Authorization") ?? "").replace(
    /^Bearer\s+/iu,
    "",
  );
  if (!token) return json({ error: "authentication_required" }, 401);
  let authorized = token === env("SUPABASE_SERVICE_ROLE_KEY");
  if (
    !authorized && body.action === "process_queue" &&
    typeof body.cronToken === "string"
  ) {
    const result = await admin.rpc("verify_service_reminder_cron_token", {
      p_token: body.cronToken,
    });
    authorized = !result.error && result.data === true;
  }
  if (!authorized) {
    const user = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const identity = await user.auth.getUser();
    const claims = await user.auth.getClaims(token);
    const staff = identity.data.user
      ? await user.from("staff_members").select("role,status").eq(
        "user_id",
        identity.data.user.id,
      ).maybeSingle()
      : null;
    if (
      !identity.data.user ||
      claims.data?.claims?.sub !== identity.data.user.id ||
      claims.data.claims.aal !== "aal2" ||
      staff?.data?.role !== "owner" || staff.data.status !== "active"
    ) return json({ error: "owner_aal2_required" }, 403);
  }
  const configuration = await admin.from("booking_xero_deposit_config").select(
    "*",
  ).eq("singleton", true).single();
  if (configuration.error) {
    return json({ error: "deposit_configuration_unavailable" }, 503);
  }
  if (body.action === "status") {
    const queue = await admin.from("booking_xero_deposit_sync").select(
      "status,last_error,updated_at",
    );
    return json({
      enabled: configuration.data.enabled,
      counts: (queue.data ?? []).reduce(
        (counts: Row, r: Row) => ({
          ...counts,
          [r.status]: (counts[r.status] ?? 0) + 1,
        }),
        {},
      ),
    });
  }
  if (body.action === "disable") {
    const disabled = await admin.from("booking_xero_deposit_config").update({
      enabled: false,
      updated_at: now(),
    }).eq("singleton", true);
    return json(
      disabled.error
        ? { error: "deposit_configuration_unavailable" }
        : { enabled: false },
    );
  }
  try {
    if (body.action === "process_queue" && !configuration.data.enabled) {
      return json({ enabled: false, processed: 0 });
    }
    const api = xero(await access(admin));
    await verifyAccounts(api);
    if (body.action === "enable") {
      const enabled = await admin.from("booking_xero_deposit_config").update({
        enabled: true,
        tenant_id: PSI.tenant,
        bank_account_id: PSI.bank,
        fee_account_code: PSI.fees,
        stripe_contact_id: PSI.stripe,
        updated_at: now(),
      }).eq("singleton", true);
      if (enabled.error) throw new Error("deposit_configuration_unavailable");
      return json({ enabled: true });
    }
    const due = await admin.from("booking_xero_deposit_sync").select(
      "payment_attempt_id",
    ).in("status", ["pending", "waiting_invoice", "failed"]).lte(
      "available_at",
      now(),
    ).order("available_at").limit(1);
    if (due.error) throw new Error("deposit_queue_unavailable");
    const results = [];
    for (const candidate of due.data ?? []) {
      const claim = await admin.rpc("claim_booking_xero_deposit", {
        p_id: candidate.payment_attempt_id,
      });
      if (claim.error || !claim.data) continue;
      const row = claim.data;
      try {
        await processDeposit(admin, api, row);
      } catch (error) {
        const code = error instanceof Error && /^[a-z_]+$/u.test(error.message)
          ? error.message
          : "deposit_sync_failed";
        const review = code.includes("review") ||
          code === "verified_contact_link_required" ||
          Object.keys(row.write_intents ?? {}).length > 0;
        await save(admin, row, {
          status: review ? "needs_review" : "failed",
          last_error: code,
          available_at: new Date(Date.now() + 3600000).toISOString(),
        });
      } finally {
        await save(admin, row, { lease_until: null, lease_token: null });
      }
      results.push({
        paymentAttemptId: row.payment_attempt_id,
        status: row.status,
      });
    }
    return json({ enabled: true, processed: results.length, results });
  } catch (error) {
    const code = error instanceof Error && /^[a-z_]+$/u.test(error.message)
      ? error.message
      : "deposit_sync_unavailable";
    return json({ error: code }, 503);
  }
});
