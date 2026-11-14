import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { metaFor } from '@/design/bridge/currencyMeta';
import type { DesignWallet } from '@/design/bridge/mapWallet';
import { verifyDesignPin } from '@/design/bridge/verifyPin';
import { AmountBox } from '@/newui/features/AmountBox';
import { PinStep } from '@/newui/features/PinStep';
import { fmt, num, ONBOARD_EMAIL, USER, W } from '@/newui/lib/money';
import { useC } from '@/newui/lib/theme';
import { Icon } from '@/newui/ui/Icon';
import { Btn, Card, Choice, Circle, Divider, Field, Flag, H1, H2, Line, Overlay, P, Row, Screen, TopBar, Txt } from '@/newui/ui/kit';
import type { NgnBankAccount } from '@/services/storage/ngnBankAccountsStorage';

type TakeOutStage = 'form' | 'check' | 'pin' | 'newacct' | 'done';

type Acct = { id?: string; name: string; bank: string; number: string; bankCode?: string };

type TakeOutProps = {
  backend?: boolean;
  stage?: string;
  code?: string;
  liveWallets?: DesignWallet[];
  bankNames?: string[];
  sessionEmail?: string;
  interacEmails?: string[];
  ngnAccounts?: NgnBankAccount[];
  helloName?: string;
  prepareWithdrawal?: (
    code: string,
    amount: string,
    dest: { email?: string; bank?: string; acct?: string; bankCode?: string },
  ) => { ok: false; error: string } | { ok: true };
  confirmPin?: (pin: string) => Promise<boolean>;
  confirmBiometric?: () => Promise<boolean>;
  saveNgnAccount?: (input: {
    bankName: string;
    accountNumber: string;
    accountName?: string;
  }) => Promise<{ ok: true; account: NgnBankAccount } | { ok: false; error: string }>;
  deleteNgnAccount?: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  go?: (href: string) => void;
};

function mapNgnAccounts(list: NgnBankAccount[] | undefined): Acct[] {
  return (list ?? []).map((a) => ({
    id: a.id,
    name: a.accountName || 'Saved account',
    bank: a.bankName,
    number: a.accountNumber,
    bankCode: a.bankCode,
  }));
}

const SAMPLE_EMAILS = [ONBOARD_EMAIL, 'other@example.com'];
const MIN: Record<string, number> = { CAD: 10, NGN: 1000 };
const LIMITS = { day: 3000, week: 15000, month: 30000 };
const USED = { day: 2800, week: 2800, month: 2800 };
const LEFT_CAD = Math.min(LIMITS.day - USED.day, LIMITS.week - USED.week, LIMITS.month - USED.month);
const SAMPLE_BANKS = ['Access Bank', 'GTBank', 'Kuda', 'OPay', 'UBA', 'Zenith Bank'];
const SAMPLE_ACCOUNTS: Acct[] = [
  { name: 'Oluwasesan Afolabi', bank: 'GTBank', number: '0123456789' },
  { name: 'Ada Okoro', bank: 'Access Bank', number: '0987654321' },
];

function normStage(s?: string): TakeOutStage {
  if (s === 'check' || s === 'pin' || s === 'newacct' || s === 'done') return s;
  return 'form';
}

function walletRow(w: DesignWallet) {
  const m = metaFor(w.code);
  return {
    ...m,
    ...w,
    start: w.start ?? m.start ?? '',
    method: w.code === 'CAD' ? ('email' as const) : ('bank' as const),
  };
}

