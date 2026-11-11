import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { metaFor } from '@/design/bridge/currencyMeta';
import type { DesignWallet } from '@/design/bridge/mapWallet';
import type { FundingDetails } from '@/design/bridge/useLiveAdd';
import { amtIn, amtShow, fmt, num, ONBOARD_EMAIL, W } from '@/newui/lib/money';
import { useC } from '@/newui/lib/theme';
import { Icon } from '@/newui/ui/Icon';
import { Btn, Card, Choice, Circle, Field, Flag, H1, Line, Overlay, P, PadNumberInput, Row, Screen, Small, TopBar, Txt } from '@/newui/ui/kit';

type AddStage = 'form' | 'send' | 'wait' | 'done';

type AddProps = {
  backend?: boolean;
  stage?: string;
  code?: string;
  liveWallets?: DesignWallet[];
  listInteracEmails?: () => Promise<string[]>;
  saveInteracEmail?: (email: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  startFunding?: (
    code: string,
    amount: string,
    interacEmail?: string,
  ) => Promise<{ ok: false; error: string } | { ok: true; details: FundingDetails; fundingId?: string }>;
  waitForFunding?: (fundingId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  sessionEmail?: string;
  helloName?: string;
  go?: (href: string) => void;
};

const SAMPLE_BANK = { bank: 'Kuda', name: 'AFRIBDC-OLUWASESAN AFOLABI', number: '7000000001', ref: '7097B5E0B0E049B1' };
const PAY_TO = 'pay@palpeer.com';
const MEMO = 'PP653603E63B';
const isPhone = (v: string) => /^\+?[0-9 ()-]{10,16}$/.test(v.trim()) && v.replace(/[^0-9]/g, '').length >= 10;

function normStage(s?: string): AddStage {
  if (s === 'send' || s === 'wait' || s === 'done') return s;
  return 'form';
}

function walletRow(w: DesignWallet) {
  const m = metaFor(w.code);
  return {
    ...m,
    ...w,
    min: w.min ?? m.min ?? 1,
    chips: w.chips ?? m.chips ?? [],
    step: w.step ?? m.step ?? 'Choose bank transfer',
    start: w.start ?? m.start ?? '',
  };
}

/** Add money — new UI wired to useLiveAdd. */
export default function Add(props: AddProps) {
  const c = useC();
  const staticStage = props.stage;
  const wallets = useMemo(
    () => (props.backend ? (props.liveWallets ?? []).map(walletRow) : [walletRow({ ...metaFor('CAD'), bal: 0 }), walletRow({ ...metaFor('NGN'), bal: 0 })]),
    [props.backend, props.liveWallets],
  );
  const pickCode = useCallback(
    (preferred: string) => {
      if (wallets.some((w) => w.code === preferred)) return preferred;
      return wallets[0]?.code || preferred || 'CAD';
    },
    [wallets],
  );

  const [stage, setStage] = useState<AddStage>(() => normStage(staticStage));
  const [code, setCode] = useState(() => pickCode(props.code || 'CAD'));
  const [picker, setPicker] = useState(false);
  const [amount, setAmount] = useState(() => {
    const c0 = pickCode(props.code || 'CAD');
    const w = wallets.find((x) => x.code === c0);
    return staticStage && w ? w.start : '';
  });
  const seedEmail = props.sessionEmail || (props.backend ? '' : ONBOARD_EMAIL);
  const [emails, setEmails] = useState<string[]>(seedEmail ? [seedEmail] : []);
  const [email, setEmail] = useState(seedEmail);
  const [emailsOpen, setEmailsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [check, setCheck] = useState<'' | 'code' | 'checking' | 'fail'>('');
  const [checkError, setCheckError] = useState('');
  const [vcode, setVcode] = useState('');
  const [copied, setCopied] = useState('');
  const [fundingDetails, setFundingDetails] = useState<FundingDetails | null>(null);
  const [fundingError, setFundingError] = useState<string | null>(null);
  const [fundingId, setFundingId] = useState<string | null>(null);
  const [continueBusy, setContinueBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  useEffect(() => {
    if (staticStage !== undefined) setStage(normStage(staticStage));
  }, [staticStage]);

  useEffect(() => {
    if (!wallets.length) return;
    if (!wallets.some((w) => w.code === code)) setCode(wallets[0]!.code);
  }, [wallets, code]);

  const loadEmails = useCallback(async () => {
    if (!props.listInteracEmails) return;
    try {
      const list = await props.listInteracEmails();
      if (!list.length) {
        if (props.backend && !props.sessionEmail) setEmails([]);
        return;
      }
      setEmails(list);
      setEmail((cur) => (list.includes(cur) ? cur : list[0]!));
    } catch {
      /* ignore */
    }
  }, [props]);

  useEffect(() => {
    void loadEmails();
  }, [loadEmails]);

  const cfg = wallets.find((w) => w.code === code) || walletRow({ ...metaFor(code), bal: 0 });
  const isCad = code === 'CAD';
  const n = num(amount);
  const amountText = fmt(code, n);
  const tooLittle = n > 0 && n < (cfg.min || 0);
  const blocked = n <= 0 || tooLittle || (isCad && !email) || !!fundingError;
  const draftBad = !(/.+@.+\..+/.test(draft.trim()) || isPhone(draft)) || check === 'checking';
  const balAfter = cfg.bal + n;

  const sampleDetails = isCad
    ? [
        { key: 'to', label: 'Send to', value: PAY_TO, copy: PAY_TO },
        { key: 'amount', label: 'Amount', value: amountText, copy: n.toFixed(2) },
        { key: 'memo', label: 'Message', value: MEMO, copy: MEMO },
      ]
    : [
        { key: 'bank', label: 'Bank', value: SAMPLE_BANK.bank, copy: SAMPLE_BANK.bank },
        { key: 'name', label: 'Account name', value: SAMPLE_BANK.name, copy: SAMPLE_BANK.name },
        { key: 'number', label: 'Account number', value: SAMPLE_BANK.number, copy: SAMPLE_BANK.number },
        { key: 'amount', label: 'Amount', value: amountText, copy: n.toFixed(2) },
        { key: 'memo', label: 'Reference', value: SAMPLE_BANK.ref, copy: SAMPLE_BANK.ref },
      ];

  const fd = fundingDetails;
  const details = fd
    ? (isCad
        ? [
            { key: 'to', label: 'Send to', value: fd.payTo || '—', copy: fd.payTo || '' },
            { key: 'amount', label: 'Amount', value: fd.amountText || amountText, copy: n.toFixed(2) },
            { key: 'memo', label: 'Message', value: fd.memo || '—', copy: fd.memo || '' },
          ].filter((row) => row.copy || row.key === 'amount')
        : [
            { key: 'bank', label: 'Bank', value: fd.bank || '—', copy: fd.bank || '' },
            { key: 'name', label: 'Account name', value: fd.name || '—', copy: fd.name || '' },
            { key: 'number', label: 'Account number', value: fd.number || '—', copy: fd.number || '' },
            { key: 'amount', label: 'Amount', value: fd.amountText || amountText, copy: n.toFixed(2) },
            { key: 'memo', label: 'Reference', value: fd.ref || fd.memo || '—', copy: fd.ref || fd.memo || '' },
          ].filter((row) => row.copy || row.key === 'amount'))
    : props.backend
      ? []
      : sampleDetails;

  const say = {
    form: 'Add money. Choose how much to add. There is no fee.',
    send: 'Open your bank app. ' + cfg.step + '. Copy the details. Send the exact amount. Then tap It is sent.',
    wait: 'Waiting for your money. You will get an alert when it is in your wallet. If you do not send it, this closes after 3 days.',
    done: 'Done. ' + amountText + ' is now in your wallet.',
  }[stage];

  const goHome = () => {
    if (timer.current) clearTimeout(timer.current);
    router.replace('/Main');
  };

  const goSend = async () => {
    setFundingError(null);
    if (timer.current) clearTimeout(timer.current);
    setContinueBusy(true);
    try {
      if (props.backend && props.startFunding) {
        const r = await props.startFunding(code, amount, isCad ? email : undefined);
        if (!r.ok) {
          setFundingError(r.error);
          return;
        }
        setFundingDetails(r.details);
        setFundingId(r.fundingId ?? null);
        setCopied('');
        setStage('send');
        return;
      }
      setFundingDetails(null);
      setStage('send');
    } finally {
      setContinueBusy(false);
    }
  };

  const goWait = async () => {
    setStage('wait');
    setFundingError(null);
    if (timer.current) clearTimeout(timer.current);
    if (props.backend && props.waitForFunding) {
      const r = await props.waitForFunding(fundingId || '');
      if (r.ok) setStage('done');
      else {
        setFundingError(r.error);
        setStage('send');
      }
      return;
    }
    if (!staticStage) {
      timer.current = setTimeout(() => setStage('done'), 6000);
    }
  };

  const checkCode = async () => {
    const mail = draft.trim();
    setCheck('checking');
    setCheckError('');
    if (props.backend && props.saveInteracEmail) {
      const r = await props.saveInteracEmail(mail);
      if (!r.ok) {
        setCheck('fail');
        setCheckError(r.error);
        return;
      }
      const next = emails.includes(mail) ? emails : [...emails, mail];
      setEmails(next);
      setEmail(mail);
      setDraft('');
      setCheck('');
      setEmailsOpen(false);
      return;
    }
    timer.current = setTimeout(() => {
      if (/wrong/i.test(mail)) {
        setCheck('fail');
        setCheckError('The name on it does not match your name.');
      } else {
        setEmails([...emails, mail]);
        setEmail(mail);
        setDraft('');
        setCheck('');
        setEmailsOpen(false);
      }
    }, 2000);
  };

  if (stage === 'send')
    return (
      <Screen scroll>
        <TopBar onBack={() => setStage('form')} say={say} />
        <H1>Send from your bank</H1>
        <Card>
          {['Open your bank app', cfg.step, 'Copy these into your bank app'].map((s, i) => (
            <Row key={s} gap={12}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={17} w="800" color="#FFFFFF" noTr>
                  {String(i + 1)}
                </Txt>
              </View>
              <Txt size={18} w="700" style={{ flex: 1 }}>
                {s}
              </Txt>
            </Row>
          ))}
          {details.map((d) => (
            <Row key={d.key} between style={{ backgroundColor: c.field, borderRadius: 14, padding: 10 }}>
              <View style={{ flex: 1 }}>
                <Small>{d.label}</Small>
                <Txt size={18} w="800" noTr>
                  {d.value}
                </Txt>
              </View>
              <Btn
                size="small"
                kind="primary"
                a11y={'Copy ' + d.label}
                label={copied === d.key ? 'Copied' : 'Copy'}
                style={{ backgroundColor: c.brand, minWidth: 96 }}
                onPress={() => {
                  if (d.copy) Clipboard.setStringAsync(d.copy).catch(() => {});
                  setCopied(d.key);
                }}
              />
            </Row>
          ))}
          {fundingError ? (
            <Txt size={16} w="700" color="red">
              {fundingError}
            </Txt>
          ) : null}
          <Txt size={16} w="700" color="orange">
            {isCad ? 'Send the exact amount from ' + email + '. No security question.' : 'Send the exact amount. Bank fees are shown by your bank.'}
          </Txt>
        </Card>
        <View style={{ flex: 1 }} />
        <Btn label="It is sent" onPress={() => void goWait()} />
      </Screen>
    );

  if (stage === 'wait')
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: 12, marginTop: 20 }}>
          <Circle icon="clock" bg="#A84C08" />
          <H1 center>Waiting for your money</H1>
          <Txt size={30} w="800" noTr>
            {amountText}
          </Txt>
          <P center>You will get an alert when it is in your wallet. If you do not send it, it stays Waiting in History for 3 days, then closes.</P>
        </View>
        <TopBar onBack={false} say={say} />
        <View style={{ flex: 1 }} />
        <Btn label="Go home" onPress={goHome} />
        <Btn
          kind="outline"
          size="mid"
          label="See the details again"
          onPress={() => {
            if (timer.current) clearTimeout(timer.current);
            setStage('send');
          }}
        />
      </Screen>
    );

  if (stage === 'done')
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: 10, marginTop: 20 }}>
          <Circle icon="check" />
          <H1 center>Done!</H1>
          <Txt size={30} w="800" noTr>
            {amountText}
          </Txt>
          <P center>{'is now in your ' + W(code).name}</P>
        </View>
        <Card gap={4}>
          <Line k="Fee" v="No fee" />
          <Line k="You now have" v={fmt(code, balAfter)} />
        </Card>
        <View style={{ flex: 1 }} />
        <Btn label="Go home" onPress={goHome} />
        <Btn kind="outline" size="mid" label="See history" onPress={() => router.replace('/History')} />
      </Screen>
    );

  return (
    <Screen scroll>
      <H1>Add money</H1>
      <Card>
        <Row gap={10}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={'Choose which money to add. Now ' + W(code).name}
            onPress={() => setPicker(true)}
            style={{ height: 60, paddingHorizontal: 8, borderRadius: 14, backgroundColor: c.field, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Flag cc={W(code).cc} w={46} />
            <Icon name="down" size={20} color={c.text} />
          </Pressable>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
            <Txt size={28} w="800" noTr>
              {W(code).sym}
            </Txt>
            <PadNumberInput
              accessibilityLabel="Amount"
              placeholder="0"
              decimal
              padKey="add-amount"
              value={amtShow(amount)}
              onChangeText={(v) => {
                setAmount(amtIn(v));
                setFundingError(null);
              }}
              style={{ flexShrink: 1, minWidth: 118, fontSize: 28, fontFamily: 'NotoSans_800ExtraBold', textAlign: 'right', paddingVertical: 4 }}
            />
          </View>
        </Row>
        <Row gap={8}>
          {(cfg.chips || []).map((v) => (
            <Pressable key={v} accessibilityRole="button" onPress={() => setAmount(String(v))} style={{ flex: 1, minHeight: 52, borderRadius: 14, backgroundColor: c.tileGreen, alignItems: 'center', justifyContent: 'center' }}>
              <Txt size={16} w="800" noTr>
                {(isCad ? '$' : '₦') + v.toLocaleString('en-CA')}
              </Txt>
            </Pressable>
          ))}
        </Row>
        {tooLittle ? (
          <Txt size={16} w="700" color="red">
            {'Too small. The least is ' + fmt(code, cfg.min || 0)}
          </Txt>
        ) : null}
        {fundingError ? (
          <Txt size={16} w="700" color="red">
            {fundingError}
          </Txt>
        ) : null}
      </Card>
      <TopBar say={say} />
      {isCad ? (
        <Card>
          <Txt size={19} w="800">
            Which email or number would you send from?
          </Txt>
          {emails.map((m, i) => (
            <Choice key={m} title={m} note={i === 0 ? 'My Palpeer email' : isPhone(m) ? 'Checked phone' : 'Checked email'} on={m === email} onPress={() => setEmail(m)} minH={64} />
          ))}
          <Btn kind="outline" size="small" label="Add Interac email or number" onPress={() => setEmailsOpen(true)} />
        </Card>
      ) : (
        <Card gap={4}>
          <Txt size={18} w="800">
            You pay by bank transfer
          </Txt>
          <Small>To your own Palpeer bank account. You see the details next.</Small>
        </Card>
      )}
      <Card gap={4} bg={c.tileGreen}>
        <Line k="Fee" v="No fee" />
        <Line k="You get" v={amountText} strong />
      </Card>
      <View style={{ flex: 1 }} />
      <Btn label="Continue" busy={continueBusy} disabled={blocked} onPress={() => void goSend()} />

      <Overlay open={picker}>
        <Screen>
          <TopBar onBack={() => setPicker(false)} />
          <H1>Which money do you add?</H1>
          {wallets.map((w) => (
            <Choice key={w.code} title={w.name} icon={<Flag cc={W(w.code).cc} w={60} />} on={w.code === code} onPress={() => { setCode(w.code); setAmount(''); setPicker(false); setFundingDetails(null); }} minH={80} />
          ))}
        </Screen>
      </Overlay>

      <Overlay open={emailsOpen}>
        <Screen scroll>
          <TopBar onBack={() => setEmailsOpen(false)} />
          <H1>Add Interac email or number</H1>
          <P>You send Interac e-Transfer from it. The name on it must match your name.</P>
          <Card>
            <Field label="My email or phone number" placeholder="Email or phone number" value={draft} onChangeText={(v) => { setDraft(v); setCheck(''); setCheckError(''); setVcode(''); }} autoCapitalize="none" keyboardType="email-address" />
            {check ? (
              <Txt size={16} w="700" color={check === 'code' ? 'brandText' : check === 'checking' ? 'orange' : 'red'} role="alert">
                {check === 'code' ? 'We sent a 6-digit code to ' + draft.trim() + '.' : check === 'checking' ? 'Interac is checking the name on it.' : checkError || 'The name on it does not match your name.'}
              </Txt>
            ) : null}
            {check === 'code' ? (
              <>
                <Field label="6-digit code" value={vcode} onChangeText={(v) => setVcode(v.replace(/[^0-9]/g, '').slice(0, 6))} keyboardType="number-pad" big center />
                <Btn size="mid" label="Check the code" disabled={vcode.length !== 6} onPress={() => void checkCode()} />
              </>
            ) : (
              <Btn size="mid" label="Send a code" disabled={draftBad} onPress={() => { setCheck('code'); setVcode(''); }} />
            )}
          </Card>
          {emails.slice(1).map((m) => (
            <Row key={m} between style={{ backgroundColor: c.card, borderRadius: 16, padding: 12 }}>
              <Txt size={17} w="700" noTr style={{ flex: 1 }}>
                {m}
              </Txt>
              <Btn
                size="small"
                kind="outline"
                label="Remove"
                a11y={'Remove ' + m}
                onPress={() => {
                  const rest = emails.filter((x) => x !== m);
                  setEmails(rest);
                  if (m === email) setEmail(rest[0] || '');
                }}
              />
            </Row>
          ))}
        </Screen>
      </Overlay>
    </Screen>
  );
}
