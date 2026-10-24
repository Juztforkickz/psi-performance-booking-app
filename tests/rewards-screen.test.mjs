import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { readRewardsEarning, rewardsSubscriptionLabel, rewardsWalletProviders } from '../mobile/src/lib/rewards-earning.ts';
const require=createRequire(new URL('../mobile/package.json',import.meta.url)),ts=require('typescript');
const compile=async file=>ts.transpileModule(await readFile(new URL(file,import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const screenSource=await compile('../mobile/src/app/rewards.tsx'),cardsSource=await compile('../mobile/src/components/rewards-earning-cards.tsx');
const now=new Date().toISOString(),later=new Date(Date.now()+86400_000).toISOString();
function render(status,{platform='ios',enabled=true,multiplier=status==='active'?2:1,state=multiplier===2?'double':'standard',history=false}={}){
  const routes=[],refreshes=[],nodes=[];
  const earning=readRewardsEarning({multiplier,state,subscriptionStatus:status,bonusEnabled:enabled,
    validUntil:later,subscriptionExpiresAt:later,verifiedAt:now,serverTime:now});
  const account={name:'Fictional Member',points:2468,creditCents:2468,cardId:'10000000-0000-4000-8000-000000000010',
    qr:'data:image/png;base64,fixture',wallet:{apple:true,google:true},walletStatus:{appleConnected:false},ledger:[],earning,
    ...(history?{invoiceEarnings:[{invoiceId:'fictional-invoice',invoiceNumber:'INV-FICTIONAL',standardPoints:1000,bonusPoints:1000,totalPoints:2000,bonusPending:false}],
      ledger:[{id:'fictional-bonus',invoice_number:'INV-FICTIONAL',kind:'bonus_earned',points_change:1000,created_at:now}],historyCursor:{at:now,id:'fictional-cursor'}}:{})};
  const native={Platform:{OS:platform},ActivityIndicator:'Spinner',Image:'Image',Pressable:'Pressable',ScrollView:'ScrollView',Text:'Text',View:'View',Linking:{openURL(){}},StyleSheet:{create:value=>value}};
  const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  const cards={};vm.runInNewContext(cardsSource,{exports:cards,require:name=>name==='react-native'?native:jsx});
  const imports={
    react:{useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useEffect(){},useRef:value=>({current:value})},'react/jsx-runtime':jsx,'react-native':native,
    'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'expo-router':{useRouter:()=>({push:route=>routes.push(route),back(){}})},
    '@/components/ui':{PrimaryButton:'Button'},'@/components/rewards-earning-cards':cards,
    '@/hooks/use-rewards-account':{useRewardsAccount:()=>({account,signedIn:true,error:'',refresh:()=>refreshes.push(true)})},
    '@/hooks/use-responsive-layout':{useResponsiveLayout:()=>({horizontalPadding:18,width:390})},
    '@/constants/brand':{colors:{},spacing:{lg:24}},
    '@/lib/rewards-earning':{rewardsSubscriptionLabel,rewardsWalletProviders},
    '@/lib/rewards':{formatRewardsCredit:value=>`AUD ${(value/100).toFixed(2)}`,formatRewardsPoints:value=>value.toLocaleString('en-AU'),prepareRewardsWallet:async()=>{throw new Error('not invoked in render test');}},
  };
  const api={};vm.runInNewContext(screenSource,{exports:api,Date,require:name=>name.endsWith('.png')?'fixture-logo':imports[name]??(()=>{throw new Error(name);})()});
  function visit(node){if(Array.isArray(node))return node.forEach(visit);if(!node||typeof node!=='object')return;
    if(typeof node.type==='function')return visit(node.type(node.props));nodes.push(node);visit(node.props?.children);}
  const tree=api.default();visit(tree);
  const text=nodes.filter(node=>node.type==='Text').map(node=>{const children=node.props.children;return Array.isArray(children)?children.join(''):children;}).join(' ');
  return{account,routes,refreshes,text,buttons:nodes.filter(node=>node.type==='Button'),cards:nodes.filter(node=>node.props?.accessibilityLabel?.includes('Your current earning rate'))};
}
test('actual Rewards screen displays dynamic balance, QR and 1x/2x comparison for every membership',()=>{
  for(const status of['free','trial','active','expired','permanent']){
    const screen=render(status);
    assert.ok(screen.text.includes('AUD 24.68'));
    assert.ok(screen.text.includes('2,468'));
    assert.ok(screen.text.includes('1× POINTS')&&screen.text.includes('2× POINTS'));
    assert.equal(screen.text.includes('2× POINTS ACTIVE'),status==='active');
    assert.equal(screen.cards.length,1);
    assert.ok(screen.cards[0].props.accessibilityLabel.startsWith(status==='active'?'PERFORMANCE+':'PSI FREE'));
    assert.equal(screen.account.cardId,'10000000-0000-4000-8000-000000000010');
    const unlock=screen.buttons.find(button=>button.props.label==='UNLOCK 2× POINTS');
    if(['free','trial','expired'].includes(status)){assert.ok(unlock);unlock.props.onPress();assert.deepEqual(screen.routes,['/performance-plus']);}
    else assert.equal(Boolean(unlock),false);
  }
});

test('paid invoice breakdown shows standard, bonus and total while keeping full history available',()=>{
  const screen=render('active',{history:true});
  assert.ok(screen.text.includes('Standard 1,000 · Bonus 1,000'));assert.ok(screen.text.includes('2,000 total points'));
  assert.ok(screen.text.includes('Bonus points earned'));assert.ok(screen.buttons.some(button=>button.props.label==='Show older points'));
});
test('native Wallet buttons match the device and keep existing readiness rules',()=>{
  const apple=render('free',{platform:'ios'}),google=render('free',{platform:'android'});
  assert.ok(apple.buttons.some(button=>button.props.label==='Add to Apple Wallet'));
  assert.equal(apple.buttons.some(button=>button.props.label==='Add to Google Wallet'),false);
  assert.ok(google.buttons.some(button=>button.props.label==='Add to Google Wallet'));
  assert.equal(google.buttons.some(button=>button.props.label==='Add to Apple Wallet'),false);
});
test('unavailable earning verification cannot highlight a current tier or prompt a paid subscriber to buy again',()=>{
  const unknown=render('active',{state:'unavailable',multiplier:1});
  assert.equal(unknown.cards.length,0);
  assert.equal(unknown.text.includes('2× POINTS ACTIVE'),false);
  assert.equal(unknown.buttons.some(button=>button.props.label==='UNLOCK 2× POINTS'),false);
  unknown.buttons.find(button=>button.props.label==='Refresh earning rate').props.onPress();
  assert.equal(unknown.refreshes.length,1);
  const pending=render('free',{enabled:false});
  assert.equal(pending.buttons.find(button=>button.props.label==='UNLOCK 2× POINTS').props.disabled,true);
});
