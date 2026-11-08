import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { maximumDateOfBirth, toDisplayDate, toIsoDate } from './schemas';

/** Palpeer Simple Home design tokens (About me / Start sheets). */
const D = {
  ink: '#0E1F19',
  muted: '#5B6B64',
  secondary: '#33453D',
  body: '#46574F',
  danger: '#B3231A',
  green: '#0B6E4F',
  field: '#E9EEEB',
  page: '#F3F6F4',
  white: '#FFFFFF',
  overlay: 'rgba(14,31,25,0.55)',
  border: '#DDE5E0',
  font: "'Noto Sans', system-ui, sans-serif",
} as const;

type Props = {
  label: string;
  value: string;
  onChange: (displayDate: string) => void;
  error?: string | null;
  /** Calendar opens on this date when the field is empty. */
  defaultPickerDate?: Date;
  maximumDate?: Date;
  minimumDate?: Date;
  /** Greys out the field and blocks opening the calendar. */
  disabled?: boolean;
  testID?: string;
};

type PickerMode = 'calendar' | 'year';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const DEFAULT_YEAR_SPAN = 120;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseDisplayToDate(value: string, fallback: Date): Date {
  const iso = toIsoDate(value);
  if (!iso) return fallback;
  const [yyyy, mm, dd] = iso.split('-').map(Number);
  const date = new Date(yyyy!, mm! - 1, dd!);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function toDisplayFromDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return toDisplayDate(`${yyyy}-${mm}-${dd}`);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Full-screen calendar sheet styled like the design Start / More bottom sheets. */
export function DateOfBirthField({
  label,
  value,
  onChange,
  error,
  defaultPickerDate = maximumDateOfBirth(),
  /** Newest selectable DOB — must be at least 16 years ago. */
  maximumDate = maximumDateOfBirth(),
  minimumDate,
  disabled = false,
  testID = 'personal-dob',
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PickerMode>('calendar');
  const empty = !value.trim();
  const selected = useMemo(
    () => parseDisplayToDate(value, defaultPickerDate),
    [value, defaultPickerDate],
  );
  const [draft, setDraft] = useState(selected);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );

  const maxDay = startOfDay(maximumDate);
  const minDay = minimumDate ? startOfDay(minimumDate) : null;
  const maxYear = maxDay.getFullYear();
  const minYear = minDay?.getFullYear() ?? maxYear - DEFAULT_YEAR_SPAN;

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = maxYear; y >= minYear; y -= 1) list.push(y);
    return list;
  }, [maxYear, minYear]);

  const openPicker = () => {
    const next = parseDisplayToDate(value, defaultPickerDate);
    setDraft(next);
    setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    setMode('calendar');
    setOpen(true);
  };

  const closePicker = () => {
    setOpen(false);
    setMode('calendar');
  };

  const commit = () => {
    onChange(toDisplayFromDate(draft));
    closePicker();
  };

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();

  const selectYear = (nextYear: number) => {
    let nextMonth = month;
    if (nextYear === maxYear) {
      nextMonth = Math.min(nextMonth, maxDay.getMonth());
    }
    if (nextYear === minYear && minDay) {
      nextMonth = Math.max(nextMonth, minDay.getMonth());
    }
    setVisibleMonth(new Date(nextYear, nextMonth, 1));
    setMode('calendar');
  };
  const firstWeekday = new Date(year, month, 1).getDay();
  const totalDays = daysInMonth(year, month);
  const cells: Array<Date | null> = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= totalDays; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  const canGoPrev =
    !minDay ||
    new Date(year, month, 0).getTime() >=
      new Date(minDay.getFullYear(), minDay.getMonth(), 1).getTime();
  const canGoNext =
    new Date(year, month + 1, 1).getTime() <=
    new Date(maxDay.getFullYear(), maxDay.getMonth(), 1).getTime();

  const sheetMaxHeight = Math.min(windowHeight * 0.92, 640);
  const yearListMaxHeight = Math.min(windowHeight * 0.5, 360);

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        onPress={openPicker}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${empty ? 'not set' : value}`}
        accessibilityHint="Opens a calendar to choose a date"
        accessibilityState={{ disabled }}
        testID={testID}
        style={[
          styles.fieldButton,
          error ? styles.fieldButtonError : null,
          disabled ? styles.fieldButtonDisabled : null,
        ]}
      >
        <Calendar size={22} color={D.muted} strokeWidth={2.2} />
        <Text style={[styles.fieldValue, empty || disabled ? styles.fieldPlaceholder : null]}>
          {empty ? 'Select date of birth' : value}
        </Text>
      </Pressable>
      {error ? (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={closePicker}
        statusBarTranslucent
      >
        <View style={styles.modalRoot} testID={`${testID}-sheet`}>
          <Pressable
            style={styles.overlay}
            onPress={closePicker}
            accessibilityRole="button"
            accessibilityLabel="Close date picker"
          />
          <View
            style={[
              styles.sheet,
              {
                maxHeight: sheetMaxHeight,
                paddingBottom: Math.max(insets.bottom, 16) + 8,
              },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} accessibilityRole="header">
                {label}
              </Text>
              <Pressable
                onPress={closePicker}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={styles.closeBtn}
                testID={`${testID}-close`}
              >
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>

            {mode === 'year' ? (
              <>
                <View style={styles.monthHeader}>
                  <Text style={styles.monthTitle}>Select year</Text>
                  <Pressable
                    onPress={() => setMode('calendar')}
                    accessibilityRole="button"
                    accessibilityLabel="Back to calendar"
                    testID={`${testID}-year-back`}
                    style={styles.navHit}
                  >
                    <Text style={styles.linkText}>{MONTHS[month]}</Text>
                  </Pressable>
                </View>
                <ScrollView
                  style={{ maxHeight: yearListMaxHeight }}
                  contentContainerStyle={styles.yearGrid}
                  testID={`${testID}-year-list`}
                  showsVerticalScrollIndicator
                >
                  {years.map((y) => {
                    const active = y === year;
                    return (
                      <Pressable
                        key={y}
                        onPress={() => selectYear(y)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Year ${y}`}
                        testID={`${testID}-year-${y}`}
                        style={[styles.yearChip, active ? styles.yearChipOn : null]}
                      >
                        <Text style={[styles.yearChipText, active ? styles.yearChipTextOn : null]}>
                          {y}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            ) : (
              <>
                <View style={styles.monthHeader}>
                  <Pressable
                    onPress={() =>
                      canGoPrev && setVisibleMonth(new Date(year, month - 1, 1))
                    }
                    disabled={!canGoPrev}
                    accessibilityRole="button"
                    accessibilityLabel="Previous month"
                    testID={`${testID}-prev-month`}
                    style={{ opacity: canGoPrev ? 1 : 0.35, padding: 8 }}
                  >
                    <ChevronLeft size={26} color={D.ink} strokeWidth={2.6} />
                  </Pressable>
                  <View style={styles.monthYearRow}>
                    <Text style={styles.monthTitle}>{MONTHS[month]}</Text>
                    <Pressable
                      onPress={() => setMode('year')}
                      accessibilityRole="button"
                      accessibilityLabel={`Year ${year}. Change year`}
                      accessibilityHint="Opens a list of years"
                      testID={`${testID}-year-button`}
                      style={styles.yearButton}
                    >
                      <Text style={styles.monthTitle}>{year}</Text>
                      <ChevronDown size={18} color={D.ink} strokeWidth={2.6} />
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() =>
                      canGoNext && setVisibleMonth(new Date(year, month + 1, 1))
                    }
                    disabled={!canGoNext}
                    accessibilityRole="button"
                    accessibilityLabel="Next month"
                    testID={`${testID}-next-month`}
                    style={{ opacity: canGoNext ? 1 : 0.35, padding: 8 }}
                  >
                    <ChevronRight size={26} color={D.ink} strokeWidth={2.6} />
                  </Pressable>
                </View>

                <View style={styles.weekRow}>
                  {WEEKDAYS.map((day) => (
                    <Text key={day} style={[styles.dayCell, styles.weekday]}>
                      {day}
                    </Text>
                  ))}
                </View>

                <View style={styles.grid} testID={`${testID}-calendar`}>
                  {cells.map((date, index) => {
                    if (!date) {
                      return <View key={`empty-${index}`} style={styles.dayCell} />;
                    }
                    const dayDisabled =
                      date.getTime() > maxDay.getTime() ||
                      (minDay != null && date.getTime() < minDay.getTime());
                    const selectedDay = sameDay(date, draft);
                    const isToday = sameDay(date, new Date());
                    return (
                      <Pressable
                        key={date.toISOString()}
                        disabled={dayDisabled}
                        onPress={() => setDraft(date)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: selectedDay, disabled: dayDisabled }}
                        accessibilityLabel={toDisplayFromDate(date)}
                        testID={`${testID}-day-${date.getDate()}`}
                        style={[
                          styles.dayCell,
                          styles.dayHit,
                          selectedDay ? styles.dayOn : null,
                          isToday && !selectedDay ? styles.dayToday : null,
                          dayDisabled ? styles.dayDisabled : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            selectedDay ? styles.dayTextOn : null,
                            (selectedDay || isToday) && styles.dayTextStrong,
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={styles.selectedHint}>Selected {toDisplayFromDate(draft)}</Text>

            <View style={styles.actions}>
              <Pressable
                onPress={closePicker}
                accessibilityRole="button"
                testID={`${testID}-cancel`}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={commit}
                accessibilityRole="button"
                testID={`${testID}-done`}
                style={styles.doneBtn}
              >
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '700',
    color: D.ink,
    fontFamily: D.font,
  },
  fieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: D.field,
  },
  fieldButtonError: {
    borderWidth: 2,
    borderColor: D.danger,
  },
  fieldButtonDisabled: {
    opacity: 0.55,
  },
  fieldValue: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: D.ink,
    paddingVertical: 12,
    fontFamily: D.font,
  },
  fieldPlaceholder: {
    color: D.muted,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '800',
    color: D.danger,
    fontFamily: D.font,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: D.overlay,
  },
  sheet: {
    backgroundColor: D.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: D.ink,
    fontFamily: D.font,
  },
  closeBtn: {
    minHeight: 48,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 17,
    fontWeight: '800',
    color: D.green,
    fontFamily: D.font,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthYearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: D.ink,
    fontFamily: D.font,
  },
  yearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: D.page,
  },
  navHit: {
    padding: 8,
  },
  linkText: {
    fontSize: 17,
    fontWeight: '800',
    color: D.green,
    fontFamily: D.font,
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  yearChip: {
    width: '22%',
    minWidth: 72,
    flexGrow: 1,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: D.page,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  yearChipOn: {
    backgroundColor: D.white,
    borderColor: D.green,
  },
  yearChipText: {
    fontSize: 17,
    fontWeight: '800',
    color: D.ink,
    fontFamily: D.font,
  },
  yearChipTextOn: {
    color: D.green,
  },
  weekRow: {
    flexDirection: 'row',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: {
    fontSize: 13,
    fontWeight: '700',
    color: D.muted,
    fontFamily: D.font,
  },
  dayHit: {
    borderRadius: 14,
  },
  dayOn: {
    backgroundColor: D.green,
  },
  dayToday: {
    borderWidth: 2,
    borderColor: D.green,
  },
  dayDisabled: {
    opacity: 0.35,
  },
  dayText: {
    fontSize: 17,
    fontWeight: '600',
    color: D.ink,
    fontFamily: D.font,
    textAlign: 'center',
  },
  dayTextOn: {
    color: D.white,
  },
  dayTextStrong: {
    fontWeight: '800',
  },
  selectedHint: {
    fontSize: 15,
    fontWeight: '600',
    color: D.body,
    textAlign: 'center',
    fontFamily: D.font,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: D.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  cancelText: {
    fontSize: 18,
    fontWeight: '800',
    color: D.ink,
    fontFamily: D.font,
  },
  doneBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: D.green,
  },
  doneText: {
    fontSize: 18,
    fontWeight: '800',
    color: D.white,
    fontFamily: D.font,
  },
});
