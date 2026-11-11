import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDesignScale } from '@/design/dc/runtime';

import {
  searchAddresses,
  type AddressSuggestion,
  type StructuredAddress,
} from './addressLookup';

/** Palpeer Simple Home design tokens (Where I live / Start fields). */
const D = {
  ink: '#0E1F19',
  muted: '#5B6B64',
  secondary: '#33453D',
  green: '#0B6E4F',
  field: '#E9EEEB',
  white: '#FFFFFF',
  border: '#DDE5E0',
  page: '#F3F6F4',
} as const;

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  countryCode?: string | null;
  onPick: (address: StructuredAddress) => void;
  error?: string | null;
  placeholder?: string;
  testID?: string;
};

const SEARCH_DEBOUNCE_MS = 450;
const SUGGESTIONS_MAX_HEIGHT = 220;

/**
 * Street address field with Nominatim/Photon suggestions, styled for design screens
 * (Where I live). Location pickup stays on the page CTA (“Use where I am now”).
 */
export function DesignAddressField({
  label,
  value,
  onChangeText,
  countryCode,
  onPick,
  error,
  placeholder = 'Start typing your address',
  testID = 'where-address1',
}: Props) {
  const scale = useDesignScale();
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [suppressSuggestions, setSuppressSuggestions] = useState(false);
  const debouncedQuery = useDebouncedValue(value, SEARCH_DEBOUNCE_MS);
  const abortRef = useRef<AbortController | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fs = (n: number) => Math.round(n * scale * 100) / 100;
  const sp = (n: number) => Math.round(n * scale * 100) / 100;

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

  const showSuggestions =
    focused && !suppressSuggestions && debouncedQuery.trim().length >= 3;

  return (
    <View style={{ gap: sp(6) }}>
      <Text style={{ fontSize: fs(16), lineHeight: fs(19), fontWeight: '700', color: D.ink }}>
        {label}
      </Text>
      <View
        style={{
          minHeight: sp(50),
          borderRadius: sp(14),
          backgroundColor: D.field,
          paddingHorizontal: sp(12),
          flexDirection: 'row',
          alignItems: 'center',
          gap: sp(8),
        }}
      >
        <TextInput
          value={value}
          onChangeText={(next) => {
            setSuppressSuggestions(false);
            onChangeText(next);
          }}
          onFocus={() => {
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
            setFocused(true);
          }}
          onBlur={() => {
            blurTimerRef.current = setTimeout(() => setFocused(false), 180);
          }}
          placeholder={placeholder}
          placeholderTextColor={D.muted}
          autoComplete="street-address"
          textContentType="fullStreetAddress"
          testID={testID}
          style={{
            flex: 1,
            minHeight: sp(50),
            fontSize: fs(18),
            fontWeight: '700',
            color: D.ink,
            paddingVertical: 0,
          }}
        />
        {searching ? <ActivityIndicator size="small" color={D.green} /> : null}
      </View>
      {error ? (
        <Text style={{ fontSize: fs(15), fontWeight: '700', color: '#B3231A' }}>{error}</Text>
      ) : null}

      {showSuggestions ? (
        <View
          testID={`${testID}-suggestions`}
          style={{
            maxHeight: SUGGESTIONS_MAX_HEIGHT * scale,
            borderRadius: sp(16),
            backgroundColor: D.white,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: D.border,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              paddingHorizontal: sp(14),
              paddingVertical: sp(10),
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: D.border,
              backgroundColor: D.page,
            }}
          >
            <Text style={{ fontSize: fs(13), fontWeight: '700', color: D.muted, textTransform: 'uppercase' }}>
              Select address
            </Text>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={{ maxHeight: (SUGGESTIONS_MAX_HEIGHT - 36) * scale }}
          >
            {searching && suggestions.length === 0 ? (
              <View
                style={{
                  padding: sp(14),
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: sp(10),
                }}
              >
                <ActivityIndicator size="small" color={D.green} />
                <Text style={{ fontSize: fs(15), fontWeight: '600', color: D.secondary }}>
                  Searching addresses…
                </Text>
              </View>
            ) : null}
            {!searching && searchError ? (
              <View style={{ padding: sp(14) }}>
                <Text style={{ fontSize: fs(15), fontWeight: '600', color: D.secondary }}>
                  {searchError}
                </Text>
              </View>
            ) : null}
            {suggestions.map((item, index) => (
              <Pressable
                key={`${item.id}-${index}`}
                onPressIn={() => applyAddress(item)}
                accessibilityRole="button"
                accessibilityLabel={`Use address ${item.label}`}
                testID={`${testID}-suggestion-${index}`}
                style={({ pressed }) => ({
                  paddingHorizontal: sp(14),
                  paddingVertical: sp(12),
                  backgroundColor: pressed ? D.page : D.white,
                  borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: D.border,
                })}
              >
                <Text
                  numberOfLines={2}
                  style={{ fontSize: fs(16), lineHeight: fs(21), fontWeight: '700', color: D.ink }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
