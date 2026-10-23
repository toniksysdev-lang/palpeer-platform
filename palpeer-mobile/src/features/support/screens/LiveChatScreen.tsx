import { MessageCircle, Send, Sparkles, UserRound } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, TextInput, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
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
import {
  answerAccountQuestion,
  isMissingAccountAiReply,
  matchAccountQuestion,
} from '../liveChat/answerAccountQuestion';
import { buildLiveChatContext } from '../liveChat/buildLiveChatContext';
import { useLiveChatContext } from '../liveChat/useLiveChatContext';

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
};

type Mode = 'ai' | 'agent';

function greeting(firstName: string | null): string {
  const name = firstName?.trim();
  return name
    ? `Hi ${name}, I'm Toniks, Palpeer's AI assistant.\nHow may I help you? I can also connect you to a live agent if needed.`
    : "Hi, I'm Toniks, Palpeer's AI assistant.\nHow may I help you? I can also connect you to a live agent if needed.";
}

export function LiveChatScreen() {
  const theme = useTheme();
  const { email, firstName, snapshot, refreshAccount, ready } = useLiveChatContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('ai');
  const [booting, setBooting] = useState(true);
  const [sending, setSending] = useState(false);
  const [awaitingEscalation, setAwaitingEscalation] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const sessionRef = useRef<string | null>(null);
  const modeRef = useRef<Mode>('ai');
  const snapshotRef = useRef(snapshot);
  const seenRemoteIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    sessionRef.current = sessionId;
  }, [sessionId]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const push = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const bootedRef = useRef(false);

  const boot = useCallback(async () => {
    setBooting(true);
    setBootError(null);
    setMessages([]);
    setMode('ai');
    setAwaitingEscalation(false);
    seenRemoteIds.current = new Set();

    const started = await startGuestAiSession();
    if (!started.ok) {
      bootedRef.current = false;
      setBootError(started.error);
      setBooting(false);
      return;
    }

    setSessionId(started.sessionId);
    push({
      id: `welcome-${Date.now()}`,
      text: greeting(firstName),
      sender: 'ai',
      createdAt: new Date().toISOString(),
    });
    // Show the composer immediately; account link + snapshot refresh can finish in the background.
    setBooting(false);

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

  // Poll agent messages while in live-agent mode (no SignalR dependency in RN).
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
        text: "There isn't a live agent online right now. Please fill out the support form below and our team will follow up via tickets. You can also keep chatting with Toniks.",
        sender: 'ai',
        createdAt: new Date().toISOString(),
        ticketForm: true,
      });
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || booting || !sessionId || awaitingEscalation) return;

    setDraft('');
    const userId = `user-${Date.now()}`;
    push({
      id: userId,
      text,
      sender: 'user',
      createdAt: new Date().toISOString(),
    });

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

      // Personal/account questions: answer from live Palpeer API data (not support email directory).
      const freshSnapshot = await refreshAccount();
      snapshotRef.current = freshSnapshot;
      const accountKind = matchAccountQuestion(text);
      if (accountKind && (email || freshSnapshot.userId)) {
        const localAnswer = answerAccountQuestion(accountKind, freshSnapshot);
        setMessages((prev) => prev.filter((m) => m.id !== loadingId));
        push({
          id: `ai-local-${Date.now()}`,
          text: localAnswer,
          sender: 'ai',
          createdAt: new Date().toISOString(),
        });
        return;
      }

      const result = await sendAiGuestChat({
        message: text,
        sessionId,
        userEmail: email,
        context: buildLiveChatContext(freshSnapshot),
      });

      setMessages((prev) => prev.filter((m) => m.id !== loadingId));

      if (!result.ok) {
        push({
          id: `err-${Date.now()}`,
          text: result.error,
          sender: 'system',
          createdAt: new Date().toISOString(),
        });
        return;
      }

      if (result.sessionId && result.sessionId !== sessionId) {
        setSessionId(result.sessionId);
      }

      let reply = result.text;
      if (isMissingAccountAiReply(reply) && (email || freshSnapshot.userId)) {
        // Support AI email lookup failed; fall back to app backend snapshot.
        const fallbackKind = matchAccountQuestion(text) ?? 'profile';
        reply = answerAccountQuestion(fallbackKind, freshSnapshot);
      }

      push({
        id: `ai-${Date.now()}`,
        text: reply,
        sender: 'ai',
        createdAt: new Date().toISOString(),
      });

      if (result.shouldEscalate && !isMissingAccountAiReply(result.text)) {
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

  const headerDetail =
    mode === 'agent' ? 'Live agent' : awaitingEscalation ? 'Choose how to continue' : 'AI assistant';

  const composer = bootError ? null : (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.sm,
        gap: theme.spacing.xs,
        backgroundColor: theme.colors.background,
      }}
    >
      {awaitingEscalation ? (
        <AppText variant="caption" tone="secondary">
          Choose an option above, or tap Talk to agent.
        </AppText>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={mode === 'agent' ? 'Message the agent…' : 'Ask the AI assistant…'}
          placeholderTextColor={theme.colors.textMuted}
          editable={!sending && !booting && !!sessionId && !awaitingEscalation}
          multiline
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 120,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            color: theme.colors.textPrimary,
            backgroundColor: theme.colors.surface,
          }}
          testID="live-chat-input"
        />
        <Pressable
          onPress={() => void send()}
          disabled={sending || booting || !draft.trim() || !sessionId || awaitingEscalation}
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={({ pressed }) => ({
            minWidth: 72,
            height: 44,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.lg,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
            backgroundColor: theme.colors.primary,
            opacity: pressed || sending || !draft.trim() || !sessionId ? 0.55 : 1,
          })}
          testID="live-chat-send"
        >
          {sending ? (
            <ActivityIndicator color={theme.colors.onPrimary} />
          ) : (
            <>
              <Icon icon={Send} color={theme.colors.onPrimary} size="sm" />
              <AppText variant="bodyStrong" style={{ color: theme.colors.onPrimary }}>
                Send
              </AppText>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );

  return (
    <Screen padded={false} edges={['top', 'bottom']} keyboardAware footer={composer}>
      <View style={{ paddingHorizontal: theme.spacing.xl }}>
        <StackHeader title="Live chat" />
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.xl,
          paddingBottom: theme.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        <Icon
          icon={mode === 'agent' ? UserRound : Sparkles}
          color={theme.colors.primary}
          size="md"
        />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{mode === 'agent' ? 'Live agent' : 'AI assistant'}</AppText>
          <AppText variant="caption" tone="secondary">
            {headerDetail}
          </AppText>
        </View>
        {mode === 'ai' ? (
          <Button
            label="Talk to agent"
            variant="outline"
            size="md"
            fullWidth={false}
            onPress={() => void escalateToAgent()}
            disabled={sending || booting || !sessionId}
            testID="live-chat-escalate"
          />
        ) : null}
      </View>

      {bootError ? (
        <View style={{ padding: theme.spacing.xl, gap: theme.spacing.md, flex: 1 }}>
          <FormAlert tone="danger" message={bootError} testID="live-chat-boot-error" />
          <Button
            label="Try again"
            onPress={() => {
              bootedRef.current = true;
              void boot();
            }}
            testID="live-chat-retry"
          />
        </View>
      ) : booting ? (
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md }}
          testID="live-chat-booting"
        >
          <ActivityIndicator color={theme.colors.primary} />
          <AppText tone="secondary">Starting chat…</AppText>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          testID="live-chat-messages"
          style={{ flex: 1 }}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.xl,
            paddingVertical: theme.spacing.md,
            gap: theme.spacing.sm,
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: theme.spacing.xxl, gap: theme.spacing.sm }}>
              <Icon icon={MessageCircle} color={theme.colors.textMuted} size="lg" />
              <AppText tone="secondary">Start the conversation</AppText>
            </View>
          }
          renderItem={({ item }) => (
            <LiveChatBubble
              message={item}
              ticketPrefill={{
                fullName: [snapshot.profile?.firstName, snapshot.profile?.lastName]
                  .filter(Boolean)
                  .join(' ')
                  .trim() || firstName,
                email,
                subject: 'Support request from chat',
              }}
              onTalkToAgent={() => void escalateToAgent()}
              onContinueAi={() => setAwaitingEscalation(false)}
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
    </Screen>
  );
}

