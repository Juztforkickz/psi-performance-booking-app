import { StyleSheet, Text, View } from 'react-native';
import type { RewardsEarning } from '@/lib/rewards-earning';

export function RewardsEarningCards({ earning }: { earning: RewardsEarning }) {
  const double = earning.multiplier === 2;
  const known = earning.state !== 'unavailable';
  return <View style={s.row}>
    {[{ title: 'PSI FREE', rate: '1× POINTS', detail: 'Free for everyone.', active: known && !double, otherLabel: 'STANDARD RATE' },
      { title: 'PERFORMANCE+', rate: '2× POINTS', detail: 'Paid members only.', active: known && double, otherLabel: 'PAID BENEFIT' }].map(tier =>
      <View key={tier.title} style={[s.tier, tier.active && s.active]}
        accessibilityLabel={`${tier.title}. ${tier.rate}. ${tier.detail}${tier.active ? ' Your current earning rate.' : ''}`}>
        <Text style={s.title}>{tier.title}</Text>
        <Text style={[s.rate, tier.active && s.activeRate]}>{tier.rate}</Text>
        <Text style={s.detail}>{tier.detail}</Text>
        <Text style={[s.tag, tier.active && s.activeTag]}>{tier.active ? 'CURRENT RATE' : tier.otherLabel}</Text>
      </View>)}
  </View>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 8 },
  tier: { flex: 1, minWidth: 0, borderRadius: 16, borderWidth: 1.5, borderColor: '#617684',
    backgroundColor: '#101A23', paddingHorizontal: 10, paddingVertical: 14, gap: 9, alignItems: 'center' },
  active: { borderColor: '#65CFF8', backgroundColor: '#102D3C', shadowColor: '#65CFF8', shadowOpacity: 0.35,
    shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  title: { color: '#DBE3E7', fontWeight: '900', fontSize: 11, letterSpacing: 0.5, textAlign: 'center' },
  rate: { color: '#FFFFFF', fontWeight: '900', fontSize: 22, textAlign: 'center' },
  activeRate: { color: '#65CFF8' },
  detail: { color: '#CAD2D8', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  tag: { color: '#A9B7C1', fontSize: 10, lineHeight: 16, fontWeight: '800', textAlign: 'center' },
  activeTag: { color: '#65CFF8' },
});
