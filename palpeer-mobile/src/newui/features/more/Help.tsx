import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  type KeyboardEvent,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import {
  PREVIEW_KEYBOARD_EVENT,
  keepPreviewKeyboardFocus,
  type PreviewKeyboardDetail,
} from '@/boot/previewSoftKeyboard';
import { useLang } from '@/newui/lib/i18n';
import { useListen } from '@/newui/lib/speech';
import { useC } from '@/newui/lib/theme';
import { Icon } from '@/newui/ui/Icon';
import { Btn, Card, Choice, Circle, Field, H1, P, Row, Screen, TopBar, Txt } from '@/newui/ui/kit';
import { FAQ, FAQ_CATS, KINDS, SAMPLE_TICKETS, TOPICS } from '../moreData';
import { CHIPS0, TONIA, TONIA_FR, TONIA_FR_MSG, topicOf } from '../tonia';

type Msg = { from: 'me' | 'bot' | 'agent' | 'sys'; text: string };

/** Chat with Tonia; hands over to a person (Grace) when asked, when urgent, or after 2 misses. */
export function Chat({ onBack }: { onBack: () => void }) {
  const c = useC();
  const { lang, t } = useLang();
  const { listen } = useListen();
  const fr = lang === 'fr';
  const tFr = (x: string) => (fr && TONIA_FR_MSG[x]) || x;
  const [chat, setChat] = useState<Msg[]>([
    { from: 'bot', text: 'Hi Oluwasesan, I am Tonia, your Palpeer helper. Ask me about fees, rates, adding, changing, sending or withdrawing money. Say "talk to a person" any time.' },
  ]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [agent, setAgent] = useState(false);
  const [misses, setMisses] = useState(0);
  const [keyboardLift, setKeyboardLift] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<ScrollView>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  // Keep the message field above the system keyboard / :3333 preview keypad.
  // iOS: Screen's KeyboardAvoidingView already pads; Android + web need an explicit lift.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (event: KeyboardEvent) => {
      if (Platform.OS === 'ios') {
        scrollToEnd();
        return;
      }
      const windowH = Dimensions.get('window').height;
      const screenY = event.endCoordinates?.screenY;
      const overlap =
        typeof screenY === 'number' ? Math.max(0, Math.round(windowH - screenY)) : 0;
      const height = overlap > 40 ? overlap : event.endCoordinates?.height ?? 0;
      setKeyboardLift(Math.max(0, height));
      scrollToEnd();
    };
    const onHide = () => setKeyboardLift(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    const onPreviewKeyboard = (event: Event) => {
      const detail = (event as CustomEvent<PreviewKeyboardDetail>).detail;
      if (!detail?.open) {
        setKeyboardLift(0);
        return;
      }
      keepPreviewKeyboardFocus(800);
      setKeyboardLift(Math.max(0, detail.height || 0));
      scrollToEnd();
      setTimeout(scrollToEnd, 80);
      setTimeout(scrollToEnd, 220);
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
  }, [scrollToEnd]);

  useEffect(() => {
    scrollToEnd();
  }, [chat, typing, scrollToEnd]);
  const add = (m: Msg) => setChat((x) => [...x, m]);
  const answer = (t: string) => {
    setTyping(false);
    if (agent) return add({ from: 'agent', text: tFr('Thanks. I have your message and I am looking into it now.') });
    const topic = topicOf(t);
    const hand = (why: string) => {
      setMisses(0);
      add({ from: 'bot', text: tFr(why) + tFr(' I am connecting you to customer service now. Your chat so far goes with you, so you will not repeat yourself.') });
      timer.current = setTimeout(() => {
        setAgent(true);
        add({ from: 'sys', text: 'Customer service joined the chat' });
        add({ from: 'agent', text: 'Hello Oluwasesan, I am Grace from Palpeer customer service. I can see your chat with Tonia. How can I help?' });
      }, 1800);
    };
    if (topic === 'urgent') return hand('This needs a person right away. For safety, do not share your PIN or password with anyone.');
    if (topic === 'hand') return hand('Sure.');
    if (!topic) {
      if (misses >= 1) return hand('I am not sure I can answer that.');
      setMisses(misses + 1);
      return add({ from: 'bot', text: tFr('Sorry, I did not get that. I can help with Palpeer: fees, rates, adding, changing, sending, withdrawing, offers, your PIN or your account. Can you say it another way, or tap a button below?') });
    }
    setMisses(0);
    const r = TONIA.find((x) => x.id === topic);
    if (r) add({ from: 'bot', text: (fr && TONIA_FR[r.id]) || r.a });
  };
  const ask = (text: string) => {
    const t = text.trim();
    if (!t || typing) return;
    add({ from: 'me', text: t });
    setDraft('');
    setTyping(true);
    timer.current = setTimeout(() => answer(t), 900);
  };
  const name = agent ? 'Grace' : 'Tonia';

  return (
    <Screen gap={10}>
      <View style={{ flex: 1, gap: 10, paddingBottom: keyboardLift }}>
        <Row gap={10}>
          <Btn kind="soft" size="small" icon="back" label="Back" onPress={onBack} style={{ paddingHorizontal: 10 }} />
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: agent ? '#1D5BC7' : '#0B6E4F', alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={20} w="800" color="#FFFFFF" noTr>
              {name[0]}
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={18} w="800" noTr>
              {name}
            </Txt>
            <Txt size={13} w="600" color="text2">
              {agent ? 'Customer service, a real person' : 'Palpeer helper. A person can join.'}
            </Txt>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Listen to the last message"
            onPress={() => {
              const last = chat.filter((m) => m.from !== 'me').pop();
              if (last) listen(last.text.replace(/•/g, ''));
            }}
            style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="listen" size={26} color={c.onInk} />
          </Pressable>
        </Row>
        <ScrollView
          ref={listRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 8, paddingVertical: 6 }}
          keyboardShouldPersistTaps="always"
          accessibilityLabel="Chat"
          onContentSizeChange={scrollToEnd}
        >
          {chat.map((m, i) => (
            <View key={i} style={{ alignSelf: m.from === 'me' ? 'flex-end' : m.from === 'sys' ? 'center' : 'flex-start', maxWidth: '86%' }}>
              {m.from === 'agent' || m.from === 'bot' ? (
                <Txt size={13} w="700" color="text3">
                  {m.from === 'agent' ? 'Grace, customer service' : 'Tonia'}
                </Txt>
              ) : null}
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 18,
                  borderBottomRightRadius: m.from === 'me' ? 4 : 18,
                  borderBottomLeftRadius: m.from === 'bot' || m.from === 'agent' ? 4 : 18,
                  backgroundColor: m.from === 'me' ? '#0B6E4F' : m.from === 'sys' ? c.key : m.from === 'agent' ? c.tileBlue : c.card,
                }}
              >
                <Txt size={17} w="600" color={m.from === 'me' ? '#FFFFFF' : c.text} noTr={m.from === 'me'}>
                  {m.text}
                </Txt>
              </View>
            </View>
          ))}
          {typing ? (
            <Txt size={15} w="700" color="text3" role="alert">
              {name + ' is typing…'}
            </Txt>
          ) : null}
        </ScrollView>
        {!agent ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }} keyboardShouldPersistTaps="always">
            {CHIPS0.map((label) => (
              <Pressable key={label} accessibilityRole="button" onPress={() => ask(t(label))} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 2, borderColor: c.brandText, justifyContent: 'center' }}>
                <Txt size={15} w="800" color="brandText">
                  {label}
                </Txt>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <Row gap={8}>
          <TextInput
            accessibilityLabel="Type a message"
            placeholder={fr ? 'Écrivez un message' : 'Type a message'}
            placeholderTextColor={c.text4}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => ask(draft)}
            onFocus={() => {
              if (Platform.OS === 'web') keepPreviewKeyboardFocus(800);
              scrollToEnd();
              setTimeout(scrollToEnd, 80);
              setTimeout(scrollToEnd, 220);
            }}
            returnKeyType="send"
            style={{ flex: 1, minHeight: 52, borderRadius: 14, backgroundColor: c.field, color: c.text, paddingHorizontal: 12, fontSize: 17, fontFamily: 'NotoSans_600SemiBold' }}
          />
          <Btn size="small" label="Send" disabled={!draft.trim()} onPress={() => ask(draft)} />
        </Row>
      </View>
    </Screen>
  );
}

