import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { cors, env, json, uuid } from '../_shared/xero-runtime.ts';
import { rewardsXeroAccess } from '../_shared/rewards-xero.ts';
import { xeroInvoiceReader } from '../_shared/xero-invoice-fetch.ts';
import { rewardsInvoiceSnapshot, type RewardsInvoice } from '../_shared/rewards-policy.ts';
import { rewardsPaymentFacts, rewardsPaymentReader, type RewardsPaymentFact } from '../_shared/rewards-payments.ts';
import { syncSubscription } from '../_shared/performance-subscription.ts';

type QueueRow = { tenant_id: string; invoice_id: string; revision: number; lease_token: string; attempts: number };
const safeError = (value: unknown) => value instanceof Error && /^[a-z0-9_]{1,100}$/u.test(value.message) ? value.message : 'rewards_sync_retry_required';

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/iu, '');
  if (!token) return json({ error: 'authentication_required' }, 401);
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
  const body = await request.json().catch(() => ({}));
  if (token !== env('SUPABASE_SERVICE_ROLE_KEY')) {
    const verified = typeof body.cronToken === 'string'
      ? await admin.rpc('verify_service_reminder_cron_token', { p_token: body.cronToken }) : null;
    if (verified?.data !== true) return json({ error: 'scheduler_authentication_required' }, 403);
  }
  const { data: config, error: configError } = await admin.from('rewards_config').select('*').eq('singleton', true).single();
  if (configError) return json({ error: 'rewards_configuration_unavailable' }, 503);
  if (!config.enabled) return json({ enabled: false, processed: 0 });
  const runtime = await admin.rpc('rewards_bonus_runtime_config');
  if (runtime.error || runtime.data?.implemented !== true) return json({ error: 'rewards_bonus_migration_required' }, 503);
  const retries = await admin.rpc('rewards_provider_retry_customers');
  if (retries.error) return json({ error: 'rewards_paid_verification_retry' }, 503);
  const providerResults = [];
  for (const customer of retries.data ?? []) {
    try { await syncSubscription(customer); providerResults.push({ status: 'verified' }); }
    catch { await admin.rpc('defer_rewards_provider_events', { p_customer_id: customer }); providerResults.push({ status: 'pending' }); }
  }
  const { data, error } = await admin.rpc('claim_rewards_invoices', { p_limit: 5 });
  if (error) return json({ error: 'rewards_queue_unavailable' }, 503);
  const results: { invoiceId: string; status: string; error?: string }[] = [];
  let access: string | null = null;
  for (const row of (data ?? []) as QueueRow[]) {
    try {
      if (row.tenant_id !== config.tenant_id || !uuid(row.invoice_id)) throw new Error('rewards_organisation_requires_review');
      access ??= await rewardsXeroAccess(admin, row.tenant_id);
      const invoice = await xeroInvoiceReader(access, row.tenant_id).invoice(row.invoice_id) as RewardsInvoice;
      const snapshot = rewardsInvoiceSnapshot(invoice, config.starts_on);
      if (!snapshot.excluded) {
        if (!uuid(invoice.Contact?.ContactID)) throw new Error('verified_rewards_customer_required');
        let facts: RewardsPaymentFact[] = []; let evidenceError: string | null = null;
        if (runtime.data.has_activated && snapshot.eligibleCents > 0) {
          try { facts = await rewardsPaymentFacts(invoice, rewardsPaymentReader(access, row.tenant_id)); }
          catch (error) { evidenceError = safeError(error); }
        }
        const { data: applied, error: applyError } = await admin.rpc('apply_rewards_invoice_v2', {
          p_tenant_id: row.tenant_id, p_invoice_id: row.invoice_id, p_contact_id: invoice.Contact.ContactID,
          p_invoice_number: snapshot.invoiceNumber, p_provider_updated_at: snapshot.providerUpdatedAt,
          p_paid_on: snapshot.paidOn, p_eligible_cents: snapshot.eligibleCents,
          p_redeemed_points: snapshot.redeemedPoints, p_facts: facts, p_evidence_error: evidenceError,
        });
        if (applyError) throw new Error(safeError(new Error(applyError.message)));
        // Standard points are already committed safely. Keep only the unresolved
        // bonus evidence on the bounded retry path, without replaying base credit.
        if (typeof applied?.pending === 'string') throw new Error(applied.pending);
      }
      const saved = await admin.from('rewards_invoice_queue').update({ processed_revision: row.revision, lease_token: null, lease_until: null, last_error: null })
        .eq('tenant_id', row.tenant_id).eq('invoice_id', row.invoice_id).eq('lease_token', row.lease_token).select('invoice_id');
      if (saved.error || saved.data?.length !== 1) throw new Error('rewards_lease_lost');
      results.push({ invoiceId: row.invoice_id, status: snapshot.excluded ? 'excluded' : 'synced' });
    } catch (error) {
      const code = safeError(error);
      await admin.from('rewards_invoice_queue').update({ last_error: code, lease_token: null, lease_until: null,
        available_at: new Date(Date.now() + Math.min(3600, 60 * 2 ** Math.min(row.attempts, 5)) * 1000).toISOString() })
        .eq('tenant_id', row.tenant_id).eq('invoice_id', row.invoice_id).eq('lease_token', row.lease_token);
      results.push({ invoiceId: row.invoice_id, status: 'held', error: code });
    }
  }
  return json({ enabled: true, processed: results.length, results, providerResults });
});
