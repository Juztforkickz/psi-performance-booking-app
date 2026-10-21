import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormInput, PrimaryButton } from '@/components/ui';
import { loadStaffMfaSecurityAccess } from '@/lib/staff-portal';
import { formatRewardsCredit, formatRewardsPoints, loadRewardsStaffStatus, lookupRewardsCard } from '@/lib/rewards';
import { colors } from '@/constants/brand';

export default function RewardsScanScreen() {
  const router = useRouter();
  const [initialCode] = useState(() => Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hash.slice(1) : '');
  const [value, setValue] = useState(initialCode);
  const [access, setAccess] = useState<'loading' | 'ready' | 'locked'>('loading');
  const [card, setCard] = useState<Awaited<ReturnType<typeof lookupRewardsCard>> | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [searchRevision, setSearchRevision] = useState(0);
  const [sync, setSync] = useState<Awaited<ReturnType<typeof loadRewardsStaffStatus>> | null>(null);
  useEffect(() => {
    let active = true;
    void loadStaffMfaSecurityAccess().then(result => { if (active) { setAccess(result.kind === 'ready' ? 'ready' : 'locked'); if (result.kind === 'ready' && initialCode.trim()) setBusy(true); } }).catch(() => { if (active) setAccess('locked'); });
    return () => { active = false; };
  }, [initialCode]);
  useEffect(() => {
    let active = true;
    if (access === 'ready') void loadRewardsStaffStatus().then(result => { if (active) setSync(result); }).catch(() => { if (active) setSync(null); });
    return () => { active = false; };
  }, [access]);
  useEffect(() => {
    if (access !== 'ready' || !value.trim()) return;
    let active = true;
    void lookupRewardsCard(value).then(result => { if (active) setCard(result); }).catch(() => { if (active) setNotice('This card could not be opened. Check the code and your portal access, then try again.'); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [access, value, searchRevision]);
  const [draft, setDraft] = useState(value);
  return <SafeAreaView style={s.screen} edges={['top']}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" onPress={() => router.push('/staff')}><Text style={s.back}>‹ PSI Portal</Text></Pressable>
    <Text style={s.heading}>PSI Rewards cards</Text>
    {access === 'loading' ? <Text style={s.copy}>Opening your portal access…</Text> : access !== 'ready' ? <View style={s.panel}>
      <Text style={s.copy}>Sign in to the PSI staff portal and complete your normal verification to view this customer’s rewards.</Text>
      <PrimaryButton label="Open PSI staff sign in" onPress={() => router.push('/staff')} />
      <Text style={s.copy}>Then return to this card link, or scan the card again.</Text>
    </View> : <>
      {sync ? <View style={s.panel}>
        <Text style={s.section}>Rewards sync {sync.enabled ? 'active' : 'being connected'}</Text>
        <Text style={s.copy}>1 point per AUD 1. 1,000 points = AUD 10 credit. Points follow fully paid invoices linked to a verified PSI customer.</Text>
        {sync.held > 0 ? <Text style={s.copy}>{sync.held} invoice{sync.held === 1 ? '' : 's'} awaiting a verified customer match or sync review. Check the invoice and customer link in Imports & drafts.</Text> : <Text style={s.copy}>No invoices currently held for rewards review.</Text>}
        <Text style={s.copy}>Apple Wallet: {sync.wallet.apple ? 'connected' : 'setup pending'}. Google Wallet: {sync.wallet.google ? 'connected' : 'setup pending'}.</Text>
      </View> : null}
      <View style={s.panel}>
        <Text style={s.section}>How to scan a card</Text>
        <Text style={s.copy}>Open the Camera app on your workshop iPhone. Point it at the customer’s PSI Rewards QR code and tap the link. Their rewards will open here after your staff access is verified.</Text>
        <Text style={s.copy}>You can also paste a card link or enter the card code below.</Text>
        <FormInput accessibilityLabel="PSI Rewards card link or code" autoCapitalize="none" autoCorrect={false} value={draft} onChangeText={setDraft} placeholder="Card link or code" />
        <PrimaryButton label="Open rewards card" loading={busy} disabled={!draft.trim()} onPress={() => { setNotice(''); setCard(null); setBusy(true); setValue(draft); setSearchRevision(revision => revision + 1); }} />
      </View>
      {notice ? <Text accessibilityLiveRegion="polite" style={s.copy}>{notice}</Text> : null}
      {card ? <View style={s.panel}>
        <Text style={s.section}>{card.name}</Text>
        <Text style={s.balance}>{formatRewardsCredit(card.creditCents)} credit</Text>
        <Text style={s.copy}>{formatRewardsPoints(card.points)} points</Text>
        <Text style={s.copy}>For cash payments, record the invoice as paid in Xero. Points are awarded automatically once, after that payment is verified.</Text>
        <Text style={s.copy}>To use credit, add a negative invoice line labelled “PSI Rewards credit” in Xero for the amount being used, within this available balance. The rewards sync records that credit once. The remaining invoice amount earns points when fully paid.</Text>
      </View> : null}
    </>}
  </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink }, content: { padding: 24, paddingBottom: 130, maxWidth: 700, width: '100%', alignSelf: 'center', gap: 20 },
  heading: { color: colors.white, fontSize: 28, fontWeight: '900' }, back: { color: colors.accent, fontSize: 17, fontWeight: '800', paddingVertical: 8 },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 25 }, section: { color: colors.white, fontWeight: '900', fontSize: 22 },
  panel: { backgroundColor: colors.panel, borderWidth: 1.5, borderColor: colors.lineLight, padding: 20, gap: 18 }, balance: { color: colors.accent, fontWeight: '900', fontSize: 27 },
});
