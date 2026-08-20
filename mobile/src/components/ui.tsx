import type { PropsWithChildren, ReactNode } from 'react';
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

import { colors, spacing } from '@/constants/brand';

export function Eyebrow({ children, dark = false }: PropsWithChildren<{ dark?: boolean }>) {
  return <Text maxFontSizeMultiplier={2} style={[styles.eyebrow, dark && styles.eyebrowDark]}>{children}</Text>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'gold',
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'gold' | 'light' | 'outline';
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'light' && styles.buttonLight,
        variant === 'outline' && styles.buttonOutline,
        pressed && styles.buttonPressed,
        (disabled || loading) && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'gold' ? colors.ink : colors.white} />
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
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text maxFontSizeMultiplier={2} style={styles.fieldLabel}>{label}</Text>
        {hint ? <Text maxFontSizeMultiplier={2} style={styles.fieldHint}>{hint}</Text> : null}
      </View>
      {children}
      {error ? (
        <Text accessibilityRole="alert" maxFontSizeMultiplier={2} style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function FormInput({ error, style, ...props }: TextInputProps & { error?: string }) {
  return (
    <TextInput
      autoCorrect={false}
      maxFontSizeMultiplier={2}
      placeholderTextColor={colors.mutedDark}
      selectionColor={colors.gold}
      style={[styles.input, error ? styles.inputError : null, style]}
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
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && styles.choicePressed,
      ]}
    >
      {index ? <Text maxFontSizeMultiplier={1.5} style={[styles.choiceIndex, selected && styles.choiceIndexSelected]}>{index}</Text> : null}
      <View style={styles.choiceCopy}>
        <Text maxFontSizeMultiplier={2} style={[styles.choiceTitle, selected && styles.choiceTitleSelected]}>{title}</Text>
        <Text maxFontSizeMultiplier={2} style={[styles.choiceDetail, selected && styles.choiceDetailSelected]}>{detail}</Text>
        {children as ReactNode}
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  eyebrowDark: {
    color: colors.goldDark,
  },
  button: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
  buttonLight: {
    backgroundColor: colors.cream,
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'transparent',
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
    color: colors.cream,
    fontSize: 13,
    fontWeight: '800',
  },
  fieldHint: {
    color: colors.muted,
    fontSize: 12,
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 3,
    backgroundColor: colors.inkSoft,
    color: colors.white,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  choice: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 3,
    backgroundColor: colors.panel,
    padding: spacing.md,
  },
  choiceSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  choicePressed: {
    opacity: 0.82,
  },
  choiceIndex: {
    alignSelf: 'flex-start',
    flexShrink: 0,
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
  },
  choiceIndexSelected: {
    color: colors.ink,
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
  choiceDetail: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  choiceDetailSelected: {
    color: '#44330E',
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
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.ink,
  },
});
