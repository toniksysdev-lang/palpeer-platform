import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
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

  const openPicker = () => {
    const next = parseDisplayToDate(value, defaultPickerDate);
    setDraft(next);
    setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    setOpen(true);
  };

  const commit = () => {
    onChange(toDisplayFromDate(draft));
    setOpen(false);
  };

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const totalDays = daysInMonth(year, month);
  const cells: Array<Date | null> = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= totalDays; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  const canGoPrev =
    !minDay ||
    new Date(year, month, 0).getTime() >= new Date(minDay.getFullYear(), minDay.getMonth(), 1).getTime();
  const canGoNext =
    new Date(year, month + 1, 1).getTime() <= new Date(maxDay.getFullYear(), maxDay.getMonth(), 1).getTime();

  const sheetMaxHeight = Math.min(windowHeight * 0.92, 640);

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
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <View style={styles.modalRoot} testID={`${testID}-sheet`}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }]}
            onPress={() => setOpen(false)}
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
              <AppText variant="bodyStrong">
                {MONTHS[month]} {year}
              </AppText>
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

            <AppText variant="caption" tone="secondary" align="center">
              Selected {toDisplayFromDate(draft)}
            </AppText>

            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Cancel"
                  variant="outline"
                  shape="pill"
                  onPress={() => setOpen(false)}
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
