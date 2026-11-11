import { router } from 'expo-router';
import { ChevronLeft, Volume2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PREVIEW_KEYBOARD_EVENT,
  keepPreviewKeyboardFocus,
  type PreviewKeyboardDetail,
} from '@/boot/previewSoftKeyboard';
import { SIMPLE_HOME as D } from '@/design/simpleHomeTokens';
import {
  autoAssignAgent,
  getAgentsOnline,
  getGuestMessages,
  mapGuestSender,
  sendAiGuestChat,
  sendGuestAgentMessage,
  startGuestAiSession,
  verifyPalpeerAccount,
} from '@/services/supportChat/supportChatApi';
import { formatClockTime } from '@/utils/datetime';

import { SupportTicketForm } from '../components/SupportTicketForm';
import { answerHowToById, answerHowToFromFaq, localAssistantTopicsHint } from '../faq';
import {
  answerAccountQuestion,
  isCapacityAiReply,
  isMissingAccountAiReply,
  matchAccountQuestion,
} from '../liveChat/answerAccountQuestion';
import { buildLiveChatContext } from '../liveChat/buildLiveChatContext';
import { useLiveChatContext } from '../liveChat/useLiveChatContext';

const HELPER_NAME = 'Tonia';
const HELPER_SUBTITLE = 'Palpeer helper. A person can join.';
const QUICK_CHIPS = [
  { id: 'fees', label: 'Fees', prompt: 'What are the fees?', faqId: 'fees-overview' },
  { id: 'add', label: 'Add money', prompt: 'How do I add money?', faqId: 'fund-how' },
  { id: 'withdraw', label: 'Withdraw', prompt: 'How do I withdraw money?', faqId: 'withdraw-how' },
  { id: 'changing', label: 'Changing', prompt: 'How do I change money?', faqId: 'exchange-how' },
] as const;

type Sender = 'user' | 'ai' | 'agent' | 'system';

type ChatMessage = {
  id: string;
  text: string;
  sender: Sender;
  createdAt: string;
  loading?: boolean;
  escalationPrompt?: boolean;
  /** Show the public support-ticket form (no live agent available). */
  ticketForm?: boolean;
  /** Welcome message: show design quick-reply chips under the bubble. */
  quickChips?: boolean;
};

type Mode = 'ai' | 'agent';

function greeting(firstName: string | null): string {
  const name = firstName?.trim();
  const who = name || 'there';
  return `Hi ${who}, I am ${HELPER_NAME}, your Palpeer helper. Ask me about fees, rates, adding, changing, sending or withdrawing money. Say 'talk to a person' any time.`;
}

function wantsPerson(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t.includes('talk to a person') ||
    t.includes('talk to person') ||
    t.includes('live agent') ||
    t.includes('human agent') ||
    t === 'agent' ||
    t === 'person'
  );
}

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

