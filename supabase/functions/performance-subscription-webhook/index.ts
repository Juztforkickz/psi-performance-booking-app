import { adminClient, env, json, syncSubscription, uuid } from '../_shared/performance-subscription.ts';
import { rewardsProviderEvent } from '../_shared/rewards-paid-periods.ts';
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
    if (event.type !== 'TRANSFER') {
      const saved = await adminClient().rpc('ingest_rewards_provider_event', { p_customer_id: validIds[0], p_event: rewardsProviderEvent(event) });
      if (saved.error) throw new Error('rewards_paid_verification_retry');
    } else {
      const from = validIds.filter(id => event.transferred_from?.includes(id));
      for (const id of from) {
        const saved = await adminClient().rpc('record_rewards_identity_review', { p_customer_id: id,
          p_event_id: event.id, p_event_at: new Date(event.event_timestamp_ms).toISOString() });
        if (saved.error) throw new Error('rewards_paid_identity_review');
      }
    }
    for (const id of validIds) await syncSubscription(id);
    const supabaseUrl = env('SUPABASE_URL');
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
    if (supabaseUrl && serviceRoleKey) {
      await fetch(`${supabaseUrl}/functions/v1/process-push-notifications`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process_queue' }),
        signal: AbortSignal.timeout(10000),
      }).catch(() => undefined);
    }
    return json({ received: true });
  } catch { return json({ error: 'retry_subscription_sync' }, 503); }
});
