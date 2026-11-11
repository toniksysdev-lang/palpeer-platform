import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DesignWallet } from '@/design/bridge/mapWallet';
import { useLang } from '@/newui/lib/i18n';
import { useLayout } from '@/newui/lib/layout';
import { fmt, W } from '@/newui/lib/money';
import { useListen } from '@/newui/lib/speech';
import { useC } from '@/newui/lib/theme';
import { BottomNav } from '@/newui/ui/BottomNav';
import { Icon, IconName } from '@/newui/ui/Icon';
import { Btn, Bullets, Card, Choice, Circle, Flag, H1, H2, Loading, Overlay, P, Pill, Row, Screen, TopBar, Txt } from '@/newui/ui/kit';

type HomeProps = {
  backend?: boolean;
  helloName?: string;
  liveWallets?: DesignWallet[];
  liveCatalog?: DesignWallet[];
  goAddMoney?: (code?: string) => void;
  onAddWallet?: (
    code: string,
  ) => Promise<{ ok: boolean; error?: string; cancelled?: boolean } | void>;
  recentMovements?: { title: string; time: string }[];
  unreadCount?: number;
  msgBadge?: string;
  profileIncomplete?: boolean;
  openProfile?: () => void;
  walletsLoading?: boolean;
  showAll?: boolean;
  showAdd?: boolean;
  showTimeout?: boolean;
  onLogBack?: () => void;
  onRefresh?: () => void;
};

const HREFS = {
  add: '/Add',
  send: '/Send',
  change: '/Change',
  withdraw: '/TakeOut',
} as const;