/** Common questions: search, topics, tap to open. */
export function Faq({ onBack, onChat }: { onBack: () => void; onChat: () => void }) {
  const c = useC();
  const { t } = useLang();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [openIdx, setOpenIdx] = useState(-1);
  const fq = q.trim().toLowerCase();
  // Search both English and the French text so it works in either language.
  const list = FAQ.map((f, i) => ({ cat: f[0], q: f[1], a: f[2], i })).filter(
    (f) => (cat === 'all' || f.cat === cat) && (!fq || (f.q + ' ' + f.a + ' ' + t(f.q) + ' ' + t(f.a)).toLowerCase().includes(fq)),
  );
  const o = FAQ[openIdx];
  return (
    <Screen scroll gap={10}>
      <TopBar onBack={onBack} say={o ? o[1] + ' ' + o[2] : 'Common questions. Pick a topic, or search. Tap a question to see the answer.'} />
      <H1>Common questions</H1>
      <Field label="Search questions" placeholder="Search, for example fee" value={q} onChangeText={(v) => { setQ(v); setOpenIdx(-1); }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FAQ_CATS.map(([id, label]) => (
          <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: cat === id }} onPress={() => { setCat(id); setOpenIdx(-1); }} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: cat === id ? c.brand : c.card, justifyContent: 'center' }}>
            <Txt size={15} w="800" color={cat === id ? '#FFFFFF' : c.brandText}>
              {label}
            </Txt>
          </Pressable>
        ))}
      </ScrollView>
      {list.map((f) => (
        <Pressable key={f.i} accessibilityRole="button" accessibilityState={{ expanded: openIdx === f.i }} onPress={() => setOpenIdx(openIdx === f.i ? -1 : f.i)} style={{ borderRadius: 18, backgroundColor: c.card, padding: 14, gap: 6 }}>
          <Row between style={{ alignItems: 'flex-start' }}>
            <Txt size={18} w="800" style={{ flex: 1 }}>
              {f.q}
            </Txt>
            <Txt size={24} w="800" color="brandText" noTr>
              {openIdx === f.i ? '−' : '+'}
            </Txt>
          </Row>
          {openIdx === f.i ? (
            <Txt size={16} w="600" color="text2">
              {f.a}
            </Txt>
          ) : null}
        </Pressable>
      ))}
      {list.length === 0 ? (
        <Card>
          <Txt size={17} w="700">
            No question found. Try another word, or ask Tonia.
          </Txt>
        </Card>
      ) : null}
      <Btn size="mid" label="Still need help? Chat with Tonia" onPress={onChat} />
    </Screen>
  );
}

