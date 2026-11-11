import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DesignAddressField } from '@/features/profile/DesignAddressField';
import { DateOfBirthField } from '@/features/profile/DateOfBirthField';
import {
  pickupCurrentAddress,
  type StructuredAddress,
} from '@/features/profile/addressLookup';
import { JOB_OPTIONS, STATES_BY_COUNTRY } from '@/features/profile/profileOptions';
import { defaultDateOfBirth } from '@/features/profile/schemas';
import { useT, useTv } from '@/newui/lib/i18n';
import { useListen } from '@/newui/lib/speech';
import { useStore } from '@/newui/lib/store';
import { useC } from '@/newui/lib/theme';
import { BottomNav } from '@/newui/ui/BottomNav';
import { Icon, IconName } from '@/newui/ui/Icon';
import { Btn, Card, Choice, Circle, Field, Flag, H1, H2, Loading, P, Pill, Row, Screen, Sheet, TopBar, Txt } from '@/newui/ui/kit';
import { ageOf, COUNTRIES, countryOf, ID_TYPES, INCOMES, monthRanges, PROVINCES, StartState } from './data';

/** About you requires 18+ (stricter than the shared profile minimum of 16). */
const ABOUT_YOU_MIN_AGE = 18;

/** Map geocoder subdivision onto Start province/state labels. */
function provinceFromAddress(liveId: string, stateTerritory: string | null | undefined): string {
  const raw = (stateTerritory || '').trim();
  if (!raw) return '';
  const list = PROVINCES[liveId];
  if (list) {
    const exact = list.find((p) => p.toLowerCase() === raw.toLowerCase());
    if (exact) return exact;
  }
  const opts = STATES_BY_COUNTRY[(liveId || '').toUpperCase()] || [];
  const byKey = opts.find((o) => o.key.toLowerCase() === raw.toLowerCase());
  if (byKey) {
    if (list?.includes(byKey.title)) return byKey.title;
    return byKey.title;
  }
  const byTitle = opts.find((o) => o.title.toLowerCase() === raw.toLowerCase());
  if (byTitle) {
    if (list?.includes(byTitle.title)) return byTitle.title;
    return byTitle.title;
  }
  return raw;
}

const DOC_TYPES = ['PASSPORT', 'NATIONAL_ID', 'DRIVING_LICENSE', 'RESIDENCE_PERMIT'] as const;

export type StartBridge = {
  backend?: boolean;
  /** Shared action-button loading (Continue / Save / Send). */
  busy?: boolean;
  kycBusy?: boolean;
  onPickDocumentType?: (documentType: string) => void;
  onUploadDocument?: (
    documentType?: string,
    start?: 'camera' | 'library',
  ) => void | Promise<unknown>;
  onUploadSelfie?: () => void | Promise<unknown>;
  onSubmitKyc?: () => void | Promise<unknown>;
  onProfileContinue?: () => void | Promise<void>;
  verifiedGoHome?: () => void;
};

export type StartCtx = StartBridge & {
  s: StartState;
  up: (p: Partial<StartState>) => void;
  go: (stage: string, p?: Partial<StartState>) => void;
  say: string;
  /** Live auth / KYC / security error to show under the action. */
  authMsg?: string;
};

const StepHead = ({ n, onBack, say }: { n: number; onBack: () => void; say: string }) => {
  const { listen, listenLabel } = useListen();
  return (
    <Row between style={{ minHeight: 52 }}>
      <Pill icon="back" label="Back" onPress={onBack} />
      <Txt size={16} w="800" color="text2">
        {'Step ' + n + ' of 4'}
      </Txt>
      <Pill icon="listen" dark label={listenLabel} onPress={() => listen(say)} a11y="Listen to this screen" />
    </Row>
  );
};

