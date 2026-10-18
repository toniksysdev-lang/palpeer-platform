import { Check, ChevronDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';

export type PickerOption = { key: string; title: string; subtitle?: string };

/** A field that shows the current choice and opens a sheet of options. */
export function PickerField({
  label,
  value,
  placeholder,
  caption,
  onPress,
  appearance = 'outlined',
  error,
  testID,
}: {
  label: string;
  value: string;
  /** Shown when `value` is empty (elevated appearance). */
  placeholder?: string;
  caption?: string;
  onPress: () => void;
  /** `elevated`: label above a white shadowed field (matches Input elevated). */
  appearance?: 'outlined' | 'elevated';
  error?: string | null;
  testID?: string;
}) {
  const theme = useTheme();
  const elevated = appearance === 'elevated';
  const empty = !value.trim();
  const display = empty ? (placeholder ?? value) : value;

  if (elevated) {
    return (
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="body" tone="primary" style={{ fontWeight: '600' }}>
          {label}
        </AppText>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${display}`}
          accessibilityHint="Opens a list to choose from"
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
          <AppText
            tone={empty ? 'muted' : 'primary'}
            style={[theme.typography.body, { flex: 1, paddingVertical: 12 }]}
          >
            {display}
          </AppText>
          <Icon icon={ChevronDown} color={theme.colors.textMuted} />
        </Pressable>
        {error ? (
          <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </AppText>
        ) : caption ? (
          <AppText variant="caption" tone="muted">
            {caption}
          </AppText>
        ) : null}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint="Opens a list to choose from"
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: error ? theme.colors.danger : theme.colors.border,
        backgroundColor: theme.colors.surface,
      }}
    >
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <AppText variant="caption" tone="secondary">
          {label}
        </AppText>
        <AppText variant="h3" tone={empty ? 'muted' : 'primary'}>
          {display}
        </AppText>
        {caption ? (
          <AppText variant="caption" tone="muted">
            {caption}
          </AppText>
        ) : null}
      </View>
      <Icon icon={ChevronDown} color={theme.colors.textMuted} />
    </Pressable>
  );
}

export function PickerSheet({
  visible,
  title,
  options,
  selectedKey,
  onSelect,
  onClose,
  searchable = false,
  searchPlaceholder = 'Search…',
  testID,
}: {
  visible: boolean;
  title: string;
  options: readonly PickerOption[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  testID: string;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => {
      const haystack = `${option.title} ${option.subtitle ?? ''} ${option.key}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [options, query]);

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        setQuery('');
        onClose();
      }}
      title={title}
      testID={testID}
    >
      {searchable ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel={searchPlaceholder}
          testID={`${testID}-search`}
          style={[
            theme.typography.body,
            {
              marginBottom: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
            },
          ]}
        />
      ) : null}
      <ScrollView
        style={{ maxHeight: searchable ? 360 : 420 }}
        keyboardShouldPersistTaps="handled"
        accessibilityRole="radiogroup"
      >
        {filtered.length === 0 ? (
          <AppText tone="secondary" style={{ paddingVertical: theme.spacing.md }}>
            No matches.
          </AppText>
        ) : (
          filtered.map((option) => {
            const active = option.key === selectedKey;
            return (
              <Pressable
                key={option.key}
                onPress={() => {
                  onSelect(option.key);
                  setQuery('');
                  onClose();
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={
                  option.subtitle ? `${option.title}, ${option.subtitle}` : option.title
                }
                testID={`${testID}-option-${option.key}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  paddingVertical: theme.spacing.md,
                }}
              >
                <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                  <AppText variant="bodyStrong">{option.title}</AppText>
                  {option.subtitle ? (
                    <AppText variant="caption" tone="secondary">
                      {option.subtitle}
                    </AppText>
                  ) : null}
                </View>
                {active ? <Icon icon={Check} color={theme.colors.primary} /> : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </BottomSheet>
  );
}
