import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { CUSTOMER_PREVIEW, type PreviewBooking } from '@/lib/customer-preview';
import { useCustomerPreview } from '@/lib/customer-preview-context';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const SEPTEMBER_2026 = [null, ...Array.from({ length: 30 }, (_, index) => index + 1), null, null, null, null];

export default function BookingsScreen() {
  const router = useRouter();
  const { prepareBookingVehicle, selectedVehicleId } = useCustomerPreview();
  const { compact, horizontalPadding } = useResponsiveLayout();
  const [bookingChooserOpen, setBookingChooserOpen] = useState(false);

  const upcoming = CUSTOMER_PREVIEW.bookings.filter((booking) => booking.status !== 'completed');
  const past = CUSTOMER_PREVIEW.bookings.filter((booking) => booking.status === 'completed');

  const openBooking = (type: 'service' | 'dyno') => {
    setBookingChooserOpen(false);
    prepareBookingVehicle(selectedVehicleId);
    router.push({ pathname: '/booking', params: { type } });
  };

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: horizontalPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Your PSI visits</Text>
            <Text maxFontSizeMultiplier={1.8} style={[styles.title, compact && styles.titleCompact]}>Bookings</Text>
          </View>
          <View accessibilityLabel={`${upcoming.length} example upcoming bookings`} style={styles.countBadge}>
            <Text style={styles.countNumber}>{upcoming.length}</Text>
            <Text style={styles.countLabel}>Ahead</Text>
          </View>
        </View>

        <View accessibilityRole="alert" style={styles.previewNotice}>
          <Text style={styles.previewNoticeTitle}>Your visits only</Text>
          <Text style={styles.previewNoticeCopy}>
            This public demo shows synthetic appointments. A real account will show only your requests and confirmed visits; PSI workshop availability stays private.
          </Text>
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <View style={styles.calendarHeadingCopy}>
              <Text style={styles.calendarKicker}>Example month</Text>
              <Text style={styles.calendarTitle}>September 2026</Text>
            </View>
            <Ionicons color={colors.gold} name="calendar-clear-outline" size={24} />
          </View>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}
          </View>
          <View style={styles.daysGrid}>
            {SEPTEMBER_2026.map((day, index) => {
              const appointment = day === 16;
              return (
                <View
                  accessibilityLabel={day ? `${day} September${appointment ? ', confirmed dyno tuning visit' : ''}` : undefined}
                  key={`${day ?? 'empty'}-${index}`}
                  style={[styles.dayCell, !day && styles.dayCellEmpty, appointment && styles.dayCellBooked]}
                >
                  {day ? <Text style={[styles.dayText, appointment && styles.dayTextBooked]}>{day}</Text> : null}
                  {appointment ? <View style={styles.dayDot} /> : null}
                </View>
              );
            })}
          </View>
          <View style={styles.calendarLegend}>
            <View style={styles.legendMark} />
            <Text style={styles.legendText}>Your confirmed example visit</Text>
          </View>
          <Text style={styles.calendarNote}>The account calendar is a personal visit history—not an open PSI workshop calendar.</Text>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Coming up</Text>
          <Pressable accessibilityRole="button" onPress={() => setBookingChooserOpen(true)}>
            <Text style={styles.sectionAction}>+ Book ahead</Text>
          </Pressable>
        </View>
        <View style={styles.bookingList}>
          {upcoming.map((booking) => <BookingCard booking={booking} key={booking.id} />)}
        </View>

        <View style={styles.callout}>
          <Ionicons color={colors.gold} name="time-outline" size={28} />
          <View style={styles.calloutCopy}>
            <Text style={styles.calloutTitle}>Planning a future visit?</Text>
            <Text style={styles.bodyCopy}>Choose the type of work and your preferred date. PSI reviews the request before confirming a time or deposit.</Text>
          </View>
          <PrimaryButton label="Book ahead" onPress={() => setBookingChooserOpen(true)} />
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Visit history</Text>
          <Text style={styles.sectionMeta}>Example</Text>
        </View>
        <View style={styles.bookingList}>
          {past.map((booking) => <BookingCard booking={booking} key={booking.id} />)}
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setBookingChooserOpen(false)}
        transparent
        visible={bookingChooserOpen}
      >
        <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.modalSafeArea}>
          <ScrollView contentContainerStyle={styles.modalBackdrop} showsVerticalScrollIndicator={false}>
            <Pressable
              accessibilityLabel="Close booking type chooser"
              accessibilityRole="button"
              onPress={() => setBookingChooserOpen(false)}
              style={StyleSheet.absoluteFill}
            />
            <View accessibilityViewIsModal style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.eyebrow}>Book ahead</Text>
                <Text style={styles.modalTitle}>Choose a starting point</Text>
              </View>
              <Pressable
                accessibilityLabel="Close"
                accessibilityRole="button"
                onPress={() => setBookingChooserOpen(false)}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <Ionicons color={colors.white} name="close" size={24} />
              </Pressable>
            </View>
            <BookingChoice icon="construct-outline" label="Service & Report" onPress={() => openBooking('service')} />
            <BookingChoice icon="speedometer-outline" label="Dyno Tuning" onPress={() => openBooking('dyno')} />
            <Text style={styles.modalNote}>Submissions remain disabled in this public demo. The existing request flow can still be explored safely.</Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function BookingCard({ booking }: { booking: PreviewBooking }) {
  const confirmed = booking.status === 'confirmed';
  const completed = booking.status === 'completed';
  const vehicle = CUSTOMER_PREVIEW.vehicles.find((item) => item.id === booking.vehicleId);
  const statusLabel = confirmed ? 'Confirmed' : completed ? 'Completed' : 'PSI review';
  const icon = booking.service === 'Dyno Tuning' ? 'speedometer-outline' : 'construct-outline';

  return (
    <View style={styles.bookingCard}>
      <View style={[styles.bookingIcon, confirmed && styles.bookingIconActive]}>
        <Ionicons color={confirmed ? colors.ink : colors.gold} name={icon} size={24} />
      </View>
      <View style={styles.bookingCopy}>
        <View style={styles.bookingTopline}>
          <Text style={styles.bookingStatus}>{statusLabel}</Text>
          <Text style={styles.bookingRef}>{booking.reference}</Text>
        </View>
        <Text style={styles.bookingTitle}>{booking.service}</Text>
        <Text style={styles.bodyCopy}>{vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Vehicle'}</Text>
        <Text style={styles.bookingDate}>{formatBookingDate(booking.scheduledFor)}</Text>
      </View>
      <Ionicons color={colors.muted} name="chevron-forward" size={18} />
    </View>
  );
}

function BookingChoice({
  icon,
  label,
  onPress,
}: {
  icon: 'construct-outline' | 'speedometer-outline';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.bookingChoice, pressed && styles.pressed]}>
      <Ionicons color={colors.gold} name={icon} size={28} />
      <Text style={styles.bookingChoiceText}>{label}</Text>
      <Ionicons color={colors.white} name="arrow-forward" size={20} />
    </Pressable>
  );
}