/** First home after sign-up: the default wallet follows the verified phone's country; everything waits for the profile. */
export function FirstHome({ s, up, go, say }: StartCtx) {
  const c = useC();
  const { listen, listenLabel } = useListen();
  const tv = useTv();
  const pc = countryOf(s.country);
  const gate = () => up({ gateOpen: true });
  const tiles: { label: string; note: string; icon: IconName; bg: string; dot: string }[] = [
    { label: 'Add', note: 'Fund my wallet', icon: 'plus', bg: c.tileGreen, dot: '#0B6E4F' },
    { label: 'Send', note: 'To Palpeer user', icon: 'send', bg: c.tileBlue, dot: '#1D5BC7' },
    { label: 'Change', note: 'To other currency', icon: 'change', bg: c.tileOrange, dot: '#A84C08' },
    { label: 'Withdraw', note: 'To my account', icon: 'bank', bg: c.tilePurple, dot: '#5E3AB8' },
  ];
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 14 }}>
        <Row between style={{ minHeight: 52 }}>
          <Txt size={24} w="800" role="header" noTr>
            {tv('Hello, {0}', s.uname)}
          </Txt>
          <Pill icon="listen" dark label={listenLabel} onPress={() => listen(say)} a11y="Listen to this screen" />
        </Row>
        <View accessibilityLabel="My wallet" style={{ backgroundColor: '#0B6E4F', borderRadius: 22, padding: 16, gap: 8 }}>
          <Row between>
            <Txt size={20} w="700" color="#FFFFFF">
              My wallet
            </Txt>
            <Pressable accessibilityRole="button" accessibilityLabel="Add a wallet" onPress={gate} style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={26} color="#0B6E4F" />
            </Pressable>
          </Row>
          <Row gap={14}>
            <Flag cc={pc.cc} w={66} />
            <View>
              <Txt size={17} color="#FFFFFF">
                {pc.wallet}
              </Txt>
              <Txt size={34} w="800" color="#FFFFFF" noTr>
                {pc.zero}
              </Txt>
            </View>
          </Row>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {tiles.map((t) => (
            <Pressable key={t.label} accessibilityRole="button" onPress={gate} style={{ flexBasis: '47%', flexGrow: 1, height: 140, padding: 14, borderRadius: 22, backgroundColor: t.bg, opacity: 0.85 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.dot, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={t.icon} size={30} color="#FFFFFF" />
              </View>
              <View style={{ marginTop: 'auto' }}>
                <Txt size={24} w="800">
                  {t.label}
                </Txt>
                <Txt size={16} color="text2">
                  {t.note}
                </Txt>
              </View>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={() => go('details', { gateOpen: false })} style={{ borderRadius: 20, backgroundColor: c.warnBg, borderWidth: 3, borderColor: c.orange, padding: 14, gap: 2 }}>
          <Txt size={20} w="800">
            Complete your profile
          </Txt>
          <Txt size={16} color="text2">
            Add your details and ID to start using your money.
          </Txt>
        </Pressable>
      </ScrollView>
      <BottomNav active="home" />
      <Sheet open={s.gateOpen} onClose={() => up({ gateOpen: false })}>
        <H2>Complete your profile first</H2>
        <P>You can move money and add wallets after Palpeer checks your details and ID.</P>
        <Btn label="Complete your profile" onPress={() => go('details', { gateOpen: false })} />
        <Btn kind="outline" size="mid" label="Not now" onPress={() => up({ gateOpen: false })} />
      </Sheet>
    </SafeAreaView>
  );
}

/** Step 1: about you (18+). */
export function Details({ s, up, go, say, busy }: StartCtx) {
  const c = useC();
  const age = ageOf(s.dob);
  const dobMaxDate = useMemo(() => defaultDateOfBirth(ABOUT_YOU_MIN_AGE), []);
  const tooYoung = age >= 0 && age < ABOUT_YOU_MIN_AGE;
  const ok = !!s.fname.trim() && !!s.lname.trim() && age >= ABOUT_YOU_MIN_AGE && !!s.job.trim();
  return (
    <Screen scroll>
      <StepHead n={1} onBack={() => go('home')} say={say} />
      <H1>About you</H1>
      <P>Write it the same way as on your ID.</P>
      <Card>
        <Field label="First name" value={s.fname} onChangeText={(v) => up({ fname: v })} />
        <Field label="Last name" value={s.lname} onChangeText={(v) => up({ lname: v })} />
        <DateOfBirthField
          label="Date of birth"
          value={s.dob}
          onChange={(display) => up({ dob: display })}
          defaultPickerDate={dobMaxDate}
          maximumDate={dobMaxDate}
          error={tooYoung ? 'You must be 18 or older.' : null}
          testID="about-dob"
        />
        <View style={{ gap: 6 }}>
          <Txt size={16} w="700">
            My job
          </Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose your job type"
            onPress={() => up({ pickOpen: 'job' })}
            style={{
              minHeight: 52,
              borderRadius: 14,
              backgroundColor: c.field,
              paddingHorizontal: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Txt size={18} w="700" color={s.job ? 'text' : 'text4'} style={{ flex: 1 }} noTr={!!s.job}>
              {s.job || 'Choose your job type'}
            </Txt>
            <Icon name="down" size={20} color={c.text} />
          </Pressable>
        </View>
      </Card>
      <View style={{ flex: 1 }} />
      <Btn label="Continue" busy={busy} disabled={!ok} onPress={() => go('where')} />
      <Sheet open={s.pickOpen === 'job'} onClose={() => up({ pickOpen: '' })} title="My job">
        {JOB_OPTIONS.map((o) => (
          <Choice
            key={o.key}
            title={o.title}
            on={o.title === s.job}
            onPress={() => up({ job: o.title, pickOpen: '' })}
            minH={56}
          />
        ))}
      </Sheet>
    </Screen>
  );
}

/** Step 2: where you live (country, province/state, address, postal code where needed). */
export function Where({ s, up, go, say, busy, backend }: StartCtx) {
  const c = useC();
  const lc = countryOf(s.live);
  const provs = PROVINCES[s.live];
  const ok = !!s.prov.trim() && !!s.addr1.trim() && !!s.city.trim() && (!lc.postal || !!s.postal.trim());
  const [locBusy, setLocBusy] = useState(false);
  const [addrMsg, setAddrMsg] = useState<string | null>(null);

  const applyAddress = useCallback(
    (address: StructuredAddress) => {
      const liveId = (address.countryCode || s.live || 'ca').toLowerCase();
      const known = COUNTRIES.some((country) => country.id === liveId);
      const nextLive = known ? liveId : s.live;
      up({
        addr1: address.addressLine1 || '',
        addr2: address.addressLine2 || '',
        city: address.city || '',
        postal: address.postalCode || '',
        live: nextLive,
        prov: provinceFromAddress(nextLive, address.stateTerritory),
      });
      setAddrMsg(null);
    },
    [s.live, up],
  );

  const useLocation = useCallback(async () => {
    if (!backend) {
      up({
        addr1: '12 Sample Street',
        city: 'Sample City',
        prov: lc.sample,
        postal: lc.postal ? 'A1A 1A1' : '',
      });
      setAddrMsg(null);
      return;
    }
    setLocBusy(true);
    setAddrMsg(null);
    try {
      const result = await pickupCurrentAddress();
      if (!result.ok) {
        setAddrMsg(result.message || 'Could not use your location.');
        return;
      }
      applyAddress(result.address);
    } finally {
      setLocBusy(false);
    }
  }, [applyAddress, backend, lc.postal, lc.sample, up]);

  return (
    <Screen scroll>
      <StepHead n={2} onBack={() => go('details')} say={say} />
      <H1>Where you live</H1>
      <Card>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose your country" onPress={() => up({ pickOpen: 'live' })} style={{ minHeight: 60, borderRadius: 14, backgroundColor: c.field, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Flag cc={lc.cc} w={38} />
          <Txt size={18} w="800" style={{ flex: 1 }}>
            {lc.name}
          </Txt>
          <Icon name="down" size={20} color={c.text} />
        </Pressable>
        <Btn
          kind="outline"
          size="small"
          label={locBusy ? 'Finding address…' : 'Use where you are now'}
          busy={locBusy}
          disabled={locBusy}
          onPress={() => {
            void useLocation();
          }}
        />
        {addrMsg ? (
          <Txt size={15} w="700" color="red" role="alert">
            {addrMsg}
          </Txt>
        ) : null}
        {provs ? (
          <View style={{ gap: 6 }}>
            <Txt size={16} w="700">
              {lc.provName}
            </Txt>
            <Pressable accessibilityRole="button" onPress={() => up({ pickOpen: 'prov' })} style={{ minHeight: 52, borderRadius: 14, backgroundColor: c.field, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}>
              <Txt size={18} w="700" style={{ flex: 1 }}>
                {s.prov || 'Choose'}
              </Txt>
              <Icon name="down" size={20} color={c.text} />
            </Pressable>
          </View>
        ) : (
          <Field label={lc.provName} value={s.prov} onChangeText={(v) => up({ prov: v })} />
        )}
        <DesignAddressField
          label="House number and street"
          value={s.addr1}
          onChangeText={(text) => {
            up({ addr1: text });
            setAddrMsg(null);
          }}
          countryCode={lc.cc}
          onPick={applyAddress}
          testID="where-address1"
        />
        <Field label="Apartment (if you have one)" value={s.addr2} onChangeText={(v) => up({ addr2: v })} />
        <Row gap={8} style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Field label="City" value={s.city} onChangeText={(v) => up({ city: v })} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={lc.postal ? 'Postal code' : 'Postal code (if any)'} value={s.postal} onChangeText={(v) => up({ postal: v })} autoCapitalize="characters" />
          </View>
        </Row>
      </Card>
      <Btn label="Continue" busy={busy} disabled={!ok} onPress={() => go('money')} />
      <Sheet open={s.pickOpen === 'live' || s.pickOpen === 'prov'} onClose={() => up({ pickOpen: '' })} title={s.pickOpen === 'prov' ? lc.provName : 'Choose your country'}>
        {s.pickOpen === 'prov'
          ? (provs || []).map((p) => <Choice key={p} title={p} on={p === s.prov} onPress={() => up({ prov: p, pickOpen: '' })} minH={56} />)
          : COUNTRIES.map((k) => <Choice key={k.id} title={k.name} icon={<Flag cc={k.cc} w={38} />} on={k.id === s.live} onPress={() => up({ live: k.id, prov: '', postal: '', pickOpen: '' })} minH={60} />)}
      </Sheet>
    </Screen>
  );
}

/** Step 3: source of funds and monthly amount (in the phone country's currency). */
export function Money({ s, up, go, say, busy, onProfileContinue }: StartCtx) {
  const c = useC();
  const chip = (text: string, on: boolean, onPress: () => void) => (
    <Pressable key={text} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={onPress} style={{ minHeight: 52, paddingHorizontal: 14, borderRadius: 16, backgroundColor: c.card, borderWidth: 3, borderColor: on ? c.brandText : 'transparent', justifyContent: 'center' }}>
      <Txt size={17} w="800" noTr={/\d/.test(text) && !/to|More/.test(text)}>
        {text}
      </Txt>
    </Pressable>
  );
  return (
    <Screen scroll>
      <StepHead n={3} onBack={() => go('where')} say={say} />
      <H1>My wallet</H1>
      <P>Palpeer needs this to follow the rules.</P>
      <H2>What is your source of funds?</H2>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{INCOMES.map((t) => chip(t, s.income === t, () => up({ income: t })))}</View>
      <H2>How much will you move each month?</H2>
      <View style={{ gap: 8 }}>{monthRanges(countryOf(s.country)).map((t, i) => chip(t, s.month === i, () => up({ month: i })))}</View>
      <Btn
        label="Continue"
        busy={busy}
        disabled={!s.income}
        onPress={async () => {
          if (onProfileContinue) await onProfileContinue();
          else go('idChoose');
        }}
      />
    </Screen>
  );
}

/** Step 4a: choose the ID type. */
export function IdChoose({ go, say, backend, onPickDocumentType }: StartCtx) {
  return (
    <Screen scroll>
      <StepHead n={4} onBack={() => go('money')} say={say} />
      <H1>Choose your ID</H1>
      <P>It must be from the government and have your photo.</P>
      {ID_TYPES.map((d, i) => (
        <Choice
          key={d.name}
          title={d.name}
          note={d.hint}
          icon={<Icon name="idcard" size={34} />}
          onPress={() => {
            if (backend && onPickDocumentType) onPickDocumentType(DOC_TYPES[i] ?? DOC_TYPES[0]);
            go('kyc', { idType: i, idDone: false, selfieDone: false });
          }}
          right={null}
        />
      ))}
    </Screen>
  );
}

/** Step 4b: ID photo, live selfie, name edit, consent. ComplyCube checks it. */
export function Kyc({ s, up, go, say, backend, busy, onUploadDocument, onUploadSelfie, onSubmitKyc, kycBusy, authMsg }: StartCtx) {
  const c = useC();
  const t = useT();
  const tv = useTv();
  const [idPhotoOpen, setIdPhotoOpen] = useState(false);
  const id = ID_TYPES[s.idType] ?? ID_TYPES[0]!;
  const docType = DOC_TYPES[s.idType] ?? DOC_TYPES[0]!;
  const ok = s.idDone && s.selfieDone && s.agree;
  const word = (d: boolean) => (
    <Txt size={16} w="800" color="brandText">
      {d ? 'Done' : 'Take photo'}
    </Txt>
  );
  return (
    <Screen scroll>
      <StepHead n={4} onBack={() => go('idChoose')} say={say} />
      <H1>Show your ID</H1>
      <Choice
        title="Photo of your ID"
        note={tv('{0}: {1}', t(id.name), t(id.hint))}
        on={s.idDone}
        onPress={() => {
          if (backend && onUploadDocument) {
            setIdPhotoOpen(true);
            return;
          }
          up({ idDone: !s.idDone });
        }}
        right={word(s.idDone)}
      />
      <Choice
        title="Live photo of your face"
        note="Look at the camera"
        on={s.selfieDone}
        onPress={() => {
          if (backend && onUploadSelfie) void onUploadSelfie();
          else up({ selfieDone: !s.selfieDone });
        }}
        right={word(s.selfieDone)}
      />
      <Card>
        <Row between>
          <Txt size={17} w="600" style={{ flex: 1 }} noTr>
            {tv('Name on your ID: {0}', s.fname + ' ' + s.lname)}
          </Txt>
          <Btn kind="outline" size="small" label={s.nameEdit ? 'Done' : 'Change name'} onPress={() => up({ nameEdit: !s.nameEdit })} />
        </Row>
        {s.nameEdit ? (
          <>
            <Txt size={15} w="700" color="orange">
              Write it exactly as on your ID.
            </Txt>
            <Field label="First name" value={s.fname} onChangeText={(v) => up({ fname: v })} />
            <Field label="Last name" value={s.lname} onChangeText={(v) => up({ lname: v })} />
          </>
        ) : null}
      </Card>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: s.agree }} onPress={() => up({ agree: !s.agree })} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 18, backgroundColor: c.card, padding: 14, borderWidth: 3, borderColor: s.agree ? c.brandText : 'transparent' }}>
        <View style={{ width: 32, height: 32, borderRadius: 8, borderWidth: 3, borderColor: c.text, alignItems: 'center', justifyContent: 'center', backgroundColor: s.agree ? c.brand : 'transparent' }}>
          {s.agree ? <Icon name="check" size={22} color="#FFFFFF" /> : null}
        </View>
        <Txt size={16} w="700" style={{ flex: 1 }}>
          This account is for you. Palpeer and ComplyCube can check your details, ID and face.
        </Txt>
      </Pressable>
      {authMsg ? (
        <Txt size={16} w="700" color="red" role="alert">
          {authMsg}
        </Txt>
      ) : null}
      <Btn
        label="Send to Palpeer"
        busy={!!busy || !!kycBusy}
        disabled={!ok}
        onPress={async () => {
          if (backend && onSubmitKyc) {
            const r = await onSubmitKyc();
            if (r && typeof r === 'object' && 'ok' in r && r.ok === false) return;
            // Bridge starts verification + replace; go/replace keep UI on the checking page.
            go('checking');
            router.replace('/StartChecking');
            return;
          }
          go('checking');
          setTimeout(() => go(s.fails >= 3 ? 'kycStop' : s.fails > 0 ? 'kycFail' : 'verified'), 2500);
        }}
      />
      <Sheet open={idPhotoOpen} onClose={() => setIdPhotoOpen(false)} title="Photo of your ID">
        <Choice
          title="Take photo"
          note="Use your camera"
          icon={<Icon name="idcard" size={28} />}
          onPress={() => {
            setIdPhotoOpen(false);
            void onUploadDocument?.(docType, 'camera');
          }}
          right={null}
          minH={60}
        />
        <Choice
          title="Upload image"
          note="Choose a photo from your device"
          icon={<Icon name="idcard" size={28} />}
          onPress={() => {
            setIdPhotoOpen(false);
            void onUploadDocument?.(docType, 'library');
          }}
          right={null}
          minH={60}
        />
      </Sheet>
    </Screen>
  );
}

export function Checking() {
  return (
    <Screen>
      <Loading title="Palpeer is checking" text="You will get a message when it is done." />
    </Screen>
  );
}

export function Verified({ backend, verifiedGoHome }: StartCtx) {
  const st = useStore();
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Circle icon="check" />
        <H1 center>You are verified</H1>
        <P center>You can now add money, change, send, withdraw and add wallets.</P>
      </View>
      <Btn
        label="Go to Home"
        onPress={() => {
          if (backend && verifiedGoHome) {
            verifiedGoHome();
            return;
          }
          st.set({ verified: true, signedIn: true });
          router.replace('/Main');
        }}
      />
    </Screen>
  );
}

/** ID check failed: email sent, 3 tries in all. */
export function KycFail({ s, go, say }: StartCtx) {
  const left = 3 - s.fails;
  return (
    <Screen>
      <TopBar onBack={false} say={say} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Circle icon="close" bg="#B3231A" />
        <H1 center>Your ID check did not pass</H1>
        <P center>{'Palpeer sent you an email. You have ' + left + (left === 1 ? ' more try.' : ' more tries.')}</P>
      </View>
      <Btn label="Try again" onPress={() => go('idChoose', { idDone: false, selfieDone: false, agree: false, fails: s.fails + 1 >= 3 ? 3 : s.fails + 1 })} />
      <Btn kind="outline" size="mid" label="Not now" onPress={() => go('home')} />
    </Screen>
  );
}

/** 3 failed ID checks: blocked until customer service clears the user. */
export function KycStop({ go, say }: StartCtx) {
  return (
    <Screen>
      <TopBar onBack={false} say={say} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Circle icon="lock" bg="#B3231A" />
        <H1 center>Your ID check did not pass 3 times</H1>
        <P center>Palpeer sent you an email. Your 3 tries are used. You cannot move money until customer service clears you.</P>
      </View>
      <Btn label="Contact customer service" onPress={() => Linking.openURL('mailto:support@palpeer.com').catch(() => {})} />
      <Btn kind="outline" size="mid" label="Go to Home" onPress={() => go('home')} />
    </Screen>
  );
}

/** Face or fingerprint failed: answer the security questions, then make a PIN. */
export function BioFail({ say }: StartCtx) {
  return (
    <Screen>
      <TopBar onBack={false} say={say} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Circle icon="finger" bg="#B3231A" />
        <H1 center>Your face or fingerprint did not work</H1>
        <P center>No money moved. Answer your 2 security questions, then make a PIN.</P>
      </View>
      <Btn label="Answer your questions" onPress={() => router.push('/PinReset')} />
    </Screen>
  );
}
