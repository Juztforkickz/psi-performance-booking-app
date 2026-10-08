import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/constants/brand';
import {
  daysInIsoMonth,
  formatIsoDate,
  isoDateParts,
  monthCalendarGrid,
  shiftIsoMonth,
} from '@/lib/australian-date';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

type MonthCalendarPickerProps = {
  disabled?: boolean;
  isDateEnabled?: (isoDate: string) => boolean;
  maximumDate?: string;
  minimumDate?: string;
  onChange: (isoDate: string) => void;
  value?: string;
};

export function MonthCalendarPicker({
  disabled = false,
  isDateEnabled,
  maximumDate,
  minimumDate,
  onChange,
  value = '',
}: MonthCalendarPickerProps) {
  const initial = isoDateParts(value) ?? isoDateParts(minimumDate ?? '') ?? todayParts();
  const [visibleMonth, setVisibleMonth] = useState(() => ({ month: initial.month, year: initial.year }));

  const days = useMemo(() => monthGrid(visibleMonth.year, visibleMonth.month), [visibleMonth]);
  const monthLabel = new Intl.DateTimeFormat('en-AU', { month: 'long', timeZone: 'UTC', year: 'numeric' })
    .format(new Date(Date.UTC(visibleMonth.year, visibleMonth.month - 1, 1, 12)));
  const previousDisabled = disabled || !monthCanContainDate(shiftMonth(visibleMonth, -1), minimumDate, maximumDate);
  const nextDisabled = disabled || !monthCanContainDate(shiftMonth(visibleMonth, 1), minimumDate, maximumDate);

  const moveMonth = (offset: number) => {
    if (disabled) return;
    setVisibleMonth((current) => shiftMonth(current, offset));
  };

  return (
    <View accessibilityLabel={`${monthLabel} calendar`} style={styles.calendar}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Previous month"
          accessibilityRole="button"
          accessibilityState={{ disabled: previousDisabled }}
          disabled={previousDisabled}
          hitSlop={8}
          onPress={() => moveMonth(-1)}
          style={({ pressed }) => [styles.monthButton, previousDisabled && styles.disabled, pressed && styles.pressed]}
        >
          <Ionicons color={colors.accent} name="chevron-back" size={22} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable
          accessibilityLabel="Next month"
          accessibilityRole="button"
          accessibilityState={{ disabled: nextDisabled }}
          disabled={nextDisabled}
          hitSlop={8}
          onPress={() => moveMonth(1)}
          style={({ pressed }) => [styles.monthButton, nextDisabled && styles.disabled, pressed && styles.pressed]}
        >
          <Ionicons color={colors.accent} name="chevron-forward" size={22} />
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((weekday) => <Text key={weekday} style={styles.weekday}>{weekday}</Text>)}
      </View>
      <View style={styles.grid}>
        {days.map((day, index) => {
          if (!day) return <View key={`empty-${index}`} style={styles.cell} />;
          const isoDate = `${visibleMonth.year}-${String(visibleMonth.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const outOfRange = Boolean((minimumDate && isoDate < minimumDate) || (maximumDate && isoDate > maximumDate));
          const unavailable = outOfRange || (isDateEnabled ? !isDateEnabled(isoDate) : false);
          const selected = isoDate === value;
          const dateLabel = formatIsoDate(isoDate, { dateStyle: 'full' }, isoDate);
          return (
            <View key={isoDate} style={styles.cell}>
              <Pressable
                accessibilityLabel={`${dateLabel}${unavailable ? ', unavailable' : ''}`}
                accessibilityRole="button"
                accessibilityState={{ disabled: disabled || unavailable, selected }}
                disabled={disabled || unavailable}
                onPress={() => onChange(isoDate)}
                style={({ pressed }) => [
                  styles.day,
                  selected && styles.daySelected,
                  (disabled || unavailable) && styles.dayDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{day}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function todayParts() {
  const parts = new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
  }).formatToParts(new Date());
  const read = (type: 'day' | 'month' | 'year') => Number(parts.find((part) => part.type === type)?.value ?? '0');
  return { day: read('day'), month: read('month'), year: read('year') };
}

function monthGrid(year: number, month: number) {
  return monthCalendarGrid(year, month);
}

function shiftMonth(value: { month: number; year: number }, offset: number) {
  return shiftIsoMonth(value, offset);
}

function monthCanContainDate(value: { month: number; year: number }, minimumDate?: string, maximumDate?: string) {
  const start = `${value.year}-${String(value.month).padStart(2, '0')}-01`;
  const end = `${value.year}-${String(value.month).padStart(2, '0')}-${String(daysInIsoMonth(value.year, value.month)).padStart(2, '0')}`;
  return (!minimumDate || end >= minimumDate) && (!maximumDate || start <= maximumDate);
}

const styles = StyleSheet.create({
  calendar: { borderColor: colors.line, borderWidth: 1, borderRadius: 6, backgroundColor: '#101010', padding: spacing.sm },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  monthButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  monthLabel: { color: colors.white, flex: 1, fontSize: 15, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { color: colors.muted, flex: 1, fontSize: 9, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { aspectRatio: 1, padding: 2, width: `${100 / 7}%` },
  day: { alignItems: 'center', borderColor: 'transparent', borderRadius: 5, borderWidth: 1, flex: 1, justifyContent: 'center' },
  daySelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayDisabled: { opacity: 0.28 },
  dayText: { color: colors.silver, fontSize: 13, fontWeight: '800' },
  dayTextSelected: { color: colors.ink, fontWeight: '900' },
  disabled: { opacity: 0.25 },
  pressed: { opacity: 0.72 },
});
