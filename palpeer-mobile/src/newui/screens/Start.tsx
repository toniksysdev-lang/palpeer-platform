import * as LocalAuthentication from 'expo-local-authentication';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Linking, Pressable, ScrollView, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOptionalNumberPad } from '@/components/ui/NumberPadContext';
import { formatPhoneDisplay, normalizePhoneInput, PHONE_MAX_LEN } from '@/newui/lib/phone';
import {
  COUNTRIES,
  countryOf,
  LAND_HERO,
  landFlagSpots,
  leftLabel,
  leftSeconds,
  OFFERS,
  QUESTIONS,
  SAMPLE,
  type StartState,
} from '@/newui/features/start/data';
import { GLOBE_XML } from '@/newui/features/start/globe';
import {
  BioFail,
  Checking,
  Details,
  FirstHome,
  IdChoose,
  Kyc,
  KycFail,
  KycStop,
  Money,
  type StartCtx,
  Verified,
  Where,
} from '@/newui/features/start/Profile';
import { useTv } from '@/newui/lib/i18n';
import { useLayout } from '@/newui/lib/layout';
import { useListen } from '@/newui/lib/speech';
import { useStore } from '@/newui/lib/store';
import { useTheme } from '@/newui/lib/theme';
import { Icon } from '@/newui/ui/Icon';
import { Badge, Btn, Card, Choice, Circle, Divider, Dots, Field, Flag, flagSource, H1, H2, NumberPadSlot, P, PinPad, Pill, Row, Screen, Sheet, TopBar, Txt } from '@/newui/ui/kit';
import { useAppSelector } from '@/store';

const LOGO = require('@/newui/assets/logo.png');

const DOC_TYPES = ['PASSPORT', 'NATIONAL_ID', 'DRIVING_LICENSE', 'RESIDENCE_PERMIT'] as const;
const BLANK_AUTH: Partial<StartState> = {
  phone: '',
  pcode: '',
  ecode: '',
  mail: '',
  uname: '',
  pw1: '',
  pw2: '',
  who: '',
  pass: '',
  fmail: '',
  fcode: '',
  np1: '',
  np2: '',
  a1: '',
  a2: '',
  pinA: '',
  pinB: '',
  fname: '',
  lname: '',
  dob: '',
  job: '',
  addr1: '',
  addr2: '',
  city: '',
  postal: '',
  income: '',
  month: 0,
  bizMail: '',
  refer: '',
};
const sampleFor = (backend?: boolean) => ({ ...SAMPLE, ...(backend ? BLANK_AUTH : {}) });

type OkErr = { ok: true } | { ok: false; error: string };

export type StartProps = {
  backend?: boolean;
  stage?: string;
  tab?: string;
  country?: string;
  gate?: boolean;
  fails?: number;
  sheet?: number;
  empty?: boolean;
  look?: 'light' | 'dark';
  onLookChange?: (next: 'light' | 'dark') => void;
  go?: (href: string) => void;
  username?: string;
  uname?: string;
  fname?: string;
  lname?: string;
  gateOpen?: boolean;
  setupRequired?: boolean;
  registrationCountries?: string[];
  authError?: string | null;
  securityError?: string | null;
  kycError?: string | null;
  loginError?: string | null;
  authBusy?: boolean;
  securityBusy?: boolean;
  kycBusy?: boolean;
  loginBusy?: boolean;
  ratesEmpty?: boolean;
  ratesLoading?: boolean;
  ratesError?: string | null;
  refetchRates?: () => void;
  liveOffers?: {
    id?: string;
    rate: number;
    amt: number;
    left: number;
    ca: boolean;
    amountLabel?: string;
    expiresAt?: string | null;
  }[];
  adminRate?: { ready?: boolean; getNgn: string; getCad: string };
  idDone?: boolean;
  selfieDone?: boolean;
  clearAuthError?: () => void;
  clearKycError?: () => void;
  clearSecurityError?: () => void;
  clearLoginError?: () => void;
  onLogin?: (who: string, pass: string) => Promise<boolean>;
  goAfterLogin?: (where?: 'home' | 'buy' | 'help') => void;
  onRequestPhoneOtp?: (phone: string, dial?: string) => Promise<OkErr>;
  onVerifyPhoneOtp?: (phone: string, code: string, dial?: string) => Promise<OkErr>;
  onRegister?: (input: {
    email: string;
    username: string;
    password: string;
    nationalPhone: string;
    dialCode?: string;
  }) => Promise<OkErr>;
  onVerifyEmailOtp?: (email: string, code: string) => Promise<OkErr>;
  onResendEmailOtp?: (phone: string, dial?: string) => Promise<OkErr>;
  onRequestPasswordReset?: (email: string) => Promise<OkErr>;
  onConfirmPasswordReset?: (email: string, code: string, newPassword: string) => Promise<OkErr>;
  onSubmitBusinessInterest?: (email: string) => Promise<OkErr>;
  onSetPin?: (pin: string) => Promise<OkErr>;
  onSetQuestions?: (input: { q1Index: number; q2Index: number; a1: string; a2: string }) => Promise<OkErr>;
  onSaveProfile?: (input: {
    fname: string;
    lname: string;
    dob: string;
    job: string;
    income: string;
    month: number;
    live: string;
    prov: string;
    addr1: string;
    addr2: string;
    city: string;
    postal: string;
  }) => Promise<OkErr>;
  onPickDocumentType?: (documentType: string) => void;
  onUploadDocument?: (
    documentType?: string,
    start?: 'camera' | 'library',
  ) => Promise<OkErr | void>;
  onUploadSelfie?: () => Promise<OkErr | void>;
  onSubmitKyc?: () => Promise<OkErr | void>;
  onAfterPinSet?: () => void;
  onSetupComplete?: () => void;
};
const mailOk = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
const digits = (v: string) => v.replace(/[^0-9]/g, '');