/** Home: wallet card, four actions, recent movements — wired to useLiveMain. */
export default function Home(props: HomeProps) {
  const c = useC();
  const { s, page } = useLayout();
  const { lang } = useLang();
  const { listen, listenLabel } = useListen();
  const owned = props.liveWallets ?? [];
  const catalog = props.liveCatalog ?? [];
  const ownedCodes = useMemo(() => owned.map((w) => w.code), [owned]);
  const hasWallet = ownedCodes.length > 0;
  const [hidden, setHidden] = useState(false);
  const [sel, setSel] = useState(ownedCodes[0] || '');
  const [strip, setStrip] = useState<string[]>(ownedCodes.slice(0, 2));
  const [all, setAll] = useState(false);
  const [adding, setAdding] = useState(false);
  /** Currency just created — keep separate from `sel` so the sync effect cannot wipe it before wallets refetch. */
  const [justAddedCode, setJustAddedCode] = useState<string | null>(null);
  const [hold, setHold] = useState<{ open: boolean; step: 'info' | 'verify' | 'checking' | 'done'; note: string }>({
    open: false,
    step: 'info',
    note: '',
  });
  const [rel, setRel] = useState({ face: false, id: false });
  const [addError, setAddError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(!!props.showTimeout);

  useEffect(() => {
    if (props.showAll) setAll(true);
  }, [props.showAll]);
  useEffect(() => {
    if (props.showAdd) setAdding(true);
  }, [props.showAdd]);
  useEffect(() => {
    if (props.showTimeout) setTimedOut(true);
  }, [props.showTimeout]);

  useEffect(() => {
    if (!ownedCodes.length) {
      setSel((prev) => (prev ? '' : prev));
      setStrip((prev) => (prev.length ? [] : prev));
      return;
    }
    // While celebrating a new wallet, keep that currency selected even if the
    // wallets list has not refetched yet (otherwise sel snaps back to CAD).
    if (justAddedCode) {
      if (ownedCodes.includes(justAddedCode)) setSel(justAddedCode);
      setStrip((prev) => {
        const withNew = prev.includes(justAddedCode) ? prev : [...prev.filter((c) => ownedCodes.includes(c)), justAddedCode];
        const next = withNew.filter((c) => c === justAddedCode || ownedCodes.includes(c));
        const fill = ownedCodes.filter((c) => !next.includes(c));
        return [...next, ...fill].slice(0, Math.min(2, Math.max(next.length, ownedCodes.length)));
      });
      return;
    }
    if (!ownedCodes.includes(sel)) setSel(ownedCodes[0]!);
    setStrip((prev) => {
      const next = prev.filter((c) => ownedCodes.includes(c));
      if (next.length >= 2) return next.slice(0, 2);
      const fill = ownedCodes.filter((c) => !next.includes(c));
      const merged = [...next, ...fill].slice(0, Math.min(2, ownedCodes.length));
      if (merged.length === prev.length && merged.every((c, i) => c === prev[i])) return prev;
      return merged;
    });
  }, [justAddedCode, ownedCodes, sel]);

  const bal = (code: string) => owned.find((w) => w.code === code)?.bal ?? 0;
  const shown = (code: string) => (hidden ? W(code).sym.trim() + ' ••••' : fmt(code, bal(code)));
  const wallets = owned.map((w) => ({ ...W(w.code), ...w }));
  const addable = catalog.filter((w) => w.on !== false && !ownedCodes.includes(w.code));
  /** Currency meta only when a real selection exists — never invent CAD for an empty wallet list. */
  const cur = sel ? W(sel) : null;
  const justAddedCur = justAddedCode ? W(justAddedCode) : null;
  const hello = props.helloName || 'there';

  const pick = (code: string) => {
    if (!strip.includes(code)) setStrip([...strip.slice(0, -1), code]);
    setSel(code);
    setAll(false);
  };

  const addWallet = async (code: string) => {
    setAddError(null);
    if (props.onAddWallet) {
      // Close the add-wallet Modal first so the PIN Modal can present on top
      // (nested RN Modals on web fail silently and look like "Could not add wallet").
      setAdding(false);
      await new Promise<void>((resolve) => setTimeout(resolve, 80));
      const res = await props.onAddWallet(code);
      if (res && 'ok' in res && !res.ok) {
        if (res.cancelled) {
          setAdding(true);
          return;
        }
        setAddError(res.error || 'Could not add wallet');
        setAdding(true);
        return;
      }
    } else {
      setAdding(false);
    }
    pick(code);
    setJustAddedCode(code);
  };

  const openAddWallet = () => {
    setAddError(null);
    setAdding(true);
  };

  const goFlow = (href: Href, what?: string) => {
    if (!hasWallet) {
      openAddWallet();
      return;
    }
    if (what && hold.open) return;
    router.push(href);
  };

  const say =
    lang === 'fr'
      ? 'Accueil. Mon portefeuille. Ajouter, Envoyer, Changer, Retirer.'
      : !hasWallet
        ? 'No wallet yet. Tap Add a wallet to create one.'
        : (hidden || !cur ? '' : 'You have ' + shown(sel) + ', ' + cur.name + '. ') +
          'Tap a flag to see other money. Tap the plus to add a wallet. Add: fund my wallet. Send: to another Palpeer user, with no fee. Change: to other currency. Withdraw: to your account.';

  const tiles: {
    label: string;
    note: string;
    icon: IconName;
    bg: string;
    dot: string;
    href: Href;
    guard?: string;
  }[] = [
    { label: 'Add', note: 'Fund my wallet', icon: 'plus', bg: c.tileGreen, dot: '#0B6E4F', href: HREFS.add as Href },
    { label: 'Send', note: 'To Palpeer user', icon: 'send', bg: c.tileBlue, dot: '#1D5BC7', href: HREFS.send as Href, guard: 'Sending' },
    { label: 'Change', note: 'To other currency', icon: 'change', bg: c.tileOrange, dot: '#A84C08', href: HREFS.change as Href, guard: 'Changing money' },
    { label: 'Withdraw', note: 'To my account', icon: 'bank', bg: c.tilePurple, dot: '#5E3AB8', href: HREFS.withdraw as Href, guard: 'Withdrawing' },
  ];

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      props.onRefresh?.();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  }, [props]);

  if (props.walletsLoading && !owned.length) {
    return (
      <SafeAreaView edges={['top']} style={[page, { backgroundColor: c.bg }]}>
        <Loading title="Loading your wallet" text="Just a moment." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[page, { backgroundColor: c.bg }]}>
      <ScrollView
        style={{ flex: 1, width: '100%' }}
        contentContainerStyle={{ padding: s(16), paddingTop: s(12), gap: s(14), width: '100%' }}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.brand} colors={[c.brand]} />
        }
      >
        <Row between style={{ minHeight: s(52) }}>
          <Txt size={24} w="800" role="header" noTr style={{ flex: 1, minWidth: 0 }}>
            Hello, {hello}
          </Txt>
          <Pill icon="listen" label={listenLabel} dark onPress={() => listen(say)} a11y="Listen to this screen" />
        </Row>

        {props.profileIncomplete ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => props.openProfile?.()}
            style={{
              minHeight: s(64),
              paddingHorizontal: s(14),
              paddingVertical: s(10),
              borderRadius: s(18),
              backgroundColor: c.warnBg,
              borderWidth: 2,
              borderColor: c.orange,
              justifyContent: 'center',
              width: '100%',
            }}
          >
            <Txt size={17} w="800">
              Complete your profile
            </Txt>
            <Txt size={15} w="600" color="text2">
              Finish your details to unlock all of Palpeer.
            </Txt>
          </Pressable>
        ) : null}

        <View accessibilityLabel="My wallet" style={{ backgroundColor: '#0B6E4F', borderRadius: s(22), paddingHorizontal: s(16), paddingTop: s(10), paddingBottom: s(14), width: '100%' }}>
          <Row between style={{ minHeight: s(44) }}>
            <Txt size={20} w="700" color="#FFFFFF" style={{ flex: 1, minWidth: 0 }}>
              My wallet
            </Txt>
            {hasWallet ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setHidden(!hidden)}
                style={{
                  minHeight: s(44),
                  paddingHorizontal: s(12),
                  borderRadius: s(22),
                  backgroundColor: 'rgba(255,255,255,0.16)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: s(6),
                  flexShrink: 0,
                }}
              >
                <Icon name="eye" size={s(22)} color="#FFFFFF" />
                <Txt size={16} w="700" color="#FFFFFF">
                  {hidden ? 'Show' : 'Hide'}
                </Txt>
              </Pressable>
            ) : null}
          </Row>
          {!hasWallet ? (
            <View style={{ gap: s(12), paddingTop: s(6), paddingBottom: s(4) }}>
              <Txt size={17} w="600" color="#FFFFFF">
                No wallet yet
              </Txt>
              <Txt size={15} w="600" color="rgba(255,255,255,0.85)">
                Create a wallet to get started.
              </Txt>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add a wallet"
                onPress={openAddWallet}
                style={{
                  marginTop: s(4),
                  minHeight: s(52),
                  borderRadius: s(14),
                  backgroundColor: '#FFFFFF',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: s(8),
                  paddingHorizontal: s(14),
                }}
              >
                <Icon name="plus" size={s(26)} color="#0B6E4F" />
                <Txt size={17} w="800" color="#0B6E4F">
                  Add a wallet
                </Txt>
              </Pressable>
            </View>
          ) : cur ? (
            <>
              <Row gap={14} style={{ minHeight: s(72) }}>
                <Flag cc={cur.cc} w={66} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt size={17} w="600" color="#FFFFFF">
                    {cur.name}
                  </Txt>
                  <Txt size={34} w="800" color="#FFFFFF" lh={1.15} noTr lines={1} style={{ flexShrink: 1 }}>
                    {shown(sel)}
                  </Txt>
                </View>
              </Row>
              <Row gap={8} style={{ marginTop: s(8) }}>
                {strip.map((code) => (
                  <Pressable
                    key={code}
                    accessibilityRole="button"
                    accessibilityLabel={W(code).name}
                    accessibilityState={{ selected: code === sel }}
                    onPress={() => pick(code)}
                    style={{
                      flex: 1,
                      height: s(52),
                      borderRadius: s(14),
                      backgroundColor: code === sel ? '#FFFFFF' : 'rgba(255,255,255,0.16)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 0,
                    }}
                  >
                    <Flag cc={W(code).cc} w={42} h={28} />
                  </Pressable>
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="See all your money"
                  onPress={() => setAll(true)}
                  style={{
                    flex: 1.2,
                    height: s(52),
                    borderRadius: s(14),
                    borderWidth: 2,
                    borderColor: 'rgba(255,255,255,0.75)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 0,
                    paddingHorizontal: s(4),
                  }}
                >
                  <Txt size={17} w="800" color="#FFFFFF" noTr lines={1}>
                    {`All ${wallets.length}`}
                  </Txt>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add a wallet"
                  onPress={openAddWallet}
                  style={{ flex: 1, height: s(52), borderRadius: s(14), backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}
                >
                  <Icon name="plus" size={s(26)} color="#0B6E4F" />
                </Pressable>
              </Row>
            </>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12), width: '100%' }}>
          {tiles.map((t) => (
            <Pressable
              key={t.label}
              accessibilityRole="button"
              onPress={() => {
                if (!hasWallet) {
                  openAddWallet();
                  return;
                }
                if (t.label === 'Add' && props.goAddMoney) {
                  props.goAddMoney(sel);
                  return;
                }
                goFlow(t.href, t.guard);
              }}
              style={{
                flexBasis: '47%',
                flexGrow: 1,
                minHeight: s(140),
                maxWidth: '48%',
                padding: s(14),
                borderRadius: s(22),
                backgroundColor: t.bg,
              }}
            >
              <View style={{ width: s(52), height: s(52), borderRadius: s(26), backgroundColor: t.dot, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={t.icon} size={s(30)} color="#FFFFFF" />
              </View>
              <View style={{ marginTop: 'auto', paddingTop: s(10) }}>
                <Txt size={24} w="800" lh={1.15}>
                  {t.label}
                </Txt>
                <Txt size={15} w="600" color="text2">
                  {t.note}
                </Txt>
              </View>
            </Pressable>
          ))}
        </View>

        {props.recentMovements && props.recentMovements.length > 0 ? (
          <View style={{ gap: s(8), width: '100%' }}>
            <Txt size={20} w="800">
              Recent Transactions
            </Txt>
            {props.recentMovements.map((m, i) => (
              <Row
                key={`${m.title}-${m.time}-${i}`}
                gap={12}
                style={{
                  backgroundColor: c.card,
                  borderRadius: s(18),
                  paddingHorizontal: s(14),
                  paddingVertical: s(10),
                  minHeight: s(64),
                  width: '100%',
                }}
              >
                <Circle icon="check" size={36} iconSize={22} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt size={17} w="700" noTr>
                    {m.title}
                  </Txt>
                  <Txt size={15} w="500" color="text3" noTr>
                    {m.time}
                  </Txt>
                </View>
              </Row>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <BottomNav active="home" unread={props.unreadCount ?? 0} />

      <Overlay open={all}>
        <Screen>
          <TopBar onBack={() => setAll(false)} right={<Pill icon="eye" label={hidden ? 'Show' : 'Hide'} onPress={() => setHidden(!hidden)} />} />
          <H1>All your money</H1>
          <ScrollView contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
            {wallets.map((w) => (
              <Pressable
                key={w.code}
                accessibilityRole="button"
                onPress={() => pick(w.code)}
                style={{
                  minHeight: 80,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderWidth: 3,
                  borderColor: w.code === sel ? c.brandText : 'transparent',
                  borderRadius: 18,
                  backgroundColor: c.card,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <Flag cc={w.cc} w={60} />
                <View>
                  <Txt size={16} w="600" color="text2">
                    {w.name}
                  </Txt>
                  <Txt size={25} w="800" noTr>
                    {shown(w.code)}
                  </Txt>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          <Btn icon="plus" label="Add a wallet" size="mid" onPress={openAddWallet} />
        </Screen>
      </Overlay>

      <Overlay open={adding}>
        <Screen>
          <TopBar
            onBack={() => setAdding(false)}
            say={'Add a wallet. Select the wallet you want to create. ' + addable.map((w) => w.name).join('. ') + '.'}
          />
          <H1>Add a wallet</H1>
          <P>Select the wallet you want to create</P>
          {addError ? (
            <Txt size={16} w="700" color="red" noTr>
              {addError}
            </Txt>
          ) : null}
          {addable.map((w) => (
            <Choice key={w.code} title={w.name} icon={<Flag cc={W(w.code).cc} w={60} />} onPress={() => void addWallet(w.code)} right={null} minH={80} />
          ))}
          {addable.length === 0 ? (
            <Card>
              <Txt size={18} w="700">
                You have all our wallets. More are coming.
              </Txt>
            </Card>
          ) : null}
        </Screen>
      </Overlay>

      {justAddedCur ? (
        <Overlay open>
          <Screen>
            <View style={{ alignItems: 'center', gap: 12, marginTop: 14 }}>
              <Circle icon="check" />
              <H1 center>Wallet ready!</H1>
              <Flag cc={justAddedCur.cc} w={90} />
              <Txt size={24} w="800">
                {justAddedCur.name}
              </Txt>
              <P center>It is empty. You can add money now or later.</P>
            </View>
            <TopBar
              onBack={false}
              say={'Wallet ready. ' + justAddedCur.name + '. It is empty. You can add money now or later.'}
            />
            <View style={{ flex: 1 }} />
            <Btn
              label="Add money"
              onPress={() => {
                const code = justAddedCode;
                setJustAddedCode(null);
                if (code) props.goAddMoney?.(code);
              }}
            />
            <Btn kind="outline" size="mid" label="Later" onPress={() => setJustAddedCode(null)} />
          </Screen>
        </Overlay>
      ) : null}

      <Overlay open={timedOut}>
        <Screen gap={14}>
          <View style={{ alignItems: 'center', gap: 12, marginTop: 14 }}>
            <Circle icon="lock" size={92} iconSize={52} bg="#0E1F19" />
            <H1 center>You were logged out</H1>
            <P center>No use for 3 minutes. This keeps your money safe.</P>
          </View>
          <View style={{ flex: 1 }} />
          <Btn kind="outline" size="mid" label="Unlock with Face or Fingerprint" onPress={() => setTimedOut(false)} />
          <Btn label="Use your PIN" onPress={() => setTimedOut(false)} />
          <Btn
            kind="link"
            label="Log in again"
            onPress={() => {
              setTimedOut(false);
              void props.onLogBack?.();
            }}
          />
        </Screen>
      </Overlay>

      <Overlay open={hold.open}>
        <Screen gap={12} scroll>
          {hold.step === 'info' ? (
            <>
              <Row gap={12}>
                <Circle icon="shield" size={72} iconSize={48} bg="#A84C08" />
                <H2 style={{ flex: 1 }}>{hold.note ? hold.note + ' is paused for 24 hours' : 'Safety hold for 24 hours'}</H2>
              </Row>
              <Txt size={17} color="text2">
                Your account moved to a new phone. For 24 hours some things are paused to keep your money safe.
              </Txt>
              <Card gap={4}>
                <Txt size={17} w="800" color="brandText">
                  You can still
                </Txt>
                <Bullets items={['Log in and see your money', 'See your history', 'Add and receive money', 'Contact customer service', 'Finish your ID check']} />
              </Card>
              <Card gap={4}>
                <Txt size={17} w="800" color="red">
                  Paused for now
                </Txt>
                <Bullets items={['Withdraw', 'Send to a person', 'Change money', 'Change your PIN, password or fingerprint']} />
              </Card>
              <View style={{ flex: 1 }} />
              <Btn
                size="mid"
                label="End the hold early"
                onPress={() => {
                  setRel({ face: false, id: false });
                  setHold({ ...hold, step: 'verify' });
                }}
              />
              <Btn size="mid" kind="outline" label="OK, keep waiting" onPress={() => setHold({ ...hold, open: false })} />
            </>
          ) : null}
          {hold.step === 'verify' ? (
            <>
              <H1>Prove it is you</H1>
              <Txt size={17} color="text2">
                A stronger check. Palpeer also checks for risk before ending the hold.
              </Txt>
              {(
                [
                  ['face', 'Live photo of your face', 'Look at the camera'],
                  ['id', 'Photo of your ID again', 'The same ID you used before'],
                ] as const
              ).map(([k, title, note]) => (
                <Choice
                  key={k}
                  title={title}
                  note={note}
                  on={rel[k]}
                  onPress={() => setRel({ ...rel, [k]: !rel[k] })}
                  right={
                    <Txt size={16} w="800" color="brandText">
                      {rel[k] ? 'Done' : 'Take photo'}
                    </Txt>
                  }
                />
              ))}
              <View style={{ flex: 1 }} />
              <Btn
                size="mid"
                label="Send to Palpeer"
                disabled={!(rel.face && rel.id)}
                onPress={() => {
                  setHold({ ...hold, step: 'checking' });
                  setTimeout(() => setHold((h) => ({ ...h, step: 'done' })), 2500);
                }}
              />
              <Btn kind="link" label="Back" onPress={() => setHold({ ...hold, step: 'info' })} />
            </>
          ) : null}
          {hold.step === 'checking' ? <Loading title="Palpeer is checking" text="This is usually quick. You get a message when it is done." /> : null}
          {hold.step === 'done' ? (
            <>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <Circle icon="check" />
                <H1 center>The hold has ended</H1>
                <P center>You can use all of Palpeer again.</P>
              </View>
              <Btn size="mid" label="Go home" onPress={() => setHold({ ...hold, open: false })} />
            </>
          ) : null}
        </Screen>
      </Overlay>
    </SafeAreaView>
  );
}
