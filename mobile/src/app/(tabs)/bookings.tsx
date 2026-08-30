import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { formatAustralianDate, formatAustralianDateTime } from '@/lib/australian-date';
import { useCustomerAccount } from '@/lib/customer-account-context';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { CUSTOMER_PREVIEW } from '@/lib/customer-preview';
import { useCustomerPreview } from '@/lib/customer-preview-context';
import { loadWorkshopWeather, normaliseDateOnly, type WeatherItem, type WorkshopWeather } from '@/lib/weather';
import type { BookingRequestRow, CustomerVehicleRow } from '@/lib/database.types';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const SEPTEMBER_2026 = [null, ...Array.from({ length: 30 }, (_, index) => index + 1), null, null, null, null];

export default function BookingsScreen() {
  const router = useRouter();
  const { account, refreshAccount, status: accountStatus } = useCustomerAccount();
  const { prepareBookingVehicle, prepareBookingVehicleRecord, selectedVehicleId } = useCustomerPreview();
  const { compact, horizontalPadding } = useResponsiveLayout();
  const [bookingChooserOpen, setBookingChooserOpen] = useState(false);
  const [vehicleChooserOpen, setVehicleChooserOpen] = useState(false);
  const [pendingBookingType, setPendingBookingType] = useState<'service' | 'dyno' | null>(null);
  const [workshopWeather, setWorkshopWeather] = useState<WorkshopWeather | null>(null);
  const [weatherError, setWeatherError] = useState(false);

  const privateAccountMode = CUSTOMER_AUTH.enabled;
  const displayBookings = privateAccountMode
    ? (account?.bookings ?? []).map((booking) => secureBookingDisplay(booking, account?.vehicles ?? []))
    : CUSTOMER_PREVIEW.bookings.map(previewBookingDisplay);
  const upcoming = displayBookings.filter((booking) => !['cancelled', 'completed'].includes(booking.state));
  const past = displayBookings.filter((booking) => ['cancelled', 'completed'].includes(booking.state));
  const calendarBookings = displayBookings.filter((booking) => ['date_approved', 'confirmed'].includes(booking.state) && booking.date);

  const openBooking = (type: 'service' | 'dyno') => {
    setBookingChooserOpen(false);
    if (privateAccountMode) {
      const vehicles = account?.vehicles ?? [];
      if (!vehicles.length) {
        router.push('/garage');
        return;
      }
      if (vehicles.length === 1) {
        prepareBookingVehicleRecord(accountVehiclePreview(vehicles[0]));
      } else {
        setPendingBookingType(type);
        setVehicleChooserOpen(true);
        return;
      }
    } else {
      prepareBookingVehicle(selectedVehicleId);
    }
    router.push({ pathname: '/booking', params: { type } });
  };

  const openBookingWithVehicle = (type: 'service' | 'dyno', vehicleId: string) => {
    const vehicle = account?.vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) return;
    prepareBookingVehicleRecord(accountVehiclePreview(vehicle));
    setVehicleChooserOpen(false);
    setPendingBookingType(null);
    router.push({ pathname: '/booking', params: { type } });
  };

  const closeVehicleChooser = () => {
    setVehicleChooserOpen(false);
    setPendingBookingType(null);
  };

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;
    const run = async () => {
      controller = new AbortController();
      try {
        const result = await loadWorkshopWeather(controller.signal);
        if (cancelled) return;
        setWorkshopWeather(result);
        setWeatherError(false);
      } catch {
        if (cancelled) return;
        setWorkshopWeather(null);
        setWeatherError(true);
      }
    };
    void run();
    return () => {
      cancelled = true;
      controller?.abort();
    };
  }, []);

  const weatherForDate = useMemo(() => {
    const weatherLookup = new Map<string, WeatherItem>();
    for (const day of workshopWeather?.nextSeven ?? []) {
      weatherLookup.set(day.date, day);
    }
    return (value: string | null) => {
      const date = normaliseDateOnly(value);
      return date ? weatherLookup.get(date) : null;
    };
  }, [workshopWeather]);

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
          <View accessibilityLabel={`${upcoming.length} upcoming bookings`} style={styles.countBadge}>
            <Text style={styles.countNumber}>{upcoming.length}</Text>
            <Text style={styles.countLabel}>Ahead</Text>
          </View>
        </View>

        <View accessibilityRole="alert" style={styles.previewNotice}>
          <Text style={styles.previewNoticeTitle}>Your visits only</Text>
          <Text style={styles.previewNoticeCopy}>
            {privateAccountMode
              ? accountStatus === 'ready'
                ? 'These are the requests and visits stored in your protected PSI account. Other customers and PSI workshop availability remain private.'
                : accountStatus === 'signed_out'
                  ? 'Sign in to load your private requests and confirmed visits. No synthetic bookings are substituted in an authenticated build.'
                  : 'Your protected booking records are loading. No synthetic bookings are being substituted.'
              : 'This public demo shows synthetic appointments. A real account will show only your requests and confirmed visits; PSI workshop availability stays private.'}
          </Text>
        </View>
        {privateAccountMode ? (
          <Pressable accessibilityRole="button" onPress={refreshAccount} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
            <Ionicons color={colors.accent} name="refresh" size={17} />
            <Text style={styles.refreshText}>Refresh private bookings</Text>
          </Pressable>
        ) : null}

        {privateAccountMode ? (
          <View style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <View style={styles.calendarHeadingCopy}>
                <Text style={styles.calendarKicker}>Private visit calendar</Text>
                <Text style={styles.calendarTitle}>Approved PSI dates</Text>
              </View>
              <Ionicons color={colors.accent} name="calendar-clear-outline" size={24} />
            </View>
            {calendarBookings.length === 0 ? (
              <Text style={styles.calendarNote}>No approved or confirmed workshop dates are currently shown. Requested dates remain preferences until PSI approves them.</Text>
            ) : calendarBookings.map((booking) => (
              <View key={booking.id} style={styles.privateCalendarRow}>
                <View style={styles.legendMark} />
                <View style={styles.privateCalendarCopy}>
                  <Text style={styles.bookingTitle}>{booking.service}</Text>
                  <Text style={styles.bookingDate}>{formatBookingDate(booking.date)}</Text>
                  <Text style={styles.bodyCopy}>{booking.vehicle}</Text>
                  {weatherForDate(booking.date) ? (
                    <Text style={styles.privateCalendarWeather}>
                      {`Forecast · ${weatherForDate(booking.date)?.temperatureMaxC ?? 0}° / ${weatherForDate(booking.date)?.temperatureMinC ?? 0}° · ${weatherForDate(booking.date)?.precipitationChance ?? 0}% rain`}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
            <Text style={styles.calendarNote}>Only your approved dates appear here. This is not PSI workshop availability.</Text>
          </View>
        ) : <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <View style={styles.calendarHeadingCopy}>
              <Text style={styles.calendarKicker}>Example month</Text>
              <Text style={styles.calendarTitle}>September 2026</Text>
            </View>
            <Ionicons color={colors.accent} name="calendar-clear-outline" size={24} />
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
        </View>}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Workshop weather</Text>
            <Text style={styles.weatherHeadingCopy}>Six-day outlook for PSI</Text>
          </View>
          <Ionicons color={colors.accent} name="partly-sunny-outline" size={24} />
        </View>
        {workshopWeather ? (
          <View style={styles.weatherStrip}>
            {workshopWeather.nextSeven.slice(0, 6).map((forecast, index) => (
              <View key={forecast.date} style={[styles.weatherDay, index === 0 && styles.weatherDayToday]}>
                <View style={styles.weatherDayTopline}>
                  <Text style={[styles.weatherDayLabel, index === 0 && styles.weatherDayLabelToday]}>
                    {index === 0 ? 'Today' : new Intl.DateTimeFormat('en-AU', { weekday: 'short' }).format(new Date(`${forecast.date}T12:00:00`))}
                  </Text>
                  <Text style={styles.weatherDateText}>
                    {new Intl.DateTimeFormat('en-AU', { day: '2-digit', month: '2-digit' }).format(new Date(`${forecast.date}T12:00:00`))}
                  </Text>
                </View>
                <Ionicons color={colors.accent} name={forecast.icon} size={26} />
                <Text style={styles.weatherDayLabel}>
                  {forecast.description}
                </Text>
                <Text style={styles.weatherTempText}>
                  {Math.round(forecast.temperatureMaxC)}° <Text style={styles.weatherMinText}>{Math.round(forecast.temperatureMinC)}°</Text>
                </Text>
                <View style={styles.weatherRainRow}>
                  <Ionicons color={colors.muted} name="water-outline" size={12} />
                  <Text style={styles.weatherRainText}>{forecast.precipitationChance}% rain</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.weatherMissing}>{weatherError ? 'Weather forecast currently unavailable' : 'Loading weather forecast…'}</Text>
        )}

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Coming up</Text>
          <Pressable accessibilityRole="button" onPress={() => setBookingChooserOpen(true)}>
            <Text style={styles.sectionAction}>+ Book ahead</Text>
          </Pressable>
        </View>
        <View style={styles.bookingList}>
          {upcoming.length === 0 ? <EmptyBookingState copy={privateAccountMode ? 'No active booking requests are currently shown.' : 'No example bookings are currently shown.'} /> : upcoming.map((booking) => <BookingCard booking={booking} key={booking.id} />)}
        </View>

        <View style={styles.callout}>
          <Ionicons color={colors.accent} name="time-outline" size={28} />
          <View style={styles.calloutCopy}>
            <Text style={styles.calloutTitle}>Planning a future visit?</Text>
            <Text style={styles.bodyCopy}>Choose the type of work and your preferred date. PSI reviews the request before confirming a time or deposit.</Text>
          </View>
          <PrimaryButton label="Book ahead" onPress={() => setBookingChooserOpen(true)} />
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Visit history</Text>
          <Text style={styles.sectionMeta}>{privateAccountMode ? 'Private account' : 'Example'}</Text>
        </View>
        <View style={styles.bookingList}>
          {past.length === 0 ? <EmptyBookingState copy="No completed or cancelled visits are currently shown." /> : past.map((booking) => <BookingCard booking={booking} key={booking.id} />)}
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
            <Text style={styles.modalNote}>{privateAccountMode
              ? account?.vehicles.length
                ? 'The selected saved vehicle opens a private request. Submission saves only after all details are reviewed.'
                : 'Add a vehicle in My Garage before submitting a private booking request.'
              : 'Submissions remain disabled in this public demo. The existing request flow can still be explored safely.'}</Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeVehicleChooser}
        transparent
        visible={vehicleChooserOpen}
      >
        <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.modalSafeArea}>
          <ScrollView contentContainerStyle={styles.modalBackdrop} showsVerticalScrollIndicator={false}>
            <Pressable
              accessibilityLabel="Close vehicle chooser"
              accessibilityRole="button"
              onPress={closeVehicleChooser}
              style={StyleSheet.absoluteFill}
            />
            <View accessibilityViewIsModal style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderCopy}>
                  <Text style={styles.eyebrow}>Choose vehicle</Text>
                  <Text style={styles.modalTitle}>Select a saved vehicle</Text>
                </View>
                <Pressable
                  accessibilityLabel="Close"
                  accessibilityRole="button"
                  onPress={closeVehicleChooser}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                >
                  <Ionicons color={colors.white} name="close" size={24} />
                </Pressable>
              </View>
              {(account?.vehicles ?? []).map((vehicle) => {
                return (
                  <Pressable
                    accessibilityLabel={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                    accessibilityRole="button"
                    key={vehicle.id}
                    onPress={() => pendingBookingType && openBookingWithVehicle(pendingBookingType, vehicle.id)}
                    style={({ pressed }) => [
                      styles.vehicleChoice,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.vehicleChoiceCopy}>
                      <Text style={styles.vehicleChoiceTitle}>
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </Text>
                      <Text style={styles.vehicleChoiceMeta}>
                        {vehicle.registration}
                      </Text>
                    </View>
                    <Ionicons
                      color={colors.silver}
                      name="chevron-forward"
                      size={22}
                    />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

type BookingDisplay = {
  date: string | null;
  id: string;
  reference: string;
  service: string;
  staffNote: string | null;
  state: BookingRequestRow['state'];
  vehicle: string;
};

function BookingCard({ booking }: { booking: BookingDisplay }) {
  const confirmed = booking.state === 'confirmed';
  const statusLabel = bookingStatusLabel(booking.state);
  const icon = booking.service === 'Dyno Tuning' ? 'speedometer-outline' : 'construct-outline';

  return (
    <View style={styles.bookingCard}>
      <View style={[styles.bookingIcon, confirmed && styles.bookingIconActive]}>
        <Ionicons color={confirmed ? colors.ink : colors.accent} name={icon} size={24} />
      </View>
      <View style={styles.bookingCopy}>
        <View style={styles.bookingTopline}>
          <Text style={styles.bookingStatus}>{statusLabel}</Text>
          <Text style={styles.bookingRef}>{booking.reference}</Text>
        </View>
        <Text style={styles.bookingTitle}>{booking.service}</Text>
        <Text style={styles.bodyCopy}>{booking.vehicle}</Text>
        <Text style={styles.bookingDate}>{booking.date ? formatBookingDate(booking.date) : 'Preferred date awaits PSI review'}</Text>
        {booking.staffNote ? <Text style={styles.bookingStaffNote}>PSI note · {booking.staffNote}</Text> : null}
      </View>
      <Ionicons color={colors.muted} name="chevron-forward" size={18} />
    </View>
  );
}

function EmptyBookingState({ copy }: { copy: string }) {
  return <View style={styles.emptyBooking}><Text style={styles.calendarNote}>{copy}</Text></View>;
}

function secureBookingDisplay(booking: BookingRequestRow, vehicles: CustomerVehicleRow[]): BookingDisplay {
  const vehicle = vehicles.find((item) => item.id === booking.vehicle_id);
  return {
    date: booking.approved_date ?? booking.preferred_date,
    id: booking.id,
    reference: `PSI-${booking.id.slice(0, 8).toUpperCase()}`,
    service: booking.booking_type === 'dyno' ? 'Dyno Tuning' : 'Service & Report',
    staffNote: booking.staff_note,
    state: booking.state,
    vehicle: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.registration}` : 'Vehicle record unavailable',
  };
}

function previewBookingDisplay(booking: (typeof CUSTOMER_PREVIEW.bookings)[number]): BookingDisplay {
  const vehicle = CUSTOMER_PREVIEW.vehicles.find((item) => item.id === booking.vehicleId);
  return {
    date: booking.scheduledFor,
    id: booking.id,
    reference: booking.reference,
    service: booking.service,
    staffNote: null,
    state: booking.status === 'awaiting_psi_review' ? 'pending_staff_review' : booking.status,
    vehicle: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Vehicle',
  };
}

function accountVehiclePreview(vehicle: CustomerVehicleRow) {
  return {
    id: vehicle.id,
    isPrimary: vehicle.is_primary,
    lastVisit: null,
    make: vehicle.make,
    model: vehicle.model,
    nextDue: null,
    odometerKm: vehicle.odometer_km,
    registration: vehicle.registration,
    vinLastFour: vehicle.vin_last_four,
    year: vehicle.year,
  };
}

function bookingStatusLabel(state: BookingRequestRow['state']) {
  if (state === 'pending_staff_review') return 'PSI review';
  if (state === 'date_proposed') return 'PSI proposed date';
  if (state === 'date_approved') return 'Date approved · deposit not paid';
  if (state === 'confirmed') return 'Confirmed';
  if (state === 'completed') return 'Completed';
  return 'Cancelled';
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
      <Ionicons color={colors.accent} name={icon} size={28} />
      <Text style={styles.bookingChoiceText}>{label}</Text>
      <Ionicons color={colors.white} name="arrow-forward" size={20} />
    </Pressable>
  );
}

function formatBookingDate(value: string | null) {
  if (!value) return 'Preferred date awaits PSI review';
  return value.length === 10 ? formatAustralianDate(value) : formatAustralianDateTime(value);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  scroll: { width: '100%', maxWidth: 880, alignSelf: 'center', gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  header: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  headerCopy: { flex: 1, gap: spacing.xs },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' },
  title: { color: colors.white, fontSize: 39, fontWeight: '900', letterSpacing: -1.5, lineHeight: 41, textTransform: 'uppercase' },
  titleCompact: { fontSize: 33, lineHeight: 35 },
  countBadge: { ...mobileFrame, minWidth: 64, alignItems: 'center', backgroundColor: colors.silver, padding: spacing.sm },
  countNumber: { color: colors.ink, fontSize: 21, fontWeight: '900', lineHeight: 23 },
  countLabel: { color: colors.ink, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  previewNotice: { ...mobileFrame, gap: spacing.xs, backgroundColor: colors.silver, padding: spacing.md },
  previewNoticeTitle: { color: colors.ink, fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  previewNoticeCopy: { color: '#464646', fontSize: 11, lineHeight: 17 },
  refreshButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.xs },
  refreshText: { color: colors.accent, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  calendarCard: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.panel, padding: spacing.md },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  calendarHeadingCopy: { gap: 2 },
  calendarKicker: { color: colors.accent, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  calendarTitle: { color: colors.white, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  weekRow: { flexDirection: 'row' },
  weekday: { width: '14.2857%', color: colors.muted, fontSize: 9, fontWeight: '900', textAlign: 'center' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.inkSoft },
  dayCellEmpty: { borderColor: 'transparent', backgroundColor: 'transparent' },
  dayCellBooked: { borderWidth: 3, borderColor: colors.white, backgroundColor: colors.silver },
  dayText: { color: colors.silver, fontSize: 11, fontWeight: '800' },
  dayTextBooked: { color: colors.ink, fontWeight: '900' },
  dayDot: { position: 'absolute', bottom: 5, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accentDark },
  calendarLegend: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  privateCalendarRow: { alignItems: 'center', borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm },
  privateCalendarCopy: { flex: 1, gap: 2 },
  privateCalendarWeather: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  legendMark: { width: 11, height: 11, borderRadius: 2, backgroundColor: colors.silver },
  legendText: { color: colors.silver, fontSize: 10, fontWeight: '700' },
  calendarNote: { color: colors.mutedDark, fontSize: 10, lineHeight: 15 },
  weatherHeadingCopy: { marginTop: 3, color: colors.muted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  weatherStrip: { ...mobileFrame, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, backgroundColor: colors.panel, padding: spacing.sm },
  weatherDay: { width: '30%', minWidth: 92, flexGrow: 1, alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.inkSoft, padding: spacing.sm },
  weatherDayToday: { borderColor: colors.accent, backgroundColor: 'rgba(101,207,248,.08)' },
  weatherDayTopline: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  weatherDayLabel: { color: colors.silver, fontSize: 9, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' },
  weatherDayLabelToday: { color: colors.accent },
  weatherDateText: { color: colors.muted, fontSize: 8, fontWeight: '800' },
  weatherTempText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  weatherMinText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  weatherRainRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  weatherRainText: { color: colors.muted, fontSize: 8, fontWeight: '800' },
  weatherMissing: { color: colors.mutedDark, fontSize: 10, fontStyle: 'italic' },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.sm },
  sectionTitle: { color: colors.white, fontSize: 15, fontWeight: '900', letterSpacing: .8, textTransform: 'uppercase' },
  sectionAction: { color: colors.accent, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  sectionMeta: { color: colors.muted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  bookingList: { gap: spacing.sm },
  bookingCard: { ...mobileFrame, minHeight: 118, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.panel, padding: spacing.md },
  bookingIcon: { ...mobileFrame, width: 48, height: 48, flexShrink: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  bookingIconActive: { backgroundColor: colors.silver },
  bookingCopy: { flex: 1, minWidth: 0, gap: 3 },
  bookingTopline: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.xs },
  bookingStatus: { color: colors.accent, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  bookingRef: { color: colors.mutedDark, fontSize: 8, fontWeight: '800' },
  bookingTitle: { color: colors.white, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  bodyCopy: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  bookingDate: { color: colors.silver, fontSize: 10, fontWeight: '800' },
  bookingStaffNote: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  emptyBooking: { ...mobileFrame, backgroundColor: colors.panel, padding: spacing.md },
  callout: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.inkSoft, padding: spacing.lg },
  calloutCopy: { gap: spacing.xs },
  calloutTitle: { color: colors.white, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  modalSafeArea: { flex: 1, backgroundColor: 'rgba(0,0,0,.82)' },
  modalBackdrop: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  modalSheet: { ...mobileFrame, zIndex: 1, width: '100%', maxWidth: 560, gap: spacing.md, backgroundColor: colors.inkSoft, padding: spacing.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  modalHeaderCopy: { flex: 1, gap: spacing.xs },
  modalTitle: { color: colors.white, fontSize: 22, fontWeight: '900', lineHeight: 26, textTransform: 'uppercase' },
  closeButton: { ...mobileFrame, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  bookingChoice: { ...mobileFrame, minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.panel, padding: spacing.md },
  bookingChoiceText: { flex: 1, color: colors.white, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  vehicleChoice: { ...mobileFrame, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.panel, padding: spacing.md },
  vehicleChoiceCopy: { flex: 1, minWidth: 0, gap: 3 },
  vehicleChoiceTitle: { color: colors.white, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  vehicleChoiceMeta: { color: colors.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  modalNote: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  pressed: { opacity: .72 },
});