type Ticket = { id: string; title: string; status: string; note: string };
export type ContactPrefill = { kind?: string; topic?: string; msg?: string };

/** Contact us: raise a ticket (problem or question), see my requests. Replies within 24 to 48 hours. */
export function Contact({ onBack, prefill }: { onBack: () => void; prefill?: ContactPrefill }) {
  const c = useC();
  const { tv } = useLang();
  const [tab, setTab] = useState<'new' | 'mine'>('new');
  const [stage, setStage] = useState<'form' | 'sent'>('form');
  const [kind, setKind] = useState(prefill?.kind || '');
  const [topic, setTopic] = useState(prefill?.topic || '');
  const [tref, setTref] = useState('');
  const [msg, setMsg] = useState(prefill?.msg || '');
  const [shot, setShot] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>(SAMPLE_TICKETS);
  const [lastId, setLastId] = useState('');
  const ok = !!kind && !!topic && msg.trim().length >= 5;
  const STATUS: Record<string, string> = { Open: 'orange', Answered: 'brandText', Closed: 'text3' };
  const say =
    stage === 'sent'
      ? 'We got it. Your request number is ' + lastId + '. We reply within 24 to 48 hours.'
      : 'Contact us. Choose a problem or a question, pick what it is about, tell us what happened, then press Send to Palpeer. Or email support at palpeer dot com. We reply within 24 to 48 hours.';

  if (stage === 'sent')
    return (
      <Screen>
        <TopBar onBack={onBack} say={say} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Circle icon="check" />
          <H1 center>We got it</H1>
          <Txt size={26} w="800" noTr>
            {lastId}
          </Txt>
          <P center>Your request number. We reply in the app and by email within 24 to 48 hours. Problems with money come first.</P>
        </View>
        <Btn size="mid" label="See your requests" onPress={() => { setTab('mine'); setStage('form'); }} />
      </Screen>
    );

  const tabBtn = (key: 'new' | 'mine', label: string) => (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => setTab(key)} style={{ flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: tab === key ? c.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      <Txt size={16} w="800" color={tab === key ? '#FFFFFF' : c.text}>
        {label}
      </Txt>
    </Pressable>
  );

  return (
    <Screen scroll gap={10}>
      <TopBar onBack={onBack} say={say} />
      <H1>Contact us</H1>
      <Row gap={4} style={{ backgroundColor: c.card, borderRadius: 14, padding: 4 }}>
        {tabBtn('new', 'New request')}
        {tabBtn('mine', 'My requests (' + tickets.length + ')')}
      </Row>
      {tab === 'new' ? (
        <>
          <Txt size={17} w="800">
            What kind?
          </Txt>
          <Row gap={8}>
            {KINDS.map(([id, label, note]) => (
              <View key={id} style={{ flex: 1 }}>
                <Choice title={label} note={note} on={kind === id} onPress={() => setKind(id)} right={null} />
              </View>
            ))}
          </Row>
          <Txt size={17} w="800">
            About
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TOPICS.map((tp) => (
              <Pressable key={tp} accessibilityRole="radio" accessibilityState={{ selected: topic === tp }} onPress={() => setTopic(tp)} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: c.card, borderWidth: 3, borderColor: topic === tp ? c.brandText : 'transparent', justifyContent: 'center' }}>
                <Txt size={15} w="800">
                  {tp}
                </Txt>
              </Pressable>
            ))}
          </View>
          <Field label="Which action? (if any)" placeholder="From History, for example PP653603E63B" value={tref} onChangeText={setTref} autoCapitalize="characters" />
          <Field label="Tell us what happened" placeholder="Write here" value={msg} onChangeText={setMsg} multiline style={{ minHeight: 110, textAlignVertical: 'top', paddingTop: 10 }} />
          <Btn kind="outline" size="small" label={shot ? 'Photo added. Tap to remove' : 'Add a photo or screenshot (if any)'} onPress={() => setShot(!shot)} />
          <Txt size={15} w="600" color="text2" noTr>
            {tv('We reply in the app and by email to {0}, within 24 to 48 hours. Never send your PIN or password.', 'sesanelect@yahoo.com')}
          </Txt>
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL('mailto:support@palpeer.com').catch(() => {})} style={{ borderRadius: 16, backgroundColor: c.card, padding: 12 }}>
            <Txt size={15} w="600" color="text2">
              Or email us
            </Txt>
            <Txt size={18} w="800" color="brandText" noTr>
              support@palpeer.com
            </Txt>
          </Pressable>
          <Btn
            label="Send to Palpeer"
            disabled={!ok}
            onPress={() => {
              const id = 'PT-' + (10422 + tickets.length);
              const tk = { id, title: (kind === 'problem' ? 'Problem: ' : 'Question: ') + topic, status: 'Open', note: msg.trim().slice(0, 90) + (msg.trim().length > 90 ? '…' : '') };
              setTickets([tk, ...tickets]);
              setLastId(id);
              setKind('');
              setTopic('');
              setTref('');
              setMsg('');
              setShot(false);
              setStage('sent');
            }}
          />
        </>
      ) : (
        tickets.map((tk) => (
          <Card key={tk.id} gap={4}>
            <Row between>
              <Txt size={16} w="800" noTr>
                {tk.id}
              </Txt>
              <Txt size={15} w="800" color={STATUS[tk.status]}>
                {tk.status}
              </Txt>
            </Row>
            <Txt size={18} w="800">
              {tk.title}
            </Txt>
            <Txt size={15} w="600" color="text2">
              {tk.note}
            </Txt>
          </Card>
        ))
      )}
    </Screen>
  );
}
