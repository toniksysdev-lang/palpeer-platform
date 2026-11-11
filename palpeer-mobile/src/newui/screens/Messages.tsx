import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinStep } from '@/newui/features/PinStep';
import { useListen } from '@/newui/lib/speech';
import { useC } from '@/newui/lib/theme';
import { BottomNav } from '@/newui/ui/BottomNav';
import { Btn, Card, Field, H1, Overlay, Pill, Row, Screen, TopBar, Txt } from '@/newui/ui/kit';

type AlertRow = {
  id: string;
  title: string;
  text: string;
  time: string;
  fresh: boolean;
  actionLabel?: string | null;
};

type ChatRow = {
  id: string;
  title: string;
  text: string;
  time: string;
  unread: number;
  negotiationId?: string | null;
  p2pOrderId?: string | null;
  needsAnswer?: boolean;
};

type MessageRow = { id: string; me: boolean; text: string; time: string };

type TalkState = {
  negotiationId: string;
  requestId: string;
  amount: number;
  rate: number;
  nextPrice: number;
  canAnswer: boolean;
  waiting: boolean;
  done: boolean;
  closed: boolean;
  dealText: string;
  statusText: string;
  statusColor: string;
  bubbles: { id: string; me: boolean; rate: number; text: string; who: string }[];
  showStatus: boolean;
};

type OkErr = { ok: true } | { ok: false; error: string };

type MessagesProps = {
  backend?: boolean;
  liveAlerts?: AlertRow[];
  liveChats?: ChatRow[];
  liveMessages?: MessageRow[];
  talk?: TalkState | null;
  activeRoomId?: string | null;
  activeNegotiationId?: string | null;
  messagesLoading?: boolean;
  alertsLoadingMore?: boolean;
  alertsHasMore?: boolean;
  /** Unread Alerts from API (footer badge may also include chat unread). */
  alertsUnread?: number;
  unreadCount?: number;
  msgBadge?: string;
  openChat?: (roomId: string) => Promise<OkErr>;
  openPriceTalk?: (roomId: string) => Promise<OkErr>;
  closeChat?: () => void;
  closeTalk?: () => void;
  openMessagesChatFromTalk?: () => Promise<OkErr>;
  onSendChat?: (text: string) => Promise<OkErr>;
  openAlert?: (alertId: string) => void;
  confirmPin?: (pin: string) => Promise<boolean>;
  onAcceptTalk?: () => Promise<OkErr>;
  onCounterTalk?: () => Promise<OkErr>;
  onRejectTalk?: () => Promise<OkErr>;
  onLoadMoreAlerts?: () => void;
  onRefresh?: () => void;
};

