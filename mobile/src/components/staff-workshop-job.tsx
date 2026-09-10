import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui';
import { colors, spacing } from '@/constants/brand';
import type { BookingRequestRow, CustomerVehicleRow } from '@/lib/database.types';
import type { WorkshopJob } from '@/lib/performance-plus';
import { loadWorkshopJobForBooking } from '@/lib/staff-vault';
import { SUPABASE_CONNECTION } from '@/lib/supabase';

export function StaffWorkshopJob({ booking, vehicle }: { booking: BookingRequestRow; vehicle: CustomerVehicleRow | undefined }) {
  const [job, setJob] = useState<WorkshopJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void loadWorkshopJobForBooking(booking.id)
      .then(value => { if (active) setJob(value); })
      .catch(() => { if (active) setMessage('The workshop job could not be loaded. Refresh the booking and try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [booking.id]);

  if (!['confirmed', 'completed'].includes(booking.state)) return null;

  const downloadManifest = () => {
    if (Platform.OS !== 'web' || !job || !vehicle) return;
    const contents = {
      schema: 1,
      project_ref: SUPABASE_CONNECTION.projectRef,
      job_id: job.id,
      customer_id: job.customer_id,
      vehicle_id: job.vehicle_id,
      registration: vehicle.registration,
      reference: job.reference,
      job_date: job.job_date,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(contents, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${job.reference}-${vehicle.registration}-psi-job.json`.replace(/[^A-Z0-9._-]+/giu, '-');
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Folder file downloaded. Add it on the workshop PC to create the verified job folders.');
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.kicker}>Workshop PC & Xero</Text>
      {loading ? <Text style={styles.muted}>Loading the confirmed PSI job…</Text> : job ? <>
        <Text selectable style={styles.reference}>{job.reference}</Text>
        <Text style={styles.muted}>Use this exact reference in Xero. Every photo and PDF in its verified PC folder is linked to this customer, vehicle and booking.</Text>
        {Platform.OS === 'web' ? <PrimaryButton label="Download PC folder file" variant="outline" onPress={downloadManifest} /> : <Text style={styles.muted}>Open the staff portal on the workshop PC to download the folder file.</Text>}
      </> : <Text accessibilityRole="alert" style={styles.error}>{message || 'No workshop job was found. Refresh after the booking is confirmed.'}</Text>}
      {message && job ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderTopColor: colors.line, borderTopWidth: 1, gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  reference: { color: colors.white, fontSize: 16, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  message: { color: colors.accent, fontSize: 13, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
