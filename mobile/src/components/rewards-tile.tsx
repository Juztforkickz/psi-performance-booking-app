import { type Href, useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLLECTION_TILE_FRAME } from '@/components/dashboard-tile';
import { useRewardsAccount } from '@/hooks/use-rewards-account';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { formatRewardsCredit, formatRewardsPoints } from '@/lib/rewards';

export function RewardsTile() {
  const router = useRouter();
  const rewards = useRewardsAccount();
  const { width, horizontalPadding, tablet, largeText } = useResponsiveLayout();
  const columns = tablet && width >= 780 && !largeText ? 3 : 2;
  const tileWidth = Math.max(100, (width - horizontalPadding * 2 - 20 - 12 * (columns - 1)) / columns);
  const points = rewards.account ? `${formatRewardsPoints(rewards.account.points)} points` : rewards.signedIn ? 'View your points' : 'Your loyalty card';
  const credit = rewards.account ? `${formatRewardsCredit(rewards.account.creditCents)} credit` : rewards.signedIn && rewards.error ? 'Refresh your balance' : '1,000 points = AUD 10';
  return <Pressable accessibilityRole="button" accessibilityLabel={`PSI Rewards. ${points}. ${credit}`} onPress={() => router.push('/rewards' as Href)}
    style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}>
    <View pointerEvents="none" style={styles.surface}>
      <Image accessible={false} source={require('../../assets/images/dashboard/tile-psi-rewards.png')} resizeMode="cover" style={styles.art} />
      <View style={styles.balance}>
        <Text adjustsFontSizeToFit minimumFontScale={0.65} numberOfLines={1} style={[styles.points, { fontSize: Math.max(11, Math.min(23, (tileWidth - 16) / (points.length * 0.6))) }]}>{points}</Text>
        <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={[styles.credit, { fontSize: Math.max(11, Math.min(14, (tileWidth - 16) / (credit.length * 0.58))) }]}>{credit}</Text>
      </View>
      <View style={styles.label}><Text style={styles.title}>PSI REWARDS</Text></View>
    </View>
  </Pressable>;
}
const styles = StyleSheet.create({
  tile: { ...COLLECTION_TILE_FRAME },
  surface: { flex: 1, borderRadius: 19, overflow: 'hidden', backgroundColor: '#090B0E' },
  art: { position: 'absolute', width: '100%', height: '100%' },
  balance: { position: 'absolute', bottom: 58, left: 8, right: 8, alignItems: 'center', gap: 3 },
  points: { fontSize: 23, fontWeight: '900', color: '#FFFFFF', textAlign: 'center' },
  credit: { fontSize: 14, fontWeight: '800', color: '#65CFF8', textAlign: 'center' },
  label: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 50, borderTopWidth: 1, borderColor: '#88D7EE', backgroundColor: 'rgba(15, 34, 47, 0.96)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFFFFF', fontWeight: '900', fontSize: 13, letterSpacing: 0.6 },
});
