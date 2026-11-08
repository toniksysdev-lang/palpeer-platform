import { router } from 'expo-router';
import { ChevronLeft, Minus, Plus, Volume2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SIMPLE_HOME as D } from '@/design/simpleHomeTokens';

import {
  COMMON_QUESTION_CATEGORIES,
  filterCommonQuestions,
  type CommonQuestion,
} from '../commonQuestionsContent';

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
 * Common questions — Simple Home FAQ artboard:
 * Back + Listen, search, category chips, accordion rows with +, Chat with Tonia footer.
 */
export function CommonQuestionsScreen() {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('getting-started');
  const [openId, setOpenId] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const items = useMemo(
    () => filterCommonQuestions(query, categoryId),
    [query, categoryId],
  );

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
    const bits = [
      'Common questions.',
      ...items.map((i) =>
        openId === i.id ? `${i.question}. ${i.answer}` : i.question,
      ),
      'Still need help? Chat with Tonia.',
    ];
    setSpeaking(true);
    speak(bits.join(' '), () => setSpeaking(false));
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/MoreHelp');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="common-questions-screen">
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
        Common questions
      </Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search, for example fee"
        placeholderTextColor={D.muted}
        autoCorrect={false}
        returnKeyType="search"
        style={styles.search}
        testID="common-questions-search"
        accessibilityLabel="Search common questions"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsScroll}
        testID="common-questions-categories"
      >
        {COMMON_QUESTION_CATEGORIES.map((cat) => {
          const selected = categoryId === cat.id;
          return (
            <Pressable
              key={cat.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={cat.label}
              onPress={() => {
                setCategoryId(cat.id);
                setOpenId(null);
              }}
              testID={`common-questions-cat-${cat.id}`}
              style={({ pressed }) => [
                styles.chip,
                selected ? styles.chipOn : styles.chipOff,
                pressed && styles.pressed,
              ]}
            >
              <Text style={selected ? styles.chipOnLabel : styles.chipOffLabel}>{cat.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      >
        {items.length === 0 ? (
          <View style={styles.empty} testID="common-questions-empty">
            <Text style={styles.rowTitle}>No matching answers</Text>
            <Text style={styles.emptyNote}>Try other words, or chat with Tonia.</Text>
          </View>
        ) : (
          items.map((item) => (
            <FaqAccordion
              key={item.id}
              item={item}
              expanded={openId === item.id}
              onToggle={() =>
                setOpenId((current) => (current === item.id ? null : item.id))
              }
            />
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Still need help? Chat with Tonia"
          onPress={() => router.push('/support/live-chat')}
          testID="common-questions-chat-tonia"
          style={({ pressed }) => [styles.toniaBtn, pressed && styles.pressed]}
        >
          <Text style={styles.toniaLabel}>Still need help? Chat with Tonia</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function FaqAccordion({
  item,
  expanded,
  onToggle,
}: {
  item: CommonQuestion;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.question}
      accessibilityState={{ expanded }}
      onPress={onToggle}
      testID={`faq-${item.id}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle}>{item.question}</Text>
        {expanded ? (
          <Minus color={D.green} size={22} strokeWidth={2.6} />
        ) : (
          <Plus color={D.green} size={22} strokeWidth={2.6} />
        )}
      </View>
      {expanded ? (
        <Text style={styles.answer} testID={`faq-${item.id}-answer`}>
          {item.answer}
        </Text>
      ) : null}
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
  search: {
    marginHorizontal: 16,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: D.white,
    borderWidth: 2,
    borderColor: D.inputBorder,
    color: D.ink,
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 17,
    fontWeight: '600',
  },
  chipsScroll: {
    flexGrow: 0,
    marginTop: 12,
    marginBottom: 4,
  },
  chips: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: D.green,
    borderColor: D.green,
  },
  chipOff: {
    backgroundColor: D.white,
    borderColor: D.green,
  },
  chipOnLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 15,
    fontWeight: '800',
    color: D.white,
  },
  chipOffLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 15,
    fontWeight: '700',
    color: D.green,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 10,
  },
  row: {
    backgroundColor: D.white,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowTitle: {
    flex: 1,
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 18,
    fontWeight: '800',
    color: D.ink,
    lineHeight: 24,
  },
  answer: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 16,
    fontWeight: '600',
    color: D.body,
    lineHeight: 22,
    paddingRight: 28,
  },
  empty: {
    backgroundColor: D.white,
    borderRadius: 18,
    padding: 16,
    gap: 4,
  },
  emptyNote: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 16,
    fontWeight: '600',
    color: D.body,
    lineHeight: 21,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  toniaBtn: {
    minHeight: 60,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: D.green,
    backgroundColor: D.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  toniaLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 18,
    fontWeight: '800',
    color: D.green,
    textAlign: 'center',
  },
});
