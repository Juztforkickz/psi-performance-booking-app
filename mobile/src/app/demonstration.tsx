import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState, type PropsWithChildren } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { CUSTOMER_PREVIEW } from '@/lib/customer-preview';
import { DEMONSTRATION_PLANS, DEMONSTRATION_SERVICES, demonstrationBookingDates, demonstrationOdometer } from '@/lib/public-demonstration';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';
import { PREVIEW_FUTURE_REPAIRS, PREVIEW_INVOICE_RECORDS, PREVIEW_REPAIR_RECORDS } from '@/lib/vehicle-reports-preview';

const VEHICLE_ART = [
  require('../../assets/images/garage-vehicles/holden-commodore-vf.jpg'),
  require('../../assets/images/garage-vehicles/ford-mustang.jpg'),
] as const;
const WORKSHOP_PHOTO = require('../../assets/images/psi-dyno-mobile.jpg');
const SECTIONS = ['Overview', 'My Garage', 'Records', 'Book a service', 'Reminders', 'Performance+', 'History import'] as const;
type Section = typeof SECTIONS[number];
type RecordView = 'invoice' | 'dyno' | 'photos' | 'service' | 'document' | null;
type BookingStep = 'vehicle' | 'service' | 'date' | 'review' | 'complete';

/** Public examples are deliberately independent of auth, storage and live APIs. */
export default function DemonstrationScreen() {
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();
  const scroll = useRef<ScrollView>(null);
  const [section, setSection] = useState<Section>('Overview');
  const [vehicleIndex, setVehicleIndex] = useState(0);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [illustrations, setIllustrations] = useState([0, 1]);
  const [odometers, setOdometers] = useState<number[]>(CUSTOMER_PREVIEW.vehicles.map((vehicle) => vehicle.odometerKm));
  const [odometerInput, setOdometerInput] = useState('');
  const [notice, setNotice] = useState('');
  const [recordView, setRecordView] = useState<RecordView>(null);
  const [bookingStep, setBookingStep] = useState<BookingStep>('vehicle');
  const [bookingVehicle, setBookingVehicle] = useState(0);
  const [service, setService] = useState<string>(DEMONSTRATION_SERVICES[0]);
  const [dates] = useState(demonstrationBookingDates);
  const [date, setDate] = useState(dates[0]);
  const [reminderRead, setReminderRead] = useState(false);
  const [plan, setPlan] = useState<'annual' | 'monthly'>('annual');
  const [purchaseStep, setPurchaseStep] = useState<'choose' | 'review' | 'complete'>('choose');
  const [historyStep, setHistoryStep] = useState<'details' | 'review' | 'complete'>('details');
  const [historyVehicle, setHistoryVehicle] = useState(0);
  const vehicle = CUSTOMER_PREVIEW.vehicles[vehicleIndex];
  const selectedPlan = DEMONSTRATION_PLANS.find((item) => item.id === plan)!;

  const moveTo = (next: Section) => {
    setSection(next);
    setNotice('');
    setRecordView(null);
    if (next === 'Book a service' && bookingStep === 'vehicle') setBookingVehicle(primaryIndex);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const account = () => router.replace('/account');
  const reset = () => {
    setVehicleIndex(0); setPrimaryIndex(0); setIllustrations([0, 1]);
    setOdometers(CUSTOMER_PREVIEW.vehicles.map((item) => item.odometerKm));
    setOdometerInput(''); setRecordView(null); setBookingStep('vehicle'); setBookingVehicle(0);
    setService(DEMONSTRATION_SERVICES[0]); setDate(dates[0]); setReminderRead(false);
    setPlan('annual'); setPurchaseStep('choose'); setHistoryStep('details'); setHistoryVehicle(0);
    moveTo('Overview'); setNotice('Sample account reset. All sample changes were cleared.');
  };
  const chooseVehicle = (index: number) => {
    setVehicleIndex(index); setOdometerInput(''); setNotice('');
  };

  return <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={s.screen}>
    <View style={[s.banner, { paddingHorizontal: horizontalPadding }]}>
      <Text accessibilityRole="header" style={s.bannerTitle}>Demonstration • Sample data</Text>
      <View style={s.toolbar}>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={s.textButton}><Ionicons name="close-outline" color={colors.accent} size={21} /><Text style={s.link}>Exit demonstration</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={reset} style={s.textButton}><Ionicons name="refresh-outline" color={colors.accent} size={18} /><Text style={s.link}>Reset</Text></Pressable>
      </View>
    </View>
    <ScrollView ref={scroll} automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingHorizontal: horizontalPadding }]}>
      <View style={s.headingGroup}><Text style={s.eyebrow}>YOUR PSI APP</Text><Text accessibilityRole="header" style={s.title}>Try it for yourself</Text><Text style={s.copy}>Explore Jordan’s fictional garage. Sample bookings and payments stay in this demonstration.</Text></View>
      <View style={s.tabs} accessibilityRole="tablist">
        {SECTIONS.map((item) => <Choice key={item} label={item} role="tab" selected={section === item} onPress={() => moveTo(item)} />)}
      </View>
      {notice && section !== 'My Garage' ? <Text accessibilityRole="alert" style={s.notice}>{notice}</Text> : null}

      {section === 'Overview' ? <>
        <Card><Text style={s.eyebrow}>SAMPLE CUSTOMER</Text><Text style={s.heading}>Welcome, Jordan</Text><Text style={s.copy}>Two vehicles. Your service records, upcoming work and booking requests in one place.</Text><Summary label="Profile" value="Jordan • jordan@example.com" /><Summary label="Membership" value="Performance+ demonstration" /><Text style={s.small}>No account is created and no free trial starts here.</Text></Card>
        <Card><Text style={s.heading}>Your own account in three steps</Text>{[['1', 'Verify your email', 'Receive a code by email and enter it in the app.'], ['2', 'Complete your profile', 'Add your details and first vehicle.'], ['3', 'Start using PSI', 'Make real booking requests and explore your 14 day Performance+ trial.']].map(([number, title, copy]) => <View key={number} style={s.stepRow}><Text style={s.stepNumber}>{number}</Text><View style={s.flex}><Text style={s.subheading}>{title}</Text><Text style={s.copy}>{copy}</Text></View></View>)}<Text style={s.small}>The trial ends unless you subscribe. Your account and basic booking remain available.</Text></Card>
        <PrimaryButton label="Explore the sample garage" onPress={() => moveTo('My Garage')} />
      </> : null}

      {section === 'My Garage' ? <>
        <VehicleChoices selected={vehicleIndex} onSelect={chooseVehicle} />
        <Card><Image source={VEHICLE_ART[illustrations[vehicleIndex]]} style={s.vehicleImage} resizeMode="contain" accessibilityLabel={`Sample ${illustrations[vehicleIndex] === 0 ? 'Holden' : 'Ford'} illustration`} /><Text style={s.eyebrow}>{primaryIndex === vehicleIndex ? 'PRIMARY SAMPLE VEHICLE' : 'SAMPLE VEHICLE'}</Text><Text style={s.heading}>{vehicle.year} {vehicle.make} {vehicle.model}</Text><Summary label="Registration" value={vehicle.registration} /><Summary label="Odometer" value={`${odometers[vehicleIndex].toLocaleString('en-AU')} km`} />
          <PrimaryButton label={primaryIndex === vehicleIndex ? 'Primary vehicle selected' : 'Make primary sample vehicle'} disabled={primaryIndex === vehicleIndex} onPress={() => { setPrimaryIndex(vehicleIndex); setNotice('Sample primary vehicle changed. Your next sample booking will start with this vehicle.'); }} variant="outline" />
        </Card>
        <Card><Text style={s.heading}>Try changing the illustration</Text><Text style={s.copy}>Artwork changes only in this sample garage.</Text><View style={s.tabs}>{['Holden illustration', 'Ford illustration'].map((label, index) => <Choice key={label} label={label} selected={illustrations[vehicleIndex] === index} onPress={() => setIllustrations((current) => current.map((value, position) => position === vehicleIndex ? index : value))} />)}</View></Card>
        <Card><Text style={s.heading}>Try an odometer update</Text><Field label="Sample odometer, km" hint="No real vehicle is updated"><FormInput keyboardType="number-pad" maxLength={7} value={odometerInput} onChangeText={setOdometerInput} placeholder={String(odometers[vehicleIndex])} /></Field><PrimaryButton label="Save sample reading" onPress={() => { const next = demonstrationOdometer(odometerInput, odometers[vehicleIndex]); if (next === null) { setNotice(`Enter whole kilometres from ${odometers[vehicleIndex].toLocaleString('en-AU')} to 9,999,999.`); return; } setOdometers((current) => current.map((value, index) => index === vehicleIndex ? next : value)); setOdometerInput(''); setNotice('Sample reading saved for this demonstration only.'); }} /></Card>
        {notice ? <Text accessibilityRole="alert" style={s.notice}>{notice}</Text> : null}
        <PrimaryButton label="Explore sample records" onPress={() => moveTo('Records')} />
      </> : null}

      {section === 'Records' ? <>
        <Card><Text style={s.eyebrow}>HOLDEN COMMODORE VF SS • DEMO 01</Text><Text style={s.heading}>A history you can open</Text><Text style={s.copy}>Explore example records for Jordan’s Holden. These are fictional samples, not customer records.</Text>{([['invoice', 'Invoice'], ['dyno', 'Dyno result'], ['photos', 'Photo gallery'], ['service', 'Service history'], ['document', 'Inspection document']] as const).map(([value, label]) => <PrimaryButton key={value} label={`Open sample ${label.toLowerCase()}`} variant={recordView === value ? 'accent' : 'outline'} onPress={() => setRecordView(recordView === value ? null : value)} />)}</Card>
        {recordView ? <View key={recordView} onLayout={(event) => scroll.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: true })}><SampleRecord kind={recordView} onClose={() => { setRecordView(null); scroll.current?.scrollTo({ y: 0, animated: true }); }} /></View> : null}
      </> : null}

      {section === 'Book a service' ? <Card>
        <Text style={s.eyebrow}>SAMPLE BOOKING</Text><Text style={s.heading}>{bookingStep === 'complete' ? 'Sample booking complete' : 'Request a workshop visit'}</Text>
        {bookingStep !== 'complete' ? <Text style={s.small}>Try the steps below. No appointment will be reserved and nothing will be sent to PSI.</Text> : null}
        {bookingStep === 'vehicle' ? <><Text style={s.subheading}>1. Choose your vehicle</Text><VehicleChoices selected={bookingVehicle} onSelect={setBookingVehicle} /><PrimaryButton label="Continue to service" onPress={() => setBookingStep('service')} /></> : null}
        {bookingStep === 'service' ? <><Text style={s.subheading}>2. Choose a service</Text>{DEMONSTRATION_SERVICES.map((item) => <Choice key={item} selected={service === item} label={item} onPress={() => setService(item)} />)}<PrimaryButton label="Continue to date" onPress={() => setBookingStep('date')} /><PrimaryButton label="Back to vehicle" variant="outline" onPress={() => setBookingStep('vehicle')} /></> : null}
        {bookingStep === 'date' ? <><Text style={s.subheading}>3. Choose a preferred date</Text><Text style={s.small}>Example dates only. This does not show PSI’s actual availability.</Text>{dates.map((item) => <Choice key={item.key} label={item.label} selected={date.key === item.key} onPress={() => setDate(item)} />)}<PrimaryButton label="Review sample request" onPress={() => setBookingStep('review')} /><PrimaryButton label="Back to service" variant="outline" onPress={() => setBookingStep('service')} /></> : null}
        {bookingStep === 'review' ? <><Text style={s.subheading}>4. Review the sample request</Text><Summary label="Customer" value="Jordan, demonstration account" /><Summary label="Vehicle" value={vehicleLabel(bookingVehicle)} /><Summary label="Service" value={service} /><Summary label="Preferred date" value={date.label} /><Text style={s.copy}>For real requests, PSI reviews the details and confirms the next steps.</Text><PrimaryButton label="Finish sample booking" onPress={() => setBookingStep('complete')} /><PrimaryButton label="Change sample date" variant="outline" onPress={() => setBookingStep('date')} /></> : null}
        {bookingStep === 'complete' ? <><Ionicons name="checkmark-circle-outline" color={colors.accent} size={48} /><Text style={s.copy}>You have completed the booking walkthrough. No booking was submitted.</Text><Text style={s.copy}>Create your account or sign in to request a real visit with PSI.</Text><PrimaryButton label="Try another sample booking" variant="outline" onPress={() => { setBookingVehicle(primaryIndex); setBookingStep('vehicle'); }} /></> : null}
      </Card> : null}

      {section === 'Reminders' ? <Card><Text style={s.eyebrow}>{reminderRead ? 'READ • SAMPLE REMINDER' : 'UNREAD • SAMPLE REMINDER'}</Text><Text style={s.heading}>Keep upcoming work in view</Text><Text style={s.copy}>Your account brings upcoming service reminders and recommended work together.</Text>{PREVIEW_FUTURE_REPAIRS.map((item) => <View key={item.id} style={s.recordRow}><Text style={s.subheading}>{item.title}</Text><Text style={s.copy}>{item.notes}</Text><Text style={s.small}>{item.timing}</Text></View>)}<PrimaryButton label={reminderRead ? 'Mark sample reminder unread' : 'Mark sample reminder read'} variant="outline" onPress={() => setReminderRead((value) => !value)} /><Text style={s.small}>Demonstration reminders stay here. They do not send push notifications or emails.</Text></Card> : null}

      {section === 'Performance+' ? <Card><Text style={s.eyebrow}>PERFORMANCE+ • SAMPLE CHECKOUT</Text><Text style={s.heading}>Your vehicle history, close at hand</Text>
        {purchaseStep === 'choose' ? <><Text style={s.copy}>Explore your invoices, workshop photos, service records and dyno results together.</Text>{DEMONSTRATION_PLANS.map((item) => <Choice key={item.id} label={`${item.title} • ${item.price} ${item.interval}`} selected={plan === item.id} onPress={() => setPlan(item.id)} />)}<Text style={s.small}>Australian reference prices. Your app store shows the final price and renewal terms before a real purchase.</Text><PrimaryButton label="Preview plan checkout" onPress={() => setPurchaseStep('review')} /></> : null}
        {purchaseStep === 'review' ? <><Summary label="Plan" value={`Performance+ ${selectedPlan.title}`} /><Summary label="Example price" value={`${selectedPlan.price} ${selectedPlan.interval}`} /><Text style={s.copy}>A real purchase continues through your app store and renews automatically unless cancelled. This sample does not open the store or charge you.</Text><PrimaryButton label="Confirm sample plan" onPress={() => setPurchaseStep('complete')} /><PrimaryButton label="Back to plans" variant="outline" onPress={() => setPurchaseStep('choose')} /></> : null}
        {purchaseStep === 'complete' ? <><Ionicons name="checkmark-circle-outline" color={colors.accent} size={48} /><Text style={s.heading}>Sample confirmation</Text><Text style={s.copy}>You have explored the subscription steps. No subscription, payment or trial has started.</Text><PrimaryButton label="Explore the sample records" onPress={() => moveTo('Records')} /><PrimaryButton label="Back to plans" variant="outline" onPress={() => setPurchaseStep('choose')} /></> : null}
      </Card> : null}

      {section === 'History import' ? <Card><Text style={s.eyebrow}>ONE TIME SERVICE • SAMPLE REQUEST</Text><Text style={s.heading}>Bring previous PSI history into the app</Text>
        {historyStep === 'details' ? <><Text style={s.copy}>PSI can locate and organise eligible older invoices, service records, dyno results, photos and documents.</Text><Text style={s.price}>AUD $199</Text><Text style={s.small}>Once only. One vehicle. Records must be located and confidently matched.</Text><Text style={s.subheading}>Choose a sample vehicle</Text><VehicleChoices selected={historyVehicle} onSelect={setHistoryVehicle} /><PrimaryButton label="Review sample history import" onPress={() => setHistoryStep('review')} /></> : null}
        {historyStep === 'review' ? <><Summary label="Vehicle" value={vehicleLabel(historyVehicle)} /><Summary label="Previous details" value="Sample registration DEMO 00" /><Summary label="Example total" value="AUD $199" /><Text style={s.copy}>Real requests go through secure checkout before PSI begins its manual review. Finding every older record cannot be guaranteed.</Text><PrimaryButton label="Simulate payment and request" onPress={() => setHistoryStep('complete')} /><PrimaryButton label="Back to details" variant="outline" onPress={() => setHistoryStep('details')} /></> : null}
        {historyStep === 'complete' ? <><Ionicons name="checkmark-circle-outline" color={colors.accent} size={48} /><Text style={s.heading}>Sample request complete</Text><Text style={s.copy}>A real request would progress through payment received, PSI review, history organised and import complete.</Text><Text style={s.small}>No payment was taken and no request was sent.</Text><PrimaryButton label="Try the sample again" variant="outline" onPress={() => setHistoryStep('details')} /></> : null}
      </Card> : null}

      <Card><Text style={s.heading}>{REVIEW_ENVIRONMENT.enabled ? 'Reviewer access' : 'Make it your own'}</Text><Text style={s.copy}>{REVIEW_ENVIRONMENT.enabled ? 'You are using the separate reviewer environment. Return to Account and exit reviewer demonstration before creating a real customer account.' : 'Create your profile before adding real details or booking with PSI. Already registered? Sign in with your emailed code.'}</Text><PrimaryButton label={REVIEW_ENVIRONMENT.enabled ? 'Open reviewer account' : 'Create account or sign in'} onPress={account} /><Text style={s.small}>These sample actions do not change your real account. Use Reset to clear this demonstration.</Text></Card>
    </ScrollView>
  </SafeAreaView>;
}

