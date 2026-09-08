import { env, json, syncSubscription, uuid } from '../_shared/performance-subscription.ts';
Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const expected = env('REVENUECAT_WEBHOOK_AUTHORIZATION');
  if (!expected) return json({ error: 'configuration_required' }, 503);
  if (request.headers.get('Authorization') !== expected) return json({ error: 'invalid_authorization' }, 401);
  const raw = await request.text();
  if (raw.length > 65536) return json({ error: 'payload_too_large' }, 413);
  try {
    const event = JSON.parse(raw).event;
    if (event?.type === 'TEST') return json({ received: true });
    const ids = event?.type === 'TRANSFER' ? [...(event.transferred_from ?? []), ...(event.transferred_to ?? [])] : [event?.app_user_id];
    const validIds = [...new Set(ids.filter(uuid))] as string[];
    if (!validIds.length || validIds.length > 10) return json({ error: 'account_review_required' }, 422);
    for (const id of validIds) await syncSubscription(id);
    return json({ received: true });
  } catch { return json({ error: 'retry_subscription_sync' }, 503); }
});