function ListOverlay({
  list,
  setList,
  onBank,
  onWallet,
  banks,
  liveWallets,
}: {
  list: '' | 'bank' | 'wallet';
  setList: (v: '' | 'bank' | 'wallet') => void;
  onBank: (b: string) => void;
  onWallet: (code: string) => void;
  banks: string[];
  liveWallets?: DesignWallet[];
}) {
  const [bankQuery, setBankQuery] = useState('');
  const walletCodes = liveWallets?.map((w) => w.code) ?? ['CAD', 'NGN'];
  const q = bankQuery.trim().toLowerCase();
  const filteredBanks = q
    ? banks.filter((b) => b.toLowerCase().includes(q))
    : banks;

  const close = () => {
    setBankQuery('');
    setList('');
  };

  // Reset search whenever the bank sheet opens or closes.
  useEffect(() => {
    if (list !== 'bank') setBankQuery('');
  }, [list]);

  return (
    <Overlay open={!!list} onClose={close}>
      <Screen scroll>
        <TopBar onBack={close} />
        <H1>{list === 'bank' ? 'Choose your bank' : 'Which money do you withdraw?'}</H1>
        {list === 'bank' ? (
          <>
            <Field
              label="Search banks"
              placeholder="Type a bank name"
              value={bankQuery}
              onChangeText={setBankQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {filteredBanks.length === 0 ? (
              <Card>
                <Txt size={17} w="700" color="text2">
                  No bank matches “{bankQuery.trim()}”. Try another name.
                </Txt>
              </Card>
            ) : (
              filteredBanks.map((b) => (
                <Choice
                  key={b}
                  title={b}
                  onPress={() => {
                    onBank(b);
                    close();
                  }}
                  minH={64}
                />
              ))
            )}
          </>
        ) : (
          walletCodes.map((k) => {
            const w = liveWallets?.find((x) => x.code === k);
            const bal = w?.bal ?? 0;
            return (
              <Choice
                key={k}
                title={W(k).name}
                note={'You have ' + fmt(k, bal)}
                icon={<Flag cc={W(k).cc} w={60} />}
                onPress={() => {
                  onWallet(k);
                  close();
                }}
                minH={80}
              />
            );
          })
        )}
      </Screen>
    </Overlay>
  );
}

/** Withdraw money — new UI wired to useLiveTakeOut. */
export default function TakeOut(props: TakeOutProps) {
  const c = useC();
  const staticStage = props.stage;
  const wallets = useMemo(
    () => (props.backend ? (props.liveWallets ?? []).map(walletRow) : [walletRow({ ...metaFor('CAD'), bal: 500 }), walletRow({ ...metaFor('NGN'), bal: 600000 })]),
    [props.backend, props.liveWallets],
  );

  const initialCode = props.code || 'CAD';
  const initialW = walletRow({ ...metaFor(initialCode), bal: 0 });

  const [stage, setStage] = useState<TakeOutStage>(() => normStage(staticStage));
  const [pinFor, setPinFor] = useState<'take' | 'save'>('take');
  const [code, setCode] = useState(initialCode);
  const [amount, setAmount] = useState(staticStage ? initialW.start : '');
  const [email, setEmail] = useState(props.backend ? props.sessionEmail || '' : SAMPLE_EMAILS[0]!);
  const [bank, setBank] = useState('');
  const [acct, setAcct] = useState('');
  const [accounts, setAccounts] = useState<Acct[]>(
    props.backend ? mapNgnAccounts(props.ngnAccounts) : SAMPLE_ACCOUNTS,
  );
  const [chosen, setChosen] = useState(0);
  const [delIdx, setDelIdx] = useState(-1);
  const [list, setList] = useState<'' | 'bank' | 'wallet'>('');
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectAccountId, setSelectAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (staticStage !== undefined) setStage(normStage(staticStage));
  }, [staticStage]);

  useEffect(() => {
    const emails = props.interacEmails;
    if (emails?.length) {
      setEmail((cur) => (emails.includes(cur) ? cur : emails[0]!));
    }
  }, [props.interacEmails]);

  useEffect(() => {
    if (!props.backend) return;
    const next = mapNgnAccounts(props.ngnAccounts);
    setAccounts(next);
    if (selectAccountId) {
      const idx = next.findIndex((a) => a.id === selectAccountId);
      setChosen(idx >= 0 ? idx : 0);
      setSelectAccountId(null);
      return;
    }
    setChosen((cur) => (next.length === 0 ? 0 : Math.min(cur, next.length - 1)));
  }, [props.backend, props.ngnAccounts, selectAccountId]);

  const w = wallets.find((x) => x.code === code) || walletRow({ ...metaFor(code), bal: 0 });
  const isEmail = w.method === 'email' || code === 'CAD';
  const have = w.bal ?? 0;
  const n = num(amount);
  const tooMuch = n > have;
  const minAmt = MIN[code] ?? 1;
  const tooLittle = n > 0 && n < minAmt;
  const limitLeft = props.backend ? have : LEFT_CAD;
  const overLimit = isEmail && !props.backend && !tooMuch && n > LEFT_CAD;
  const pick = accounts[chosen];
  const destOk = isEmail ? !!email : !!pick || (!!bank && /^\d{10}$/.test(acct));
  const blocked = n <= 0 || tooMuch || tooLittle || overLimit || !destOk || !!prepareError;
  const amountText = fmt(code, n);
  const destText = isEmail ? email : pick ? pick.bank + ' · ' + pick.number : bank && acct ? bank + ' · ' + acct : '';
  const destName = isEmail
    ? props.backend
      ? props.helloName || email || 'My account'
      : USER.first + ' ' + USER.last
    : pick
      ? pick.name
      : props.backend
        ? 'Saved account'
        : '';
  const newOk = !!bank && /^\d{10}$/.test(acct);
  const del = delIdx >= 0 ? accounts[delIdx] : null;
  const emailList = props.backend ? props.interacEmails ?? (props.sessionEmail ? [props.sessionEmail] : []) : SAMPLE_EMAILS;
  const payeeLabel = props.backend ? props.helloName || 'My account' : USER.first + ' ' + USER.last;
  const banks = props.bankNames?.length ? props.bankNames : SAMPLE_BANKS;

  const pickAccount = (i: number) => {
    setChosen(i);
    const a = accounts[i];
    if (a) {
      setBank(a.bank);
      setAcct(a.number);
    }
    setPrepareError(null);
  };

  const goPin = async () => {
    setPrepareError(null);
    if (pinFor === 'take' && props.backend && props.prepareWithdrawal) {
      const dest = isEmail
        ? { email }
        : pick
          ? { bank: pick.bank, acct: pick.number, bankCode: pick.bankCode }
          : { bank, acct };
      const r = props.prepareWithdrawal(code, amount, dest);
      if (!r.ok) {
        setPrepareError(r.error);
        return;
      }
    }
    setStage('pin');
  };

  const saveNewAccountAfterAuth = useCallback(async (): Promise<boolean | { softFail: true }> => {
    if (!props.saveNgnAccount) return { softFail: true };
    setSaveError(null);
    const r = await props.saveNgnAccount({
      bankName: bank,
      accountNumber: acct,
      accountName: props.helloName || 'Saved account',
    });
    if (!r.ok) {
      setSaveError(r.error || 'Could not save this account. Please try again.');
      return { softFail: true };
    }
    setSelectAccountId(r.account.id);
    return true;
  }, [acct, bank, props.helloName, props.saveNgnAccount]);

  if (stage === 'pin')
    return (
      <PinStep
        title={pinFor === 'save' ? 'Confirm new account' : 'Enter your PIN'}
        onBack={() => {
          setStage(pinFor === 'save' ? 'newacct' : 'check');
          if (pinFor !== 'save') setPinFor('take');
        }}
        confirmPin={
          pinFor === 'take' && props.confirmPin
            ? props.confirmPin
            : pinFor === 'save' && props.backend && props.saveNgnAccount
              ? async (pin) => {
                  const pinOk = await verifyDesignPin(pin);
                  if (!pinOk) return false;
                  return saveNewAccountAfterAuth();
                }
              : undefined
        }
        confirmBiometric={
          pinFor === 'take'
            ? props.confirmBiometric
            : pinFor === 'save' && props.backend && props.saveNgnAccount
              ? async () => {
                  try {
                    const has = await LocalAuthentication.hasHardwareAsync();
                    const enrolled = has ? await LocalAuthentication.isEnrolledAsync() : false;
                    if (has && enrolled) {
                      const bio = await LocalAuthentication.authenticateAsync({
                        promptMessage: 'Confirm new account',
                        cancelLabel: 'Cancel',
                        disableDeviceFallback: false,
                      });
                      if (!bio.success) return false;
                    } else {
                      // No biometrics — require PIN instead of silently succeeding.
                      return false;
                    }
                  } catch {
                    return false;
                  }
                  return saveNewAccountAfterAuth();
                }
              : undefined
        }
        onDone={() => {
          if (pinFor === 'save') {
            if (!props.backend) {
              setAccounts([...accounts, { name: props.helloName || 'Saved account', bank, number: acct }]);
              setChosen(accounts.length);
            }
            setBank('');
            setAcct('');
            setPinFor('take');
            setSaveError(null);
            setStage('form');
          } else {
            setStage('done');
          }
        }}
      />
    );

  if (stage === 'newacct')
    return (
      <Screen scroll>
        <TopBar onBack={() => setStage('form')} say="Save a new account. You can only withdraw to accounts you saved." />
        <H1>Save a new account</H1>
        <P>You can only withdraw to accounts you saved.</P>
        <Card>
          <Pressable accessibilityRole="button" onPress={() => setList('bank')} style={{ minHeight: 64, borderRadius: 14, backgroundColor: c.field, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Txt size={15} color="text2">
                Bank
              </Txt>
              <Txt size={19} w="800">
                {bank || 'Choose your bank'}
              </Txt>
            </View>
            <Icon name="down" size={20} color={c.text} />
          </Pressable>
          <Field label="10-number account" value={acct} onChangeText={(v) => setAcct(v.replace(/[^0-9]/g, '').slice(0, 10))} keyboardType="number-pad" />
          {newOk && !props.backend ? (
            <Row gap={8} style={{ backgroundColor: c.okBg, borderRadius: 14, padding: 10 }}>
              <Icon name="check" size={24} color={c.deep} />
              <Txt size={18} w="800" noTr>
                Tunde Bello
              </Txt>
            </Row>
          ) : null}
          {saveError ? (
            <Txt size={16} w="700" color="red" role="alert">
              {saveError}
            </Txt>
          ) : null}
        </Card>
        <View style={{ flex: 1 }} />
        <Btn
          label="Save this account"
          disabled={!newOk}
          onPress={() => {
            setSaveError(null);
            setPinFor('save');
            setStage('pin');
          }}
        />
        <ListOverlay list={list} setList={setList} onBank={setBank} onWallet={(k) => { setCode(k); setAmount(''); }} banks={banks} liveWallets={props.liveWallets} />
      </Screen>
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
                You withdraw
              </Txt>
              <Txt size={26} w="800" noTr>
                {amountText}
              </Txt>
            </View>
          </Row>
          <Divider />
          <View>
            <Txt size={16} color="text2">
              To
            </Txt>
            <Txt size={22} w="800" noTr>
              {destName}
            </Txt>
            <Txt size={16} w="600" color="text3" noTr>
              {destText}
            </Txt>
          </View>
          <Divider />
          <Line k="Fee" v="No fee" />
          <Txt size={16} w="700" color="orange">
            This money leaves your wallet now. If it fails, it comes back.
          </Txt>
        </Card>
        <TopBar onBack={() => setStage('form')} say={'Is this right? You withdraw ' + amountText + ' to ' + destName + '. No fee. This money leaves your wallet now. If it fails, it comes back.'} />
        <View style={{ flex: 1 }} />
        <Btn label="Yes, withdraw your money" onPress={() => void goPin()} />
      </Screen>
    );

  if (stage === 'done')
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: 8, marginTop: 14 }}>
          <Circle icon="clock" bg="#A84C08" />
          <H1 center>Your money is on the way</H1>
          <Txt size={30} w="800" noTr>
            {amountText}
          </Txt>
          <P center>You will get an alert when it arrives.</P>
        </View>
        <Card gap={4}>
          <Line k="Fee" v="No fee" />
          <Line k="You now have" v={fmt(code, Math.max(0, have - n))} />
        </Card>
        <TopBar onBack={false} say={'Your money is on the way. You now have ' + fmt(code, Math.max(0, have - n)) + '.'} />
        <View style={{ flex: 1 }} />
        <Btn label="Go home" onPress={() => router.replace('/Main')} />
        <Btn kind="outline" size="mid" label="See history" onPress={() => router.replace('/History')} />
      </Screen>
    );

  const haveMsg = tooLittle
    ? 'Too small. The least is ' + fmt(code, minAmt)
    : tooMuch
      ? 'Too much. You only have ' + fmt(code, have)
      : overLimit
        ? 'Over your limit. You can withdraw ' + fmt(code, LEFT_CAD) + ' now.'
        : isEmail
          ? 'You have ' + fmt(code, have) + '. You can withdraw ' + fmt(code, Math.min(limitLeft, have)) + ' now.'
          : 'You have ' + fmt(code, have);

  return (
    <Screen scroll>
      <H1>Withdraw money</H1>
      <Card>
        <AmountBox code={code} label="You withdraw" value={amount} onChange={(v) => { setAmount(v); setPrepareError(null); }} onPick={() => setList('wallet')} pickLabel="Choose which money to withdraw" />
        <Txt size={16} w="700" color={tooMuch || tooLittle || overLimit || prepareError ? 'red' : 'text3'}>
          {haveMsg}
          {prepareError ? ' ' + prepareError : ''}
        </Txt>
      </Card>
      <TopBar onBack={() => router.back()} say={'Withdraw money. There is no fee. You cannot withdraw more than you have. You have ' + fmt(code, have) + '.'} />
      {isEmail ? (
        <Card>
          <H2>Send to your checked email</H2>
          {emailList.map((m) => (
            <Choice key={m} title={payeeLabel} note={m} on={m === email} onPress={() => setEmail(m)} />
          ))}
        </Card>
      ) : (
        <Card>
          <H2 style={{ width: '100%', flexShrink: 0 }}>Send to a saved account</H2>
          {accounts.map((a, i) => (
            <Row key={(a.id || a.number) + String(i)} gap={8} style={{ width: '100%', alignItems: 'center' }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Choice title={a.name} note={a.bank + ' · ' + a.number} on={i === chosen} onPress={() => pickAccount(i)} />
              </View>
              <Btn
                size="small"
                kind="outline"
                fit
                label="Delete"
                a11y={'Delete ' + a.name}
                onPress={() => setDelIdx(i)}
                style={{ borderColor: c.red, flexShrink: 0 }}
              />
            </Row>
          ))}
          <Btn kind="outline" size="small" label="Save a new account" onPress={() => { setBank(''); setAcct(''); setSaveError(null); setStage('newacct'); }} />
        </Card>
      )}
      <View style={{ flex: 1 }} />
      <Btn
        label="Continue"
        disabled={blocked}
        onPress={() => {
          setPinFor('take');
          setPrepareError(null);
          setStage('check');
        }}
      />

      <ListOverlay list={list} setList={setList} onBank={setBank} onWallet={(k) => { setCode(k); setAmount(''); }} banks={banks} liveWallets={props.liveWallets} />

      <Modal visible={!!del} transparent animationType="fade" onRequestClose={() => setDelIdx(-1)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 }}>
          <Card gap={10}>
            <H2>Delete this account?</H2>
            <Txt size={19} w="800" noTr>
              {del?.name ?? ''}
            </Txt>
            <Txt size={16} color="text2" noTr>
              {del ? del.bank + ' · ' + del.number : ''}
            </Txt>
            <P>You can save it again later.</P>
            <Btn
              kind="danger"
              size="mid"
              label="Delete"
              onPress={() => {
                void (async () => {
                  const target = accounts[delIdx];
                  if (props.backend && props.deleteNgnAccount && target?.id) {
                    const r = await props.deleteNgnAccount(target.id);
                    if (!r.ok) {
                      setPrepareError(r.error);
                      setDelIdx(-1);
                      return;
                    }
                  } else {
                    setAccounts(accounts.filter((_, i) => i !== delIdx));
                    setChosen(chosen === delIdx ? 0 : chosen > delIdx ? chosen - 1 : chosen);
                  }
                  setDelIdx(-1);
                })();
              }}
            />
            <Btn kind="outline" size="mid" label="Keep it" onPress={() => setDelIdx(-1)} />
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}
