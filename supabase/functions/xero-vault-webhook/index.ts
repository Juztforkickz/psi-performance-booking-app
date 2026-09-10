import { adminClient, env, json, uuid } from '../_shared/performance-subscription.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

function startImportWorker() {
  const supabaseUrl = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return;

  EdgeRuntime.waitUntil(
    fetch(`${supabaseUrl}/functions/v1/process-xero-imports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ limit: 10 }),
    })
      .then(response => response.body?.cancel())
      .catch(() => undefined),
  );
}

Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = env('XERO_WEBHOOK_SIGNING_KEY');
  const tenant = env('XERO_TENANT_ID');
  if (!secret || !tenant) return json({ error: 'xero_configuration_required' }, 503);
  const raw = new Uint8Array(await request.arrayBuffer());
  if (raw.byteLength > 262144) return json({ error: 'payload_too_large' }, 413);
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const signature = Uint8Array.from(atob(request.headers.get('x-xero-signature') ?? ''), c => c.charCodeAt(0));
    if (!await crypto.subtle.verify('HMAC', key, signature, raw)) return json({ error: 'invalid_signature' }, 401);
  } catch { return json({ error: 'invalid_signature' }, 401); }
  try {
    const payload = JSON.parse(new TextDecoder().decode(raw));
    if (!Array.isArray(payload.events) || payload.events.length > 100) return json({ error: 'invalid_events' }, 400);
    const rows = payload.events.filter((e: Record<string, unknown>) => e.tenantId === tenant && e.eventCategory === 'INVOICE' && uuid(e.resourceId)).map((e: Record<string, unknown>) => ({
      source: 'xero', source_key: `${tenant}:${e.resourceId}`,
      status: 'pending',
      identifiers: { tenantId: tenant, invoiceId: e.resourceId, eventDateUtc: e.eventDateUtc, eventType: e.eventType },
      reason: 'Queued for secure Xero invoice inspection.',
    }));
    if (rows.length) {
      const admin = adminClient();
      const { error } = await admin.from('vault_import_queue').upsert(rows, { onConflict: 'source,source_key', ignoreDuplicates: true });
      if (error) throw error;
      const refreshes = await Promise.all(rows.map(row => admin
        .from('vault_import_queue')
        .update({
          identifiers: row.identifiers,
          status: 'pending',
          reason: row.reason,
          attempt_count: 0,
          available_at: new Date().toISOString(),
          completed_at: null,
          last_error_code: null,
        })
        .eq('source', row.source)
        .eq('source_key', row.source_key)
        .neq('status', 'ignored')));
      if (refreshes.some(result => result.error)) throw new Error('xero_queue_refresh_failed');
      startImportWorker();
    }
    return json({ received: true });
  } catch { return json({ error: 'retry_import_queue' }, 503); }
});
