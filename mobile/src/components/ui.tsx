import { createContext, useContext, type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type ViewStyle,
  View,
} from 'react-native';

import { bookingColors, colors, mobileFrame, spacing } from '@/constants/brand';

const FieldLabelContext = createContext<string | undefined>(undefined);
type UiTone = 'brand' | 'booking';
const UiToneContext = createContext<UiTone>('brand');

export function UiToneProvider({ children, tone }: PropsWithChildren<{ tone: UiTone }>) {
  return <UiToneContext.Provider value={tone}>{children}</UiToneContext.Provider>;
}

export function Eyebrow({ children, dark = false }: PropsWithChildren<{ dark?: boolean }>) {
  const tone = useContext(UiToneContext);

  return (
    <Text
      maxFontSizeMultiplier={2}
      style={[styles.eyebrow, tone === 'booking' && styles.eyebrowBooking, dark && styles.eyebrowDark]}
    >
      {children}
    </Text>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'accent',
  tone: toneOverride,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'accent' | 'light' | 'outline';
  tone?: UiTone;
  style?: ViewStyle;
}) {
  const contextTone = useContext(UiToneContext);
  const tone = toneOverride ?? contextTone;
  const bookingTone = tone === 'booking';

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'light' && styles.buttonLight,
        variant === 'outline' && styles.buttonOutline,
        bookingTone && variant === 'accent' && styles.buttonBooking,
        pressed && styles.buttonPressed,
        (disabled || loading) && styles.buttonDisabled,
        style,
        mobileFrame,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.white : colors.ink} />
      ) : (
        <Text
          maxFontSizeMultiplier={2}
          style={[
            styles.buttonText,
            variant === 'light' && styles.buttonTextDark,
            variant === 'outline' && styles.buttonTextOutline,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: PropsWithChildren<{ label: string; hint?: string; error?: string }>) {
  const tone = useContext(UiToneContext);
  const bookingTone = tone === 'booking';

  return (
    <FieldLabelContext.Provider value={label}>
      <View style={styles.field}>
        <View style={styles.fieldLabelRow}>
          <Text maxFontSizeMultiplier={2} style={[styles.fieldLabel, bookingTone && styles.fieldLabelBooking]}>{label}</Text>
          {hint ? <Text maxFontSizeMultiplier={2} style={[styles.fieldHint, bookingTone && styles.fieldHintBooking]}>{hint}</Text> : null}
        </View>
        {children}
        {error ? (
          <Text accessibilityRole="alert" maxFontSizeMultiplier={2} style={[styles.error, bookingTone && styles.errorBooking]}>
            {error}
          </Text>
        ) : null}
      </View>
    </FieldLabelContext.Provider>
  );
}

export function FormInput({ error, style, accessibilityLabel, ...props }: TextInputProps & { error?: string }) {
  const fieldLabel = useContext(FieldLabelContext);
  const tone = useContext(UiToneContext);
  const bookingTone = tone === 'booking';

  return (
    <TextInput
      accessibilityLabel={accessibilityLabel ?? fieldLabel}
      autoCorrect={false}
      maxFontSizeMultiplier={2}
      placeholderTextColor={bookingTone ? bookingColors.placeholder : colors.mutedDark}
      selectionColor={bookingTone ? bookingColors.accent : colors.accent}
      style={[
        styles.input,
        bookingTone && styles.inputBooking,
        error ? styles.inputError : null,
        bookingTone && error ? styles.inputErrorBooking : null,
        style,
        mobileFrame,
      ]}
      {...props}
    />
  );
}

export function ChoiceCard({
  title,
  detail,
  selected,
  onPress,
  index,
  children,
}: PropsWithChildren<{
  title: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
  index?: string;
}>) {
  const tone = useContext(UiToneContext);
  const bookingTone = tone === 'booking';

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        bookingTone && styles.choiceBooking,
        selected && styles.choiceSelected,
        bookingTone && selected && styles.choiceSelectedBooking,
        pressed && styles.choicePressed,
      ]}
    >
      {index ? (
        <Text
          maxFontSizeMultiplier={1.5}
          style={[
            styles.choiceIndex,
            bookingTone && styles.choiceIndexBooking,
            selected && styles.choiceIndexSelected,
            bookingTone && selected && styles.choiceIndexSelectedBooking,
          ]}
        >
          {index}
        </Text>
      ) : null}
      <View style={styles.choiceCopy}>
        <Text
          maxFontSizeMultiplier={2}
          style={[
            styles.choiceTitle,
            bookingTone && styles.choiceTitleBooking,
            selected && styles.choiceTitleSelected,
            bookingTone && selected && styles.choiceTitleSelectedBooking,
          ]}
        >
          {title}
        </Text>
        <Text
          maxFontSizeMultiplier={2}
          style={[
            styles.choiceDetail,
            bookingTone && styles.choiceDetailBooking,
            selected && styles.choiceDetailSelected,
            bookingTone && selected && styles.choiceDetailSelectedBooking,
          ]}
        >
          {detail}
        </Text>
        {children as ReactNode}
      </View>
      <View
        style={[
          styles.radio,
          bookingTone && styles.radioBooking,
          selected && styles.radioSelected,
          bookingTone && selected && styles.radioSelectedBooking,
        ]}
      >
        {selected ? <View style={[styles.radioDot, bookingTone && styles.radioDotBooking]} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  eyebrowDark: {
    color: colors.accentDark,
  },
  eyebrowBooking: {
    color: bookingColors.accent,
  },
  button: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...mobileFrame,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  buttonLight: {
    backgroundColor: colors.silver,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
  },
  buttonBooking: {
    backgroundColor: bookingColors.accentBright,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.48,
  },
  buttonText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.1,
    lineHeight: 18,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  buttonTextDark: {
    color: colors.ink,
  },
  buttonTextOutline: {
    color: colors.white,
  },
  field: {
    gap: spacing.sm,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  fieldLabel: {
    flexShrink: 1,
    color: colors.silver,
    fontSize: 13,
    fontWeight: '800',
  },
  fieldLabelBooking: {
    color: bookingColors.label,
  },
  fieldHint: {
    color: colors.muted,
    fontSize: 12,
  },
  fieldHintBooking: {
    color: bookingColors.textMuted,
  },
  input: {
    minHeight: 54,
    ...mobileFrame,
    borderRadius: 3,
    backgroundColor: colors.inkSoft,
    color: colors.white,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  inputError: {
    borderColor: mobileFrame.borderColor,
  },
  inputBooking: {
    borderColor: mobileFrame.borderColor,
    backgroundColor: 'transparent',
    color: bookingColors.text,
  },
  inputErrorBooking: {
    borderColor: mobileFrame.borderColor,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  errorBooking: {
    color: bookingColors.error,
  },
  choice: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...mobileFrame,
    borderRadius: 3,
    backgroundColor: colors.panel,
    padding: spacing.md,
  },
  choiceSelected: {
    borderColor: mobileFrame.borderColor,
    backgroundColor: colors.accent,
  },
  choiceBooking: {
    borderColor: mobileFrame.borderColor,
    backgroundColor: bookingColors.surface,
  },
  choiceSelectedBooking: {
    borderColor: mobileFrame.borderColor,
    backgroundColor: bookingColors.accent,
  },
  choicePressed: {
    opacity: 0.82,
  },
  choiceIndex: {
    alignSelf: 'flex-start',
    flexShrink: 0,
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
  },
  choiceIndexSelected: {
    color: colors.ink,
  },
  choiceIndexBooking: {
    color: bookingColors.accent,
  },
  choiceIndexSelectedBooking: {
    color: bookingColors.accentText,
  },
  choiceCopy: {
    flex: 1,
    gap: 4,
  },
  choiceTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '900',
  },
  choiceTitleSelected: {
    color: colors.ink,
  },
  choiceTitleBooking: {
    color: bookingColors.text,
  },
  choiceTitleSelectedBooking: {
    color: bookingColors.accentText,
  },
  choiceDetail: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  choiceDetailSelected: {
    color: '#0C3444',
  },
  choiceDetailBooking: {
    color: bookingColors.textSecondary,
  },
  choiceDetailSelectedBooking: {
    color: bookingColors.selectedSecondary,
  },
  radio: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.muted,
    flexShrink: 0,
  },
  radioSelected: {
    borderColor: colors.ink,
  },
  radioBooking: {
    borderColor: bookingColors.accentDark,
  },
  radioSelectedBooking: {
    borderColor: bookingColors.accentText,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.ink,
  },
  radioDotBooking: {
    backgroundColor: bookingColors.accentText,
  },
});
