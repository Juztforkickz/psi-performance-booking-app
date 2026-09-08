import { adminClient, env, json, uuid } from '../_shared/performance-subscription.ts';
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
      source: 'xero', source_key: `${tenant}:${e.resourceId}:${e.eventDateUtc}:${e.eventType}`,
      identifiers: { tenantId: tenant, invoiceId: e.resourceId, eventType: e.eventType },
      reason: 'Fetch invoice and verify Xero contact, PSI customer and explicit workshop job before publishing.',
    }));
    if (rows.length) { const { error } = await adminClient().from('vault_import_queue').upsert(rows, { onConflict: 'source,source_key', ignoreDuplicates: true }); if (error) throw error; }
    return json({ received: true });
  } catch { return json({ error: 'retry_import_queue' }, 503); }
});
