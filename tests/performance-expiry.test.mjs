import assert from 'node:assert/strict';
import test from 'node:test';
import { performanceStatus } from '../mobile/src/lib/performance-status.ts';
import { fileLinkLifetime } from '../supabase/functions/open-vault-file/access-deadline.ts';
const now = Date.parse('2026-10-23T00:00:00Z');
const trial = { plan:'performance_plus', is_permanent:false, is_trial:true, expires_at:new Date(now + 1000).toISOString() };
test('trial changes at its exact deadline in an already open app', () => {
  assert.equal(performanceStatus(trial, now).label, 'TRIAL ACTIVE');
  assert.equal(performanceStatus(trial, now + 1000).label, 'FREE / EXPIRED');
  assert.equal(performanceStatus(trial, now + 1000).records, false);
});
test('paid, grace, cancelled renewal and permanent labels follow verified timed entitlement', () => {
  const paid = {...trial,is_trial:false};
  assert.equal(performanceStatus(paid, now).label,'ACTIVE');
  assert.equal(performanceStatus(paid, now+1000).active,false);
  assert.equal(performanceStatus({...paid,is_permanent:true,expires_at:null},now+1e12).label,'PERMANENT ACCESS');
  assert.equal(performanceStatus({...paid,expires_at:'invalid'},now).active,false);
  assert.equal(performanceStatus({...paid,expires_at:null},now).active,false);
  assert.equal(performanceStatus(null,now).label,'CHECKING ACCESS');
});
test('vehicle import survives expiry without pretending the account is permanent', () => {
  const imported = performanceStatus({...trial,history_import_access:true},now+1000);
  assert.equal(imported.active,false); assert.equal(imported.records,true); assert.equal(imported.permanent,false);
  assert.equal(performanceStatus({...trial,plan:'history_import',expires_at:null},now).records,true);
});
test('download links cannot extend a known deadline or use an invalid expiry', () => {
  assert.equal(fileLinkLifetime({expires_at:new Date(now+30000).toISOString()},now),29);
  assert.equal(fileLinkLifetime({expires_at:new Date(now+1000).toISOString()},now),0);
  assert.equal(fileLinkLifetime({expires_at:new Date(now-1000).toISOString()},now),0);
  assert.equal(fileLinkLifetime({expires_at:'invalid'},now),0);
  assert.equal(fileLinkLifetime({unlimited:true},now),60);
  assert.equal(fileLinkLifetime({expires_at:new Date(now+300000).toISOString()},now),60);
  assert.equal(fileLinkLifetime({expires_at:new Date(now+30000).toISOString(),server_time:new Date(now+10000).toISOString()},now),19);
});
