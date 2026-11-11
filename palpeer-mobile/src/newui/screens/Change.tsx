import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { metaFor } from '@/design/bridge/currencyMeta';
import type { DesignWallet } from '@/design/bridge/mapWallet';
import type { LockQuoteResult } from '@/design/bridge/useLiveChange';
import { PinStep } from '@/newui/features/PinStep';
import { WalletPicker } from '@/newui/features/WalletPicker';
import { amtIn, amtShow, fmt, num, W } from '@/newui/lib/money';
import { useC } from '@/newui/lib/theme';
import { Icon } from '@/newui/ui/Icon';
import { Btn, Card, Circle, Divider, Flag, H1, H2, Line, P, PadNumberInput, Row, Screen, TopBar, Txt } from '@/newui/ui/kit';

type ChangeStage = 'form' | 'check' | 'pin' | 'done';

type ChangeProps = {
  backend?: boolean;
  stage?: string;
  liveWallets?: DesignWallet[];
  lockQuote?: (input: { giveCode: string; wantCode: string; amount: string }) => Promise<LockQuoteResult>;
  confirmPin?: (pin: string) => Promise<boolean>;
  confirmBiometric?: () => Promise<boolean>;
  go?: (href: string) => void;
};

function normStage(s?: string): ChangeStage {
  if (s === 'locked') return 'pin';
  if (s === 'check' || s === 'pin' || s === 'done') return s;
  return 'form';
}

function walletRow(w: DesignWallet) {
  const m = metaFor(w.code);
  return { ...m, ...w, perCad: w.perCad ?? m.perCad };
}

const startAmount = (code: string, perCad: number) => String(Math.round(perCad * 100));

