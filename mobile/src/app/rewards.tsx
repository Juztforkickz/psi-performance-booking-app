import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui';
import { useRewardsAccount } from '@/hooks/use-rewards-account';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { formatRewardsCredit, formatRewardsPoints, prepareRewardsWallet } from '@/lib/rewards';
import { colors, spacing } from '@/constants/brand';

export default function RewardsScreen() {
  const router = useRouter();
  const { horizontalPadding, width } = useResponsiveLayout();
  const rewards = useRewardsAccount();
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const [notice, setNotice] = useState('');
  const [openedWallet, setOpenedWallet] = useState<'apple' | 'google' | null>(null);
  const account = rewards.account;
  const appleConnected = account?.walletStatus?.appleConnected === true;
  const platformWalletReady = account && (Platform.OS === 'ios' ? account.wallet.apple : Platform.OS === 'android' ? account.wallet.google : account.wallet.apple || account.wallet.google);
  const creditText = account ? formatRewardsCredit(account.creditCents) : '';
  const creditFontSize = Math.max(18, Math.min(47, (Math.min(width - horizontalPadding * 2 - 20, 420) - 50) / Math.max(1, creditText.length * 0.65)));
  const addWallet = async (provider: 'apple' | 'google') => {
    if (busy) return;
    setBusy(provider); setNotice(''); setOpenedWallet(null);
    try {
      const url = await prepareRewardsWallet(provider);
      if (Platform.OS === 'web') window.location.assign(url);
      else await Linking.openURL(url);
      setOpenedWallet(provider);
    } catch { setNotice('Your Wallet card could not be saved yet. Please try again shortly. Your points are safe in your PSI account.'); }
    finally { setBusy(null); }
  };
  return <SafeAreaView style={s.screen} edges={['top']}>
    <ScrollView contentContainerStyle={[s.content, { paddingHorizontal: horizontalPadding }]}>
      <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={s.back}>‹ Back</Text></Pressable>
      <Text style={s.heading}>PSI Rewards</Text>
      <Text style={s.copy}>Your car. Your rewards.</Text>
      {!rewards.signedIn ? <View style={s.panel}>
        <Text style={s.copy}>Sign in and complete your PSI account to view your loyalty card, points and workshop credit.</Text>
        <PrimaryButton label="Sign in to PSI" onPress={() => router.push('/account')} />
      </View> : !account ? <View style={s.panel}>
        {rewards.error ? <><Text style={s.copy}>{rewards.error}</Text><PrimaryButton label="Refresh rewards" onPress={rewards.refresh} /></> : <ActivityIndicator accessibilityLabel="Loading your rewards" color={colors.accent} />}
      </View> : <>
        <View style={s.card}>
          <View style={s.cardHeader}><Image accessibilityLabel="PSI Performance Garage" source={require('../../assets/images/psi-logo.png')} resizeMode="contain" style={s.logo} /><Text style={s.cardTitle}>PSI REWARDS</Text></View>
          <Text style={s.cardLabel}>WORKSHOP CREDIT</Text>
          <Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={[s.amount, { fontSize: creditFontSize }]}>{creditText}</Text>
          <Text style={s.points}>{formatRewardsPoints(account.points)} points</Text>
          <View style={s.divider} />
          <Text style={s.member}>{account.name}</Text>
          <Image accessibilityLabel="Your PSI loyalty card QR code. Show this to PSI staff." source={{ uri: account.qr }} resizeMode="contain" style={s.qr} />
          <Text selectable style={s.cardNumber}>{account.cardId.slice(0, 8).toUpperCase()}</Text>
          <Text style={s.cardFooter}>Your car. Your rewards.</Text>
        </View>
        <Text style={s.rate}>1,000 points = AUD 10 workshop credit</Text>
        {rewards.error ? <Text accessibilityLiveRegion="polite" style={s.copy}>Showing your last verified balance. {rewards.error}</Text> : null}
        {account.points < 0 ? <Text style={s.copy}>A previous reward was adjusted. Future points will first cover that adjustment. Your history shows the change.</Text> : null}
        <View style={s.panel}>
          <Text style={s.sectionTitle}>Keep your card handy</Text>
          <Text style={s.copy}>Show this card in the workshop, or save it to your phone’s Wallet.</Text>
          {(Platform.OS === 'ios' || Platform.OS === 'web') && appleConnected ? <Text accessibilityLiveRegion="polite" style={s.walletConfirmed}>✓ Connected to Apple Wallet</Text> : null}
          {(Platform.OS === 'ios' || Platform.OS === 'web') && account.wallet.apple ? <PrimaryButton label="Save Apple Wallet card" disabled={Boolean(busy)} loading={busy === 'apple'} onPress={() => void addWallet('apple')} /> : null}
          {(Platform.OS === 'android' || Platform.OS === 'web') && account.wallet.google ? <PrimaryButton label="Save Google Wallet card" disabled={Boolean(busy)} loading={busy === 'google'} onPress={() => void addWallet('google')} /> : null}
          {!platformWalletReady ? <Text style={s.copy}>Wallet downloads are being connected. Your loyalty card and balance are available here.</Text> : null}
          {openedWallet === 'apple' && !appleConnected && !notice ? <><Text accessibilityLiveRegion="polite" style={s.copy}>Apple Wallet opened. Tap Add if prompted, then return to PSI. A connection confirmation will appear when Apple registers your card.</Text><PrimaryButton label="Check Wallet connection" variant="outline" onPress={rewards.refresh} /></> : null}
          {openedWallet === 'google' && !notice ? <Text accessibilityLiveRegion="polite" style={s.copy}>Google Wallet opened. Complete the save in Google Wallet to keep your card.</Text> : null}
          {notice ? <Text accessibilityLiveRegion="polite" style={s.copy}>{notice}</Text> : null}
        </View>
        <View style={s.panel}>
          <Text style={s.sectionTitle}>How your points work</Text>
          <Text style={s.copy}>Earn 1 point for each whole AUD 1 of eligible spending on a fully paid invoice. Points appear after Xero confirms the payment, usually within a few minutes.</Text>
          <Text style={s.copy}>Your deposit and balance count toward one invoice reward. Online payments, bank transfers and cash recorded against your invoice follow the same rules.</Text>
          <Text style={s.copy}>Use your workshop credit toward future PSI invoices. Amounts covered by rewards do not earn new points. Refunds and invoice corrections can adjust your points.</Text>
          <PrimaryButton label="Refresh my balance" variant="outline" onPress={rewards.refresh} />
        </View>
        <View style={s.panel}>
          <Text style={s.sectionTitle}>Points history</Text>
          {!account.ledger.length ? <Text style={s.copy}>Your rewards history will appear here after your next eligible invoice is fully paid.</Text> : account.ledger.map(entry => <View key={entry.id} style={s.entry}>
            <Text style={s.entryTitle}>{entry.kind === 'earned' ? 'Points earned' : entry.kind === 'redeemed' ? 'Credit used' : entry.kind === 'credit_restored' ? 'Credit restored' : 'Points adjusted'}</Text>
            <Text style={s.copy}>{entry.invoice_number} · {new Date(entry.created_at).toLocaleDateString('en-AU', { timeZone: 'Australia/Melbourne' })}</Text>
            <Text style={s.entryPoints}>{entry.points_change > 0 ? '+' : ''}{entry.points_change.toLocaleString('en-AU')} points</Text>
          </View>)}
        </View>
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink }, content: { paddingTop: spacing.lg, paddingBottom: 130, gap: 18, width: '100%', maxWidth: 700, alignSelf: 'center' },
  back: { color: colors.accent, fontWeight: '800', fontSize: 16, paddingVertical: 8 }, heading: { color: colors.white, fontWeight: '900', fontSize: 32 },
  walletConfirmed: { color: colors.accent, fontSize: 18, lineHeight: 26, fontWeight: '800' },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 24, flexShrink: 1 }, panel: { padding: 20, gap: 16, borderWidth: 1.5, borderColor: colors.lineLight, backgroundColor: colors.panel },
  sectionTitle: { color: colors.white, fontWeight: '900', fontSize: 21 }, card: { alignSelf: 'center', width: '100%', maxWidth: 420, backgroundColor: '#090B0E', borderRadius: 22, borderWidth: 2, borderColor: '#9DAFBB', padding: 23, alignItems: 'center', gap: 12 },
  cardHeader: { alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingBottom: 13, borderBottomWidth: 1, borderColor: '#65CFF8' },
  logo: { width: 122, height: 49 }, cardTitle: { color: '#65CFF8', fontWeight: '900', fontSize: 17 }, cardLabel: { color: '#CAD2D8', fontWeight: '800', letterSpacing: 2, fontSize: 14, marginTop: 12 },
  amount: { color: '#65CFF8', fontWeight: '900', fontSize: 47, width: '100%', textAlign: 'center' }, points: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', textAlign: 'center' },
  divider: { height: 1, backgroundColor: '#687B89', alignSelf: 'stretch', marginVertical: 8 }, member: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  qr: { width: '75%', maxWidth: 220, aspectRatio: 1, backgroundColor: '#FFFFFF', borderRadius: 8 }, cardNumber: { color: '#CAD2D8', fontSize: 12, letterSpacing: 2 },
  cardFooter: { color: '#DBE3E7', fontSize: 17, textAlign: 'center', marginTop: 7 }, rate: { color: colors.accent, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  entry: { gap: 6, paddingVertical: 14, borderTopWidth: 1, borderColor: colors.line }, entryTitle: { color: colors.white, fontSize: 17, fontWeight: '800' }, entryPoints: { color: colors.accent, fontSize: 18, fontWeight: '900' },
});
