import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui';
import { colors } from '@/constants/brand';
import { useCustomerAccount } from '@/lib/customer-account-context';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { useCustomerPreview } from '@/lib/customer-preview-context';
import { aud, loadVaultOverview, PERFORMANCE_PRICING, VAULT_KINDS, VAULT_LABELS, type VaultOverview } from '@/lib/performance-plus';
import { purchasePerformancePlus, restorePerformancePlus, subscriptionPurchasesAvailable, verifyWithServer } from '@/lib/performance-purchases';

const VAULT_DESCRIPTIONS = {
  invoice: 'Itemised PSI invoices and supporting paperwork.',
  media: 'Before, progress and after workshop galleries.',
  dyno: 'Mainline PDFs, figures and before/after results.',
  service: 'Complete PSI service and repair records.',
  document: 'Reports and private vehicle documentation.',
  modification: 'A lasting record of each build milestone.',
} as const;

const VAULT_ICONS = {
  invoice: 'receipt-outline',
  media: 'images-outline',
  dyno: 'speedometer-outline',
  service: 'construct-outline',
  document: 'documents-outline',
  modification: 'build-outline',
} as const;

export default function PerformancePlusScreen() {
  const router = useRouter();
  const auth = useCustomerAuth();
  const { account } = useCustomerAccount();
  const preview = useCustomerPreview();
  const { vehicleId: requested } = useLocalSearchParams<{ vehicleId?: string }>();
  const demo = !CUSTOMER_AUTH.enabled;
  const vehicles = demo ? preview.vehicles : account?.vehicles ?? [];
  const [selected, setSelected] = useState(requested ?? '');
  const vehicle = vehicles.find(v => v.id === selected) ?? vehicles[0];
  const vehicleId = vehicle?.id;
  const [now, setNow] = useState(() => Date.now());
  const [state, setState] = useState<{ key: string; overview: VaultOverview } | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const key = `${auth.user?.id ?? 'preview'}:${vehicle?.id}`;
  const overview = demo ? { plan: 'free' as const, counts: { invoice: 7, media: 3, dyno: 2, service: 4, document: 2, modification: 3 }, expires_at: null, is_permanent: false } : state?.key === key ? state.overview : null;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    const sub = AppState.addEventListener('change', value => { if (value === 'active') setRevision(v => v + 1); });
    return () => { sub.remove(); clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (demo || !vehicleId || auth.status !== 'signed_in') return;
    let active = true;
    loadVaultOverview(vehicleId).then(value => { if (active) { setState({ key, overview: value }); setMessage(''); } }).catch(() => { if (active) { setState(null); setMessage('Your vault status could not be loaded. Please refresh and try again.'); } });
    return () => { active = false; };
  }, [demo, vehicleId, auth.status, key, revision]);
  const activePlus = overview?.plan === 'performance_plus' && (!overview.expires_at || Date.parse(overview.expires_at) > now);
  const permanentPlus = activePlus && overview?.is_permanent;
  const entitlementReady = demo || !!overview;
  const refresh = async () => {
    if (busy) return;
    setBusy(true);
    try { if (!permanentPlus && subscriptionPurchasesAvailable() && auth.user) await verifyWithServer(); setMessage(''); }
    catch { setMessage('Apple status could not be verified right now. Your last verified access remains in effect until its expiry.'); }
    finally { setRevision(v => v + 1); setBusy(false); }
  };
  const subscribe = async (period: 'monthly' | 'annual' | 'restore') => {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      if (!auth.user) { router.push('/account'); return; }
      if (!vehicleId) throw new Error('Add a vehicle to My Garage before choosing Performance+.');
      const currentOverview = await loadVaultOverview(vehicleId);
      setState({ key, overview: currentOverview });
      if (currentOverview.is_permanent) {
        setMessage('Performance+ is permanently included with this PSI owner account. No purchase is required.');
        return;
      }
      if (period === 'restore') await restorePerformancePlus(auth.user.id);
      else await purchasePerformancePlus(auth.user.id, period);
      setRevision(v => v + 1);
      setMessage('Purchase checked. Your verified subscription status is being refreshed.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Purchase could not be completed. Please try again.'); }
    finally { setBusy(false); }
  };
  return <SafeAreaView edges={['top', 'left', 'right']} style={s.screen}><ScrollView contentContainerStyle={s.content}>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={s.link}>‹ Back</Text></Pressable>
    <View style={s.heading}><Text style={s.eyebrow}>PSI PERFORMANCE+</Text><Text style={s.title}>{'YOUR CAR.\nITS COMPLETE STORY.'}</Text><Text style={s.copy}>Every service. Every build. Every important milestone. Your PSI vehicle record, in one place.</Text></View>
    <View style={s.planCard}>
      <View style={s.row}>
        <View style={s.planHeading}><Ionicons name={activePlus ? 'shield-checkmark' : 'car-sport-outline'} color={colors.accent} size={22} /><View><Text style={s.planLabel}>CURRENT PLAN</Text><Text style={s.planName}>{activePlus ? 'PSI Performance+' : 'PSI Free'}</Text></View></View>
        <View style={[s.badge, activePlus && s.activeBadge]}><Text style={[s.badgeText, activePlus && s.activeBadgeText]}>{activePlus ? 'ACTIVE' : 'FREE'}</Text></View>
      </View>
      <Text style={s.copy}>{activePlus ? 'Your complete private PSI vehicle record is unlocked.' : 'Your everyday PSI account remains free. Upgrade whenever you want the complete digital history.'}</Text>
    </View>
    {permanentPlus ? <Text style={s.muted}>Permanent complimentary PSI owner access · A$0 · no renewal or expiry.</Text> : null}
    {activePlus && overview?.expires_at ? <Text style={s.muted}>Access through {new Date(overview.expires_at).toLocaleDateString('en-AU')}. Turning off renewal retains access until expiry.</Text> : null}
    <Text style={s.section}>Your vehicle vault</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.choices}>{vehicles.map(v => <Pressable accessibilityRole="button" accessibilityState={{ selected: v.id === vehicle?.id }} key={v.id} onPress={() => { setSelected(v.id); setMessage(''); }} style={[s.choice, v.id === vehicle?.id && s.chosen]}><Text style={s.choiceText}>{v.make} {v.model}</Text></Pressable>)}</ScrollView>
    {demo ? <Text style={s.muted}>Demo records · explore a sample vault without making a purchase.</Text> : null}
    {!demo && !overview && vehicle && !message ? <ActivityIndicator color={colors.accent} /> : null}
    <View style={s.grid}>{VAULT_KINDS.map(kind => <Pressable accessibilityRole="button" key={kind} onPress={() => { if (demo || activePlus) router.push({ pathname: '/vehicle-vault', params: { vehicleId: vehicle?.id ?? '', kind } }); else setMessage('Choose Performance+ below to unlock your private vehicle archive. Your free PSI features remain available.'); }} style={({ pressed }) => [s.vault, pressed && s.pressed]}>
      <View style={s.row}><View style={s.vaultIcon}><Ionicons name={VAULT_ICONS[kind]} color={colors.accent} size={24} /></View><Ionicons name={activePlus || demo ? 'arrow-forward' : 'lock-closed'} color={colors.accent} size={18} /></View>
      <View style={s.vaultCopy}><Text style={s.vaultTitle}>{VAULT_LABELS[kind]}</Text><Text style={s.recordCount}>{overview ? `${overview.counts[kind] ?? 0} PSI records available` : 'Your private PSI records'}</Text><Text style={s.vaultDescription}>{VAULT_DESCRIPTIONS[kind]}</Text></View>
      <View style={s.vaultAction}><Text style={s.vaultActionText}>{activePlus || demo ? 'Open vault' : 'Unlock with Performance+'}</Text><Ionicons name="chevron-forward" color={colors.accent} size={15} /></View>
    </Pressable>)}</View>
    {vehicle ? <PrimaryButton label={demo ? 'Explore sample vehicle history' : 'Open vehicle history'} onPress={() => router.push({ pathname: '/vehicle-vault', params: { vehicleId: vehicle.id } })} variant="outline" /> : null}
    {!activePlus && entitlementReady ? <View style={s.pricing}><Text style={s.pricingEyebrow}>UNLOCK YOUR COMPLETE VEHICLE STORY</Text><Text style={s.section}>Choose Performance+</Text><Text style={s.copy}>One subscription covers every vehicle in your PSI account.</Text>
      <View style={s.priceGrid}>
        <View style={s.priceOption}><Text style={s.priceLabel}>MONTHLY</Text><Text style={s.price}>{aud(PERFORMANCE_PRICING.monthly)}</Text><Text style={s.priceMeta}>per month</Text></View>
        <View style={[s.priceOption, s.bestValue]}><Text style={s.bestValueLabel}>BEST VALUE</Text><Text style={s.priceLabel}>ANNUAL</Text><Text style={s.price}>{aud(PERFORMANCE_PRICING.annual)}</Text><Text style={s.priceMeta}>per year · save {aud(PERFORMANCE_PRICING.monthly * 12 - PERFORMANCE_PRICING.annual)}</Text></View>
      </View>
      <PrimaryButton disabled={busy || !subscriptionPurchasesAvailable()} label="Unlock annually" onPress={() => void subscribe('annual')} />
      <PrimaryButton disabled={busy || !subscriptionPurchasesAvailable()} label="Choose monthly" onPress={() => void subscribe('monthly')} variant="outline" />
      {!subscriptionPurchasesAvailable() ? <Text style={s.muted}>{demo ? 'Preview only · no payment will be taken.' : 'Purchases are not open in this beta yet. PSI can grant complimentary beta access.'}</Text> : null}
      <Text style={s.muted}>Subscriptions renew automatically unless cancelled before renewal. Cancellation keeps your records safe and locks premium access after the paid period ends.</Text>
    </View> : null}
    {entitlementReady && !permanentPlus ? <PrimaryButton disabled={busy || !subscriptionPurchasesAvailable()} label="Restore purchases" onPress={() => void subscribe('restore')} variant="outline" /> : null}
    {entitlementReady && !permanentPlus && Platform.OS === 'ios' ? <PrimaryButton label="Manage Apple subscription" variant="outline" onPress={() => void Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => setMessage('Open iPhone Settings, your Apple Account, then Subscriptions.'))} /> : null}
    <PrimaryButton disabled={busy} label={permanentPlus ? 'Refresh access status' : 'Refresh subscription status'} onPress={() => void refresh()} variant="outline" />
    {message ? <Text accessibilityRole="alert" style={s.notice}>{message}</Text> : null}
    <View style={s.free}><Text style={s.section}>Always part of PSI Free</Text><Text style={s.copy}>Your account and garage, vehicle photos, bookings, kilometre recording, maintenance reminders, current dyno results, notifications and contacting PSI.</Text></View>
    <View style={s.row}><Pressable accessibilityRole="link" onPress={() => router.push('/privacy')}><Text style={s.link}>Privacy</Text></Pressable><Pressable accessibilityRole="link" onPress={() => router.push('/subscription-terms')}><Text style={s.link}>Subscription terms</Text></Pressable></View>
  </ScrollView></SafeAreaView>;
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: 22, paddingBottom: 48, gap: 20 },
  heading: { gap: 14, paddingVertical: 16 },
  eyebrow: { color: colors.accent, fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  title: { color: colors.white, fontSize: 34, fontWeight: '900', letterSpacing: -.8 },
  copy: { color: colors.silver, fontSize: 15, lineHeight: 23 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  section: { color: colors.white, fontSize: 21, fontWeight: '800' },
  planCard: { backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: 8, padding: 18, gap: 14 },
  planHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  planLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  planName: { color: colors.white, fontSize: 17, fontWeight: '900' },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.inkSoft, borderColor: colors.line, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 3 },
  badgeText: { color: colors.silver, fontSize: 9, fontWeight: '900', letterSpacing: .8 },
  activeBadge: { backgroundColor: colors.accent, borderColor: colors.accent },
  activeBadgeText: { color: colors.ink },
  link: { color: colors.accent, fontSize: 15, paddingVertical: 8 },
  choices: { gap: 10 },
  choice: { padding: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 5 },
  chosen: { borderColor: colors.accent, backgroundColor: colors.inkSoft },
  choiceText: { color: colors.white, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  vault: { flexGrow: 1, flexBasis: '45%', minWidth: 150, padding: 17, backgroundColor: colors.panel, borderColor: colors.accentDark, borderWidth: 1, borderRadius: 8, gap: 14 },
  pressed: { opacity: .76 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  vaultIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.inkSoft, borderRadius: 21 },
  vaultCopy: { flex: 1, gap: 5 },
  vaultTitle: { color: colors.white, fontSize: 18, fontWeight: '800' },
  recordCount: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  vaultDescription: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  vaultAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 11 },
  vaultActionText: { flex: 1, color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: .35, textTransform: 'uppercase' },
  pricing: { backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: 8, padding: 20, gap: 16 },
  pricingEyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.25 },
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  priceOption: { flex: 1, minWidth: 140, borderColor: colors.line, borderWidth: 1, padding: 15, gap: 4 },
  bestValue: { borderColor: colors.accent },
  bestValueLabel: { alignSelf: 'flex-start', color: colors.ink, backgroundColor: colors.accent, paddingHorizontal: 7, paddingVertical: 4, fontSize: 8, fontWeight: '900', letterSpacing: .7 },
  priceLabel: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  price: { color: colors.white, fontSize: 25, fontWeight: '900' },
  priceMeta: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  notice: { color: colors.accent, fontSize: 15, lineHeight: 23 },
  free: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 22, gap: 12 },
});
