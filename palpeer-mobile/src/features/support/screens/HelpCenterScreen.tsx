import { router } from 'expo-router';
import { ChevronLeft, Volume2 } from 'lucide-react-native';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SIMPLE_HOME as D } from '@/design/simpleHomeTokens';
import { appConfig } from '@/config/env';
import { useToast } from '@/providers/ToastProvider';

import { openExternal, supportMailto, telUrl } from '../appInfo';

const DEFAULT_SUPPORT_EMAIL = 'support@palpeer.com';

type Panel = 'home' | 'contact';

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

/**
 * Get help hub — design MoreHelp sheets: Chat with us, Common questions, Contact us.
 * Common questions opens the dedicated FAQ artboard screen.
 */
export function HelpCenterScreen() {
  const toast = useToast();
  const [panel, setPanel] = useState<Panel>('home');
  const [speaking, setSpeaking] = useState(false);
  const email = appConfig.support.email ?? DEFAULT_SUPPORT_EMAIL;
  const phone = appConfig.support.phone;

  const title = panel === 'contact' ? 'Contact us' : 'Get help';

  const onListen = () => {
    if (speaking) {
      try {
        (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
      setSpeaking(false);
      return;
    }
    const bits =
      panel === 'home'
        ? [
            title,
            'Chat with us. Our helper answers. A person joins if needed.',
            'Common questions. Quick answers.',
            'Contact us. How to reach us.',
          ]
        : [
            title,
            'Stay safe. Never share your password, PIN or one-time codes with anyone, including someone who says they are from support.',
            `Email support. ${email}.`,
            phone ? `Call support. ${phone}.` : '',
          ];
    setSpeaking(true);
    speak(bits.filter(Boolean).join(' '), () => setSpeaking(false));
  };

  const openLink = async (url: string, fallback: string) => {
    if (!(await openExternal(url))) toast.show({ type: 'error', title: fallback });
  };

  const goBack = () => {
    if (panel === 'home') {
      if (router.canGoBack()) router.back();
      else router.replace('/More');
      return;
    }
    setPanel('home');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="help-center-screen">
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={goBack}
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

      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {panel === 'home' ? (
          <>
            <HelpRow
              title="Chat with us"
              note="Our helper answers. A person joins if needed."
              onPress={() => router.push('/support/live-chat')}
              testID="support-live-chat"
            />
            <HelpRow
              title="Common questions"
              note="Quick answers"
              onPress={() => router.push('/support/common-questions')}
              testID="support-common-questions"
            />
            <HelpRow
              title="Contact us"
              note="How to reach us"
              onPress={() => setPanel('contact')}
              testID="support-contact-us"
            />
          </>
        ) : null}

        {panel === 'contact' ? (
          <>
            <View style={styles.safeCard} accessibilityRole="summary">
              <Text style={styles.safeTitle}>Stay safe</Text>
              <Text style={styles.safeNote}>
                Never share your password, PIN or one-time codes with anyone, including someone who
                says they are from support.
              </Text>
            </View>
            <HelpRow
              title="Email support"
              note={email}
              onPress={() =>
                void openLink(
                  supportMailto(email, 'PALPEER support request'),
                  `No email app found. Write to ${email}.`,
                )
              }
              testID="support-email"
            />
            {phone ? (
              <HelpRow
                title="Call support"
                note={phone}
                onPress={() => void openLink(telUrl(phone), `Calling isn't available. Call ${phone}.`)}
                testID="support-phone"
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function HelpRow({
  title,
  note,
  onPress,
  testID,
  selected,
}: {
  title: string;
  note: string;
  onPress: () => void;
  testID?: string;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowNote}>{note}</Text>
    </Pressable>
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
  title: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 30,
    fontWeight: '800',
    color: D.ink,
    lineHeight: 34,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 10,
  },
  row: {
    minHeight: 76,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: D.white,
    borderWidth: 3,
    borderColor: 'transparent',
    justifyContent: 'center',
    gap: 2,
  },
  rowSelected: {
    borderColor: D.green,
  },
  rowTitle: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 20,
    fontWeight: '800',
    color: D.ink,
    lineHeight: 24,
  },
  rowNote: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 16,
    fontWeight: '600',
    color: D.body,
    lineHeight: 21,
  },
  safeCard: {
    minHeight: 76,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#DDF1E7',
    gap: 4,
  },
  safeTitle: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 20,
    fontWeight: '800',
    color: '#075E45',
    lineHeight: 24,
  },
  safeNote: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 16,
    fontWeight: '600',
    color: '#075E45',
    lineHeight: 21,
  },
});
