import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.3';
import { openXeroTokens, sealXeroTokens } from '../_shared/xero-token-crypto.ts';
import { xeroInvoiceReader } from '../_shared/xero-invoice-fetch.ts';
import { matchXeroInvoice, type VerifiedContactLink, type XeroInvoice } from '../_shared/xero-invoice-match.ts';
import { parseXeroTokenSet, requestXeroTokenRefresh } from '../_shared/xero-token-refresh.ts';

type QueueRow = {
  id: string;
  source_key: string;
  status: string;
  identifiers: Record<string, unknown>;
  job_id: string | null;
  attempt_count: number;
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const env = (name: string) => Deno.env.get(name)?.trim() ?? '';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
const errorCode = (value: unknown) => ((value instanceof Error ? value.message : String(value ?? 'xero_import_failed')).toLowerCase().replace(/[^a-z0-9_-]+/gu, '_').replace(/^_+|_+$/gu, '') || 'xero_import_failed').slice(0, 160);

function invoiceDate(invoice: XeroInvoice) {
  const candidate = invoice.DateString ?? invoice.Date ?? '';
  const match = candidate.match(/^\d{4}-\d{2}-\d{2}/u);
  if (!match) throw new Error('xero_invoice_date_requires_review');
  return match[0];
}

function invoiceAmountCents(invoice: XeroInvoice) {
  if (!Number.isFinite(invoice.Total) || Number(invoice.Total) < 0) throw new Error('xero_invoice_total_requires_review');
  const cents = Math.round(Number(invoice.Total) * 100);
  if (!Number.isSafeInteger(cents) || cents > 2147483647) throw new Error('xero_invoice_total_requires_review');
  return cents;
}

const hexDigest = async (bytes: Uint8Array) => Array.from(
  new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
  byte => byte.toString(16).padStart(2, '0'),
).join('');

async function refreshedAccess(admin: SupabaseClient, tenantId: string) {
  const encryptionKey = env('XERO_TOKEN_ENCRYPTION_KEY');
  const clientId = env('XERO_CLIENT_ID');
  const clientSecret = env('XERO_CLIENT_SECRET');
  if (!encryptionKey || !clientId || !clientSecret) throw new Error('xero_refresh_configuration_required');

  const { data: claim, error: claimError } = await admin.rpc('claim_xero_refresh', { p_tenant_id: tenantId });
  if (claimError || !claim || !uuid(claim.lock_token) || !Number.isFinite(Number(claim.revision)) || typeof claim.sealed_tokens !== 'string') {
    throw new Error(errorCode(claimError ?? 'xero_refresh_claim_failed'));
  }
  let committed = false;
  try {
    const current = parseXeroTokenSet(await openXeroTokens(claim.sealed_tokens, tenantId, encryptionKey));
    const refreshed = await requestXeroTokenRefresh(current.refresh_token, clientId, clientSecret);
    const sealed = await sealXeroTokens({ ...refreshed, refreshed_at: new Date().toISOString() }, tenantId, encryptionKey);
    const { error: commitError } = await admin.rpc('commit_xero_refresh', {
      p_tenant_id: tenantId,
      p_lock_token: claim.lock_token,
      p_expected_revision: Number(claim.revision),
      p_sealed_tokens: sealed,
    });
    if (commitError) throw new Error('xero_refresh_conflict');
    committed = true;
    return { accessToken: refreshed.access_token, ownerId: String(claim.owner_id) };
  } finally {
    if (!committed) await admin.rpc('release_xero_refresh', { p_tenant_id: tenantId, p_lock_token: claim.lock_token });
  }
}

async function setQueue(admin: SupabaseClient, id: string, values: Record<string, unknown>) {
  const { error } = await admin.from('vault_import_queue').update(values).eq('id', id);
  if (error) throw new Error('xero_queue_update_failed');
}

async function importInvoice(admin: SupabaseClient, queued: QueueRow) {
  const tenantId = queued.identifiers.tenantId;
  const invoiceId = queued.identifiers.invoiceId;
  if (!uuid(tenantId) || !uuid(invoiceId)) throw new Error('xero_queue_identity_invalid');

  const { accessToken, ownerId } = await refreshedAccess(admin, tenantId);
  const reader = xeroInvoiceReader(accessToken, tenantId);
  const invoice = await reader.invoice(invoiceId);
  const contactId = invoice.Contact?.ContactID;
  const reference = typeof invoice.Reference === 'string' ? invoice.Reference.trim().toUpperCase() : '';
  const enriched = {
    ...queued.identifiers,
    tenantId,
    invoiceId,
    contactId: uuid(contactId) ? contactId : null,
    contactName: typeof invoice.Contact?.Name === 'string' ? invoice.Contact.Name.slice(0, 160) : null,
    reference,
    invoiceNumber: typeof invoice.InvoiceNumber === 'string' ? invoice.InvoiceNumber.slice(0, 120) : null,
    invoiceDate: invoiceDate(invoice),
    totalCents: invoiceAmountCents(invoice),
    currency: invoice.CurrencyCode ?? null,
    invoiceStatus: invoice.Status ?? null,
  };

  const { data: linked, error: linkError } = uuid(contactId)
    ? await admin.rpc('xero_customer_link_context', { p_tenant_id: tenantId, p_contact_id: contactId })
    : { data: null, error: null };
  if (linkError) throw new Error('xero_customer_link_unavailable');
  const links = linked && typeof linked === 'object' && uuid(linked.customer_id) ? [linked as VerifiedContactLink] : [];

  let jobsQuery = admin.from('workshop_jobs').select('id,reference,customer_id,vehicle_id').eq('reference', reference);
  if (queued.job_id) jobsQuery = jobsQuery.eq('id', queued.job_id);
  const { data: jobs, error: jobsError } = await jobsQuery.limit(2);
  if (jobsError) throw new Error('xero_job_lookup_failed');
  const vehicleIds = [...new Set((jobs ?? []).map(job => job.vehicle_id).filter(uuid))];
  const { data: vehicles, error: vehiclesError } = vehicleIds.length
    ? await admin.from('customer_vehicles').select('id,customer_id,archived_at').in('id', vehicleIds)
    : { data: [], error: null };
  if (vehiclesError) throw new Error('xero_vehicle_lookup_failed');
  const customerIds = [...new Set(links.map(link => link.customer_id))];
  const { data: activeCustomers, error: customerError } = customerIds.length
    ? await admin.from('customer_profiles').select('user_id').in('user_id', customerIds).eq('account_state', 'active')
    : { data: [], error: null };
  if (customerError) throw new Error('xero_customer_lookup_failed');

  const matched = matchXeroInvoice({
    tenantId,
    expectedTenantId: tenantId,
    expectedInvoiceId: invoiceId,
    invoice,
    links,
    jobs: jobs ?? [],
    vehicles: vehicles ?? [],
    activeCustomerIds: (activeCustomers ?? []).map(customer => customer.user_id),
  });
  if (matched.status === 'needs_review') {
    await setQueue(admin, queued.id, {
      status: 'needs_review', identifiers: enriched, reason: matched.reason,
      completed_at: null, last_error_code: null,
    });
    return { id: queued.id, status: 'needs_review', reason: matched.reason };
  }

  const sourceReference = matched.sourceReference;
  const { data: existing, error: existingError } = await admin.from('vault_records').select('id,published_at').eq('source', 'xero').eq('source_reference', sourceReference).maybeSingle();
  if (existingError) throw new Error('xero_record_lookup_failed');
  if (existing?.published_at) {
    await setQueue(admin, queued.id, { status: 'imported', job_id: matched.jobId, record_id: existing.id, identifiers: enriched, reason: 'Invoice already imported.', completed_at: new Date().toISOString(), last_error_code: null });
    return { id: queued.id, status: 'imported', recordId: existing.id };
  }

  const pdf = await reader.pdf(invoiceId);
  const sha256 = await hexDigest(pdf);
  const recordId = existing?.id ?? crypto.randomUUID();
  const invoiceNumber = typeof invoice.InvoiceNumber === 'string' && invoice.InvoiceNumber.trim() ? invoice.InvoiceNumber.trim().slice(0, 120) : invoiceId.slice(0, 8).toUpperCase();
  if (!existing) {
    const { error: recordError } = await admin.from('vault_records').insert({
      id: recordId,
      job_id: matched.jobId,
      customer_id: matched.customerId,
      vehicle_id: matched.vehicleId,
      kind: 'invoice',
      title: `Xero invoice ${invoiceNumber}`,
      notes: 'Original Xero invoice imported after protected customer, vehicle and PSI job verification.',
      occurred_on: invoiceDate(invoice),
      amount_cents: invoiceAmountCents(invoice),
      currency: 'AUD',
      created_by: uuid(links[0]?.verified_by) ? links[0].verified_by : uuid(ownerId) ? ownerId : null,
      source: 'xero',
      source_reference: sourceReference,
    });
    if (recordError) throw new Error('xero_record_create_failed');
  }

  const { data: currentAsset, error: assetLookupError } = await admin.from('vault_assets').select('id,object_path').eq('record_id', recordId).eq('sha256', sha256).maybeSingle();
  if (assetLookupError) throw new Error('xero_asset_lookup_failed');
  const assetId = currentAsset?.id ?? crypto.randomUUID();
  const objectPath = currentAsset?.object_path ?? `${matched.customerId}/${matched.vehicleId}/${recordId}/${assetId}/original.pdf`;
  if (!currentAsset) {
    const { error: assetError } = await admin.from('vault_assets').insert({
      id: assetId,
      record_id: recordId,
      customer_id: matched.customerId,
      vehicle_id: matched.vehicleId,
      object_path: objectPath,
      mime_type: 'application/pdf',
      size_bytes: pdf.byteLength,
      sha256,
      caption: `Original Xero invoice ${invoiceNumber}`.slice(0, 300),
      ready: false,
      created_by: uuid(links[0]?.verified_by) ? links[0].verified_by : uuid(ownerId) ? ownerId : null,
    });
    if (assetError) throw new Error('xero_asset_create_failed');
  }
  const upload = await admin.storage.from('performance-vault').upload(objectPath, pdf, { contentType: 'application/pdf', cacheControl: '0', upsert: true });
  if (upload.error) throw new Error('xero_pdf_storage_failed');
  const assetReady = await admin.from('vault_assets').update({ ready: true }).eq('id', assetId);
  if (assetReady.error) throw new Error('xero_asset_publish_failed');
  const recordReady = await admin.from('vault_records').update({ published_at: new Date().toISOString() }).eq('id', recordId);
  if (recordReady.error) throw new Error('xero_record_publish_failed');

  await setQueue(admin, queued.id, {
    status: 'imported', job_id: matched.jobId, record_id: recordId,
    identifiers: enriched, reason: 'Original invoice PDF imported and published to the verified vehicle.',
    completed_at: new Date().toISOString(), last_error_code: null,
  });
  return { id: queued.id, status: 'imported', recordId };
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const supabaseUrl = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = env('SUPABASE_ANON_KEY');
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/iu, '');
  if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ error: 'server_configuration_unavailable' }, 503);
  if (!token) return json({ error: 'authentication_required' }, 401);

  if (token !== serviceRoleKey) {
    const user = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: identity } = await user.auth.getUser(token);
    if (!identity.user) return json({ error: 'owner_aal2_required' }, 403);
    const [{ data: claims }, { data: staff }] = await Promise.all([
      user.auth.getClaims(token),
      user.from('staff_members').select('role,status').eq('user_id', identity.user.id).maybeSingle(),
    ]);
    if (claims?.claims?.sub !== identity.user.id || claims.claims.aal !== 'aal2' || staff?.role !== 'owner' || staff.status !== 'active') {
      return json({ error: 'owner_aal2_required' }, 403);
    }
  }

  let body: { queueId?: unknown; limit?: unknown } = {};
  try { body = await request.json(); } catch { body = {}; }
  if (body.queueId !== undefined && !uuid(body.queueId)) return json({ error: 'invalid_queue_id' }, 400);
  const limit = Math.min(10, Math.max(1, typeof body.limit === 'number' && Number.isFinite(body.limit) ? Math.trunc(body.limit) : 5));
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let query = admin.from('vault_import_queue').select('id,source_key,status,identifiers,job_id,attempt_count').eq('source', 'xero').in('status', ['pending','matched','failed']).lte('available_at', new Date().toISOString()).lt('attempt_count', 20).order('created_at').limit(limit);
  if (body.queueId) query = query.eq('id', body.queueId);
  const { data: queued, error: queueError } = await query;
  if (queueError) return json({ error: 'xero_queue_unavailable' }, 500);

  const results = [];
  for (const candidate of (queued ?? []) as QueueRow[]) {
    const { data: claimed, error: claimError } = await admin.from('vault_import_queue').update({
      status: 'processing', attempt_count: candidate.attempt_count + 1,
      last_attempt_at: new Date().toISOString(), last_error_code: null,
    }).eq('id', candidate.id).eq('status', candidate.status).select('id,source_key,status,identifiers,job_id,attempt_count').maybeSingle();
    if (claimError || !claimed) continue;
    try {
      results.push(await importInvoice(admin, claimed as QueueRow));
    } catch (error) {
      const code = errorCode(error);
      const delay = Math.min(60, 2 ** Math.min(5, Number(claimed.attempt_count))) * 60_000;
      await setQueue(admin, claimed.id, { status: 'failed', reason: 'Secure Xero import will retry. Open the item if owner review is requested.', last_error_code: code, available_at: new Date(Date.now() + delay).toISOString() });
      results.push({ id: claimed.id, status: 'failed', errorCode: code });
    }
  }
  return json({ processed: results.length, results });
});
