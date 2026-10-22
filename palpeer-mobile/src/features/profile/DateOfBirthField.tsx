import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';

import { toDisplayDate, toIsoDate } from './schemas';

type Props = {
  label: string;
  value: string;
  onChange: (displayDate: string) => void;
  error?: string | null;
  /** Calendar opens on this date when the field is empty. */
  defaultPickerDate?: Date;
  maximumDate?: Date;
  minimumDate?: Date;
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

/** Full-screen calendar sheet so the month grid is never clipped. */
export function DateOfBirthField({
  label,
  value,
  onChange,
  error,
  defaultPickerDate = new Date(),
  maximumDate = new Date(),
  minimumDate,
  testID = 'personal-dob',
}: Props) {
  const theme = useTheme();
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
    <View style={{ gap: theme.spacing.xs }}>
      <AppText variant="body" tone="primary" style={{ fontWeight: '600' }}>
        {label}
      </AppText>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${empty ? 'not set' : value}`}
        accessibilityHint="Opens a calendar to choose a date"
        testID={testID}
        style={[
          theme.shadows.card,
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            minHeight: 56,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: error ? theme.colors.danger : 'transparent',
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <Icon icon={Calendar} color={theme.colors.textMuted} />
        <AppText
          tone={empty ? 'muted' : 'primary'}
          style={[theme.typography.body, { flex: 1, paddingVertical: 12 }]}
        >
          {empty ? 'Select date of birth' : value}
        </AppText>
      </Pressable>
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
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
            style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }]}
            onPress={closePicker}
            accessibilityRole="button"
            accessibilityLabel="Close date picker"
          />
          <View
            style={{
              maxHeight: sheetMaxHeight,
              backgroundColor: theme.colors.surfaceElevated,
              borderTopLeftRadius: theme.radius.xxl,
              borderTopRightRadius: theme.radius.xxl,
              paddingHorizontal: theme.spacing.xl,
              paddingTop: theme.spacing.lg,
              paddingBottom: Math.max(insets.bottom, theme.spacing.lg) + theme.spacing.md,
              gap: theme.spacing.md,
            }}
          >
            <View style={styles.handleRow}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: theme.colors.borderStrong,
                }}
              />
            </View>
            <AppText variant="h3">{label}</AppText>

            {mode === 'year' ? (
              <>
                <View style={styles.monthHeader}>
                  <AppText variant="bodyStrong">Select year</AppText>
                  <Pressable
                    onPress={() => setMode('calendar')}
                    accessibilityRole="button"
                    accessibilityLabel="Back to calendar"
                    testID={`${testID}-year-back`}
                    style={{ padding: theme.spacing.sm }}
                  >
                    <AppText variant="body" tone="secondary">
                      {MONTHS[month]}
                    </AppText>
                  </Pressable>
                </View>
                <ScrollView
                  style={{ maxHeight: yearListMaxHeight }}
                  contentContainerStyle={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: theme.spacing.sm,
                    paddingBottom: theme.spacing.sm,
                  }}
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
                        style={{
                          width: '22%',
                          minWidth: 72,
                          flexGrow: 1,
                          paddingVertical: theme.spacing.sm,
                          borderRadius: theme.radius.md,
                          alignItems: 'center',
                          backgroundColor: active
                            ? theme.colors.primary
                            : theme.colors.surface,
                          borderWidth: 1,
                          borderColor: active ? theme.colors.primary : theme.colors.border,
                        }}
                      >
                        <AppText
                          variant="bodyStrong"
                          tone={active ? 'inverse' : 'primary'}
                        >
                          {y}
                        </AppText>
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
                    style={{ opacity: canGoPrev ? 1 : 0.35, padding: theme.spacing.sm }}
                  >
                    <Icon icon={ChevronLeft} color={theme.colors.textPrimary} />
                  </Pressable>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.xs,
                    }}
                  >
                    <AppText variant="bodyStrong">{MONTHS[month]}</AppText>
                    <Pressable
                      onPress={() => setMode('year')}
                      accessibilityRole="button"
                      accessibilityLabel={`Year ${year}. Change year`}
                      accessibilityHint="Opens a list of years"
                      testID={`${testID}-year-button`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 2,
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: theme.spacing.xs,
                        borderRadius: theme.radius.md,
                        backgroundColor: theme.colors.surface,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                      }}
                    >
                      <AppText variant="bodyStrong">{year}</AppText>
                      <Icon icon={ChevronDown} size={16} color={theme.colors.textPrimary} />
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
                    style={{ opacity: canGoNext ? 1 : 0.35, padding: theme.spacing.sm }}
                  >
                    <Icon icon={ChevronRight} color={theme.colors.textPrimary} />
                  </Pressable>
                </View>

                <View style={styles.weekRow}>
                  {WEEKDAYS.map((day) => (
                    <AppText
                      key={day}
                      variant="caption"
                      tone="muted"
                      align="center"
                      style={styles.dayCell}
                    >
                      {day}
                    </AppText>
                  ))}
                </View>

                <View style={styles.grid} testID={`${testID}-calendar`}>
                  {cells.map((date, index) => {
                    if (!date) {
                      return <View key={`empty-${index}`} style={styles.dayCell} />;
                    }
                    const disabled =
                      date.getTime() > maxDay.getTime() ||
                      (minDay != null && date.getTime() < minDay.getTime());
                    const selectedDay = sameDay(date, draft);
                    const isToday = sameDay(date, new Date());
                    return (
                      <Pressable
                        key={date.toISOString()}
                        disabled={disabled}
                        onPress={() => setDraft(date)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: selectedDay, disabled }}
                        accessibilityLabel={toDisplayFromDate(date)}
                        testID={`${testID}-day-${date.getDate()}`}
                        style={[
                          styles.dayCell,
                          {
                            borderRadius: theme.radius.md,
                            backgroundColor: selectedDay
                              ? theme.colors.primary
                              : 'transparent',
                            borderWidth: isToday && !selectedDay ? 1 : 0,
                            borderColor: theme.colors.primary,
                            opacity: disabled ? 0.35 : 1,
                          },
                        ]}
                      >
                        <AppText
                          variant="body"
                          align="center"
                          tone={selectedDay ? 'inverse' : 'primary'}
                          style={{ fontWeight: selectedDay || isToday ? '700' : '400' }}
                        >
                          {date.getDate()}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            <AppText variant="caption" tone="secondary" align="center">
              Selected {toDisplayFromDate(draft)}
            </AppText>

            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Cancel"
                  variant="outline"
                  shape="pill"
                  onPress={closePicker}
                  testID={`${testID}-cancel`}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Done"
                  shape="pill"
                  onPress={commit}
                  testID={`${testID}-done`}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  handleRow: {
    alignItems: 'center',
    marginBottom: 4,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
});