function vehicleLabel(index: number) {
  const item = CUSTOMER_PREVIEW.vehicles[index];
  return `${item.year} ${item.make} ${item.model} • ${item.registration}`;
}

function VehicleChoices({ selected, onSelect }: { selected: number; onSelect: (index: number) => void }) {
  return <View style={s.group}>{CUSTOMER_PREVIEW.vehicles.map((vehicle, index) => <Choice key={vehicle.id} selected={selected === index} label={vehicleLabel(index)} onPress={() => onSelect(index)} />)}</View>;
}

function Choice({ label, selected, onPress, role = 'button' }: { label: string; selected: boolean; onPress: () => void; role?: 'button' | 'tab' }) {
  return <Pressable accessibilityRole={role} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [s.choice, selected && s.choiceSelected, pressed && s.pressed]}><Text style={[s.choiceLabel, selected && s.choiceLabelSelected]}>{label}</Text></Pressable>;
}

function Card({ children }: PropsWithChildren) { return <View style={s.card}>{children}</View>; }
function Summary({ label, value }: { label: string; value: string }) { return <View style={s.summary}><Text style={s.small}>{label}</Text><Text style={s.summaryValue}>{value}</Text></View>; }

function SampleRecord({ kind, onClose }: { kind: NonNullable<RecordView>; onClose: () => void }) {
  const invoice = PREVIEW_INVOICE_RECORDS[0];
  const dyno = CUSTOMER_PREVIEW.dynoResults[0];
  return <Card><Text style={s.eyebrow}>FICTIONAL SAMPLE • HOLDEN COMMODORE VF SS</Text>
    {kind === 'invoice' ? <><Text style={s.heading}>Sample invoice</Text><View style={s.document}><Text style={s.heading}>PSI Performance</Text><Text style={s.small}>Demonstration invoice. Not a tax invoice.</Text><Summary label="Reference" value={invoice.invoiceNumber} /><Summary label="Date" value="14 May 2026" /><Summary label="Customer" value="Jordan • DEMO 01" /><Summary label="Description" value={invoice.summary} /><Summary label="Example total" value={`AUD $${invoice.amountAud!.toFixed(2)}`} /><Text style={s.copy}>Fluids, filters and general vehicle health inspection.</Text></View></> : null}
    {kind === 'dyno' ? <><Text style={s.heading}>Sample dyno result</Text><Summary label="Peak power" value={`${dyno.peakPower.value} HP at hubs`} /><Summary label="Peak torque" value={`${dyno.peakTorque.value} Nm at hubs`} /><Summary label="Fuel" value={dyno.fuel} /><Text style={s.small}>Illustrative power chart. Fictional readings only.</Text><View accessibilityLabel="Sample power chart rising from 90 to 426 horsepower before falling to 405 horsepower" style={s.chart}>{[90, 170, 250, 320, 385, 426.4, 405].map((power, index) => <View key={index} style={s.barColumn}><View style={[s.bar, { height: power / 3.1 }]} /><Text maxFontSizeMultiplier={1.3} style={s.chartLabel}>{index + 1}</Text></View>)}</View><Text style={s.small}>Engine speed, thousands of RPM</Text></> : null}
    {kind === 'photos' ? <><Text style={s.heading}>Sample gallery</Text><Image source={WORKSHOP_PHOTO} style={s.galleryImage} resizeMode="contain" accessibilityLabel="PSI promotional vehicle photo used to demonstrate the photo gallery" /><Text style={s.small}>Existing PSI promotional image, shown as a gallery example. It is not Jordan’s service record.</Text><Image source={VEHICLE_ART[0]} style={s.vehicleImage} resizeMode="contain" accessibilityLabel="Sample Holden vehicle illustration" /><Text style={s.small}>Vehicle illustration</Text></> : null}
    {kind === 'service' ? <><Text style={s.heading}>Sample service history</Text>{PREVIEW_REPAIR_RECORDS.map((item) => <View key={item.id} style={s.recordRow}><Text style={s.subheading}>{item.title}</Text><Text style={s.small}>{item.repairedAt.split('-').reverse().join('/')}{item.odometerKm ? ` • ${item.odometerKm.toLocaleString('en-AU')} km` : ''}</Text><Text style={s.copy}>{item.description}</Text></View>)}</> : null}
    {kind === 'document' ? <><Text style={s.heading}>Sample inspection document</Text><View style={s.document}><Text style={s.subheading}>Vehicle health inspection</Text><Text style={s.small}>14 May 2026 • DEMO 01 • 84,210 km</Text>{['Fluids and filters checked', 'General vehicle health inspected', 'Rear differential oil leak to monitor', 'Front brake pads to review at next visit'].map((item) => <View key={item} style={s.stepRow}><Ionicons color={colors.accent} name="document-text-outline" size={19} /><Text style={[s.copy, s.flex]}>{item}</Text></View>)}<Text style={s.small}>Fictional report for demonstration. No vehicle has been assessed.</Text></View></> : null}
    <PrimaryButton label="Close sample record" variant="outline" onPress={onClose} />
  </Card>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  banner: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: colors.inkSoft, gap: 4 },
  bannerTitle: { color: colors.accent, fontSize: 13, lineHeight: 19, fontWeight: '900' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: spacing.md },
  textButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 9, minHeight: 44, maxWidth: '100%' },
  link: { color: colors.accent, fontSize: 12, fontWeight: '800', flexShrink: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  headingGroup: { gap: spacing.sm },
  eyebrow: { color: colors.accent, fontSize: 10, lineHeight: 16, letterSpacing: 1, fontWeight: '900' },
  title: { color: colors.white, fontSize: 30, lineHeight: 36, fontWeight: '900' },
  heading: { color: colors.white, fontSize: 22, lineHeight: 29, fontWeight: '900' },
  subheading: { color: colors.white, fontSize: 16, lineHeight: 23, fontWeight: '800' },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  small: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  notice: { ...mobileFrame, color: colors.silver, fontSize: 14, lineHeight: 22, padding: spacing.md, borderColor: colors.accent },
  card: { ...mobileFrame, backgroundColor: colors.panel, padding: spacing.md, gap: spacing.md },
  group: { gap: spacing.sm },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { ...mobileFrame, borderColor: colors.line, maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
  choiceSelected: { borderColor: colors.accent, backgroundColor: colors.inkSoft },
  choiceLabel: { color: colors.muted, flexShrink: 1, fontSize: 13, lineHeight: 20, fontWeight: '700' },
  choiceLabelSelected: { color: colors.accent },
  pressed: { opacity: 0.7 },
  flex: { flex: 1, minWidth: 0 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  stepNumber: { color: colors.accent, fontSize: 24, fontWeight: '900', minWidth: 26 },
  summary: { borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: spacing.sm, gap: 4 },
  summaryValue: { color: colors.white, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  vehicleImage: { width: '100%', aspectRatio: 1.55, backgroundColor: '#090B0E' },
  galleryImage: { width: '100%', aspectRatio: 1100 / 1227 },
  recordRow: { gap: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: spacing.md },
  document: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.inkSoft, padding: spacing.md, gap: spacing.md },
  price: { color: colors.white, fontSize: 30, fontWeight: '900' },
  chart: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', paddingTop: spacing.md, borderBottomWidth: 1, borderColor: colors.line },
  barColumn: { flex: 1, minWidth: 0, gap: 6, alignItems: 'center' },
  bar: { width: '100%', backgroundColor: colors.accent },
  chartLabel: { color: colors.muted, fontSize: 10, paddingBottom: 5 },
});
