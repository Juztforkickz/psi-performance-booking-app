import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { createAndroidUpdateController } from '../mobile/src/lib/android-update-controller.ts';
const require=createRequire(new URL('../mobile/package.json',import.meta.url));const ts=require('typescript');
const source=ts.transpileModule(await readFile(new URL('../mobile/src/components/android-app-updates.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const deferred=()=>{let resolve;const promise=new Promise(a=>{resolve=a;});return{promise,resolve};};
function app(options={}){
  let cursor=0,dirty=true,tree,time=1000_000;const states=[],effects=[],pending=[],timers=new Map();let timerId=0;
  const calls={checks:0,fetches:0,reloads:0,keys:[]};let resume;
  const native={currentState:'active',addEventListener(_name,fn){resume=fn;return{remove(){resume=null;}};}};
  const react={createContext:value=>({value}),useContext:context=>context.value,useSyncExternalStore:(_s,get)=>get(),
    useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;dirty=true;}];},
    useEffect(fn,deps){const i=cursor++;if(!effects[i])pending.push(()=>{effects[i]={deps,cleanup:fn()};});}};
  const updates={isEnabled:true,channel:options.channel??'android-play-internal',runtimeVersion:'1.0.0-android-play-internal-1',updateId:'old',
    async checkForUpdateAsync(){calls.checks++;return options.check?options.check():{isAvailable:false};},
    async fetchUpdateAsync(){calls.fetches++;return options.fetch?options.fetch():{isNew:true,manifest:{id:'new'}};},async reloadAsync(){calls.reloads++;}};
  const api={};vm.runInNewContext(source,{exports:api,__DEV__:false,Date:class extends Date{static now(){return time;}},
    setTimeout(fn,ms){timers.set(++timerId,{fn,at:time+ms});return timerId;},clearTimeout:id=>timers.delete(id),setInterval(){return -1;},clearInterval(){},
    require(name){
      if(name==='react')return react;if(name==='react/jsx-runtime')return{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
      if(name==='react-native')return{AppState:native,Platform:{OS:options.platform??'android'},StyleSheet:{create:v=>v}};
      if(name==='expo-updates')return updates;
      if(name==='expo-constants')return{__esModule:true,default:{expoConfig:{version:'1.0.3'}}};
      if(name==='@react-native-async-storage/async-storage')return{__esModule:true,default:{async getItem(key){calls.keys.push(key);return null;},async setItem(key){calls.keys.push(key);}}};
      if(name.includes('android-update-controller'))return{createAndroidUpdateController:adapter=>createAndroidUpdateController({...adapter,now:()=>time})};
      if(name.includes('theme-preference'))return{useThemePreference:()=>({theme:{}})};
      if(name.includes('australian-date'))return{formatAustralianDateTime:v=>v};
      if(name.includes('garage-startup-screen'))return{GarageStartupScreen:()=>null};if(name.includes('/ui'))return{PrimaryButton:()=>null};
      throw Error(name);
    }});
  async function flush(){for(let i=0;i<25;i++){if(dirty){dirty=false;cursor=0;tree=api.AndroidAppUpdates({children:'CUSTOMER APP'});while(pending.length)pending.shift()();}await Promise.resolve();}return tree.props.children;}
  return{calls,flush,async advance(ms){time+=ms;for(const[id,t]of[...timers])if(t.at<=time){timers.delete(id);t.fn();}return flush();},async foreground(){native.currentState='background';resume?.('background');native.currentState='active';resume?.('active');return flush();},unmount(){for(const e of effects)e?.cleanup?.();}};
}
test('a current Android app opens without requiring customer action',async()=>{const h=app();assert.equal(await h.flush(),'CUSTOMER APP');assert.equal(h.calls.checks,1);assert.equal(h.calls.reloads,0);});
test('a fast downloaded Android update applies before customer forms mount',async()=>{const h=app({check:async()=>({isAvailable:true})});await h.flush();assert.equal(h.calls.fetches,1);assert.equal(h.calls.reloads,1);assert.ok(h.calls.keys.every(k=>k==='@psi-performance/android-update-attempt/v1'));});
test('an offline launch opens the existing app without deleting any storage',async()=>{const h=app({check:async()=>{throw Error('offline');}});assert.equal(await h.flush(),'CUSTOMER APP');assert.equal(h.calls.reloads,0);assert.deepEqual(h.calls.keys,[]);});
test('a slow download releases startup after eight seconds and never interrupts the mounted app later',async()=>{
  const wait=deferred();const h=app({check:async()=>({isAvailable:true}),fetch:()=>wait.promise});assert.notEqual(await h.flush(),'CUSTOMER APP');
  assert.equal(await h.advance(8001),'CUSTOMER APP');wait.resolve({isNew:true,manifest:{id:'new'}});assert.equal(await h.flush(),'CUSTOMER APP');assert.equal(h.calls.reloads,0);
});
test('returning to the foreground checks automatically without reloading a form',async()=>{
  const h=app();await h.flush();await h.advance(120001);await h.foreground();assert.equal(h.calls.checks,2);assert.equal(h.calls.reloads,0);h.unmount();
});
test('Apple and isolated review channels retain their existing startup behaviour',async()=>{
  for(const options of[{platform:'ios'},{platform:'web'},{channel:'google-review'},{channel:'qa'}]){const h=app(options);assert.equal(await h.flush(),'CUSTOMER APP');assert.equal(h.calls.checks,0);assert.equal(h.calls.reloads,0);}
});
