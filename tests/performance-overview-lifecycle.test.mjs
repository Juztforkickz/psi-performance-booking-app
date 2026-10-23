import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { performanceStatus } from '../mobile/src/lib/performance-status.ts';
const require = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts=require('typescript');
const source=ts.transpileModule(await readFile(new URL('../mobile/src/hooks/use-performance-overview.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness(initial) {
  let time=Date.parse('2026-10-23T00:00:00Z'), snapshot=initial, cursor=0, dirty=true, result, calls=0;
  let resume, focus, changed, realtime;
  const states=[],effects=[],pending=[],timers=new Map();let timerId=0;
  const auth={status:'signed_in',user:{id:'fixture-a'},sessionRevision:0};
  const client={channel:()=>({on(_event,_filter,fn){realtime=fn;return this;},subscribe(){return this;}}),removeChannel:async()=>{}};
  const react={useState(initialValue){const i=cursor++;if(!(i in states))states[i]=typeof initialValue==='function'?initialValue():initialValue;return [states[i],value=>{const next=typeof value==='function'?value(states[i]):value;if(!Object.is(states[i],next)){states[i]=next;dirty=true;}}];},
    useEffect(fn,deps){const i=cursor++;const prev=effects[i];if(!prev||deps.some((v,j)=>!Object.is(v,prev.deps[j])))pending.push(()=>{prev?.cleanup?.();effects[i]={deps,cleanup:fn()};});}};
  const context={exports:{},Date:class extends Date {static now(){return time;}},Math,window:{addEventListener(_e,fn){focus=fn;},removeEventListener(){}},
    setTimeout(fn,delay){timers.set(++timerId,{fn,at:time+delay});return timerId;},clearTimeout(id){timers.delete(id);},setInterval(){return -1;},clearInterval(){},
    require(name){if(name==='react')return react;
      if(name==='react-native')return {Platform:{OS:'web'},AppState:{currentState:'active',addEventListener(_e,fn){resume=fn;return {remove(){}};}}};
      if(name.includes('customer-auth-context'))return {useCustomerAuth:()=>auth};
      if(name.includes('customer-auth'))return {CUSTOMER_AUTH:{enabled:true}};
      if(name.includes('performance-plus'))return {loadVaultOverview:async()=>{calls++;return {...snapshot,counts:{},server_time:new Date(time).toISOString()};}};
      if(name.includes('performance-status'))return {onPerformanceChanged(fn){changed=fn;return ()=>{};}};
      if(name.includes('supabase'))return {getSupabaseClient:()=>client};
      throw new Error(name);
    }};
  vm.runInNewContext(source,context);
  async function flush(){for(let i=0;i<12;i++){if(dirty){dirty=false;cursor=0;result=context.exports.usePerformanceOverview();while(pending.length)pending.shift()();}await Promise.resolve();}return result;}
  return {flush,get calls(){return calls;},set(value){snapshot=value;},async advance(ms){time+=ms;for(const[id,timer]of [...timers])if(timer.at<=time){timers.delete(id);timer.fn();}return flush();},async resume(){resume('active');return flush();},async focus(){focus();return flush();},async changed(){changed();return flush();},async realtime(){realtime();return flush();},async restart(){for(const effect of effects)effect?.cleanup?.();effects.length=0;states.length=0;dirty=true;return flush();}};
}
const trial={plan:'performance_plus',is_trial:true,is_permanent:false,expires_at:'2026-10-23T00:00:01Z',status:'trial'};
test('actual overview hook locks an open trial at expiry and stays locked after restart',async()=>{
  const app=harness(trial);let state=await app.flush();assert.equal(performanceStatus(state.overview,state.now).label,'TRIAL ACTIVE');
  state=await app.advance(1001);assert.equal(performanceStatus(state.overview,state.now).label,'FREE / EXPIRED');
  state=await app.restart();assert.equal(performanceStatus(state.overview,state.now).active,false);
});
test('resume, browser focus, purchase verification and server events refresh every mounted status',async()=>{
  const app=harness({...trial,plan:'free',expires_at:null,status:'free'});await app.flush();
  app.set({...trial,is_trial:false,status:'active',expires_at:'2026-11-23T00:00:00Z'});
  for(const event of ['resume','focus','changed','realtime']){const before=app.calls;const state=await app[event]();assert.ok(app.calls>before);assert.equal(performanceStatus(state.overview,state.now).label,'ACTIVE');}
  app.set({...trial,plan:'free',status:'expired'});const state=await app.realtime();assert.equal(performanceStatus(state.overview,state.now).records,false);
});
