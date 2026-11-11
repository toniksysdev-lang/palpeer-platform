import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { metaFor } from '@/design/bridge/currencyMeta';
import type { DesignWallet } from '@/design/bridge/mapWallet';
import type { ResolveRecipientResult } from '@/design/bridge/useLiveSend';
import { AmountBox } from '@/newui/features/AmountBox';
import { PinStep } from '@/newui/features/PinStep';
import { WalletPicker } from '@/newui/features/WalletPicker';
import { useT, useTv } from '@/newui/lib/i18n';
import { fmt, num, W } from '@/newui/lib/money';
import { useC } from '@/newui/lib/theme';
import { Icon } from '@/newui/ui/Icon';
import { Btn, Card, Circle, Divider, Field, Flag, H1, Line, P, Row, Screen, TopBar, Txt } from '@/newui/ui/kit';

type SendStage = 'form' | 'check' | 'pin' | 'done';

const RECENT = [
  { name: 'Ada Okoro', user: 'adaokoro', contact: 'ada@example.com' },
  { name: 'Tunde Bello', user: 'tundeb', contact: '+1 902 555 0123', only: 'CAD' as const },
];

type SendProps = {
  backend?: boolean;
  stage?: string;
  liveWallets?: DesignWallet[];
  resolveRecipient?: (who: string, code: string, amount: string) => Promise<ResolveRecipientResult>;
  confirmPin?: (pin: string) => Promise<{ ok: boolean; afterText?: string; person?: string } | { ok: false }>;
  confirmBiometric?: () => Promise<{ ok: boolean; afterText?: string; person?: string } | { ok: false }>;
  go?: (href: string) => void;
};

function normStage(s?: string): SendStage {
  if (s === 'check' || s === 'pin' || s === 'done') return s;
  return 'form';
}

function walletRow(w: DesignWallet) {
  const m = metaFor(w.code);
  return { ...m, ...w, perCad: w.perCad ?? m.perCad };
}

