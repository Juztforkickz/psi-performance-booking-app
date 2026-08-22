import { createElement, useEffect, useRef } from 'react';

type WebDateTimePickerEvent = {
  type: 'set';
  nativeEvent: {
    timestamp: number;
    utcOffset: number;
  };
};

type WebDateTimePickerProps = {
  value: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
  onChange?: (event: WebDateTimePickerEvent, date?: Date) => void;
};

type DateInputElement = HTMLInputElement & {
  showPicker?: () => void;
};

function melbourneIsoDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: 'year' | 'month' | 'day') => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export default function WebDateTimePicker({
  value,
  minimumDate,
  maximumDate,
  disabled = false,
  onChange,
}: WebDateTimePickerProps) {
  const inputRef = useRef<DateInputElement | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || disabled) return;

    try {
      input.showPicker?.();
    } catch {
      input.focus();
    }
  }, [disabled]);

  return createElement('input', {
    ref: inputRef,
    type: 'date',
    disabled,
    min: minimumDate ? melbourneIsoDate(minimumDate) : undefined,
    max: maximumDate ? melbourneIsoDate(maximumDate) : undefined,
    value: melbourneIsoDate(value),
    'aria-label': 'Preferred booking date calendar',
    onClick: (event) => {
      try {
        event.currentTarget.showPicker?.();
      } catch {
        // The browser will keep its normal date-input interaction as a fallback.
      }
    },
    onChange: (event) => {
      const selectedValue = event.currentTarget.value;
      if (!selectedValue) return;
      const selectedDate = new Date(`${selectedValue}T00:00:00Z`);
      onChange?.(
        {
          type: 'set',
          nativeEvent: {
            timestamp: selectedDate.getTime(),
            utcOffset: 0,
          },
        },
        selectedDate,
      );
    },
    style: {
      width: '100%',
      minHeight: '52px',
      border: 0,
      outline: 'none',
      background: 'transparent',
      color: '#FFFFFF',
      colorScheme: 'dark',
      fontFamily: 'inherit',
      fontSize: '16px',
      fontWeight: 700,
      padding: '0 12px',
      WebkitAppearance: 'auto',
    },
  });
}