function LiveChatBubble({
  message,
  ticketPrefill,
  onTalkToAgent,
  onContinueAi,
  onTicketSubmitted,
}: {
  message: ChatMessage;
  ticketPrefill?: { fullName?: string | null; email?: string | null; subject?: string | null };
  onTalkToAgent: () => void;
  onContinueAi: () => void;
  onTicketSubmitted?: (ticket: { ticketNumber?: string }) => void;
}) {
  const theme = useTheme();
  const mine = message.sender === 'user';
  const system = message.sender === 'system';

  if (system) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: theme.spacing.xs }}>
        <AppText variant="caption" tone="secondary" style={{ textAlign: 'center' }}>
          {message.text}
        </AppText>
      </View>
    );
  }

  return (
    <View
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: message.ticketForm ? '100%' : '85%',
        width: message.ticketForm ? '100%' : undefined,
        gap: theme.spacing.xs,
      }}
    >
      {!mine ? (
        <AppText variant="caption" tone="muted">
          {message.sender === 'agent' ? 'Agent' : 'Toniks'}
        </AppText>
      ) : null}
      <View
        style={{
          backgroundColor: mine
            ? theme.colors.primary
            : message.sender === 'agent'
              ? theme.colors.primarySoft
              : theme.colors.surface,
          borderWidth: mine ? 0 : 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          gap: theme.spacing.xxs,
        }}
      >
        {message.loading ? (
          <ActivityIndicator color={theme.colors.textMuted} />
        ) : (
          <>
            <AppText style={{ color: mine ? theme.colors.onPrimary : theme.colors.textPrimary }} selectable>
              {message.text}
            </AppText>
            <AppText
              variant="caption"
              style={{
                color: mine ? theme.colors.onPrimary : theme.colors.textMuted,
                alignSelf: 'flex-end',
                opacity: 0.85,
              }}
            >
              {formatClockTime(message.createdAt) ?? ''}
            </AppText>
          </>
        )}
      </View>
      {message.escalationPrompt ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          <Button
            label="Talk to agent"
            size="md"
            fullWidth={false}
            onPress={onTalkToAgent}
            testID="live-chat-choose-agent"
          />
          <Button
            label="Continue with AI"
            size="md"
            fullWidth={false}
            variant="outline"
            onPress={onContinueAi}
            testID="live-chat-choose-ai"
          />
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
