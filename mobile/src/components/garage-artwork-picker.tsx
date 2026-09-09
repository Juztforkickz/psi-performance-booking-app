import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FlatList, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui';
import { colors } from '@/constants/brand';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { GARAGE_ART, garageArtById } from '@/lib/garage-art-assets';
import { findGarageArtwork, GARAGE_ART_MAKES, type GarageArtVehicle } from '@/lib/garage-art-catalog';
import { vaultClient } from '@/lib/performance-plus';

const previewChoices: Record<string, string> = {};
let artworkRevision = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function useGarageArtwork(vehicleId: string) {
  const revision = useSyncExternalStore(subscribe, () => artworkRevision, () => 0);
  const auth = useCustomerAuth();
  const key = `${auth.user?.id ?? 'demo'}:${vehicleId}`;
  const [choice, setChoice] = useState<{ key: string; id: string } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!CUSTOMER_AUTH.enabled || auth.status !== 'signed_in') return;
    let live = true;
    vaultClient().from('vehicle_display_preferences').select('illustration_id').eq('vehicle_id', vehicleId).maybeSingle()
      .then(({ data, error }) => { if (live && !error) setChoice({ key, id: data?.illustration_id ?? 'porsche' }); });
    return () => { live = false; };
  }, [key, vehicleId, auth.status, revision]);
  const id = !CUSTOMER_AUTH.enabled ? previewChoices[vehicleId] ?? 'porsche' : choice?.key === key ? choice.id : 'porsche';
  const select = async (id: string): Promise<boolean> => {
    if (!GARAGE_ART.some(art => art.id === id)) return false;
    setError('');
    if (CUSTOMER_AUTH.enabled) {
      if (!auth.user) return false;
      try {
        const { error } = await vaultClient().from('vehicle_display_preferences').upsert({ vehicle_id: vehicleId, customer_id: auth.user.id, illustration_id: id });
        if (error) throw error;
      } catch {
        setError('The illustration could not be saved. Please try again.');
        return false;
      }
    } else previewChoices[vehicleId] = id;
    setChoice({ key, id });
    artworkRevision += 1;
    listeners.forEach(listener => listener());
    return true;
  };
  return { art: garageArtById(id), select, error };
}