/** Messages: price talks and alerts — wired to useLiveMessages. */
export default function Messages(props: MessagesProps) {
  const c = useC();
  const { listen, listenLabel } = useListen();
  const params = useLocalSearchParams<{ section?: string }>();
  const [tab, setTab] = useState<'chats' | 'alerts'>(params.section === 'alerts' ? 'alerts' : 'chats');
  const [draft, setDraft] = useState('');
  const [chatError, setChatError] = useState('');
  const [talkError, setTalkError] = useState('');
  const [talkBusy, setTalkBusy] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (params.section === 'alerts') setTab('alerts');
    if (params.section === 'talks' || params.section === 'chats') setTab('chats');
  }, [params.section]);

  const alerts = props.liveAlerts ?? [];
  const chats = props.liveChats ?? [];
  const messages = props.liveMessages ?? [];
  const talk = props.talk ?? null;
  const chatOpen = !!props.activeRoomId;
  const talkOpen = !!props.activeNegotiationId && !!talk;
  const freshCount = props.alertsUnread ?? alerts.filter((a) => a.fresh).length;

  const say = useMemo(() => {
    if (talkOpen && talk) {
      if (talk.canAnswer) {
        return (
          `A person asks ${talk.rate} naira for one Canada dollar. ${talk.dealText}. ` +
          'You can accept, offer another price, or say no.'
        );
      }
      return talk.statusText || 'Talk about the price.';
    }
    if (chatOpen) {
      return 'Chat. ' + messages.map((m) => (m.me ? 'You said ' : 'They said ') + m.text).join('. ') + '.';
    }
    if (tab === 'chats') {
      return chats.length
        ? 'Price talks. You have ' + chats.length + '. Tap one to open it.'
        : 'Price talks. You have none yet.';
    }
    return 'Alerts. ' + alerts.map((a) => a.title + '. ' + a.text).join('. ') + '.';
  }, [alerts, chatOpen, chats.length, messages, tab, talk, talkOpen]);

  const sendChat = useCallback(async () => {
    const text = draft.trim();
    if (!text || !props.onSendChat) return;
    const r = await props.onSendChat(text);
    if (r.ok === false) setChatError(r.error || 'Could not send.');
    else {
      setDraft('');
      setChatError('');
    }
  }, [draft, props]);

  const closeChat = useCallback(() => {
    setDraft('');
    setChatError('');
    props.closeChat?.();
  }, [props]);

  const closeTalk = useCallback(() => {
    setTalkError('');
    setPinOpen(false);
    props.closeTalk?.();
  }, [props]);

  const runTalk = useCallback(
    async (action: 'accept' | 'counter' | 'reject') => {
      setTalkBusy(true);
      setTalkError('');
      try {
        const r =
          action === 'accept'
            ? await props.onAcceptTalk?.()
            : action === 'counter'
              ? await props.onCounterTalk?.()
              : await props.onRejectTalk?.();
        if (!r) {
          setTalkError('Could not finish that.');
          return;
        }
        if (r.ok === false) setTalkError(r.error);
        else if (action === 'accept') setPinOpen(false);
      } finally {
        setTalkBusy(false);
      }
    },
    [props],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      props.onRefresh?.();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  }, [props]);

  const tabBtn = (key: 'chats' | 'alerts', label: string) => (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: tab === key }}
      onPress={() => setTab(key)}
      style={{
        flex: 1,
        minHeight: 52,
        borderRadius: 14,
        backgroundColor: tab === key ? c.brand : c.field,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt size={17} w="800" color={tab === key ? '#FFFFFF' : c.text}>
        {label}
      </Txt>
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 10, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.brand} />}
      >
        <Row between style={{ minHeight: 52 }}>
          <H1>Messages</H1>
          <Pill icon="listen" dark label={listenLabel} a11y="Listen to this screen" onPress={() => listen(say)} />
        </Row>
        <Row gap={8}>
          {tabBtn('chats', props.backend ? `Price talks (${chats.length})` : 'Price talks (0)')}
          {tabBtn('alerts', props.backend ? `Alerts (${freshCount})` : 'Alerts (0)')}
        </Row>

        {tab === 'chats' ? (
          <>
            {chats.length === 0 ? (
              <Txt size={19} w="700" color="text2">
                No price talks yet.
              </Txt>
            ) : null}
            {chats.map((room) => (
              <Pressable
                key={room.id}
                accessibilityRole="button"
                onPress={() => {
                  setChatError('');
                  setTalkError('');
                  void (props.openPriceTalk ?? props.openChat)?.(room.id);
                }}
                style={{
                  borderRadius: 18,
                  backgroundColor: room.unread > 0 || room.needsAnswer ? c.tileBlue : c.card,
                  padding: 14,
                  gap: 2,
                }}
              >
                <Txt size={16} w="700" color="text2">
                  {room.negotiationId ? 'Price talk' : room.p2pOrderId ? 'Order chat' : 'Chat'}
                </Txt>
                <Txt size={18} w="800">
                  {room.title}
                </Txt>
                <Txt size={17} w="700" color="blue">
                  {room.text}
                </Txt>
                <Txt size={15} w="600" color="text3">
                  {room.time}
                </Txt>
              </Pressable>
            ))}
          </>
        ) : (
          <>
            {alerts.length === 0 ? (
              <Txt size={19} w="700" color="text2">
                No alerts yet.
              </Txt>
            ) : null}
            {alerts.map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                onPress={() => props.openAlert?.(a.id)}
                style={{
                  borderRadius: 18,
                  backgroundColor: a.fresh ? c.tileOrange : c.card,
                  padding: 14,
                  gap: 4,
                }}
              >
                <Txt size={18} w="800">
                  {a.title}
                </Txt>
                <Txt size={16} color="text2">
                  {a.text}
                </Txt>
                <Txt size={15} w="600" color="text3">
                  {a.time}
                </Txt>
                {a.actionLabel ? (
                  <Txt
                    size={16}
                    w="800"
                    color={a.actionLabel === 'See Palpeer rate' ? 'orange' : 'blue'}
                    style={{ marginTop: 6 }}
                  >
                    {a.actionLabel}
                  </Txt>
                ) : null}
              </Pressable>
            ))}
            {props.alertsHasMore ? (
              <Btn
                kind="soft"
                size="mid"
                label={props.alertsLoadingMore ? 'Loading…' : 'Load more alerts'}
                disabled={props.alertsLoadingMore}
                onPress={() => props.onLoadMoreAlerts?.()}
              />
            ) : null}
          </>
        )}
      </ScrollView>
      <BottomNav active="messages" unread={props.unreadCount ?? 0} />

      <Overlay open={talkOpen && !pinOpen}>
        {talk ? (
          <Screen gap={10}>
            <TopBar onBack={closeTalk} say={say} />
            <H1>Talk about the price</H1>
            <ScrollView
              contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
              style={{ flex: 1, backgroundColor: c.card, borderRadius: 22, padding: 14 }}
            >
              {talk.bubbles.map((b) => (
                <View
                  key={b.id}
                  style={{
                    alignSelf: b.me ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: b.me ? '#1D5BC7' : c.field,
                  }}
                >
                  <Txt size={14} w="700" color={b.me ? '#FFFFFF' : 'text3'} style={{ opacity: b.me ? 0.85 : 1 }}>
                    {b.who}
                  </Txt>
                  <Txt size={20} w="800" color={b.me ? '#FFFFFF' : c.text}>
                    {b.text}
                  </Txt>
                </View>
              ))}
              {talk.showStatus && talk.statusText ? (
                <Txt size={17} w="800" style={{ color: talk.statusColor }} role="alert">
                  {talk.statusText}
                </Txt>
              ) : null}
            </ScrollView>
            {talkError ? (
              <Txt size={17} w="700" color="red" role="alert">
                {talkError}
              </Txt>
            ) : null}
            {talk.canAnswer ? (
              <>
                <Card bg={c.tileGreen}>
                  <Txt size={16} w="700">
                    {talk.dealText}
                  </Txt>
                </Card>
                <Btn
                  label={'Accept ₦' + talk.rate}
                  busy={talkBusy}
                  disabled={talkBusy}
                  onPress={() => setPinOpen(true)}
                />
                <Row gap={8}>
                  <Btn
                    size="mid"
                    kind="outline"
                    label={'Offer ₦' + talk.nextPrice}
                    disabled={talkBusy}
                    onPress={() => void runTalk('counter')}
                    style={{ flex: 1, borderColor: '#1D5BC7' }}
                  />
                  <Btn
                    size="mid"
                    kind="outline"
                    label="Say no"
                    disabled={talkBusy}
                    onPress={() => void runTalk('reject')}
                    style={{ flex: 1, borderColor: c.red }}
                  />
                </Row>
              </>
            ) : null}
            <Btn
              kind="outline"
              size="mid"
              label="Open chat"
              onPress={() => void props.openMessagesChatFromTalk?.()}
            />
          </Screen>
        ) : null}
      </Overlay>

      <Overlay open={pinOpen}>
        <PinStep
          title="Enter your PIN"
          onBack={() => setPinOpen(false)}
          onDone={() => setPinOpen(false)}
          confirmPin={
            props.confirmPin
              ? async (pin) => {
                  const ok = await props.confirmPin!(pin);
                  if (!ok) return false;
                  const r = await props.onAcceptTalk?.();
                  if (!r || r.ok === false) {
                    setTalkError(r && r.ok === false ? r.error : 'Could not accept price.');
                    return false;
                  }
                  return true;
                }
              : undefined
          }
        />
      </Overlay>

      <Overlay open={chatOpen}>
        <Screen gap={10}>
          <TopBar onBack={closeChat} say={say} />
          <H1>Chat</H1>
          <ScrollView contentContainerStyle={{ gap: 10, paddingVertical: 4 }} style={{ flex: 1, backgroundColor: c.card, borderRadius: 22, padding: 14 }}>
            {messages.map((m) => (
              <View
                key={m.id}
                style={{
                  alignSelf: m.me ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  borderRadius: 16,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  backgroundColor: m.me ? '#1D5BC7' : c.field,
                }}
              >
                <Txt size={14} w="700" color={m.me ? '#FFFFFF' : 'text3'} style={{ opacity: m.me ? 0.85 : 1 }}>
                  {m.me ? 'Me' : 'The other person'}
                </Txt>
                <Txt size={19} w="700" color={m.me ? '#FFFFFF' : c.text}>
                  {m.text}
                </Txt>
                <Txt size={13} w="600" color={m.me ? '#FFFFFF' : 'text3'} style={{ opacity: 0.85 }}>
                  {m.time}
                </Txt>
              </View>
            ))}
          </ScrollView>
          {chatError ? (
            <Txt size={17} w="700" color="red" role="alert">
              {chatError}
            </Txt>
          ) : null}
          <Field label="Message" value={draft} onChangeText={(v) => { setDraft(v); setChatError(''); }} />
          <Row gap={8}>
            <Btn kind="outline" size="mid" label="Back" onPress={closeChat} style={{ flex: 1 }} />
            <Btn size="mid" label="Send" onPress={() => void sendChat()} style={{ flex: 1 }} />
          </Row>
        </Screen>
      </Overlay>
    </SafeAreaView>
  );
}