/** Speech for each stage of the start flow. */
const speechFor = (st: string, s: StartState, people: boolean, left: number) =>
  ({
    land: 'Welcome to Palpeer. Change your money, easy and safe. Press Get started, See best rate now, or Log in. Press Dark or Light to change the screen.',
    rates: people ? 'These are rates from offers people posted. Press Click to buy, then log in.' : 'This rate is set by Palpeer. If you give 1 Canada dollar, you get 900 naira. If you give 1000 naira, you get 1 Canada dollar.',
    login: (s.wantHelp ? 'Log in to get help. ' : s.created ? 'Your account is ready. ' : '') + 'Log in with your email or phone, and your password. Or use your fingerprint or face.',
    type: 'Who is this account for? Press Me for yourself, or My business for a company.',
    biz: 'Business accounts are not ready yet. Type your email, and we will tell you when it is ready.',
    bizDone: 'Thank you. We will email you when business accounts are ready.',
    forgot: 'You forgot your password. Type your email. We will send you a 6-digit code.',
    forgotCode: 'If this email has an account, a code is coming. Type the 6-digit code. The code ends in 10 minutes.',
    forgotNew: 'Make a new password with at least 8 letters or numbers. You will be logged out on all your phones.',
    elsewhere: 'This account is open on another phone. Only one phone can be signed in at a time. Log out on that phone first.',
    move: 'Move your account to this phone. Type the 6-digit code we sent by text to your phone number.',
    moveQ: 'Answer your 2 security questions.',
    moveDone: 'This is now your phone. Your old phone is signed out. For safety, withdrawing, sending and changing money pause for 24 hours. Log in and set your PIN or fingerprint.',
    moveStuck: 'Your answers were wrong 3 times. Customer service must help. Email support at palpeer dot com.',
    phone: 'Choose your country, and type your phone number. We will send you a code.',
    phoneCode: 'We sent a 6-digit code to your phone. Type it here. Or press Skip Code to continue without the code.',
    account: 'Create your account. Type your email, a username and a password. A friend code is not needed.',
    emailCode: 'We sent a 6-digit code to your email. Type it here.',
    method: 'How do you want to keep your account safe? Choose a 4 number PIN, or your face or fingerprint.',
    pinSet: 'Make a PIN with 4 numbers. Do not tell anyone.',
    pinAgain: 'Type the same 4 numbers again.',
    bio: 'Use your face or fingerprint. Press Turn it on.',
    questions: 'Choose 2 questions only you can answer, and type your answers.',
    home: 'This is your home. You have one wallet. Press Complete your profile to add your details and ID. You must do this before you can move money or add a wallet.',
    details: 'Step 1 of 4. Type your name, date of birth and job, the same way as on your ID.',
    where: 'Step 2 of 4. Tell us where you live.',
    money: 'Step 3 of 4. Say where your money comes from, and how much you will move each month.',
    idChoose: 'Step 4 of 4. Choose your ID.',
    kyc: 'Take a photo of your ID, and a live photo of your face. If the name on your ID is different, press Change name. Then agree and send.',
    checking: 'Palpeer is checking your details.',
    verified: 'You are verified. You can now use your money.',
    kycFail: 'Your ID check did not pass. We sent you an email. You have ' + left + (left === 1 ? ' more try.' : ' more tries.'),
    kycStop: 'Your ID check did not pass 3 times. We sent you an email. You cannot move money until customer service clears you.',
    bioFail: 'Your face or fingerprint did not work. No money moved. Answer your 2 security questions, then make a PIN.',
  })[st] || '';

/**
 * Start flow: landing, best rate now, log in, forgot password, individual or business, phone and email codes,
 * account, PIN or biometrics, security questions, first home, profile and ID check, new-phone move.
 * Demo links: /start?stage=elsewhere (account open on another phone), /start?stage=kyc&fails=1 (ID check fails).
 */