export function GarageArtworkPicker({ selectedId, onSelect, vehicle, hasVehiclePhoto = false }: {
  selectedId: string;
  onSelect: (id: string) => Promise<boolean>;
  vehicle?: GarageArtVehicle;
  hasVehiclePhoto?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [make, setMake] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const draftId = pickedId ?? selectedId;
  const [saveError, setSaveError] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const { width, height, fontScale } = useWindowDimensions();
  const compactFooter = height < 600 || fontScale > 1.45;
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const columns = width < 360 || fontScale > 1.45 ? 1 : width >= 760 ? 3 : 2;
  const results = findGarageArtwork(query, make, vehicle).map(entry => garageArtById(entry.id));
  const list = useRef<FlatList<(typeof GARAGE_ART)[number]>>(null);
  const selected = garageArtById(selectedId);
  const draft = garageArtById(draftId);
  const close = () => { if (!busy) { Keyboard.dismiss(); setOpen(false); } };
  const openLibrary = () => {
    setPickedId(null);
    setQuery('');
    setMake('');
    setSaveError('');
    setOpen(true);
  };
  const resetScroll = () => list.current?.scrollToOffset({ offset: 0, animated: false });
  const save = async () => {
    if (busy) return;
    if (draftId === selectedId) { setOpen(false); return; }
    setBusy(true);
    setSaveError('');
    try {
      if (await onSelect(draftId)) setOpen(false);
      else setSaveError('We couldn’t save this illustration. Please try again.');
    } catch { setSaveError('We couldn’t save this illustration. Please try again.'); }
    finally { setBusy(false); }
  };

  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Change garage artwork. Selected: ${selected.label}, ${selected.generation}`} accessibilityState={{ expanded: open }} onPress={openLibrary} style={({ pressed }) => [st.trigger, pressed && st.pressed]}>
      <Image source={selected.thumbnail} resizeMode="contain" style={st.triggerImage} />
      <View style={st.grow}><Text style={st.eyebrow}>GARAGE ARTWORK</Text><Text style={st.triggerLabel}>{selected.label} <Text style={st.muted}>· {selected.generation}</Text></Text></View>
      <Ionicons name="chevron-forward" color={colors.accent} size={20} />
    </Pressable>

    <Modal visible={open} animationType="slide" onRequestClose={close} presentationStyle="fullScreen">
      <SafeAreaView style={st.screen}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.screen}>
          <View style={st.library} accessibilityViewIsModal onAccessibilityEscape={close}>
            <FlatList ref={list} key={columns} numColumns={columns} data={results} extraData={draftId} keyExtractor={entry => entry.id} style={st.list} contentContainerStyle={st.cards} columnWrapperStyle={columns > 1 ? st.cardRow : undefined} initialNumToRender={6} maxToRenderPerBatch={6} windowSize={5} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
              ListHeaderComponent={<View style={st.header}>
              <View style={st.headingRow}><View style={st.grow}><Text style={st.eyebrow}>MY GARAGE</Text><Text accessibilityRole="header" style={st.title}>Choose your car</Text></View>
                <Pressable accessibilityRole="button" accessibilityLabel="Close vehicle artwork library" accessibilityState={{ disabled: busy }} disabled={busy} onPress={close} style={st.iconButton}><Ionicons name="close" size={26} color={colors.silver} /></Pressable>
              </View>
              <Text style={st.copy}>Find your model. Make it yours.</Text>
              <View style={st.search}>
                <Ionicons name="search" size={20} color={colors.muted} />
                <TextInput accessibilityLabel="Search vehicle make, model or generation" placeholder="Search VF, VS GTS, i30 N…" placeholderTextColor={colors.muted} value={query} onChangeText={value => { setQuery(value); resetScroll(); }} style={st.input} autoCorrect={false} autoCapitalize="none" returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} selectionColor={colors.accent} />
                {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear vehicle search" onPress={() => { setQuery(''); resetScroll(); }} style={st.iconButton}><Ionicons name="close-circle" size={20} color={colors.muted} /></Pressable> : null}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={st.filters}>
                {['', ...GARAGE_ART_MAKES].map(option => <Pressable key={option || 'all'} accessibilityRole="button" accessibilityLabel={option || 'All makes'} accessibilityState={{ selected: make === option }} onPress={() => { setMake(option); resetScroll(); }} style={[st.chip, make === option && st.chipSelected]}><Text style={[st.chipLabel, make === option && st.chipLabelSelected]}>{option || 'All makes'}</Text></Pressable>)}
              </ScrollView>
              <View style={st.resultHeading}><Text accessibilityLiveRegion="polite" style={st.count}>{results.length} {results.length === 1 ? 'illustration' : 'illustrations'}</Text><Text style={st.count}>Silver collection</Text></View>
              </View>}
              ListEmptyComponent={<View style={st.empty}><Ionicons name="car-sport-outline" size={32} color={colors.muted} /><Text style={st.emptyTitle}>No matching illustration yet</Text><Text style={st.copy}>Try a model or generation, or browse all makes. You can also use your own vehicle photo.</Text><Pressable accessibilityRole="button" onPress={() => { setQuery(''); setMake(''); }} style={st.emptyAction}><Text style={st.link}>Show all cars</Text></Pressable></View>}
              renderItem={({ item }) => <Pressable disabled={busy} accessibilityRole="radio" accessibilityLabel={`${item.label}, ${item.generation}`} accessibilityState={{ checked: draftId === item.id, disabled: busy }} onPress={() => { setPickedId(item.id); setSaveError(''); Keyboard.dismiss(); }} style={({ pressed }) => [st.card, { flexBasis: columns === 1 ? '100%' : columns === 2 ? '48.4%' : '32%' }, draftId === item.id && st.cardSelected, pressed && st.pressed]}>
                <View style={st.frame}><Image source={item.thumbnail} resizeMode="contain" style={st.artImage} />{draftId === item.id ? <View style={st.check}><Ionicons name="checkmark" size={16} color={colors.ink} /></View> : null}</View>
                <View style={st.cardCopy}><Text style={st.make}>{item.make}</Text><Text style={st.model}>{item.model}</Text><Text style={st.generation}>{item.generation}</Text></View>
              </Pressable>}
            />

            {!keyboardOpen && <View style={st.footer}>
              {!compactFooter && <View style={st.selection}><Image source={draft.thumbnail} resizeMode="contain" style={st.selectionImage} /><View style={st.grow}><Text style={st.eyebrow}>YOUR SELECTION</Text><Text style={st.selectionLabel}>{draft.label} · {draft.generation}</Text></View></View>}
              {hasVehiclePhoto && !compactFooter ? <Text style={st.photoHint}>Your uploaded photo stays on your vehicle profile. This artwork appears on your home tile.</Text> : null}
              {saveError ? <Text accessibilityRole="alert" style={st.error}>{saveError}</Text> : null}
              <PrimaryButton label={busy ? 'Saving…' : draftId === selectedId ? 'Done' : 'Use this illustration'} loading={busy} onPress={() => void save()} />
            </View>}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </>;
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  library: { flex: 1, width: '100%', maxWidth: 820, alignSelf: 'center' },
  grow: { flex: 1, minWidth: 0 },
  muted: { color: colors.muted, fontWeight: '400' },
  pressed: { opacity: 0.8 },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 76, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.inkSoft },
  triggerImage: { width: 78, height: 48 },
  eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 5 },
  triggerLabel: { color: colors.silver, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  header: { paddingTop: 2, paddingBottom: 12, gap: 12 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: colors.white, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  iconButton: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingLeft: 13, paddingRight: 4, backgroundColor: colors.inkSoft },
  input: { flex: 1, minWidth: 0, minHeight: 48, color: colors.white, fontSize: 15, paddingVertical: 12 },
  filters: { gap: 8, paddingVertical: 2 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 22 },
  chipSelected: { backgroundColor: colors.inkSoft, borderColor: colors.accent },
  chipLabel: { color: colors.silver, fontSize: 13, fontWeight: '600' },
  chipLabelSelected: { color: colors.accent },
  resultHeading: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 3 },
  count: { color: colors.muted, fontSize: 11 },
  list: { flex: 1 },
  cards: { padding: 18, paddingTop: 10, gap: 12, flexGrow: 1 },
  cardRow: { gap: 10 },
  card: { flexGrow: 0, flexShrink: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.panel },
  cardSelected: { borderColor: colors.accent, backgroundColor: colors.inkSoft },
  frame: { aspectRatio: 16 / 9, backgroundColor: '#080808' },
  artImage: { width: '100%', height: '100%' },
  check: { position: 'absolute', right: 8, top: 8, width: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  cardCopy: { padding: 10, gap: 4 },
  make: { color: colors.muted, fontSize: 10 },
  model: { color: colors.white, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  generation: { color: colors.silver, fontSize: 12, lineHeight: 17 },
  empty: { alignItems: 'center', gap: 12, padding: 24 },
  emptyTitle: { color: colors.white, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyAction: { minHeight: 44, justifyContent: 'center' },
  link: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  footer: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12, gap: 10, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.inkSoft },
  selection: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  selectionImage: { width: 84, height: 48 },
  selectionLabel: { color: colors.silver, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  photoHint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
});
