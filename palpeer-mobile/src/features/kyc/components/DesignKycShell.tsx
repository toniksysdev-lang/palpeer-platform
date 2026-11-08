import { ChevronLeft, Volume2 } from 'lucide-react-native';
import { type ReactNode, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KYC_D as D } from './designTokens';

type FooterButton = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
};

type Props = {
  onBack: () => void;
  title: string;
  subtitle?: string;
  /** Spoken when Listen is pressed (defaults to title + subtitle). */
  listenText?: string;
  children?: ReactNode;
  footer?: FooterButton[];
  /** Centered empty / permission body instead of scroll content. */
  centered?: boolean;
  testID?: string;
};

function speak(text: string, onDone: () => void) {
  try {
    const synth = (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
    if (!synth) {
      onDone();
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-NG';
    u.onend = onDone;
    u.onerror = onDone;
    synth.speak(u);
  } catch {
    onDone();
  }
}

function DesignButton({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  testID,
}: FooterButton) {
  const inactive = Boolean(disabled || loading);
  const primary = variant === 'primary';
  const ghost = variant === 'ghost';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.cta,
        primary && {
          backgroundColor: inactive ? D.greenDisabled : D.green,
          opacity: pressed && !inactive ? 0.92 : 1,
        },
        !primary &&
          !ghost && {
            backgroundColor: D.white,
            opacity: pressed && !inactive ? 0.92 : 1,
          },
        ghost && {
          backgroundColor: 'transparent',
          opacity: pressed && !inactive ? 0.7 : inactive ? 0.5 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? D.white : D.green} />
      ) : (
        <Text
          style={[
            styles.ctaLabel,
            { color: primary ? D.white : ghost ? D.green : D.ink },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Simple Home chrome for ComplyCube capture / permission / submit screens
 * (page wash, Back + Listen pills, large title, green CTAs).
 */
export function DesignKycShell({
  onBack,
  title,
  subtitle,
  listenText,
  children,
  footer,
  centered,
  testID,
}: Props) {
  const [speaking, setSpeaking] = useState(false);
  const spoken = listenText || [title, subtitle].filter(Boolean).join('. ');

  const onListen = useCallback(() => {
    if (speaking) {
      try {
        (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(spoken, () => setSpeaking(false));
  }, [speaking, spoken]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID={testID}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={({ pressed }) => [styles.pill, styles.backPill, pressed && styles.pressed]}
        >
          <ChevronLeft color={D.ink} size={22} strokeWidth={2.6} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={speaking ? 'Stop listening' : 'Listen to this screen'}
          onPress={onListen}
          style={({ pressed }) => [styles.pill, styles.listenPill, pressed && styles.pressed]}
        >
          <Volume2 color={D.white} size={20} strokeWidth={2.2} />
          <Text style={styles.listenLabel}>{speaking ? 'Stop' : 'Listen'}</Text>
        </Pressable>
      </View>

      {centered ? (
        <View style={styles.centerBody}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {children}
        </View>
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {children}
        </ScrollView>
      )}

      {footer && footer.length > 0 ? (
        <View style={styles.footer}>
          {footer.map((btn) => (
            <DesignButton key={btn.testID || btn.label} {...btn} />
          ))}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: D.page,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 10,
  },
  pill: {
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  backPill: {
    backgroundColor: D.white,
    paddingLeft: 10,
  },
  listenPill: {
    backgroundColor: D.ink,
    paddingLeft: 12,
  },
  pressed: { opacity: 0.88 },
  backLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 17,
    fontWeight: '700',
    color: D.ink,
  },
  listenLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 17,
    fontWeight: '700',
    color: D.white,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  centerBody: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: 14,
  },
  title: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 28,
    fontWeight: '800',
    color: D.ink,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 17,
    fontWeight: '600',
    color: D.secondary,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 10,
  },
  cta: {
    minHeight: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ctaLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 22,
    fontWeight: '800',
  },
});
