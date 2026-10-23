import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { performanceStatus } from '../mobile/src/lib/performance-status.ts';
const require=createRequire(new URL('../mobile/package.json',import.meta.url));
const ts=require('typescript');
const source=ts.transpileModule(await readFile(new URL('../mobile/src/components/performance-plan-card.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const now=Date.parse('2026-10-23T00:00:00Z');
function render(overview,badge=false){
  const imports={
    'react':{useState:initial=>[initial,()=>{}]},
    'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
    'react-native':{Platform:{OS:'ios'},Pressable:'Pressable',Text:'Text',View:'View',StyleSheet:{create:value=>value}},
    '@expo/vector-icons':{Ionicons:'Icon'},'expo-router':{useRouter:()=>({push(){}})},
    '@/components/ui':{PrimaryButton:'Button'},'@/constants/brand':{mobileFrame:{},spacing:{}},
    '@/lib/customer-account-context':{useCustomerAccount:()=>({account:{vehicles:[]}})},
    '@/lib/customer-auth':{CUSTOMER_AUTH:{enabled:true}},'@/lib/customer-auth-context':{useCustomerAuth:()=>({status:'signed_in',user:{id:'fictional'}})},
    '@/lib/performance-plus':{PERFORMANCE_PRICING:{monthly:999,annual:9900},aud:cents=>`${cents/100} AUD`},
    '@/hooks/use-performance-overview':{usePerformanceOverview:()=>({overview,now})},
    '@/lib/performance-status':{performanceStatus},
    '@/lib/performance-purchases':{subscriptionStorefrontName:()=>null},
    '@/lib/theme-preference':{useThemePreference:()=>({theme:{}})},
  };
  const api={};vm.runInNewContext(source,{exports:api,require:name=>{if(!(name in imports))throw new Error(name);return imports[name];}});
  const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(' '):node?.props?`${text(node.props.children)} ${node.props.label??''}`:'';
  return text(badge?api.PerformanceStatusBadge():api.PerformancePlanCard({}));
}
test('actual plan card and account/garage badge display each entitlement without a vehicle',()=>{
  const base={plan:'performance_plus',is_permanent:false,is_trial:false,expires_at:'2026-11-23T00:00:00Z'};
  for(const [value,label]of [[base,'ACTIVE'],[{...base,is_trial:true},'TRIAL ACTIVE'],[{...base,is_permanent:true,expires_at:null},'PERMANENT ACCESS'],[{...base,expires_at:'2026-10-22T00:00:00Z'},'FREE / EXPIRED'],[{...base,plan:'free',expires_at:null},'FREE']]){
    for(const badge of [true,false])assert.ok(render(value,badge).includes(label));
  }
  assert.ok(render({...base,plan:'free',expires_at:null}).includes('Upgrade to Performance+'));
  assert.ok(render(null,true).includes('CHECKING ACCESS'));
});