/** Send money — new UI wired to useLiveSend. */
export default function Send(props: SendProps) {
  const c = useC();
  const t = useT();
  const tv = useTv();
  const staticStage = props.stage;
  const wallets = useMemo(
    () => (props.backend ? (props.liveWallets ?? []).map(walletRow) : [walletRow({ ...metaFor('CAD'), bal: 500 }), walletRow({ ...metaFor('NGN'), bal: 600000 })]),
    [props.backend, props.liveWallets],
  );

  const [stage, setStage] = useState<SendStage>(() => normStage(staticStage));
  const filled = staticStage && staticStage !== 'form' && !props.backend;
  const [code, setCode] = useState('CAD');
  const [amount, setAmount] = useState(filled ? '45' : '');
  const [who, setWho] = useState(filled ? RECENT[0]!.contact : '');
  const [picker, setPicker] = useState(false);
  const [doneAt, setDoneAt] = useState(new Date());
  const [personName, setPersonName] = useState('');
  const [backendError, setBackendError] = useState<string | null>(null);
  const [doneAfterText, setDoneAfterText] = useState<string | null>(null);
  const [continueBusy, setContinueBusy] = useState(false);

  useEffect(() => {
    if (staticStage !== undefined) setStage(normStage(staticStage));
  }, [staticStage]);

  const wallet = wallets.find((w) => w.code === code) || wallets[0] || walletRow({ ...metaFor(code), bal: 0 });
  const n = num(amount);
  const have = wallet.bal ?? 0;
  const perCad = wallet.perCad || 1;
  const tooMuch = n > have;
  const tooLittle = n > 0 && n / perCad < 10;
  const typed = who.trim();
  const recent = props.backend ? [] : RECENT;
  const match = recent.find((r) => r.contact === typed);
  const found = props.backend ? typed.length >= 3 : !!match || typed.length >= 6;
  const person = props.backend ? personName || typed : match ? match.name : 'Ada Okoro';
  const personUser = match ? match.user : typed.replace(/^@/, '');
  const noWallet = !!(match && 'only' in match && match.only && match.only !== code);
  const blocked = n <= 0 || tooMuch || tooLittle || !found || noWallet;
  const sendText = fmt(code, n);
  const afterBal = doneAfterText || fmt(code, Math.max(0, have - n));

  const goCheck = async () => {
    setBackendError(null);
    setContinueBusy(true);
    try {
      if (props.backend && props.resolveRecipient) {
        const r = await props.resolveRecipient(who, code, amount);
        if (!r.ok) {
          setBackendError(r.error);
          return;
        }
        setPersonName(r.person);
        setStage('check');
        return;
      }
      setStage('check');
    } finally {
      setContinueBusy(false);
    }
  };

  const finishSend = (r?: { afterText?: string; person?: string }) => {
    if (r?.person) setPersonName(r.person);
    if (r?.afterText) setDoneAfterText(r.afterText);
    setDoneAt(new Date());
    setStage('done');
  };

  if (stage === 'pin')
    return (
      <PinStep
        onBack={() => setStage('check')}
        confirmPin={props.confirmPin}
        confirmBiometric={props.confirmBiometric}
        onDone={(r) => {
          if (r && typeof r === 'object' && 'ok' in r && r.ok) {
            finishSend({ afterText: r.afterText as string | undefined, person: r.person as string | undefined });
          } else if (!props.confirmPin && !props.confirmBiometric) {
            finishSend();
          }
        }}
      />
    );

  if (stage === 'check')
    return (
      <Screen>
        <H1>Is this right?</H1>
        <Card>
          <Row gap={12}>
            <Flag cc={W(code).cc} w={54} />
            <View>
              <Txt size={16} color="text2">
                You send
              </Txt>
              <Txt size={26} w="800" noTr>
                {sendText}
              </Txt>
            </View>
          </Row>
          <Divider />
          <View>
            <Txt size={16} color="text2">
              To
            </Txt>
            <Txt size={22} w="800" noTr>
              {person}
            </Txt>
            <Txt size={16} w="600" color="text3" noTr>
              {who}
            </Txt>
          </View>
          <Divider />
          <Line k="Fee" v="No fee" />
          <Line k="They get" v={sendText} />
          <Txt size={16} w="700" color="orange">
            You cannot get this money back after sending.
          </Txt>
        </Card>
        <TopBar onBack={() => setStage('form')} say={'Is this right? You send ' + sendText + ' to ' + person + '. No fee. They get ' + sendText + '. You cannot get this money back after sending.'} />
        <View style={{ flex: 1 }} />
        <Btn label="Yes, send your money" onPress={() => setStage('pin')} />
      </Screen>
    );

  if (stage === 'done')
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: 8, marginTop: 14 }}>
          <Circle icon="check" />
          <H1 center>Sent!</H1>
          <Txt size={30} w="800" noTr>
            {sendText}
          </Txt>
          <P center>{'went to ' + person}</P>
        </View>
        <Card gap={4}>
          <Line k="Fee" v="No fee" />
          <Line k="You now have" v={afterBal} />
          <Divider />
          <Txt size={15} w="600" color="text3" noTr>
            {doneAt.toLocaleString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </Txt>
        </Card>
        <TopBar onBack={false} say={'Sent. ' + sendText + ' went to ' + person + '.'} />
        <View style={{ flex: 1 }} />
        <Btn label="Go home" onPress={() => router.replace('/Main')} />
        <Btn kind="outline" size="mid" label="See history" onPress={() => router.replace('/History')} />
      </Screen>
    );

  return (
    <Screen scroll>
      <H1>Send money</H1>
      <Card>
        <AmountBox code={code} label="You send" value={amount} onChange={(v) => { setAmount(v); setBackendError(null); }} onPick={() => setPicker(true)} pickLabel="Choose which money to send" />
        <Txt size={16} w="700" color={tooMuch || tooLittle ? 'red' : 'text3'}>
          {tooLittle ? 'Too small. The least is ' + fmt(code, 10 * perCad) : tooMuch ? 'Not enough money. You have ' + fmt(code, have) : 'You have ' + fmt(code, have)}
        </Txt>
        {backendError ? (
          <Txt size={16} w="700" color="red">
            {backendError}
          </Txt>
        ) : null}
      </Card>
      <TopBar
        onBack={() => router.back()}
        say="Send money to another Palpeer user. Same money only. No fee. Enter the amount, then the username, phone number or email. Check the full name before you send."
      />
      <Card>
        <Field label="To which Palpeer user?" placeholder="@username" value={who} onChangeText={(v) => { setWho(v); setBackendError(null); }} autoCapitalize="none" autoCorrect={false} />
        <Txt size={15} w="600" color="text3">
          Type a username, phone number or email.
        </Txt>
        {typed && found ? (
          <Row gap={10} style={{ backgroundColor: c.okBg, borderRadius: 14, padding: 10 }}>
            <Icon name="person" size={28} color={c.deep} />
            <View style={{ flex: 1 }}>
              <Txt size={19} w="800" noTr>
                {person}
              </Txt>
              <Txt size={15} w="600" color="text2">
                {'@' + personUser + '. Is this the right full name?'}
              </Txt>
            </View>
          </Row>
        ) : null}
        {noWallet ? (
          <Txt size={16} w="700" color="red">
            {person + ' has no ' + W(code).name + ' wallet. This money cannot be sent.'}
          </Txt>
        ) : null}
        {typed && !found ? (
          <Txt size={16} w="700" color="red">
            We cannot find this user yet
          </Txt>
        ) : null}
        {!typed && !props.backend ? (
          <>
            <Txt size={16} w="700" color="text2">
              People you sent to before
            </Txt>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {RECENT.map((r) => (
                <Pressable key={r.user} accessibilityRole="button" onPress={() => setWho('@' + r.user)} style={{ minHeight: 48, paddingHorizontal: 14, borderRadius: 24, backgroundColor: c.field, justifyContent: 'center' }}>
                  <Txt size={17} w="700" noTr>
                    {r.name}
                  </Txt>
                </Pressable>
              ))}
            </Row>
          </>
        ) : null}
      </Card>
      <Card gap={2} bg={c.tileGreen}>
        <Txt size={19} w="800">
          No fee
        </Txt>
        <Txt size={16} color="text2" noTr>
          {tv('They get the same money: {0}', t(W(code).name))}
        </Txt>
      </Card>
      <View style={{ flex: 1 }} />
      <Btn label="Continue" busy={continueBusy} disabled={blocked} onPress={() => void goCheck()} />
      <WalletPicker open={picker} title="Which money do you send?" current={code} liveWallets={props.liveWallets} onClose={() => setPicker(false)} onPick={(k) => { setCode(k); setPicker(false); }} showAdd={false} />
    </Screen>
  );
}
