import { LocateFixed, MapPin } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInputProps,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useTheme } from '@/providers/ThemeProvider';

import {
  pickupCurrentAddress,
  searchAddresses,
  type AddressSuggestion,
  type StructuredAddress,
} from './addressLookup';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: TextInputProps['onBlur'];
  error?: string | null;
  countryCode?: string | null;
  onPick: (address: StructuredAddress) => void;
  onPickupMessage?: (message: string, type: 'success' | 'error') => void;
  testID?: string;
};

const SEARCH_DEBOUNCE_MS = 450;
const SUGGESTIONS_MAX_HEIGHT = 220;

export function AddressAutocomplete({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  countryCode,
  onPick,
  onPickupMessage,
  testID = 'personal-address1',
}: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pickingLocation, setPickingLocation] = useState(false);
  const [suppressSuggestions, setSuppressSuggestions] = useState(false);
  const debouncedQuery = useDebouncedValue(value, SEARCH_DEBOUNCE_MS);
  const abortRef = useRef<AbortController | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (suppressSuggestions) {
      setSuggestions([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    const query = debouncedQuery.trim();
    if (query.length < 3 || !focused) {
      setSuggestions([]);
      setSearching(false);
      setSearchError(null);
      abortRef.current?.abort();
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setSearching(true);
    setSearchError(null);

    void searchAddresses(query, countryCode, controller.signal)
      .then((results) => {
        if (controller.signal.aborted) return;
        setSuggestions(results);
        if (results.length === 0) {
          setSearchError('No matching addresses found. Try a fuller street address.');
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setSearchError('Address search is unavailable right now. Enter the address manually.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearching(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, countryCode, focused, suppressSuggestions]);

  const applyAddress = (address: StructuredAddress) => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setSuppressSuggestions(true);
    setSuggestions([]);
    setFocused(false);
    onPick(address);
  };

  const handleUseLocation = async () => {
    setPickingLocation(true);
    const result = await pickupCurrentAddress();
    setPickingLocation(false);
    if (!result.ok) {
      onPickupMessage?.(result.message, 'error');
      return;
    }
    applyAddress(result.address);
    onPickupMessage?.('Address picked up from your location', 'success');
  };

  const showSuggestions =
    focused && !suppressSuggestions && debouncedQuery.trim().length >= 3;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => void handleUseLocation()}
          disabled={pickingLocation}
          accessibilityRole="button"
          accessibilityLabel="Use current location"
          testID={`${testID}-use-location`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
            paddingVertical: theme.spacing.xs,
            opacity: pickingLocation ? 0.6 : 1,
          }}
        >
          {pickingLocation ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Icon icon={LocateFixed} size={16} color={theme.colors.primary} />
          )}
          <AppText variant="caption" tone="brand" style={{ fontWeight: '600' }}>
            {pickingLocation ? 'Finding address…' : 'Use current location'}
          </AppText>
        </Pressable>
      </View>

      <Input
        appearance="elevated"
        label={label}
        placeholder="Start typing your address"
        value={value}
        onChangeText={(next) => {
          setSuppressSuggestions(false);
          onChangeText(next);
        }}
        onFocus={() => {
          if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
          setFocused(true);
        }}
        onBlur={(event) => {
          // Keep the list briefly so a suggestion tap can register.
          blurTimerRef.current = setTimeout(() => setFocused(false), 180);
          onBlur?.(event);
        }}
        error={error}
        autoComplete="street-address"
        textContentType="fullStreetAddress"
        left={<Icon icon={MapPin} color={theme.colors.textMuted} />}
        right={
          searching ? <ActivityIndicator size="small" color={theme.colors.primary} /> : undefined
        }
        testID={testID}
      />

      {showSuggestions ? (
        <View
          testID={`${testID}-suggestions`}
          style={[
            theme.shadows.card,
            {
              maxHeight: SUGGESTIONS_MAX_HEIGHT,
              borderRadius: theme.radius.lg,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              overflow: 'hidden',
            },
          ]}
        >
          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.colors.border,
              backgroundColor: theme.colors.surfaceMuted,
            }}
          >
            <AppText variant="caption" tone="muted">
              Select address
            </AppText>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={{ maxHeight: SUGGESTIONS_MAX_HEIGHT - 36 }}
          >
            {searching && suggestions.length === 0 ? (
              <View
                style={{
                  padding: theme.spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}
              >
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <AppText variant="caption" tone="muted">
                  Searching addresses…
                </AppText>
              </View>
            ) : null}
            {!searching && searchError ? (
              <View style={{ padding: theme.spacing.md }}>
                <AppText variant="caption" tone="secondary">
                  {searchError}
                </AppText>
              </View>
            ) : null}
            {suggestions.map((item, index) => (
              <Pressable
                key={item.id}
                onPressIn={() => applyAddress(item)}
                accessibilityRole="button"
                accessibilityLabel={`Use address ${item.label}`}
                testID={`${testID}-suggestion-${item.id}`}
                style={({ pressed }) => ({
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm + 2,
                  backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
                  borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: theme.colors.border,
                })}
              >
                <AppText variant="body" numberOfLines={2}>
                  {item.label}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