export function LiveChatScreen() {
  const insets = useSafeAreaInsets();
  const { email, firstName, snapshot, refreshAccount, ready } = useLiveChatContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('ai');
  const [booting, setBooting] = useState(true);
  const [sending, setSending] = useState(false);
  const [awaitingEscalation, setAwaitingEscalation] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const sessionRef = useRef<string | null>(null);
  const modeRef = useRef<Mode>('ai');
  const snapshotRef = useRef(snapshot);
  const seenRemoteIds = useRef<Set<string>>(new Set());
  const bootedRef = useRef(false);
  /** After Support AI returns a capacity/rate-limit stub, stay on local How-Tos for this session. */
  const remoteAiDegradedRef = useRef(false);
  // Safe-area bottom can grow with the keyboard; keep the resting inset for closed-keyboard padding.
  const restingBottomInset = useRef(insets.bottom);

  useEffect(() => {
    sessionRef.current = sessionId;
  }, [sessionId]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);
  useEffect(() => {
    if (keyboardHeight === 0) {
      restingBottomInset.current = insets.bottom;
    }
  }, [insets.bottom, keyboardHeight]);

  const push = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const scrollToComposer = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (event: KeyboardEvent) => {
      // Prefer overlap vs window (edge-to-edge Android); fall back to reported height.
      const windowH = Dimensions.get('window').height;
      const screenY = event.endCoordinates?.screenY;
      const overlap =
        typeof screenY === 'number' ? Math.max(0, Math.round(windowH - screenY)) : 0;
      const height = overlap > 40 ? overlap : event.endCoordinates?.height ?? 0;
      setKeyboardHeight(Math.max(0, height));
      scrollToComposer();
      if (Platform.OS === 'android') {
        setTimeout(scrollToComposer, 50);
      }
    };
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    // :3333 phone-frame overlay keypad (does not fire RN Keyboard events).
    const onPreviewKeyboard = (event: Event) => {
      const detail = (event as CustomEvent<PreviewKeyboardDetail>).detail;
      if (!detail?.open) {
        setKeyboardHeight(0);
        return;
      }
      keepPreviewKeyboardFocus(800);
      setKeyboardHeight(Math.max(0, Math.round(detail.height || 0)));
      scrollToComposer();
      setTimeout(scrollToComposer, 80);
      setTimeout(scrollToComposer, 220);
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener(PREVIEW_KEYBOARD_EVENT, onPreviewKeyboard as EventListener);
    }

    return () => {
      showSub.remove();
      hideSub.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener(PREVIEW_KEYBOARD_EVENT, onPreviewKeyboard as EventListener);
      }
    };
  }, [scrollToComposer]);

  const boot = useCallback(async () => {
    setBootError(null);
    setMessages([]);
    setMode('ai');
    setAwaitingEscalation(false);
    setSessionId(null);
    seenRemoteIds.current = new Set();
    remoteAiDegradedRef.current = false;

    // Show the greeting immediately — don't wait on the support API round-trip.
    push({
      id: `welcome-${Date.now()}`,
      text: greeting(firstName),
      sender: 'ai',
      createdAt: new Date().toISOString(),
      quickChips: true,
    });
    setBooting(false);

    const started = await startGuestAiSession();
    if (!started.ok) {
      bootedRef.current = false;
      setBootError(started.error);
      return;
    }

    setSessionId(started.sessionId);

    // Link account + refresh wallets in the background (do not block the composer).
    void (async () => {
      if (email) {
        await verifyPalpeerAccount(email, started.sessionId);
      }
      try {
        await refreshAccount();
      } catch {
        // Account snapshot is best-effort for AI context.
      }
    })();
  }, [email, firstName, push, refreshAccount]);

  useEffect(() => {
    if (!ready || bootedRef.current) return;
    bootedRef.current = true;
    void boot();
  }, [ready, boot]);

  useEffect(() => {
    if (mode !== 'agent' || !sessionId) return;
    let cancelled = false;

    const poll = async () => {
      const remote = await getGuestMessages(sessionId);
      if (cancelled) return;
      for (const item of remote) {
        const sender = mapGuestSender(item.senderType);
        if (sender === 'user') continue;
        const id = String(item.id ?? `${item.createdAt}-${item.message ?? item.text}`);
        if (seenRemoteIds.current.has(id)) continue;
        seenRemoteIds.current.add(id);
        const text = (item.message ?? item.text ?? '').trim();
        if (!text) continue;
        push({
          id: `remote-${id}`,
          text,
          sender: sender === 'agent' ? 'agent' : 'ai',
          createdAt: item.createdAt ?? new Date().toISOString(),
        });
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [mode, sessionId, push]);

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  const escalateToAgent = async () => {
    if (!sessionId || mode === 'agent') return;
    setSending(true);
    setAwaitingEscalation(false);

    try {
      let assigned = await autoAssignAgent(sessionId);
      if (!assigned.ok || !assigned.data.agentAvailable) {
        const online = await getAgentsOnline();
        if (online.online) {
          assigned = await autoAssignAgent(sessionId);
        }
      }

      if (assigned.ok && assigned.data.agentAvailable) {
        setMode('agent');
        push({
          id: `escalate-${Date.now()}`,
          text: assigned.data.pending
            ? 'An agent is available. Your request has been sent — they will join this chat shortly.'
            : `You're connected with ${assigned.data.agentName || 'a live agent'}. They will reply here shortly.`,
          sender: 'system',
          createdAt: new Date().toISOString(),
        });
        return;
      }

      push({
        id: `no-agent-${Date.now()}`,
        text: `There isn't a live agent online right now. Please fill out the support form below and our team will follow up via tickets. You can also keep chatting with ${HELPER_NAME}.`,
        sender: 'ai',
        createdAt: new Date().toISOString(),
        ticketForm: true,
      });
    } finally {
      setSending(false);
    }
  };

  const sendText = async (raw: string, options?: { faqId?: string }) => {
    const text = raw.trim();
    if (!text || sending || booting || !sessionId || awaitingEscalation) return;

    setDraft('');
    const userMsgId = `user-${Date.now()}`;
    push({
      id: userMsgId,
      text,
      sender: 'user',
      createdAt: new Date().toISOString(),
    });

    if (mode === 'ai' && wantsPerson(text)) {
      await escalateToAgent();
      return;
    }

    const loadingId = `loading-${Date.now()}`;
    if (mode === 'ai') {
      push({
        id: loadingId,
        text: '',
        sender: 'ai',
        createdAt: new Date().toISOString(),
        loading: true,
      });
    }

    setSending(true);
    try {
      if (mode === 'agent') {
        const result = await sendGuestAgentMessage(sessionId, text);
        if (!result.ok) {
          push({
            id: `err-${Date.now()}`,
            text: result.error,
            sender: 'system',
            createdAt: new Date().toISOString(),
          });
        }
        return;
      }

      // Quick chips pin a How-To id so scoring cannot pick a rival answer.
      if (options?.faqId) {
        const pinned = answerHowToById(options.faqId);
        if (pinned) {
          setMessages((prev) => prev.filter((m) => m.id !== loadingId));
          push({
            id: `ai-faq-${Date.now()}`,
            text: pinned,
            sender: 'ai',
            createdAt: new Date().toISOString(),
          });
          return;
        }
      }

      // Answer account questions from cached snapshot first; refresh only when needed.
      const accountKind = matchAccountQuestion(text);
      let activeSnapshot = snapshotRef.current;
      if (accountKind) {
        if (!(email || activeSnapshot.userId)) {
          setMessages((prev) => prev.filter((m) => m.id !== loadingId));
          push({
            id: `ai-signin-${Date.now()}`,
            text: 'Sign in to your Palpeer account in the app to see your balances, profile, and recent activity. I can still answer how-to questions while you are signed out.',
            sender: 'ai',
            createdAt: new Date().toISOString(),
          });
          return;
        }
        try {
          activeSnapshot = await refreshAccount();
          snapshotRef.current = activeSnapshot;
        } catch {
          // Keep cached snapshot.
        }
        const localAnswer = answerAccountQuestion(accountKind, activeSnapshot);
        setMessages((prev) => prev.filter((m) => m.id !== loadingId));
        push({
          id: `ai-local-${Date.now()}`,
          text: localAnswer,
          sender: 'ai',
          createdAt: new Date().toISOString(),
        });
        return;
      }

      // Product how-tos from Help Center — preferred path (remote Support AI is often rate-limited).
      const howToAnswer =
        answerHowToFromFaq(text) ??
        (remoteAiDegradedRef.current ? answerHowToFromFaq(text, { loose: true }) : null);
      if (howToAnswer) {
        setMessages((prev) => prev.filter((m) => m.id !== loadingId));
        push({
          id: `ai-faq-${Date.now()}`,
          text: howToAnswer,
          sender: 'ai',
          createdAt: new Date().toISOString(),
        });
        return;
      }

      if (remoteAiDegradedRef.current) {
        setMessages((prev) => prev.filter((m) => m.id !== loadingId));
        push({
          id: `ai-local-degraded-${Date.now()}`,
          text: localAssistantTopicsHint(),
          sender: 'ai',
          createdAt: new Date().toISOString(),
          escalationPrompt: true,
        });
        setAwaitingEscalation(true);
        return;
      }

      // Slim context only — the full How-To guide is answered locally above and
      // large prompts make OpenAI TPM / rate limits worse on the support API.
      const result = await sendAiGuestChat({
        message: text,
        sessionId,
        userEmail: email,
        context: buildLiveChatContext({ ...activeSnapshot, includeOperationalGuide: false }),
      });

      setMessages((prev) => prev.filter((m) => m.id !== loadingId));

      if (!result.ok) {
        remoteAiDegradedRef.current = true;
        const fallback =
          answerHowToFromFaq(text, { loose: true }) ?? localAssistantTopicsHint();
        push({
          id: `ai-fallback-${Date.now()}`,
          text: fallback,
          sender: 'ai',
          createdAt: new Date().toISOString(),
          escalationPrompt: true,
        });
        setAwaitingEscalation(true);
        return;
      }

      if (result.sessionId && result.sessionId !== sessionId) {
        setSessionId(result.sessionId);
      }

      let reply = result.text;
      if (isMissingAccountAiReply(reply) && (email || activeSnapshot.userId)) {
        const fallbackKind = matchAccountQuestion(text);
        reply = fallbackKind
          ? answerAccountQuestion(fallbackKind, activeSnapshot)
          : answerHowToFromFaq(text, { loose: true }) ??
            "You're signed in on Palpeer. Ask about your balances, recent activity, or a how-to (add money, withdraw, InstantEX, P2P), or talk to a person.";
      }

      // Capacity stubs from the Support AI — answer locally or offer topics + agent.
      const capacityStub = isCapacityAiReply(reply);
      if (capacityStub) {
        remoteAiDegradedRef.current = true;
        reply =
          answerHowToFromFaq(text, { loose: true }) ?? localAssistantTopicsHint();
      }

      const answeredFromLocalKnowledge = capacityStub && reply !== localAssistantTopicsHint();

      push({
        id: `ai-${Date.now()}`,
        text: reply,
        sender: 'ai',
        createdAt: new Date().toISOString(),
      });

      if (
        (result.shouldEscalate || (capacityStub && !answeredFromLocalKnowledge)) &&
        !isMissingAccountAiReply(result.text)
      ) {
        push({
          id: `esc-prompt-${Date.now()}`,
          text: 'I want to make sure you get the right help. Would you like to talk to a live agent?',
          sender: 'ai',
          createdAt: new Date().toISOString(),
          escalationPrompt: true,
        });
        setAwaitingEscalation(true);
      }
    } finally {
      setSending(false);
    }
  };

  const send = () => void sendText(draft);

  const helperTitle = mode === 'agent' ? 'Live agent' : HELPER_NAME;
  const helperSubtitle =
    mode === 'agent'
      ? 'A person from Palpeer will reply here.'
      : connectingLabel(!!sessionId, !!bootError, booting, awaitingEscalation);

  const canSend = !sending && !booting && !!sessionId && !awaitingEscalation && !!draft.trim();
  // Lift the composer above the system / :3333 keypad. Pad the column so the message field
  // sits just above the keyboard (keyboard stays below the field).
  const keyboardLift = keyboardHeight > 0 ? keyboardHeight : 0;
  const composerBottomPad =
    10 + (keyboardHeight > 0 ? 8 : restingBottomInset.current);

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
    const spoken = [helperTitle, helperSubtitle, greeting(firstName)].join('. ');
    setSpeaking(true);
    speak(spoken, () => setSpeaking(false));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="live-chat-screen">
      <View style={[styles.flex, { paddingBottom: keyboardLift }]} testID="live-chat-keyboard-lift">
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backPill, pressed && styles.pressed]}
          >
            <ChevronLeft color={D.ink} size={22} strokeWidth={2.6} />
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>

          <View style={styles.helperBlock} accessibilityRole="header">
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>
                {mode === 'agent' ? 'A' : HELPER_NAME.charAt(0)}
              </Text>
            </View>
            <View style={styles.helperText}>
              <Text style={styles.helperName} numberOfLines={1}>
                {helperTitle}
              </Text>
              <Text style={styles.helperSubtitle} numberOfLines={2}>
                {helperSubtitle}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={speaking ? 'Stop listening' : 'Listen to this screen'}
            onPress={onListen}
            style={({ pressed }) => [styles.listenCircle, pressed && styles.pressed]}
          >
            <Volume2 color={D.white} size={22} strokeWidth={2.2} />
          </Pressable>
        </View>

        <View style={styles.flex}>
          {bootError ? (
            <View style={styles.errorBody} testID="live-chat-boot-error">
              <Text style={styles.errorText} accessibilityRole="text">
                {bootError}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Try again"
                onPress={() => {
                  bootedRef.current = true;
                  setBooting(true);
                  void boot();
                }}
                testID="live-chat-retry"
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.primaryBtnLabel}>Try again</Text>
              </Pressable>
            </View>
          ) : booting ? (
            <View style={styles.centerBody} testID="live-chat-booting">
              <ActivityIndicator color={D.green} size="large" />
              <Text style={styles.helperSubtitle}>Starting chat…</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              testID="live-chat-messages"
              style={styles.flex}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.threadContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              onContentSizeChange={scrollToComposer}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.helperSubtitle}>Start the conversation</Text>
                </View>
              }
              renderItem={({ item }) => (
                <LiveChatBubble
                  message={item}
                  ticketPrefill={{
                    fullName:
                      [snapshot.profile?.firstName, snapshot.profile?.lastName]
                        .filter(Boolean)
                        .join(' ')
                        .trim() || firstName,
                    email,
                    subject: 'Support request from chat',
                  }}
                  onQuickChip={(prompt, faqId) => void sendText(prompt, { faqId })}
                  onTalkToAgent={() => void escalateToAgent()}
                  onContinueAi={() => setAwaitingEscalation(false)}
                  chipsDisabled={sending || booting || !sessionId || awaitingEscalation}
                  onTicketSubmitted={(ticket) => {
                    push({
                      id: `ticket-ok-${Date.now()}`,
                      text: ticket.ticketNumber
                        ? `Thanks — ticket ${ticket.ticketNumber} was submitted. Our team will follow up by email.`
                        : 'Thanks — your support ticket was submitted. Our team will follow up by email.',
                      sender: 'system',
                      createdAt: new Date().toISOString(),
                    });
                  }}
                />
              )}
            />
          )}
        </View>

        {!bootError ? (
          <View
            style={[styles.composer, { paddingBottom: composerBottomPad }]}
            testID="live-chat-composer"
          >
            {awaitingEscalation ? (
              <Text style={styles.composerHint}>Choose an option above, or ask for a person.</Text>
            ) : !sessionId && !booting ? (
              <Text style={styles.composerHint} testID="live-chat-connecting">
                Connecting…
              </Text>
            ) : null}
            <View style={styles.composerRow}>
              <TextInput
                ref={inputRef}
                value={draft}
                onChangeText={setDraft}
                placeholder="Type a message"
                placeholderTextColor={D.muted}
                editable={!sending && !booting && !!sessionId && !awaitingEscalation}
                multiline
                onFocus={() => {
                  if (Platform.OS === 'web') keepPreviewKeyboardFocus(800);
                  scrollToComposer();
                  setTimeout(scrollToComposer, 80);
                  setTimeout(scrollToComposer, 220);
                }}
                style={styles.input}
                testID="live-chat-input"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send"
                accessibilityState={{ disabled: !canSend, busy: sending }}
                disabled={!canSend}
                onPress={send}
                testID="live-chat-send"
                style={({ pressed }) => [
                  styles.sendBtn,
                  !canSend && styles.sendBtnDisabled,
                  pressed && canSend && styles.pressed,
                ]}
              >
                {sending ? (
                  <ActivityIndicator color={D.white} />
                ) : (
                  <Text style={styles.sendBtnLabel}>Send</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function connectingLabel(
  hasSession: boolean,
  bootError: boolean,
  booting: boolean,
  awaitingEscalation: boolean,
): string {
  if (awaitingEscalation) return 'Choose how to continue';
  if (bootError) return 'Could not start chat';
  if (booting || !hasSession) return 'Connecting…';
  return HELPER_SUBTITLE;
}

function LiveChatBubble({
  message,
  ticketPrefill,
  onQuickChip,
  chipsDisabled,
  onTalkToAgent,
  onContinueAi,
  onTicketSubmitted,
}: {
  message: ChatMessage;
  ticketPrefill?: { fullName?: string | null; email?: string | null; subject?: string | null };
  onQuickChip?: (prompt: string, faqId?: string) => void;
  chipsDisabled?: boolean;
  onTalkToAgent: () => void;
  onContinueAi: () => void;
  onTicketSubmitted?: (ticket: { ticketNumber?: string }) => void;
}) {
  const mine = message.sender === 'user';
  const system = message.sender === 'system';

  if (system) {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{message.text}</Text>
      </View>
    );
  }

  const bg = mine ? D.green : D.white;
  const ink = mine ? D.white : D.ink;
  const whoLabel = message.sender === 'agent' ? 'Agent' : HELPER_NAME;

  return (
    <View
      style={[
        styles.bubbleWrap,
        {
          alignSelf: mine ? 'flex-end' : 'flex-start',
          maxWidth: message.ticketForm ? '100%' : mine ? '82%' : '92%',
          width: message.ticketForm ? '100%' : undefined,
        },
      ]}
    >
      {!mine ? <Text style={styles.who}>{whoLabel}</Text> : null}
      <View style={[styles.bubble, { backgroundColor: bg }]}>
        {message.loading ? (
          <ActivityIndicator color={D.muted} />
        ) : (
          <>
            <Text style={[styles.bubbleText, { color: ink }]} selectable>
              {message.text}
            </Text>
            <Text
              style={[
                styles.bubbleTime,
                { color: mine ? D.white : D.muted, opacity: mine ? 0.85 : 1 },
              ]}
            >
              {formatClockTime(message.createdAt) ?? ''}
            </Text>
          </>
        )}
      </View>
      {message.quickChips ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          testID="live-chat-quick-chips"
        >
          {QUICK_CHIPS.map((chip) => (
            <Pressable
              key={chip.id}
              accessibilityRole="button"
              accessibilityLabel={chip.label}
              disabled={chipsDisabled}
              onPress={() => onQuickChip?.(chip.prompt, chip.faqId)}
              testID={`live-chat-chip-${chip.id}`}
              style={({ pressed }) => [
                styles.chip,
                chipsDisabled && styles.chipDisabled,
                pressed && !chipsDisabled && styles.pressed,
              ]}
            >
              <Text style={styles.chipLabel}>{chip.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {message.escalationPrompt ? (
        <View style={styles.choiceRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Talk to a person"
            onPress={onTalkToAgent}
            testID="live-chat-choose-agent"
            style={({ pressed }) => [styles.choicePrimary, pressed && styles.pressed]}
          >
            <Text style={styles.choicePrimaryLabel}>Talk to a person</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Continue with ${HELPER_NAME}`}
            onPress={onContinueAi}
            testID="live-chat-choose-ai"
            style={({ pressed }) => [styles.choiceOutline, pressed && styles.pressed]}
          >
            <Text style={styles.choiceOutlineLabel}>Keep chatting</Text>
          </Pressable>
        </View>
      ) : null}
      {message.ticketForm ? (
        <SupportTicketForm
          prefill={ticketPrefill}
          onSubmitted={onTicketSubmitted}
          testID="live-chat-ticket-form"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: D.page,
  },
  flex: { flex: 1, minHeight: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  backPill: {
    height: 48,
    borderRadius: 24,
    backgroundColor: D.white,
    paddingLeft: 8,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 17,
    fontWeight: '700',
    color: D.ink,
  },
  helperBlock: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: D.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 20,
    fontWeight: '800',
    color: D.white,
  },
  helperText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  helperName: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 18,
    fontWeight: '800',
    color: D.ink,
    lineHeight: 22,
  },
  helperSubtitle: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 13,
    fontWeight: '600',
    color: D.secondary,
    lineHeight: 17,
  },
  listenCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: D.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.88 },
  errorBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 14,
  },
  errorText: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 18,
    fontWeight: '700',
    color: D.danger,
    lineHeight: 24,
  },
  centerBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  threadContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 14,
    flexGrow: 1,
  },
  empty: {
    alignItems: 'center',
    marginTop: 40,
  },
  composer: {
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 8,
    backgroundColor: D.page,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: D.border,
  },
  composerHint: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 14,
    fontWeight: '600',
    color: D.secondary,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 26,
    backgroundColor: D.white,
    color: D.ink,
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 17,
    fontWeight: '600',
  },
  sendBtn: {
    minHeight: 52,
    minWidth: 88,
    borderRadius: 26,
    backgroundColor: D.green,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sendBtnDisabled: {
    backgroundColor: D.greenDisabled,
  },
  sendBtnLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 17,
    fontWeight: '800',
    color: D.white,
  },
  primaryBtn: {
    minHeight: 68,
    borderRadius: 20,
    backgroundColor: D.green,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryBtnLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 22,
    fontWeight: '800',
    color: D.white,
  },
  systemRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  systemText: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 15,
    fontWeight: '600',
    color: D.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  bubbleWrap: {
    gap: 8,
  },
  who: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 15,
    fontWeight: '800',
    color: D.green,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  bubbleText: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },
  bubbleTime: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 12,
    fontWeight: '600',
    alignSelf: 'flex-end',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: D.green,
    backgroundColor: D.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipDisabled: {
    opacity: 0.55,
  },
  chipLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 15,
    fontWeight: '800',
    color: D.green,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  choicePrimary: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: D.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choicePrimaryLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 16,
    fontWeight: '800',
    color: D.white,
  },
  choiceOutline: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: D.green,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: D.white,
  },
  choiceOutlineLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 16,
    fontWeight: '800',
    color: D.green,
  },
});
