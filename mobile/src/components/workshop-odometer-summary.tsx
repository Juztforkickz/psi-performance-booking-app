import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/constants/brand';
import type { VehicleServiceSummaryRow } from '@/lib/database.types';
import { getSupabaseClient } from '@/lib/supabase';
import { workshopOdometerDate } from '@/lib/workshop-odometer';

export function WorkshopOdometerSummary({ vehicleId, revision = 0 }: { vehicleId: string; revision?: number }) {
  const [state, setState] = useState<{ vehicleId: string; reading: VehicleServiceSummaryRow | null } | null>(null);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await getSupabaseClient().from('vehicle_service_summary').select('*').eq('vehicle_id', vehicleId).maybeSingle();
      if (!active) return;
      setFailed(Boolean(error));
      if (!error) setState({ vehicleId, reading: data });
    };
    void load().catch(() => { if (active) setFailed(true); });
    const subscription = AppState.addEventListener('change', value => { if (value === 'active') void load().catch(() => {}); });
    return () => { active = false; subscription.remove(); };
  }, [vehicleId, revision, refresh]);
  const reading = state?.vehicleId === vehicleId ? state.reading : null;
  return <View style={styles.panel}>
    <Text style={styles.label}>Latest PSI odometer</Text>
    {reading ? <>
      <Text style={styles.value}>{reading.latest_psi_odometer_km == null ? 'No workshop reading recorded yet' : `${reading.latest_psi_odometer_km.toLocaleString('en-AU')} km`}</Text>
      {reading.latest_psi_odometer_km != null ? <Text style={styles.date}>{workshopOdometerDate(reading.latest_psi_odometer_recorded_on)}</Text> : null}
    </> : <Text style={styles.date}>{failed ? 'Workshop reading could not be refreshed.' : state?.vehicleId === vehicleId ? 'No active vehicle summary available.' : 'Loading workshop reading…'}</Text>}
    <Pressable accessibilityRole="button" onPress={() => setRefresh(value => value + 1)} style={styles.refresh}><Text style={styles.refreshText}>Refresh reading</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: 10, padding: spacing.md, gap: 6 },
  label: { color: colors.accent, fontWeight: '800', fontSize: 13 },
  value: { color: colors.white, fontWeight: '800', fontSize: 20, lineHeight: 27 },
  date: { color: colors.silver, fontSize: 14, lineHeight: 21 },
  refresh: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  refreshText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
});