/** Change money — new UI wired to useLiveChange. */
export default function Change(props: ChangeProps) {
  const c = useC();
  const staticStage = props.stage;
  const wallets = useMemo(
    () => (props.backend ? (props.liveWallets ?? []).map(walletRow) : [walletRow({ ...metaFor('CAD'), bal: 500 }), walletRow({ ...metaFor('NGN'), bal: 600000 })]),
    [props.backend, props.liveWallets],
  );

  const [stage, setStage] = useState<ChangeStage>(() => normStage(staticStage));
  const [give, setGive] = useState('CAD');
  const [want, setWant] = useState('NGN');
  const [amount, setAmount] = useState('100');
  const [picker, setPicker] = useState<null | 'give' | 'want'>(null);
  const [left, setLeft] = useState(59);
  const [doneAt, setDoneAt] = useState(new Date());
  const [quoteGiveText, setQuoteGiveText] = useState('');
  const [quoteNowGet, setQuoteNowGet] = useState('');
  const [quoteRateText, setQuoteRateText] = useState('');
  const [quoteAfterText, setQuoteAfterText] = useState('');
  const [backendError, setBackendError] = useState<string | null>(null);
  const pinLocked = staticStage === 'locked';

  useEffect(() => {
    if (staticStage !== undefined) setStage(normStage(staticStage));
  }, [staticStage]);

  useEffect(() => {
    const t = setInterval(() => {
      setLeft((l) => {
        if ((stage === 'check' || stage === 'pin') && l > 0) {
          const next = l - 1;
          if (next === 0 && stage === 'pin') setStage('check');
          return next;
        }
        return l;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [stage]);

  const giveW = wallets.find((w) => w.code === give) || walletRow({ ...metaFor(give), bal: 0 });
  const wantW = wallets.find((w) => w.code === want) || walletRow({ ...metaFor(want), bal: 0 });
  const n = num(amount);
  const have = giveW.bal ?? 0;
  const perGive = giveW.perCad || 1;
  const perWant = wantW.perCad || 1;
  const personValue = (n / perGive) * perWant;
  const nowValue = personValue * 0.9;
  const tooMuch = n > have;
  const tooLittle = n > 0 && n / perGive < 10;
  const nowGet = props.backend && quoteNowGet ? quoteNowGet : fmt(want, nowValue);
  const personFee = personValue / perWant > 200 ? personValue * 0.0095 : 2 * perWant;
  const personGet = fmt(want, Math.max(0, personValue - personFee));
  const giveText = quoteGiveText || fmt(give, n);
  const oneGive = perGive >= 100 ? 1000 : 1;
  const rateText =
    quoteRateText ||
    (props.backend && !quoteRateText
      ? 'Get a live price'
      : W(give).sym.trim() + oneGive.toLocaleString('en-CA') + ' = ' + fmt(want, (oneGive / perGive) * perWant * 0.9));
  const expired = left === 0;
  const cant = n <= 0 || tooMuch || tooLittle;
  const afterText = quoteAfterText || (props.backend && !quoteAfterText ? '—' : fmt(want, (wantW.bal ?? 0) + nowValue));

  const applyQuote = (r: Extract<LockQuoteResult, { ok: true }>) => {
    setLeft(r.secondsLeft);
    setQuoteGiveText(r.giveText);
    setQuoteNowGet(r.nowGet);
    setQuoteRateText(r.rateText);
    setQuoteAfterText(r.afterText);
  };

  const fetchQuote = async () => {
    setBackendError(null);
    if (props.backend && props.lockQuote) {
      const r = await props.lockQuote({ giveCode: give, wantCode: want, amount });
      if (!r.ok) {
        setBackendError(r.error);
        return false;
      }
      applyQuote(r);
      return true;
    }
    setLeft(59);
    setQuoteGiveText('');
    setQuoteNowGet('');
    setQuoteRateText('');
    setQuoteAfterText('');
    return true;
  };

  const goCheck = async () => {
    if (!(await fetchQuote())) return;
    setStage('check');
  };

  if (stage === 'pin')
    return (
      <PinStep
        onBack={() => setStage('check')}
        initialTries={pinLocked ? 3 : 0}
        confirmPin={props.confirmPin ? async (pin) => !!(await props.confirmPin!(pin)) : undefined}
        confirmBiometric={props.confirmBiometric}
        onDone={() => {
          setDoneAt(new Date());
          setStage('done');
        }}
      />
    );

  if (stage === 'check')
    return (
      <Screen>
        <H1>Is this right?</H1>
        <Card>
          <Row gap={12}>
            <Flag cc={W(give).cc} w={54} />
            <View>
              <Txt size={16} color="text2">
                You give
              </Txt>
              <Txt size={26} w="800" noTr>
                {giveText}
              </Txt>
            </View>
          </Row>
          <Icon name="downArrow" size={28} color={c.brandText} />
          <Row gap={12}>
            <Flag cc={W(want).cc} w={54} />
            <View>
              <Txt size={16} color="text2">
                You get
              </Txt>
              <Txt size={26} w="800" noTr>
                {nowGet}
              </Txt>
            </View>
          </Row>
          <Divider />
          <Txt size={17} w="700" noTr>
            {rateText}
          </Txt>
          <Row gap={6}>
            <Icon name="clock" size={22} color={expired ? c.red : c.orange} />
            <Txt size={17} w="800" color={expired ? 'red' : 'orange'} role="alert">
              {expired ? 'Time is over. Get a new price.' : 'This price stays for 0:' + String(left).padStart(2, '0')}
            </Txt>
          </Row>
          {backendError ? (
            <Txt size={16} w="700" color="red">
              {backendError}
            </Txt>
          ) : null}
        </Card>
        <TopBar
          onBack={() => setStage('form')}
          say={'Is this right? You give ' + giveText + '. You get ' + nowGet + '. ' + (expired ? 'Time is over. Get a new price.' : 'If it is right, tap Yes, change your money.')}
        />
        <View style={{ flex: 1 }} />
        <Btn
          label={expired ? 'Get a new price' : 'Yes, change your money'}
          onPress={() => void (expired ? fetchQuote() : setStage('pin'))}
        />
      </Screen>
    );

  if (stage === 'done')
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: 8, marginTop: 14 }}>
          <Circle icon="check" />
          <H1 center>Done!</H1>
          <Txt size={30} w="800" noTr>
            {nowGet}
          </Txt>
          <P center>{'is now in your ' + W(want).name}</P>
        </View>
        <Card gap={4}>
          <Line k="You gave" v={giveText} />
          <Line k="Price" v={rateText} />
          <Line k="You now have" v={afterText} />
          <Divider />
          <Txt size={15} w="600" color="text3" noTr>
            {doneAt.toLocaleString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </Txt>
        </Card>
        <TopBar onBack={false} say={'Done. ' + nowGet + ' is now in your ' + W(want).name + '.'} />
        <View style={{ flex: 1 }} />
        <Btn icon="homeLine" label="Go home" onPress={() => router.replace('/Main')} />
        <Btn kind="outline" size="mid" label="See all your money" onPress={() => router.replace('/Main')} />
      </Screen>
    );

  const sayForm =
    'Change money. You give ' + W(give).name + '. You want ' + W(want).name + '. Change now: Palpeer changes it and there is no waiting. You get ' + nowGet + '. Choose a person: you change with another user and you may wait. You may get ' + personGet + ' after the fee.';

  return (
    <Screen scroll>
      <H1>Change money</H1>
      <Card>
        <Row gap={10}>
          <Pressable accessibilityRole="button" accessibilityLabel={'Choose the money you give. Now ' + W(give).name} onPress={() => setPicker('give')} style={{ height: 60, paddingHorizontal: 8, borderRadius: 14, backgroundColor: c.field, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Flag cc={W(give).cc} w={46} />
            <Icon name="down" size={20} color={c.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Txt size={16} color="text2">
              You give
            </Txt>
            <Row gap={4}>
              <Txt size={28} w="800" noTr>
                {W(give).sym}
              </Txt>
              <PadNumberInput
                accessibilityLabel="You give"
                decimal
                padKey="change-give"
                value={amtShow(amount)}
                onChangeText={(v) => {
                  setAmount(amtIn(v));
                  setBackendError(null);
                }}
                style={{ minWidth: 118, flexShrink: 1, fontSize: 28, fontFamily: 'NotoSans_800ExtraBold', textAlign: 'right', paddingVertical: 4 }}
              />
            </Row>
          </View>
        </Row>
        <Txt size={16} w="700" color={tooMuch || tooLittle ? 'red' : 'text3'}>
          {tooLittle ? 'Too small. The least is ' + fmt(give, 10 * perGive) : tooMuch ? 'Not enough money. You have ' + fmt(give, have) : 'You have ' + fmt(give, have)}
        </Txt>
        {backendError ? (
          <Txt size={16} w="700" color="red">
            {backendError}
          </Txt>
        ) : null}
        <Divider />
        <Row gap={10}>
          <Pressable accessibilityRole="button" accessibilityLabel={'Choose the money you want. Now ' + W(want).name} onPress={() => setPicker('want')} style={{ height: 60, paddingHorizontal: 8, borderRadius: 14, backgroundColor: c.field, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Flag cc={W(want).cc} w={46} />
            <Icon name="down" size={20} color={c.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Txt size={16} color="text2">
              You want
            </Txt>
            <Txt size={20} w="800">
              {W(want).name}
            </Txt>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Swap the two moneys"
            onPress={() => {
              setGive(want);
              setWant(give);
              setAmount(startAmount(want, perWant));
            }}
            style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.field, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="swap" size={28} color={c.text} />
          </Pressable>
        </Row>
      </Card>
      <TopBar onBack={() => router.back()} say={sayForm} />
      <H2>How do you want to change?</H2>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: cant }}
        disabled={cant}
        onPress={() => void goCheck()}
        style={{ opacity: cant ? 0.55 : 1, borderRadius: 20, backgroundColor: c.card, padding: 14, flexDirection: 'row', gap: 12 }}
      >
        <Circle icon="bolt" size={52} iconSize={30} />
        <View style={{ flex: 1 }}>
          <Txt size={21} w="800">
            Change now
          </Txt>
          <Txt size={16} color="text2">
            Palpeer changes it. No waiting.
          </Txt>
          <Txt size={18} w="800" color="brandText">
            {'You get ' + nowGet}
          </Txt>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/People')} style={{ borderRadius: 20, backgroundColor: c.card, padding: 14, flexDirection: 'row', gap: 12 }}>
        <Circle icon="people" size={52} iconSize={30} bg="#1D5BC7" />
        <View style={{ flex: 1 }}>
          <Txt size={21} w="800">
            Choose a person
          </Txt>
          <Txt size={16} color="text2">
            Change with a user. You may wait.
          </Txt>
          <Txt size={18} w="800" color="blue">
            {'You may get ' + personGet + ' after fee'}
          </Txt>
          <Txt size={15} w="600" color="text3">
            Have a code or points? Use them next.
          </Txt>
        </View>
      </Pressable>

      <WalletPicker
        open={!!picker}
        title={picker === 'give' ? 'Which money do you give?' : 'Which money do you want?'}
        skip={picker === 'give' ? want : give}
        current={picker === 'give' ? give : want}
        liveWallets={props.liveWallets}
        onClose={() => setPicker(null)}
        onPick={(code) => {
          const w = wallets.find((x) => x.code === code);
          const per = w?.perCad || metaFor(code).perCad;
          if (picker === 'give') {
            setGive(code);
            setAmount(startAmount(code, per));
          } else setWant(code);
          setPicker(null);
        }}
      />
    </Screen>
  );
}
