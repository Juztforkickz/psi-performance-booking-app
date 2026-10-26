import assert from 'node:assert/strict';
import test from 'node:test';
import { createAndroidUpdateController } from '../mobile/src/lib/android-update-controller.ts';

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a;reject=b; }); return {promise,resolve,reject}; };
function harness(options={}) {
  let time=1000_000,attempt=options.attempt??null;
  const calls={check:0,fetch:0,reload:0,writes:0};
  const controller=createAndroidUpdateController({ enabled:true,runningId:'running',now:()=>time,
    check:async()=>{calls.check++;return options.check?options.check():{isAvailable:true};},
    fetch:async()=>{calls.fetch++;return options.fetch?options.fetch():{isNew:true,manifest:{id:'new-release'}};},
    reload:async()=>{calls.reload++;if(options.reload)await options.reload();},
    readAttempt:async()=>attempt,writeAttempt:async value=>{calls.writes++;if(options.write)await options.write(value);attempt=value;},
    ...options.adapter,
  });
  return {controller,calls,advance(ms){time+=ms;},get attempt(){return attempt;}};
}
test('disabled or isolated builds make no update or storage calls',async()=>{
  const h=harness({adapter:{enabled:false}});await h.controller.check(true);await h.controller.apply(()=>true);
  assert.equal(h.controller.getSnapshot().phase,'disabled');assert.deepEqual(h.calls,{check:0,fetch:0,reload:0,writes:0});
});
test('concurrent launch, resume and manual checks share one network operation',async()=>{
  const wait=deferred();const h=harness({check:()=>wait.promise});
  const a=h.controller.check(),b=h.controller.check(true);assert.equal(a,b);assert.equal(h.calls.check,1);
  wait.resolve({isAvailable:true});await a;assert.equal(h.calls.fetch,1);assert.equal(h.calls.reload,0);assert.equal(h.controller.getSnapshot().phase,'ready');
});
test('a current release never downloads or restarts',async()=>{
  const h=harness({check:async()=>({isAvailable:false})});await h.controller.check();await h.controller.apply(()=>true);
  assert.equal(h.controller.getSnapshot().phase,'current');assert.equal(h.calls.fetch,0);assert.equal(h.calls.reload,0);
});
test('a downloaded update restarts automatically only inside the allowed startup window',async()=>{
  const h=harness();await h.controller.check();assert.equal(h.calls.reload,0);
  await h.controller.apply(()=>true);assert.equal(h.calls.reload,1);assert.equal(JSON.parse(h.attempt).id,'new-release');
});
test('downloads completed during a booking stay ready without restarting it',async()=>{
  const wait=deferred();const h=harness({fetch:()=>wait.promise});const request=h.controller.check();await Promise.resolve();
  wait.resolve({isNew:true,manifest:{id:'new-release'}});await request;await h.controller.apply(()=>false);
  assert.equal(h.controller.getSnapshot().phase,'ready');assert.equal(h.calls.reload,0);assert.equal(h.calls.writes,0);
});
test('network and download failures preserve a usable app and can retry',async()=>{
  for(const stage of ['check','fetch']){
    let fail=true;const options={};options[stage]=async()=>{if(fail)throw Error('private URL must never be displayed');return stage==='check'?{isAvailable:true}:{isNew:true,manifest:{id:'new-release'}};};
    const h=harness(options);await h.controller.check();assert.equal(h.controller.getSnapshot().phase,'error');assert.equal(h.calls.reload,0);
    assert.equal(h.controller.getSnapshot().error,'update_connection_or_download_failed');fail=false;await h.controller.check(true);assert.equal(h.controller.getSnapshot().phase,'ready');
  }
});
test('previous native launch failures are reported without bypassing quarantine',async()=>{
  const h=harness({check:async()=>({isAvailable:false,reason:'updatePreviouslyFailed'})});await h.controller.check(true);
  assert.equal(h.controller.getSnapshot().error,'update_requires_review');assert.equal(h.calls.fetch,0);assert.equal(h.calls.reload,0);
});
test('native selection rejection is not reported as successfully current',async()=>{
  const h=harness({check:async()=>({isAvailable:false,reason:'updateRejectedBySelectionPolicy'})});await h.controller.check();
  assert.equal(h.controller.getSnapshot().phase,'error');
});
test('a fetch resolving to the running release does not reload in a loop',async()=>{
  const h=harness({fetch:async()=>({isNew:true,manifest:{id:'running'}})});await h.controller.check();await h.controller.apply(()=>true);
  assert.equal(h.controller.getSnapshot().phase,'current');assert.equal(h.calls.reload,0);
});
test('native signed rollback instructions retain their normal validation path',async()=>{
  const h=harness({check:async()=>({isAvailable:false,isRollBackToEmbedded:true}),fetch:async()=>({isNew:false,isRollBackToEmbedded:true})});
  await h.controller.check();assert.equal(h.controller.getSnapshot().pendingId,'embedded');await h.controller.apply(()=>true);assert.equal(h.calls.reload,1);
});
test('resume checks are throttled but later automatic checks and explicit retries work',async()=>{
  const h=harness({check:async()=>({isAvailable:false})});await h.controller.check();await h.controller.check();assert.equal(h.calls.check,1);
  h.advance(120001);await h.controller.check();assert.equal(h.calls.check,2);await h.controller.check(true);assert.equal(h.calls.check,3);
});
test('downloaded releases do not repeatedly download on foreground events',async()=>{
  const h=harness();await h.controller.check();h.advance(600000);await h.controller.check(true);assert.equal(h.calls.fetch,1);
});
test('a form becoming active while the restart marker is saved prevents reload',async()=>{
  let allowed=true;const h=harness({write:async()=>{allowed=false;}});await h.controller.check();await h.controller.apply(()=>allowed);
  assert.equal(h.calls.reload,0);assert.equal(h.controller.getSnapshot().phase,'ready');
});
test('a persisted recent restart attempt prevents repeated crash restart loops',async()=>{
  const h=harness({attempt:JSON.stringify({id:'new-release',at:999999})});await h.controller.check();await h.controller.apply(()=>true);
  assert.equal(h.calls.reload,0);assert.equal(h.controller.getSnapshot().error,'update_restart_requires_review');
});
test('a different new release can recover from a previous failed release attempt',async()=>{
  const h=harness({attempt:JSON.stringify({id:'older-release',at:999999})});await h.controller.check();await h.controller.apply(()=>true);assert.equal(h.calls.reload,1);
});
test('failed persistence or native reload is visible without deleting customer storage',async()=>{
  for(const stage of ['write','reload']){const h=harness({[stage]:async()=>{throw Error('failure');}});await h.controller.check();await h.controller.apply(()=>true);
    assert.equal(h.controller.getSnapshot().error,'update_restart_failed');assert.equal(h.calls.writes,1);assert.equal(h.calls.reload,stage==='write'?0:1);}
});
test('concurrent restart requests are coalesced',async()=>{
  const wait=deferred();const h=harness({reload:()=>wait.promise});await h.controller.check();const a=h.controller.apply(()=>true),b=h.controller.apply(()=>true);
  assert.equal(a,b);wait.resolve();await a;assert.equal(h.calls.reload,1);assert.equal(h.calls.writes,1);
});
test('status subscriptions receive transitions and unsubscribe cleanly',async()=>{
  const h=harness();const phases=[];const stop=h.controller.subscribe(()=>phases.push(h.controller.getSnapshot().phase));await h.controller.check();stop();await h.controller.apply(()=>true);
  assert.deepEqual(phases,['checking','downloading','ready']);
});