/** Start flow — new UI wired to useLiveStart (and related bridges). */
export default function Start(props: StartProps) {
  const { c, look, setLook } = useTheme();
  const { s: sz, page, width: winW, height: winH } = useLayout();
  const store = useStore();
  const { listen, listenLabel } = useListen();
  const tv = useTv();
  /** Only show fingerprint/face login when Face or Fingerprint unlock is enabled. */
  const biometricUnlockOn = useAppSelector((state) => state.appLock.biometricEnabled);
  // Cap globe art so short phones (SE / Flip) still leave room for CTAs.
  const heroW = Math.min(320, Math.max(220, winW - 48));
  const heightBudget = Math.max(0.55, Math.min(1, (winH - 280) / 320));
  const heroScale = Math.min(heroW / 320, heightBudget);
  const logoW = Math.min(200, Math.round(230 * heroScale));
  const logoH = Math.round(logoW * (105 / 250));
  const p = useLocalSearchParams<{ stage?: string; tab?: string; country?: string; gate?: string; fails?: string; buying?: string }>();
  const staticStage = props.stage ?? p.stage ?? 'land';
  const [stage, setStage] = useState(staticStage);
  const countryId = props.country || p.country || 'ca';
  const [s, setS] = useState<StartState>(() => ({
    ...sampleFor(props.backend),
    tab: (props.tab ?? p.tab) === 'admin' ? 'admin' : 'people',
    country: countryId,
    live: countryId,
    prov: countryOf(countryId).sample,
    gateOpen: props.gate ?? !!p.gate,
    fails: props.fails ?? Number(p.fails || 0),
    buying: !!p.buying,
    uname: (props.uname || props.username || '').trim() || sampleFor(props.backend).uname,
    fname: props.fname?.trim() || sampleFor(props.backend).fname,
    lname: props.lname?.trim() || sampleFor(props.backend).lname,
    qSheet: props.sheet || 0,
  }));
  const [left, setLeft] = useState(0);
  const [clock, setClock] = useState(0);
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const numberPad = useOptionalNumberPad();
  const phonePadOpen = numberPad?.active?.id === 'signup-phone';
  const forgotCodePadOpen = numberPad?.active?.id === 'forgot-code';
  const otpCodePadOpen = numberPad?.active?.id === 'otp-code';

  useEffect(() => {
    if (props.stage) setStage(props.stage);
  }, [props.stage]);
  useEffect(() => {
    if (props.look === 'light' || props.look === 'dark') setLook(props.look);
  }, [props.look, setLook]);
  useEffect(() => {
    if (!props.backend) return;
    setS((o) => ({
      ...o,
      ...(typeof props.idDone === 'boolean' ? { idDone: props.idDone } : {}),
      ...(typeof props.selfieDone === 'boolean' ? { selfieDone: props.selfieDone } : {}),
    }));
  }, [props.backend, props.idDone, props.selfieDone]);

  const dial = countryOf(s.country).dial;
  const phoneCountries = props.registrationCountries?.length
    ? COUNTRIES.filter((k) => props.registrationCountries!.includes(k.cc))
    : COUNTRIES;
  /**
   * Landing orbit flags — enabled ISO2 from Admin → Settings → Registration countries
   * (`GET /public/registration-countries`), preserving admin order. Any world country
   * admin enables can appear (local PNG or flagcdn), not only the dial-list subset.
   */
  const landFlags = useMemo(() => {
    const codes = (props.registrationCountries ?? [])
      .map((cc) => String(cc).trim().toUpperCase())
      .filter((cc) => /^[A-Z]{2}$/.test(cc));
    // While the public API is still loading, keep a short stand-in orbit so the
    // hero isn't empty; once admin countries arrive, those replace the stand-in.
    const source = codes.length ? codes : props.registrationCountries == null ? ['CA', 'NG', 'GH', 'KE'] : [];
    return source.slice(0, 8).map((cc) => ({
      cc,
      name: COUNTRIES.find((k) => k.cc === cc)?.name ?? cc,
    }));
  }, [props.registrationCountries]);
  const landFlagPositions = useMemo(
    () => landFlagSpots(landFlags.length, LAND_HERO.flag),
    [landFlags.length],
  );
  const globeSpin = useRef(new Animated.Value(0)).current;
  const flagOrbit = useRef(new Animated.Value(0)).current;
  const flagPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // Rotate string transforms are unreliable with the native driver on RN web;
    // keep scale on the native driver and drive orbit/globe spin on JS.
    const native = false;
    const globeAnim = Animated.loop(
      Animated.timing(globeSpin, {
        toValue: 1,
        duration: 28_000,
        easing: Easing.linear,
        useNativeDriver: native,
      }),
    );
    const orbitAnim = Animated.loop(
      Animated.timing(flagOrbit, {
        toValue: 1,
        duration: 22_000,
        easing: Easing.linear,
        useNativeDriver: native,
      }),
    );
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(flagPulse, {
          toValue: 1,
          duration: 1_600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(flagPulse, {
          toValue: 0,
          duration: 1_600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    globeAnim.start();
    orbitAnim.start();
    pulseAnim.start();
    return () => {
      globeAnim.stop();
      orbitAnim.stop();
      pulseAnim.stop();
    };
  }, [globeSpin, flagOrbit, flagPulse]);
  const globeRotate = globeSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const flagsOrbitRotate = flagOrbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const flagsCounterRotate = flagOrbit.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });
  const flagPulseScale = flagPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  const up = (patch: Partial<StartState>) => setS((o) => ({ ...o, ...patch }));
  const startTimer = (secs: number) => {
    if (timer.current) clearInterval(timer.current);
    setLeft(secs);
    timer.current = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
  };
  const go = (st: string, patch?: Partial<StartState>, keepErr?: boolean) => {
    if (props.backend && !keepErr) {
      props.clearAuthError?.();
      props.clearKycError?.();
      props.clearSecurityError?.();
    }
    setS((o) => ({ ...o, notice: false, passChanged: false, wantHelp: false, ...(patch || {}) }));
    setStage(st);
    if (st === 'phoneCode' || st === 'emailCode') startTimer(30);
    else if (st === 'forgotCode') startTimer(45);
  };
  useEffect(() => {
    const k = setInterval(() => setClock((x) => x + 1), 1000);
    return () => {
      clearInterval(k);
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const pc = countryOf(s.country);
  const people = s.tab === 'people';
  const say = speechFor(stage, s, people, 3 - s.fails);
  const authMsg = props.backend ? (props.authError || props.securityError || props.kycError || '') : '';
  const busy =
    actionBusy ||
    pinSubmitting ||
    !!props.loginBusy ||
    (!!props.backend && (!!props.authBusy || !!props.securityBusy || !!props.kycBusy));

  const viaApi = async (call: () => Promise<OkErr | void>, onOk: () => void) => {
    setActionBusy(true);
    try {
      const r = await call();
      if (!r || (typeof r === 'object' && 'ok' in r && r.ok)) onOk();
    } finally {
      setActionBusy(false);
    }
  };

  const enterApp = () => {
    if (props.backend && props.goAfterLogin) {
      if (s.wantHelp) props.goAfterLogin('help');
      else if (s.buying) props.goAfterLogin('buy');
      else props.goAfterLogin('home');
      return;
    }
    store.set({ signedIn: true });
    if (s.wantHelp) router.replace('/MoreHelp');
    else if (s.buying) router.replace('/People');
    else router.replace('/Main');
  };

  /** Always authenticate against the API when live; never skip password checks. */
  const doLogin = async () => {
    if (props.backend) {
      if (!props.onLogin) return;
      props.clearLoginError?.();
      const ok = await props.onLogin(s.who, s.pass);
      if (!ok) return;
      // Post-signup: credentials verified → set PIN / biometrics next.
      if (s.created) {
        go('method');
        return;
      }
      enterApp();
      return;
    }
    // Design-only preview without API.
    if (s.created) {
      go('method');
      return;
    }
    enterApp();
  };

  const bioLogin = async () => {
    try {
      const has = await LocalAuthentication.hasHardwareAsync();
      if (!has) {
        props.clearLoginError?.();
        // No biometrics hardware — require password login, do not auto-enter.
        return;
      }
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Palpeer' });
      if (r.success) await doLogin();
    } catch {
      // Keep user on Log in; do not treat biometric failure as a password success.
    }
  };

  const resendCode = async () => {
    if (left > 0) return;
    if (stage === 'emailCode' && props.onResendEmailOtp) {
      const r = await props.onResendEmailOtp(s.phone, dial);
      if (r.ok) startTimer(30);
      return;
    }
    if (props.onRequestPhoneOtp) {
      const r = await props.onRequestPhoneOtp(s.phone, dial);
      if (r.ok) startTimer(stage === 'forgotCode' ? 45 : 30);
    } else startTimer(stage === 'forgotCode' ? 45 : 30);
  };
  const resend = (
    <Btn
      kind="link"
      disabled={left > 0 || busy}
      label={left > 0 ? 'Send code again (' + left + 's)' : 'Send code again'}
      onPress={() => void resendCode()}
    />
  );

  const ctx: StartCtx = {
    s,
    up,
    go,
    say,
    authMsg,
    backend: props.backend,
    busy,
    kycBusy: props.kycBusy,
    onPickDocumentType: props.onPickDocumentType,
    onUploadDocument: props.onUploadDocument
      ? (documentType?: string, start?: 'camera' | 'library') =>
          props.onUploadDocument!(documentType, start)
      : undefined,
    onUploadSelfie: props.onUploadSelfie,
    onSubmitKyc: props.onSubmitKyc ? () => props.onSubmitKyc!() : undefined,
    onProfileContinue: props.backend
      ? async () => {
          if (!props.onSaveProfile) {
            go('idChoose');
            return;
          }
          setActionBusy(true);
          try {
            const r = await props.onSaveProfile({
              fname: s.fname,
              lname: s.lname,
              dob: s.dob,
              job: s.job,
              income: s.income,
              month: s.month,
              live: s.live,
              prov: s.prov,
              addr1: s.addr1,
              addr2: s.addr2,
              city: s.city,
              postal: s.postal,
            });
            if (r.ok) go('idChoose');
          } finally {
            setActionBusy(false);
          }
        }
      : undefined,
    verifiedGoHome: props.backend ? () => router.replace('/Main') : undefined,
  };

  /* ---------- Landing ---------- */
  if (stage === 'land') {
    const landBody = (
      <>
        <View
          style={{
            width: '100%',
            flexShrink: 1,
            minHeight: 0,
            backgroundColor: c.hero,
            borderBottomLeftRadius: sz(32),
            borderBottomRightRadius: sz(32),
            paddingHorizontal: sz(16),
            // Clear the :3333 decorative notch / status island so Dark + Listen stay readable.
            paddingTop: sz(40),
            paddingBottom: sz(16),
            alignItems: 'center',
            gap: sz(4),
          }}
        >
          <Row gap={8} style={{ alignSelf: 'stretch', width: '100%', justifyContent: 'flex-end', zIndex: 2, paddingRight: sz(4) }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={look === 'dark' ? 'Use light screen' : 'Use dark screen'}
              onPress={() => {
                const next = look === 'dark' ? 'light' : 'dark';
                setLook(next);
                props.onLookChange?.(next);
              }}
              style={{ height: sz(44), paddingHorizontal: sz(12), borderRadius: sz(22), backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', flexShrink: 1 }}
            >
              <Txt size={16} w="700" color="#FFFFFF" lines={1}>
                {look === 'dark' ? 'Light' : 'Dark'}
              </Txt>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Listen to this screen" onPress={() => listen(say)} style={{ height: sz(44), paddingHorizontal: sz(12), borderRadius: sz(22), backgroundColor: 'rgba(255,255,255,0.14)', flexDirection: 'row', alignItems: 'center', gap: sz(6), flexShrink: 1 }}>
              <Icon name="listen" size={sz(22)} color="#FFFFFF" />
              <Txt size={16} w="700" color="#FFFFFF" lines={1}>
                {listenLabel}
              </Txt>
            </Pressable>
          </Row>
          <Image source={LOGO} style={{ width: logoW, height: logoH, maxWidth: '100%' }} resizeMode="contain" accessibilityLabel="Palpeer. Your rate, your way." />
          <View
            style={{
              width: Math.round(LAND_HERO.width * heroScale),
              height: Math.round(LAND_HERO.height * heroScale),
              alignSelf: 'center',
              flexShrink: 1,
              overflow: 'visible',
            }}
          >
            <Animated.View
              style={{
                position: 'absolute',
                left: Math.round(62 * heroScale),
                top: Math.round(24 * heroScale),
                width: Math.round(196 * heroScale),
                height: Math.round(196 * heroScale),
                transform: [{ rotate: globeRotate }],
              }}
            >
              <SvgXml xml={GLOBE_XML} width={Math.round(196 * heroScale)} height={Math.round(196 * heroScale)} />
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                transform: [{ rotate: flagsOrbitRotate }],
              }}
            >
              {landFlags.map((k, i) => {
                const spot = landFlagPositions[i]!;
                const flag = Math.round(LAND_HERO.flag * heroScale);
                return (
                  <Animated.View
                    key={`${k.cc}-${i}`}
                    style={{
                      position: 'absolute',
                      left: Math.round(spot[0] * heroScale),
                      top: Math.round(spot[1] * heroScale),
                      width: flag,
                      height: flag,
                      // Keep upright while the ring orbits (JS driver).
                      transform: [{ rotate: flagsCounterRotate }],
                    }}
                  >
                    <Animated.View style={{ width: flag, height: flag, transform: [{ scale: flagPulseScale }] }}>
                      <Image
                        source={flagSource(k.cc)}
                        accessibilityLabel={k.name}
                        style={{
                          width: flag,
                          height: flag,
                          borderRadius: flag / 2,
                          borderWidth: 3,
                          borderColor: '#FFFFFF',
                        }}
                      />
                    </Animated.View>
                  </Animated.View>
                );
              })}
            </Animated.View>
          </View>
        </View>
        <View style={{ flexGrow: 1, flexShrink: 0, width: '100%', padding: sz(16), paddingTop: sz(14), gap: sz(8), justifyContent: 'flex-end' }}>
          <Txt size={winH < 720 ? 24 : 28} w="800" center lh={1.15} role="header">
            Change your money. Easy and safe.
          </Txt>
          <View style={{ height: sz(20) }} />
          <Btn label="Get started" onPress={() => go('type')} />
          <Btn kind="outline" size="mid" label="See best rate now" onPress={() => go('rates')} />
          <Btn kind="link" label="Have an account? Log in" onPress={() => go('login', { created: false, buying: false })} />
        </View>
      </>
    );
    // Prefer flex (no web scrollbar). Only scroll on very short viewports.
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[page, { backgroundColor: c.bg }]}>
        {winH < 620 ? (
          <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={{ flexGrow: 1, width: '100%' }} bounces={false} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
            {landBody}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, width: '100%', minHeight: 0 }}>{landBody}</View>
        )}
      </SafeAreaView>
    );
  }

  /* ---------- Best rate now (no login) — live /public/p2p-rates + /public/instant-rates ---------- */
  if (stage === 'rates') {
    void clock; // keep tick so expiry labels re-render each second
    const livePeople = props.backend ? (props.liveOffers ?? []) : OFFERS;
    const peopleEmpty =
      props.backend &&
      !props.ratesLoading &&
      (props.empty || props.ratesEmpty || livePeople.length === 0);
    const adminReady = props.backend ? !!props.adminRate?.ready : true;
    const adminGiveGet: readonly [string, string][] = [
      ['CA$1', props.backend ? (props.adminRate?.getNgn ?? '₦—') : (props.adminRate?.getNgn ?? '₦900')],
      ['₦1,000', props.backend ? (props.adminRate?.getCad ?? 'CA$—') : (props.adminRate?.getCad ?? 'CA$1')],
    ];
    return (
      <Screen>
        <TopBar onBack={() => go('land')} say={say} />
        <H1>Best rate now</H1>
        <P>You can look without an account.</P>
        <Row gap={4} style={{ backgroundColor: c.card, borderRadius: sz(16), padding: sz(4), width: '100%' }}>
          {(['people', 'admin'] as const).map((k) => (
            <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: s.tab === k }} onPress={() => up({ tab: k })} style={{ flex: 1, minHeight: sz(52), borderRadius: sz(13), backgroundColor: s.tab === k ? c.brand : 'transparent', alignItems: 'center', justifyContent: 'center', minWidth: 0, paddingHorizontal: sz(4) }}>
              <Txt size={17} w="800" color={s.tab === k ? '#FFFFFF' : c.text} center lines={1}>
                {k === 'people' ? "People's offers" : 'Palpeer rate'}
              </Txt>
            </Pressable>
          ))}
        </Row>
        <ScrollView contentContainerStyle={{ gap: sz(8), width: '100%' }} style={{ flex: 1, width: '100%' }} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
          {props.backend && props.ratesError ? (
            <Card>
              <Txt size={16} color="red" center>
                {props.ratesError}
              </Txt>
              <Btn
                kind="outline"
                size="mid"
                label="Try again"
                onPress={() => props.refetchRates?.()}
                style={{ marginTop: sz(8) }}
              />
            </Card>
          ) : null}
          {people ? (
            props.backend && props.ratesLoading && !livePeople.length ? (
              <Card>
                <Txt size={16} color="text2" center>
                  Loading people's offers…
                </Txt>
              </Card>
            ) : peopleEmpty ? (
              <Card>
                <Txt size={18} w="800" center>
                  No people's offers right now
                </Txt>
                <Txt size={15} color="text2" center>
                  Open offers will show here when someone posts one. Check the Palpeer rate, or log in later.
                </Txt>
              </Card>
            ) : (
              livePeople.map((o, i) => {
                const amt: string =
                  'amountLabel' in o && typeof o.amountLabel === 'string' && o.amountLabel
                    ? o.amountLabel
                    : 'Selling ' + (o.ca ? 'CA$' : '₦') + o.amt.toLocaleString('en-CA');
                const remain =
                  props.backend && 'expiresAt' in o && o.expiresAt
                    ? leftSeconds(o.expiresAt)
                    : o.left - clock;
                return (
                  <Row
                    key={'id' in o && o.id ? o.id : i}
                    gap={10}
                    style={{
                      minHeight: sz(88),
                      borderRadius: sz(16),
                      backgroundColor: c.card,
                      paddingVertical: sz(8),
                      paddingLeft: sz(12),
                      paddingRight: sz(10),
                      width: '100%',
                    }}
                  >
                    <Flag cc={o.ca ? 'CA' : 'NG'} w={40} h={28} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt size={19} w="800" noTr>
                        {'CA$1 = ₦' + o.rate}
                      </Txt>
                      <Txt size={15} color="text2">
                        {amt}
                      </Txt>
                      <Txt size={15} w="700" color="orange">
                        {leftLabel(remain)}
                      </Txt>
                    </View>
                    <Btn
                      size="small"
                      label="Click to buy"
                      a11y={'Click to buy. ' + amt}
                      onPress={() => go('login', { buying: true, created: false })}
                      style={{ flexShrink: 0 }}
                    />
                  </Row>
                );
              })
            )
          ) : props.backend && props.ratesLoading && !adminReady ? (
            <Card>
              <Txt size={16} color="text2" center>
                Loading Palpeer rate…
              </Txt>
            </Card>
          ) : props.backend && !adminReady ? (
            <Card>
              <Txt size={18} w="800" center>
                Palpeer rate not published yet
              </Txt>
              <Txt size={15} color="text2" center>
                The CAD/NGN InstantEX rate will show here once an admin publishes it.
              </Txt>
            </Card>
          ) : (
            <>
              <Card>
                {adminGiveGet.map(([g, w], i) => (
                  <View key={g} style={{ gap: 14 }}>
                    {i ? <Divider /> : null}
                    <Row between>
                      <View>
                        <Txt size={16} color="text2">
                          You give
                        </Txt>
                        <Txt size={26} w="800" noTr>
                          {g}
                        </Txt>
                      </View>
                      <Icon name="arrow" size={28} color={c.brandText} />
                      <View style={{ alignItems: 'flex-end' }}>
                        <Txt size={16} color="text2">
                          You get
                        </Txt>
                        <Txt size={26} w="800" noTr>
                          {w}
                        </Txt>
                      </View>
                    </Row>
                  </View>
                ))}
              </Card>
              <P>Palpeer sets this rate. It can change.</P>
            </>
          )}
        </ScrollView>
        <Btn label="Log in to change money" onPress={() => go('login', { created: false, buying: false })} />
      </Screen>
    );
  }

  /* ---------- Log in ---------- */
  if (stage === 'login') {
    const ok = !!s.who.trim() && !!s.pass;
    return (
      <SafeAreaView edges={['bottom']} style={[page, { backgroundColor: c.bg }]}>
        <SafeAreaView
          edges={['top']}
          style={{
            width: '100%',
            alignSelf: 'stretch',
            backgroundColor: c.hero,
            borderBottomLeftRadius: sz(28),
            borderBottomRightRadius: sz(28),
            paddingHorizontal: sz(16),
            paddingBottom: sz(18),
            alignItems: 'center',
            gap: sz(6),
          }}
        >
          <Row between style={{ alignSelf: 'stretch', width: '100%', paddingTop: sz(8) }}>
            <Pill icon="back" label="Back" onPress={() => go(s.buying ? 'rates' : 'land', { buying: false })} />
            <Pill icon="listen" label={listenLabel} onPress={() => listen(say)} a11y="Listen to this screen" />
          </Row>
          <Image source={LOGO} style={{ width: Math.min(180, logoW), height: Math.round(Math.min(180, logoW) * (76 / 180)) }} resizeMode="contain" accessibilityLabel="Palpeer" />
        </SafeAreaView>
        <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={{ padding: sz(16), paddingTop: sz(14), gap: sz(10), flexGrow: 1, width: '100%' }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
          <H1>Log in</H1>
          {s.wantHelp ? <Badge>Log in to get help.</Badge> : null}
          {s.passChanged ? <Badge>Your password is changed. Log in. For safety, withdrawals pause for 5 hours.</Badge> : null}
          {s.buying ? <Badge>Log in to buy this offer.</Badge> : null}
          {s.created ? <Badge>Your account is ready. Log in.</Badge> : null}
          <Card gap={6}>
            <Field
              label="Email or phone"
              value={s.who}
              onChangeText={(v) => {
                props.clearLoginError?.();
                up({ who: v });
              }}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Field label="Password" value={s.pass} onChangeText={(v) => up({ pass: v })} secureTextEntry={!s.showPw} autoCapitalize="none" />
            <Row between>
              <Btn kind="link" label={s.showPw ? 'Hide' : 'Show'} onPress={() => up({ showPw: !s.showPw })} />
              <Btn kind="link" label="Forgot your password?" onPress={() => go('forgot')} />
            </Row>
            {props.loginError ? (
              <Txt size={16} w="700" color="red" role="alert">
                {props.loginError}
              </Txt>
            ) : null}
          </Card>
          <View style={{ flex: 1 }} />
          <Btn label="Log in" busy={busy} disabled={!ok} onPress={() => void doLogin()} />
          {!s.created && biometricUnlockOn ? (
            <Btn
              kind="outline"
              size="mid"
              label="Use your fingerprint or face"
              icon="finger"
              disabled={busy}
              onPress={() => void bioLogin()}
            />
          ) : null}
          <Row gap={10}>
            <Btn kind="link" label="Get started" onPress={() => go('type')} style={{ flex: 1 }} />
            <Btn kind="link" label="Need help?" onPress={() => up({ wantHelp: true, buying: false, created: false, passChanged: false })} style={{ flex: 1 }} />
          </Row>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ---------- Individual or business ---------- */
  if (stage === 'type')
    return (
      <Screen>
        <TopBar onBack={() => go('land')} say={say} />
        <H1>Who is this account for?</H1>
        <Choice title="Me" note="For yourself, an individual" icon={<Circle icon="person" size={56} iconSize={32} />} onPress={() => go('phone')} right={null} minH={96} />
        <Choice title="My business" note="For a company" icon={<Circle icon="shop" size={56} iconSize={32} bg="#1D5BC7" />} onPress={() => go('biz')} right={null} minH={96} />
      </Screen>
    );
  if (stage === 'biz') {
    const ok = mailOk(s.bizMail);
    return (
      <Screen scroll>
        <TopBar onBack={() => go('type')} say={say} />
        <H1>Business accounts are not ready yet</H1>
        <P>Give us your email. We will tell you when it is ready.</P>
        <Card>
          <Field label="My email" value={s.bizMail} onChangeText={(v) => up({ bizMail: v })} autoCapitalize="none" keyboardType="email-address" />
        </Card>
        <View style={{ flex: 1 }} />
        {authMsg ? (
          <Txt size={16} w="700" color="red" role="alert">
            {authMsg}
          </Txt>
        ) : null}
        <Btn
          label="Get notified when it is ready"
          busy={busy}
          disabled={!ok}
          onPress={() =>
            props.onSubmitBusinessInterest
              ? void viaApi(() => props.onSubmitBusinessInterest!(s.bizMail), () => go('bizDone'))
              : go('bizDone')
          }
        />
      </Screen>
    );
  }
  if (stage === 'bizDone')
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Circle icon="check" />
          <H1 center>Thank you</H1>
          <P center>{'We will email ' + s.bizMail + ' when business accounts are ready.'}</P>
        </View>
        <Btn label="Done" onPress={() => go('land')} />
      </Screen>
    );

  /* ---------- Forgot password ---------- */
  if (stage === 'forgot')
    return (
      <Screen scroll>
        <TopBar onBack={() => go('login')} say={say} />
        <H1>Forgot your password?</H1>
        <P>Palpeer will send a 6-digit code to your email.</P>
        <Card>
          <Field label="My email" value={s.fmail} onChangeText={(v) => up({ fmail: v })} autoCapitalize="none" keyboardType="email-address" />
        </Card>
        <View style={{ flex: 1 }} />
        <Btn
          label="Send your code"
          busy={busy}
          disabled={!mailOk(s.fmail)}
          onPress={() =>
            props.onRequestPasswordReset
              ? void viaApi(() => props.onRequestPasswordReset!(s.fmail), () => go('forgotCode'))
              : go('forgotCode')
          }
        />
      </Screen>
    );
  if (stage === 'forgotCode')
    return (
      <Screen style={{ paddingBottom: 0 }}>
        <TopBar onBack={() => go('forgot')} say={say} />
        {/* When the pad is open, dock the code field just above the keypad (justifyContent — marginTop:auto is ignored on RN web). */}
        <View
          style={{
            flex: 1,
            width: '100%',
            minHeight: 0,
            gap: sz(14),
            justifyContent: forgotCodePadOpen ? 'flex-end' : 'flex-start',
          }}
        >
          {!forgotCodePadOpen ? (
            <>
              <H1>Check your email</H1>
              <P noTr>{tv('If {0} has an account, a code is coming. It ends in 10 minutes.', s.fmail)}</P>
            </>
          ) : null}
          <Card>
            <Field
              label="6-digit code"
              value={s.fcode}
              onChangeText={(v) => up({ fcode: digits(v).slice(0, 6) })}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              big
              center
              maxLength={6}
              padKey="forgot-code"
              autoFocus={forgotCodePadOpen}
            />
            {resend}
          </Card>
          {authMsg ? (
            <Txt size={16} w="700" color="red" role="alert">
              {authMsg}
            </Txt>
          ) : null}
          {!forgotCodePadOpen ? <View style={{ flex: 1, minHeight: 0 }} /> : null}
          <Btn label="Continue" busy={busy} disabled={s.fcode.length !== 6} onPress={() => go('forgotNew')} />
        </View>
        <NumberPadSlot forId="forgot-code" />
      </Screen>
    );
  if (stage === 'forgotNew') {
    const ok = s.np1.length >= 8 && s.np1.length <= 128 && s.np1 === s.np2;
    return (
      <Screen scroll>
        <TopBar onBack={() => go('forgotCode')} say={say} />
        <H1>Make a new password</H1>
        <Card>
          <Field label="New password (at least 8)" value={s.np1} onChangeText={(v) => up({ np1: v })} secureTextEntry={!s.showPw} autoCapitalize="none" maxLength={128} />
          <Field label="Type it again" value={s.np2} onChangeText={(v) => up({ np2: v })} secureTextEntry={!s.showPw} autoCapitalize="none" maxLength={128} />
          <Btn kind="link" label={s.showPw ? 'Hide' : 'Show'} onPress={() => up({ showPw: !s.showPw })} />
          {s.np2 && s.np1 !== s.np2 ? (
            <Txt size={16} w="700" color="red" role="alert">
              The passwords are not the same.
            </Txt>
          ) : null}
        </Card>
        <P>You will be logged out on all your phones.</P>
        <View style={{ flex: 1 }} />
        {authMsg ? (
          <Txt size={16} w="700" color="red" role="alert">
            {authMsg}
          </Txt>
        ) : null}
        <Btn
          label="Change your password"
          busy={busy}
          disabled={!ok}
          onPress={() =>
            props.onConfirmPasswordReset
              ? void viaApi(
                  () => props.onConfirmPasswordReset!(s.fmail, s.fcode, s.np1),
                  () => go('login', { passChanged: true, who: s.fmail, pass: s.np1 }),
                )
              : go('login', { passChanged: true, who: s.fmail, pass: s.np1 })
          }
        />
      </Screen>
    );
  }

  /* ---------- Sign up: phone, code, account, email code ---------- */
  if (stage === 'phone') {
    const ok = s.phone.length === PHONE_MAX_LEN;
    return (
      <Screen style={{ paddingBottom: 0 }}>
        <TopBar onBack={() => go('type')} say={say} />
        {/* When the keypad is open, keep it pinned and let the fields/Continue scroll above it. */}
        <ScrollView
          style={{ flex: 1, width: '100%', minHeight: 0 }}
          contentContainerStyle={{
            flexGrow: 1,
            width: '100%',
            gap: sz(14),
            paddingBottom: phonePadOpen ? sz(10) : 0,
          }}
          scrollEnabled={phonePadOpen}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={phonePadOpen}
          showsHorizontalScrollIndicator={false}
          bounces={phonePadOpen}
        >
          {!phonePadOpen ? (
            <>
              <H1>My phone number</H1>
              <P>We will send a code to your phone.</P>
            </>
          ) : null}
          <Card>
            {!phonePadOpen ? (
              <>
                <Txt size={16} w="700">
                  My country
                </Txt>
                <Pressable accessibilityRole="button" accessibilityLabel="Choose your country" onPress={() => up({ pickOpen: 'phone' })} style={{ minHeight: 60, borderRadius: 14, backgroundColor: c.field, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Flag cc={pc.cc} w={38} />
                  <Txt size={18} w="800" style={{ flex: 1 }}>
                    {pc.name + ' ' + pc.dial}
                  </Txt>
                  <Icon name="down" size={20} color={c.text} />
                </Pressable>
              </>
            ) : null}
            <Field
              label="Phone number"
              value={s.phone}
              onChangeText={(v) => up({ phone: normalizePhoneInput(v) })}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              format="phone"
              maxLength={PHONE_MAX_LEN}
              padKey="signup-phone"
              placeholder={formatPhoneDisplay('5555555555')}
              autoFocus={phonePadOpen}
            />
          </Card>
          {!phonePadOpen ? (
            <Txt size={16} color="text2">
              If you continue, you agree to the Terms of Use and Privacy Policy.
            </Txt>
          ) : null}
          {!phonePadOpen ? <View style={{ flex: 1, minHeight: 0 }} /> : null}
          {authMsg ? (
            <Txt size={16} w="700" color="red" role="alert">
              {authMsg}
            </Txt>
          ) : null}
          <Btn
            label="Continue"
            busy={busy}
            disabled={!ok}
            onPress={() =>
              props.onRequestPhoneOtp
                ? void viaApi(() => props.onRequestPhoneOtp!(s.phone, dial), () => go('phoneCode', { pcode: '' }))
                : go('phoneCode')
            }
          />
        </ScrollView>
        <NumberPadSlot forId="signup-phone" />
        <Sheet open={s.pickOpen === 'phone'} onClose={() => up({ pickOpen: '' })} title="Choose your country">
          {phoneCountries.map((k) => (
            <Choice key={k.id} title={k.name + ' ' + k.dial} icon={<Flag cc={k.cc} w={38} />} on={k.id === s.country} onPress={() => up({ country: k.id, pickOpen: '' })} minH={60} />
          ))}
        </Sheet>
      </Screen>
    );
  }
  if (stage === 'phoneCode' || stage === 'emailCode') {
    const isMail = stage === 'emailCode';
    const code = isMail ? s.ecode : s.pcode;
    return (
      <Screen style={{ paddingBottom: 0 }}>
        <TopBar onBack={() => go(isMail ? 'account' : 'phone')} say={say} />
        <View
          style={{
            flex: 1,
            width: '100%',
            minHeight: 0,
            gap: sz(14),
            justifyContent: otpCodePadOpen ? 'flex-end' : 'flex-start',
          }}
        >
          {!otpCodePadOpen ? (
            <>
              <H1>{isMail ? 'Check your email' : 'Check your phone'}</H1>
              <P noTr>{tv('We sent a 6-digit code to {0}.', isMail ? s.mail : pc.dial + ' ***-***-' + s.phone.slice(-2))}</P>
            </>
          ) : null}
          <Card>
            <Field
              label="6-digit code"
              value={code}
              onChangeText={(v) => up(isMail ? { ecode: digits(v).slice(0, 6) } : { pcode: digits(v).slice(0, 6) })}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              big
              center
              maxLength={6}
              padKey="otp-code"
              autoFocus={otpCodePadOpen}
            />
            {resend}
            {isMail && !otpCodePadOpen ? <Btn kind="link" label="Wrong email? Change it" onPress={() => go('account')} /> : null}
          </Card>
          {authMsg ? (
            <Txt size={16} w="700" color="red" role="alert">
              {authMsg}
            </Txt>
          ) : null}
          {!otpCodePadOpen ? <View style={{ flex: 1, minHeight: 0 }} /> : null}
          <Btn
            label="Continue"
            busy={busy}
            disabled={code.length !== 6}
            onPress={() => {
              if (isMail) {
                if (props.onVerifyEmailOtp)
                  return void viaApi(() => props.onVerifyEmailOtp!(s.mail, code), () =>
                    go('login', { created: true, who: s.mail, pass: s.pw1 }),
                  );
                go('login', { created: true, who: s.mail, pass: s.pw1 });
                return;
              }
              if (props.onVerifyPhoneOtp)
                return void viaApi(() => props.onVerifyPhoneOtp!(s.phone, code, dial), () => go('account'));
              go('account');
            }}
          />
          {/* Dev / fallback: continue signup without verifying the SMS code (matches design Skip Code). */}
          {!isMail && !otpCodePadOpen ? (
            <Btn
              kind="link"
              label="Skip Code"
              disabled={busy}
              onPress={() => {
                props.clearAuthError?.();
                go('account', { pcode: '' });
              }}
            />
          ) : null}
        </View>
        <NumberPadSlot forId="otp-code" />
      </Screen>
    );
  }
  if (stage === 'account') {
    const ok = mailOk(s.mail) && s.uname.trim().length >= 3 && s.pw1.length >= 8 && s.pw1.length <= 128 && s.pw1 === s.pw2;
    return (
      <Screen scroll gap={10}>
        <TopBar onBack={() => go('phoneCode')} say={say} />
        <H1>Create your account</H1>
        <Card gap={6}>
          <Field label="Email" value={s.mail} onChangeText={(v) => up({ mail: v })} autoCapitalize="none" keyboardType="email-address" />
          <Field label="Username" value={s.uname} onChangeText={(v) => up({ uname: v })} autoCapitalize="none" />
          <Field label="Friend's code (if you have one)" value={s.refer} onChangeText={(v) => up({ refer: v })} autoCapitalize="characters" />
          <Field label="Make a password (at least 8)" value={s.pw1} onChangeText={(v) => up({ pw1: v })} secureTextEntry={!s.showPw} autoCapitalize="none" maxLength={128} />
          <Field label="Type it again" value={s.pw2} onChangeText={(v) => up({ pw2: v })} secureTextEntry={!s.showPw} autoCapitalize="none" maxLength={128} />
          <Btn kind="link" label={s.showPw ? 'Hide' : 'Show'} onPress={() => up({ showPw: !s.showPw })} />
          {s.pw2 && s.pw1 !== s.pw2 ? (
            <Txt size={16} w="700" color="red" role="alert">
              The passwords are not the same.
            </Txt>
          ) : null}
        </Card>
        {authMsg ? (
          <Txt size={16} w="700" color="red" role="alert">
            {authMsg}
          </Txt>
        ) : null}
        <Btn
          label="Continue"
          busy={busy}
          disabled={!ok}
          onPress={() =>
            props.onRegister
              ? void viaApi(
                  () =>
                    props.onRegister!({
                      email: s.mail,
                      username: s.uname,
                      password: s.pw1,
                      nationalPhone: s.phone,
                      dialCode: dial,
                    }),
                  () => go('emailCode', { ecode: '' }),
                )
              : go('emailCode')
          }
        />
      </Screen>
    );
  }

  /* ---------- Security: PIN or biometrics, then questions ---------- */
  if (stage === 'method')
    return (
      <Screen>
        <TopBar onBack={() => go('login')} say={say} />
        <H1>How do you keep your account safe?</H1>
        <P>You use this each time you move money.</P>
        <Choice title="4-number PIN" note="You type your PIN" icon={<Circle icon="lock" size={56} iconSize={32} />} onPress={() => go('pinSet', { pinA: '', pinB: '', pinDiff: false })} right={null} minH={96} />
        <Choice title="Face or fingerprint" note="You use your face or finger" icon={<Circle icon="finger" size={56} iconSize={32} />} onPress={() => go('bio')} right={null} minH={96} />
      </Screen>
    );
  if (stage === 'pinSet' || stage === 'pinAgain') {
    const again = stage === 'pinAgain';
    const typed = again ? s.pinB : s.pinA;
    const pinBusy = pinSubmitting || !!props.securityBusy;
    const press = (k: string) => {
      if (pinBusy) return;
      const v = (typed + k).slice(0, 4);
      if (!again) {
        up({ pinA: v, pinDiff: false });
        if (v.length === 4) setTimeout(() => go('pinAgain', { pinB: '' }, true), 200);
        return;
      }
      // Capture first PIN now — avoid a stale `s.pinA` after the confirm re-render.
      const expected = s.pinA;
      up({ pinB: v });
      if (v.length !== 4) return;
      setTimeout(() => {
        void (async () => {
          if (v !== expected) {
            go('pinSet', { pinA: '', pinB: '', pinDiff: true });
            return;
          }
          if (props.onSetPin) {
            setPinSubmitting(true);
            props.clearSecurityError?.();
            const r = await props.onSetPin(v);
            setPinSubmitting(false);
            if (!r.ok) {
              // Keep confirm screen so the user can retry the same PIN.
              up({ pinB: '' });
              return;
            }
            if (props.onAfterPinSet) {
              props.onAfterPinSet();
              return;
            }
          }
          go('questions', { way: 'pin' });
        })();
      }, 200);
    };
    return (
      <Screen gap={12}>
        <TopBar onBack={() => (again ? go('pinSet', { pinA: '', pinB: '', pinDiff: false }) : go('method'))} say={say} />
        <H1>{again ? 'Type your PIN again' : 'Make your PIN'}</H1>
        <P>{again ? 'Same 4 numbers.' : '4 numbers. Do not tell anyone.'}</P>
        <Dots n={typed.length} />
        {pinBusy ? (
          <Txt size={17} w="700" color="text2" center role="alert">
            Saving your PIN…
          </Txt>
        ) : null}
        {s.pinDiff ? (
          <Txt size={17} w="700" color="red" center role="alert">
            The PINs are not the same. Try again.
          </Txt>
        ) : null}
        {props.securityError ? (
          <Txt size={16} w="700" color="red" center role="alert">
            {props.securityError}
          </Txt>
        ) : null}
        <View style={{ flex: 1 }} />
        <PinPad
          onKey={pinBusy ? () => {} : press}
          onDel={() => {
            if (pinBusy) return;
            up(again ? { pinB: s.pinB.slice(0, -1) } : { pinA: s.pinA.slice(0, -1) });
          }}
        />
      </Screen>
    );
  }
  if (stage === 'bio')
    return (
      <Screen>
        <TopBar onBack={() => go('method')} say={say} />
        <H1>Use your face or fingerprint</H1>
        <P>Your phone will check it is you.</P>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Circle icon="finger2" size={160} iconSize={100} />
        </View>
        <Btn
          label="Turn it on"
          busy={busy}
          onPress={async () => {
            setActionBusy(true);
            try {
              const has = await LocalAuthentication.hasHardwareAsync();
              if (has) {
                const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Palpeer' });
                if (!r.success) return go('bioFail');
              }
            } catch {
            } finally {
              setActionBusy(false);
            }
            go('questions', { way: 'bio' });
          }}
        />
      </Screen>
    );
  if (stage === 'questions') {
    const ok = !!s.a1.trim() && !!s.a2.trim() && s.q1 !== s.q2;
    const skip = s.qSheet === 1 ? s.q2 : s.q1;
    const qBtn = (i: number, which: number) => (
      <Pressable accessibilityRole="button" onPress={() => up({ qSheet: which })} style={{ minHeight: 60, borderRadius: 14, backgroundColor: c.field, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Txt size={17} w="700" style={{ flex: 1 }}>
          {QUESTIONS[i]}
        </Txt>
        <Icon name="down" size={20} color={c.text} />
      </Pressable>
    );
    return (
      <Screen scroll gap={10}>
        <TopBar onBack={() => go(s.way === 'pin' ? 'pinSet' : 'bio', { pinA: '', pinB: '', pinDiff: false, qSheet: 0 })} say={say} />
        <H1>My 2 security questions</H1>
        <P>{(s.way === 'pin' ? 'You need these answers if you forget your PIN.' : 'You need these answers if you get a new phone.') + ' Small or capital letters do not matter.'}</P>
        <Card gap={6}>
          <Txt size={15} w="800" color="text2">
            Question 1
          </Txt>
          {qBtn(s.q1, 1)}
          <Field label="My answer" value={s.a1} onChangeText={(v) => up({ a1: v })} />
        </Card>
        <Card gap={6}>
          <Txt size={15} w="800" color="text2">
            Question 2
          </Txt>
          {qBtn(s.q2, 2)}
          <Field label="My answer" value={s.a2} onChangeText={(v) => up({ a2: v })} />
        </Card>
        {authMsg ? (
          <Txt size={16} w="700" color="red" role="alert">
            {authMsg}
          </Txt>
        ) : null}
        <Btn
          label="Save"
          busy={busy}
          disabled={!ok}
          onPress={() => {
            const homePatch = { live: s.country, prov: pc.sample, postal: pc.postal ? s.postal : '' };
            if (props.onSetQuestions) {
              void (async () => {
                setActionBusy(true);
                try {
                  const r = await props.onSetQuestions!({ q1Index: s.q1, q2Index: s.q2, a1: s.a1, a2: s.a2 });
                  if (!r.ok) return;
                  if (props.setupRequired && props.onSetupComplete) {
                    props.onSetupComplete();
                    return;
                  }
                  go('home', homePatch);
                } finally {
                  setActionBusy(false);
                }
              })();
              return;
            }
            go('home', homePatch);
          }}
        />
        <Sheet open={s.qSheet > 0} onClose={() => up({ qSheet: 0 })} title="Choose a question">
          {QUESTIONS.map((q, i) =>
            i === skip ? null : <Choice key={q} title={q} on={i === (s.qSheet === 1 ? s.q1 : s.q2)} onPress={() => up(s.qSheet === 1 ? { q1: i, qSheet: 0 } : { q2: i, qSheet: 0 })} minH={60} />,
          )}
        </Sheet>
      </Screen>
    );
  }

  /* ---------- One phone only; moving to a new phone ---------- */
  if (stage === 'elsewhere')
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Circle icon="phone" bg="#A84C08" />
          <H1 center>This account is open on another phone</H1>
          <P center>Only one phone can be signed in at a time. Log out on that phone first, then try again here. We told the account owner about this try.</P>
        </View>
        <Btn label="Back to Log in" onPress={() => go('login')} />
        <Btn kind="outline" size="mid" label="You have a new phone or lost your old one" onPress={() => go('move', { mcode: '' })} />
        <Btn kind="link" label="Not you? Email support@palpeer.com" onPress={() => Linking.openURL('mailto:support@palpeer.com').catch(() => {})} />
      </Screen>
    );
  if (stage === 'move')
    return (
      <Screen scroll>
        <TopBar onBack={() => go('elsewhere')} say={say} />
        <Txt size={16} w="800" color="text2">
          Step 1 of 2
        </Txt>
        <H1>Move your account to this phone</H1>
        <P noTr>{tv('We sent a 6-digit code by text to your phone number {0}. Your number still works in a new phone.', '+1 ***-***-' + (s.phone || '0123').slice(-4))}</P>
        <Card>
          <Field label="6-digit code" value={s.mcode} onChangeText={(v) => up({ mcode: digits(v).slice(0, 6) })} keyboardType="number-pad" textContentType="oneTimeCode" big center />
        </Card>
        <P>No longer have this number? Email support@palpeer.com.</P>
        <View style={{ flex: 1 }} />
        <Btn label="Continue" busy={busy} disabled={s.mcode.length !== 6} onPress={() => go('moveQ', { mq1: '', mq2: '', mqErr: false })} />
      </Screen>
    );
  if (stage === 'moveQ')
    return (
      <Screen scroll>
        <TopBar onBack={() => go('move', { mcode: '' })} say={say} />
        <Txt size={16} w="800" color="text2">
          Step 2 of 2
        </Txt>
        <H1>Answer your questions</H1>
        <P>The 2 questions you set when you joined. Small or capital letters do not matter.</P>
        <Card>
          <Field label="What was the name of your first school?" value={s.mq1} onChangeText={(v) => up({ mq1: v, mqErr: false })} />
          <Field label="What was the name of your first pet?" value={s.mq2} onChangeText={(v) => up({ mq2: v, mqErr: false })} />
          {s.mqErr ? (
            <Txt size={16} w="700" color="red" role="alert">
              {'These answers do not match. ' + (3 - s.mqTries) + (3 - s.mqTries === 1 ? ' try left.' : ' tries left.')}
            </Txt>
          ) : null}
        </Card>
        <View style={{ flex: 1 }} />
        <Btn
          label="Move to this phone"
          busy={busy}
          disabled={!s.mq1.trim() || !s.mq2.trim()}
          onPress={() => {
            if (!/wrong/i.test(s.mq1 + s.mq2)) {
              store.set({ onHold: true }); // 24-hour safety hold after a move
              return go('moveDone');
            }
            const t = s.mqTries + 1;
            if (t >= 3) go('moveStuck', { mqTries: t });
            else up({ mqTries: t, mqErr: true });
          }}
        />
      </Screen>
    );
  if (stage === 'moveDone')
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Circle icon="check" />
          <H1 center>This is now your phone</H1>
          <P center>Your old phone is signed out and cannot log in. We sent an email, and a text to your old number if we have it. For safety, withdrawing, sending and changing money pause for 24 hours. Next, log in and set your PIN or fingerprint.</P>
        </View>
        <Btn label="Log in" onPress={() => go('login', { created: false, buying: false })} />
      </Screen>
    );
  if (stage === 'moveStuck')
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Circle icon="lock" bg="#B3231A" />
          <H1 center>Customer service must help</H1>
          <P center>Your answers were wrong 3 times. Your account stays on your old phone, and your money is safe.</P>
        </View>
        <Btn label="Email support@palpeer.com" onPress={() => Linking.openURL('mailto:support@palpeer.com').catch(() => {})} />
      </Screen>
    );

  /* ---------- First home, profile and ID check ---------- */
  switch (stage) {
    case 'home':
      return <FirstHome {...ctx} />;
    case 'details':
      return <Details {...ctx} />;
    case 'where':
      return <Where {...ctx} />;
    case 'money':
      return <Money {...ctx} />;
    case 'idChoose':
      return <IdChoose {...ctx} />;
    case 'kyc':
      return <Kyc {...ctx} />;
    case 'checking':
      return <Checking />;
    case 'verified':
      return <Verified {...ctx} />;
    case 'kycFail':
      return <KycFail {...ctx} />;
    case 'kycStop':
      return <KycStop {...ctx} />;
    case 'bioFail':
      return <BioFail {...ctx} />;
  }
  return (
    <Screen>
      <H2>Page not found</H2>
      <Btn label="Go to start" onPress={() => go('land')} />
    </Screen>
  );
}
