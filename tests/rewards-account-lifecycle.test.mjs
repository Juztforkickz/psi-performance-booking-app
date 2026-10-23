import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { rewardsEarningAt } from '../mobile/src/lib/rewards-earning.ts';
const require = createRequire(new URL('../mobile/package.json',import.meta.url));
const ts=require('typescript');
const source=ts.transpileModule(await readFile(new URL('../mobile/src/hooks/use-rewards-account.ts',import.meta.url),'utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const start=Date.parse('2026-10-23T00:00:00Z');
const paid={multiplier:2,state:'double',subscriptionStatus:'active',bonusEnabled:true,
  validUntil:new Date(start+1000).toISOString(),subscriptionExpiresAt:new Date(start+1000).toISOString()};
function harness(initial) {
  let time=start,snapshot=initial,cursor=0,dirty=true,result,calls=0,offline=false;
  let resume,focus,changed;const realtime=[];
  const states=[],effects=[],pending=[],memos=[],timers=new Map();let timerId=0;
  const auth={status:'signed_in',user:{id:'fictional-customer'},sessionRevision:0};
  const account={profile:{account_state:'active',user_id:auth.user.id}};
  const client={channel:()=>({on(_event,_filter,fn){realtime.push(fn);return this;},subscribe(){return this;}}),removeChannel:async()=>{}};
  const react={
    useState(initialValue){const i=cursor++;if(!(i in states))states[i]=typeof initialValue==='function'?initialValue():initialValue;
      return[states[i],value=>{const next=typeof value==='function'?value(states[i]):value;if(!Object.is(states[i],next)){states[i]=next;dirty=true;}}];},
    useCallback(fn,deps){const i=cursor++;const prev=memos[i];if(!prev||deps.some((v,j)=>!Object.is(v,prev.deps[j])))memos[i]={fn,deps};return memos[i].fn;},
    useEffect(fn,deps){const i=cursor++;const prev=effects[i];if(!prev||deps.some((v,j)=>!Object.is(v,prev.deps[j])))pending.push(()=>{prev?.cleanup?.();effects[i]={deps,cleanup:fn()};});},
  };
  const api={};vm.runInNewContext(source,{exports:api,Math,Date:class extends Date{static now(){return time;}},
    window:{addEventListener(_e,fn){focus=fn;},removeEventListener(){}},
    setTimeout(fn,delay){timers.set(++timerId,{fn,at:time+delay});return timerId;},clearTimeout(id){timers.delete(id);},setInterval(){return -1;},clearInterval(){},
    require(name){
      if(name==='react')return react;
      if(name==='react-native')return{Platform:{OS:'web'},AppState:{currentState:'active',addEventListener(_e,fn){resume=fn;return{remove(){}};}}};
      if(name.includes('customer-auth-context'))return{useCustomerAuth:()=>auth};
      if(name.includes('customer-account-context'))return{useCustomerAccount:()=>({account})};
      if(name.includes('review-environment'))return{REVIEW_ENVIRONMENT:{enabled:false}};
      if(name==='@/lib/rewards')return{loadRewardsAccount:async()=>{calls++;if(offline)throw new Error('offline');return{points:2468,creditCents:2468,cardId:'same-membership',ledger:[{id:'original-earned'}],earning:{...snapshot,serverTime:new Date(time).toISOString()}};}};
      if(name.includes('performance-status'))return{onPerformanceChanged(fn){changed=fn;return()=>{};}};
      if(name.includes('rewards-earning'))return{rewardsEarningAt};
      if(name.includes('supabase'))return{getSupabaseClient:()=>client};
      throw new Error(name);
    }});
  async function flush(){for(let i=0;i<15;i++){if(dirty){dirty=false;cursor=0;result=api.useRewardsAccount();while(pending.length)pending.shift()();}await Promise.resolve();}return result;}
  return{flush,get calls(){return calls;},set(value){snapshot=value;},offline(value){offline=value;},
    async advance(ms){time+=ms;for(const[id,timer]of[...timers])if(timer.at<=time){timers.delete(id);timer.fn();}return flush();},
    async resume(){resume('active');return flush();},async focus(){focus();return flush();},async changed(){changed();return flush();},async realtime(){realtime.at(-1)();return flush();},
    async restart(){for(const effect of effects)effect?.cleanup?.();effects.length=0;states.length=0;memos.length=0;dirty=true;return flush();}};
}
test('an open Rewards screen returns to standard at expiry even offline, retaining balance and history',async()=>{
  const app=harness(paid);let state=await app.flush();assert.equal(state.account.earning.multiplier,2);
  app.offline(true);state=await app.advance(1001);
  assert.equal(state.account.earning.multiplier,1);assert.equal(state.account.earning.subscriptionStatus,'expired');
  assert.equal(state.account.points,2468);assert.equal(state.account.creditCents,2468);assert.equal(state.account.ledger[0].id,'original-earned');
});
test('restart uses verified status, and resume, focus, purchase and server events refresh earning',async()=>{
  const app=harness({...paid,multiplier:1,state:'standard',subscriptionStatus:'expired'});await app.flush();
  app.set({...paid,validUntil:new Date(start+86400_000).toISOString(),subscriptionExpiresAt:new Date(start+86400_000).toISOString()});
  for(const event of['resume','focus','changed','realtime','restart']){const before=app.calls;const state=await app[event]();assert.ok(app.calls>before);assert.equal(state.account.earning.multiplier,2);assert.equal(state.account.cardId,'same-membership');}
});