function formatBookingDate(value: string | null) {
  if (!value) return 'Preferred date awaits PSI review';
  return new Date(value).toLocaleString('en-AU', {
    timeZone: 'Australia/Melbourne',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  scroll: { width: '100%', maxWidth: 880, alignSelf: 'center', gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  header: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  headerCopy: { flex: 1, gap: spacing.xs },
  eyebrow: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' },
  title: { color: colors.white, fontSize: 39, fontWeight: '900', letterSpacing: -1.5, lineHeight: 41, textTransform: 'uppercase' },
  titleCompact: { fontSize: 33, lineHeight: 35 },
  countBadge: { ...mobileFrame, minWidth: 64, alignItems: 'center', backgroundColor: colors.cream, padding: spacing.sm },
  countNumber: { color: colors.ink, fontSize: 21, fontWeight: '900', lineHeight: 23 },
  countLabel: { color: colors.ink, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  previewNotice: { ...mobileFrame, gap: spacing.xs, backgroundColor: colors.cream, padding: spacing.md },
  previewNoticeTitle: { color: colors.ink, fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  previewNoticeCopy: { color: '#464646', fontSize: 11, lineHeight: 17 },
  calendarCard: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.panel, padding: spacing.md },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  calendarHeadingCopy: { gap: 2 },
  calendarKicker: { color: colors.gold, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  calendarTitle: { color: colors.white, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  weekRow: { flexDirection: 'row' },
  weekday: { width: '14.2857%', color: colors.muted, fontSize: 9, fontWeight: '900', textAlign: 'center' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.inkSoft },
  dayCellEmpty: { borderColor: 'transparent', backgroundColor: 'transparent' },
  dayCellBooked: { borderWidth: 3, borderColor: colors.white, backgroundColor: colors.cream },
  dayText: { color: colors.cream, fontSize: 11, fontWeight: '800' },
  dayTextBooked: { color: colors.ink, fontWeight: '900' },
  dayDot: { position: 'absolute', bottom: 5, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.goldDark },
  calendarLegend: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendMark: { width: 11, height: 11, borderRadius: 2, backgroundColor: colors.cream },
  legendText: { color: colors.cream, fontSize: 10, fontWeight: '700' },
  calendarNote: { color: colors.mutedDark, fontSize: 10, lineHeight: 15 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.sm },
  sectionTitle: { color: colors.white, fontSize: 15, fontWeight: '900', letterSpacing: .8, textTransform: 'uppercase' },
  sectionAction: { color: colors.gold, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  sectionMeta: { color: colors.muted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  bookingList: { gap: spacing.sm },
  bookingCard: { ...mobileFrame, minHeight: 118, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.panel, padding: spacing.md },
  bookingIcon: { ...mobileFrame, width: 48, height: 48, flexShrink: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  bookingIconActive: { backgroundColor: colors.cream },
  bookingCopy: { flex: 1, minWidth: 0, gap: 3 },
  bookingTopline: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.xs },
  bookingStatus: { color: colors.gold, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  bookingRef: { color: colors.mutedDark, fontSize: 8, fontWeight: '800' },
  bookingTitle: { color: colors.white, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  bodyCopy: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  bookingDate: { color: colors.cream, fontSize: 10, fontWeight: '800' },
  callout: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.inkSoft, padding: spacing.lg },
  calloutCopy: { gap: spacing.xs },
  calloutTitle: { color: colors.white, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  modalSafeArea: { flex: 1, backgroundColor: 'rgba(0,0,0,.82)' },
  modalBackdrop: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  modalSheet: { ...mobileFrame, width: '100%', maxWidth: 560, gap: spacing.md, backgroundColor: colors.inkSoft, padding: spacing.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  modalHeaderCopy: { flex: 1, gap: spacing.xs },
  modalTitle: { color: colors.white, fontSize: 22, fontWeight: '900', lineHeight: 26, textTransform: 'uppercase' },
  closeButton: { ...mobileFrame, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  bookingChoice: { ...mobileFrame, minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.panel, padding: spacing.md },
  bookingChoiceText: { flex: 1, color: colors.white, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  modalNote: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  pressed: { opacity: .72 },
});
