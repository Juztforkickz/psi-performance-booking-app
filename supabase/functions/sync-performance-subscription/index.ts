import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { cors, env, json, syncSubscription } from '../_shared/performance-subscription.ts';
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token) return json({ error: 'authentication_required' }, 401);
  const userClient = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) return json({ error: 'invalid_session' }, 401);
  try { return json(await syncSubscription(data.user.id)); }
  catch { return json({ error: 'subscription_verification_unavailable' }, 503); }
});
