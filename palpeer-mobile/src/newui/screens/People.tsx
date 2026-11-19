import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { useLivePeople } from '@/design/bridge/useLivePeople';
import { PinStep } from '@/newui/features/PinStep';
import { amtIn, amtShow } from '@/newui/lib/money';
import { useLayout } from '@/newui/lib/layout';
import { useListen } from '@/newui/lib/speech';
import { useC } from '@/newui/lib/theme';
import { Icon } from '@/newui/ui/Icon';
import { Btn, Card, Circle, Divider, Field, Flag, H1, H2, Line, Loading, Overlay, P, PadNumberInput, Pill, Row, Screen, TopBar, Txt } from '@/newui/ui/kit';

type LivePeople = ReturnType<typeof useLivePeople>;
type PeopleProps = LivePeople & {
  stage?: string;
  go?: (href: string) => void;
};

/* ---------- Rules (match the prototype and the change map) ---------- */
const FLAT_CAD = 2; // CA$2 flat fee for CA$200 or less
const FLAT_UP_TO_CAD = 200;
const PERCENT = 0.0095; // 0.95% above CA$200
const MIN_CAD = 10;
const PROMO_CODE = 'HALFFEE';
const OLD_CODE = 'OLDCODE';
const CODE_SHARE = 0.5;
const POINTS_END = 'Dec 31, 2026';
const POINTS_PER_CAD = 100;
const FALLBACK_LOW = 950;
const FALLBACK_HIGH = 1000;
const STEP = 1;
const PAL_BUY = 900; // Palpeer rate when you give CA$
const PAL_SELL = 1000; // Palpeer rate when you give naira

type Code = 'CAD' | 'NGN';
const DEMO_BAL: Record<Code, number> = { CAD: 500, NGN: 600000 };
const asCode = (c: string): Code => (c === 'NGN' ? 'NGN' : 'CAD');

function mapLiveOffers(items: LivePeople['liveOffers']): Offer[] {
  return (items ?? []).map((o) => ({
    ...o,
    giveCode: asCode(o.giveCode),
    baseCurrencyCode: o.baseCurrencyCode,
    quoteCurrencyCode: o.quoteCurrencyCode,
  }));
}

function mapLiveMine(items: LivePeople['liveMine']): Offer[] {
  return (items ?? []).map((o) => ({
    ...o,
    giveCode: asCode(o.giveCode),
    baseCurrencyCode: o.baseCurrencyCode,
    quoteCurrencyCode: o.quoteCurrencyCode,
  }));
}
type Reward =
  | { type: 'code'; code?: string }
  | { type: 'points'; points: number }
  | { type: 'bonus'; points?: number }
  | null;
type Offer = {
  id: string;
  giveCode: Code;
  amt: number;
  least: number;
  rate: number;
  left: number;
  sold?: number;
  reward?: Reward;
  baseCurrencyCode?: string;
  quoteCurrencyCode?: string;
};
type NegAccept = { id: string; requestId: string };

const WD = {
  CAD: { sym: 'CA$', dec: 2, name: 'Canada dollars', word: 'dollars', cc: 'CA' },
  NGN: { sym: '₦', dec: 0, name: 'Nigeria naira', word: 'naira', cc: 'NG' },
};
const other = (c: Code): Code => (c === 'CAD' ? 'NGN' : 'CAD');
const fmt = (c: Code, v: number) => WD[c].sym + v.toLocaleString('en-CA', { minimumFractionDigits: WD[c].dec, maximumFractionDigits: WD[c].dec });
const price = (r: number) => 'CA$1 = ₦' + r.toLocaleString('en-CA');
const cadSize = (c: Code, a: number, rate: number) => (c === 'CAD' ? a : a / rate);
const isLarge = (c: Code, a: number, rate: number) => cadSize(c, a, rate) > FLAT_UP_TO_CAD;
const feeOf = (c: Code, a: number, rate: number) => (isLarge(c, a, rate) ? a * PERCENT : c === 'CAD' ? FLAT_CAD : FLAT_CAD * rate);
const feeTag = (c: Code, a: number, rate: number) => (isLarge(c, a, rate) ? ' (0.95%)' : ' (CA$2 flat)');
const tooSmall = (c: Code, a: number, rate: number) => cadSize(c, a, rate) < MIN_CAD;
const minText = (c: Code, rate: number) => (c === 'CAD' ? 'CA$10' : '₦' + (MIN_CAD * rate).toLocaleString('en-CA'));
const rewardOff = (c: Code, fee: number, rate: number, r?: Reward) => {
  if (!r) return 0;
  if (r.type === 'code') return fee * CODE_SHARE;
  if (r.type === 'bonus') return fee;
  const cad = (r.points || 0) / POINTS_PER_CAD;
  return Math.min(fee, c === 'CAD' ? cad : cad * rate);
};
const pointsUsed = (c: Code, off: number, rate: number) => Math.ceil((c === 'CAD' ? off : off / rate) * POINTS_PER_CAD);
const feeShown = (c: Code, fee: number, off: number) => (off >= fee ? 'Free' : '−' + fmt(c, fee - off));
/** Offer end choices (stored as hours for the API). */
const OFFER_END_OPTIONS = [
  { hours: 3, label: '3 Hours' },
  { hours: 24, label: '24 Hours' },
  { hours: 72, label: '3 Days' },
  { hours: 168, label: '7 Days' },
] as const;
const hoursLabel = (h: number) => OFFER_END_OPTIONS.find((o) => o.hours === h)?.label ?? h + (h === 1 ? ' hour' : ' hours');
const leftLabel = (s: number) => {
  if (s <= 0) return 'Ended';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ss = String(sec).padStart(2, '0');
  if (h > 0) {
    return h + 'h ' + String(m).padStart(2, '0') + 'm ' + ss + 's left';
  }
  if (m > 0) return m + 'm ' + ss + 's left';
  return sec + 's left';
};
const worth = (g: Code, amt: number, rate: number) => (g === 'CAD' ? amt * rate : amt / rate);
const palQuote = (o: Offer) => (o.giveCode === 'CAD' ? { rate: PAL_BUY, getCode: 'NGN' as Code, get: o.amt * PAL_BUY } : { rate: PAL_SELL, getCode: 'CAD' as Code, get: o.amt / PAL_SELL });

const SAMPLE_OFFER: Offer = { id: 'p1', giveCode: 'CAD', amt: 100, least: 10, rate: 980, left: 2674 };
const SAMPLE_OFFER_2: Offer = { id: 'p2', giveCode: 'CAD', amt: 500, least: 10, rate: 975, left: 3180 };
const SAMPLE_MINE: Offer = { id: 'm1', giveCode: 'NGN', amt: 60000, sold: 40000, least: 10000, rate: 980, left: 1795 };
const EMPTY_OFFER: Offer = { id: '', giveCode: 'CAD', amt: 0, least: 0, rate: 1, left: 0 };
const EMPTY_MINE: Offer = { id: '', giveCode: 'CAD', amt: 0, sold: 0, least: 0, rate: 1, left: 0 };

/** What the seller (me) sees for an offer. */
const sellerView = (o: Offer) => {
  const getCode = other(o.giveCode);
  const got = worth(o.giveCode, o.amt, o.rate);
  const theirFee = feeOf(o.giveCode, o.amt, o.rate);
  const myFee = feeOf(getCode, got, o.rate);
  const myOff = rewardOff(getCode, myFee, o.rate, o.reward);
  return {
    give: fmt(o.giveCode, o.amt),
    theirFeeLabel: "Person's P2P fee" + feeTag(o.giveCode, o.amt, o.rate),
    fee: fmt(o.giveCode, theirFee),
    net: fmt(o.giveCode, Math.max(0, o.amt - theirFee)),
    myFeeLabel: 'My P2P fee' + feeTag(getCode, got, o.rate),
    myFeeShow: feeShown(getCode, myFee, myOff),
    saved: myOff > 0 ? fmt(getCode, myOff) : '',
    hasReward: myOff > 0,
    rewardNote: o.reward && o.reward.type === 'points' ? 'Your points cover your fee on every buy until they run out.' : 'Your code cuts your fee on every buy of this offer.',
    get: fmt(getCode, Math.max(0, got - myFee + myOff)),
    priceText: price(o.rate),
    leftText: leftLabel(o.left),
    leastText: fmt(o.giveCode, o.least || 0),
    hasSold: (o.sold || 0) > 0,
    original: fmt(o.giveCode, o.amt + (o.sold || 0)),
    soldText: fmt(o.giveCode, o.sold || 0),
    soldPct: (o.sold || 0) / (o.amt + (o.sold || 0)),
    giveCc: WD[o.giveCode].cc,
  };
};
/** What a buyer sees for an offer. */
const buyerView = (o: Offer, rate: number, take?: number, reward?: Reward) => {
  const amt = take === undefined ? o.amt : take;
  const payCode = other(o.giveCode);
  const pay = worth(o.giveCode, amt, rate);
  const fee = feeOf(o.giveCode, amt, rate);
  const off = rewardOff(o.giveCode, fee, rate, reward);
  return {
    feeLabel: 'My P2P fee' + feeTag(o.giveCode, amt, rate),
    feeShow: feeShown(o.giveCode, fee, off),
    offerAmt: fmt(o.giveCode, amt),
    saved: off > 0 ? fmt(o.giveCode, off) : '',
    usedPoints: pointsUsed(o.giveCode, off, rate),
    youGet: fmt(o.giveCode, Math.max(0, amt - fee + off)),
    youGive: fmt(payCode, pay),
    payCode,
    pay,
    getName: WD[o.giveCode].name,
    getCc: WD[o.giveCode].cc,
    giveCc: WD[payCode].cc,
    priceText: price(rate),
    leftText: leftLabel(o.left),
    rangeText: o.least >= o.amt ? 'You can buy ' + fmt(o.giveCode, o.amt) : 'You can buy ' + fmt(o.giveCode, o.least) + ' to ' + fmt(o.giveCode, o.amt),
    restText:
      o.amt - amt <= 0
        ? 'You bought the whole offer.'
        : feeOf(o.giveCode, o.amt - amt, rate) >= o.amt - amt
          ? 'The ' + fmt(o.giveCode, o.amt - amt) + ' left went back to the seller.'
          : 'The offer stays open with ' + fmt(o.giveCode, o.amt - amt) + ' left.',
  };
};

type Stage = 'list' | 'offer' | 'counter' | 'talk' | 'post' | 'pin' | 'bought' | 'live' | 'nowDone' | 'ended';

/** Choose a person (P2P): people's offers, my offers, make an offer, price talk, 30-minute Palpeer rate pop-up. */
export default function People(props: PeopleProps) {
  const c = useC();
  const { s } = useLayout();
  const insets = useSafeAreaInsets();
  // Lift the ends-soon sheet above the persistent DesignTabDock (icon band + safe inset).
  const tabDockOffset = s(6) + s(62) + s(10) + insets.bottom;
  const backend = !!props.backend;
  const { listen, listenLabel } = useListen();
  const params = useLocalSearchParams<{
    requestId?: string | string[];
    negotiationId?: string | string[];
    nudge?: string | string[];
    amount?: string | string[];
    giveCode?: string | string[];
  }>();
  const paramOne = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v)?.trim() || '';
  const deepRequestId = paramOne(params.requestId);
  const deepNegotiationId = paramOne(params.negotiationId);
  const deepNudge = paramOne(params.nudge) === '1' || paramOne(params.nudge) === 'true';
  const deepGiveAmount = paramOne(params.amount);
  const deepGiveCode = paramOne(params.giveCode);

  const startStage = props.stage || 'list';
  const none = startStage === 'empty';
  const talking = startStage === 'talk';
  const offersSeed: Offer[] = backend ? mapLiveOffers(props.liveOffers) : none ? [] : [SAMPLE_OFFER, SAMPLE_OFFER_2];
  const mineSeed: Offer[] = backend ? mapLiveMine(props.liveMine) : none ? [] : [SAMPLE_MINE];
  const firstMine = backend ? props.liveMine?.[0] : mineSeed[0] ?? SAMPLE_MINE;

  const rateLow = props.liveRateBounds?.min ?? FALLBACK_LOW;
  const rateHigh = props.liveRateBounds?.max ?? FALLBACK_HIGH;
  const rateMid = props.liveRateBounds?.mid ?? Math.round((rateLow + rateHigh) / 2);
  const LOW = rateLow;
  const HIGH = rateHigh;

  const [stage, setStage] = useState<Stage>(none ? 'list' : startStage === 'share' || startStage === 'stop' ? 'live' : (startStage as Stage));
  const [sharing, setSharing] = useState(startStage === 'share');
  const [stopping, setStopping] = useState(startStage === 'stop');
  const [reward, setReward] = useState<Reward>(null);
  const [codeUsed, setCodeUsed] = useState(false);
  const [points, setPoints] = useState(300);
  const [rewardPanel, setRewardPanel] = useState(false);
  const [code, setCode] = useState('');
  const [codeBad, setCodeBad] = useState<false | true | 'old' | 'used'>(false);
  const [copied, setCopied] = useState('');
  const [apiError, setApiError] = useState('');
  const [negAccept, setNegAccept] = useState<NegAccept | null>(null);
  const [saidNo, setSaidNo] = useState(false);
  const [endedAmt, setEndedAmt] = useState(
    firstMine ? fmt(asCode(firstMine.giveCode), firstMine.amt) : fmt('NGN', SAMPLE_MINE.amt),
  );
  const [offers, setOffers] = useState<Offer[]>(none ? [] : offersSeed);
  const [mine, setMine] = useState<Offer[]>(none ? [] : mineSeed);
  const [openId, setOpenId] = useState(offersSeed[0]?.id ?? (backend ? '' : 'p1'));
  const [take, setTake] = useState('100');
  const [mineId, setMineId] = useState(mineSeed[0]?.id ?? (backend ? '' : 'm1'));
  const [dealRate, setDealRate] = useState(rateMid);
  const [myPrice, setMyPrice] = useState(rateMid);
  const [talk, setTalk] = useState<Array<{ me: boolean; rate: number; text?: string }>>(
    talking && !backend
      ? [
          { me: false, rate: rateMid + 10 },
          { me: true, rate: rateMid },
          { me: false, rate: rateMid + 5 },
        ]
      : [],
  );
  const [waiting, setWaiting] = useState(false);
  const [sendingPrice, setSendingPrice] = useState(false);
  const [dir, setDir] = useState<Code>(deepGiveCode === 'NGN' ? 'NGN' : 'CAD');
  const [amount, setAmount] = useState(deepGiveAmount && Number.parseFloat(deepGiveAmount) > 0 ? deepGiveAmount : '100');
  const [least, setLeast] = useState<string | null>(null);
  const [rate, setRate] = useState(rateMid);
  const [hours, setHours] = useState<number>(OFFER_END_OPTIONS[0].hours);
  const [more, setMore] = useState(false);
  const [pinFor, setPinFor] = useState<'buy' | 'post' | 'nudge'>('buy');
  const [pinBack, setPinBack] = useState<Stage>('offer');
  const [waved, setWaved] = useState<string[]>(!props.stage || props.stage === 'live' ? [] : ['m1']);
  const [nudgeId, setNudgeId] = useState<string | null>(null);
  const deepLinkApplied = useRef(false);
  /** Set after create/counter so Offer again always has a negotiation id for push. */
  const [localNegId, setLocalNegId] = useState<string | null>(null);
  const [now, setNow] = useState({ get: '', give: '', getName: '', palText: '' });
  const [doneAt, setDoneAt] = useState(new Date());
  const [receipt, setReceipt] = useState<ReturnType<typeof buyerView> | null>(
    startStage === 'bought' && !backend ? buyerView(SAMPLE_OFFER, 980, 40) : null,
  );
  const reply = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinBusy = useRef(false);

  useEffect(() => {
    if (!backend) return;
    const next = mapLiveOffers(props.liveOffers);
    setOffers(next);
    setOpenId((id) => {
      if (next.find((o) => o.id === id)) return id;
      // Keep openId when Talk is for my own listing (Alerts → PeopleTalk).
      if ((props.liveMine ?? []).some((o) => o.id === id)) return id;
      if (deepNegotiationId) return id;
      return next[0]?.id ?? id;
    });
    // Do not kick Talk/Offer stages just because marketplace offers are empty —
    // price talk often opens against the user's own listing.
  }, [backend, deepNegotiationId, props.liveMine, props.liveOffers]);

  useEffect(() => {
    if (!backend) return;
    const next = mapLiveMine(props.liveMine);
    setMine(next);
    setMineId((id) => next.find((o) => o.id === id)?.id ?? next[0]?.id ?? '');
    if (!next.length) {
      setStage((s) => (s === 'live' ? 'list' : s));
      setSharing(false);
      setStopping(false);
    }
  }, [backend, props.liveMine]);

  useEffect(() => {
    if (backend && stage === 'live' && !mine.find((o) => o.id === mineId) && !mine.length) {
      setStage('list');
    }
  }, [backend, stage, mine, mineId]);

  useEffect(() => {
    if (props.stage !== undefined) {
      const s = props.stage;
      const next = none ? 'list' : s === 'share' || s === 'stop' ? 'live' : (s as Stage);
      setStage(next);
      setSharing(s === 'share');
      setStopping(s === 'stop');
    }
  }, [props.stage, none]);

  // Admin rate band → keep Create-offer / counter rates inside min–max.
  useEffect(() => {
    if (!props.liveRateBounds) return;
    setRate((cur) => {
      if (cur >= rateLow && cur <= rateHigh) return cur;
      return rateMid;
    });
    setMyPrice((cur) => {
      if (cur >= rateLow && cur <= rateHigh) return cur;
      return rateMid;
    });
    setDealRate((cur) => {
      if (cur >= rateLow && cur <= rateHigh) return cur;
      return rateMid;
    });
  }, [props.liveRateBounds, rateLow, rateHigh, rateMid]);

  // Change money → Create your offer: seed You give from Instant Exchange amount.
  useEffect(() => {
    if (!deepGiveAmount) return;
    const n = Number.parseFloat(deepGiveAmount);
    if (Number.isFinite(n) && n > 0) setAmount(String(n));
    if (deepGiveCode === 'CAD' || deepGiveCode === 'NGN') setDir(deepGiveCode);
  }, [deepGiveAmount, deepGiveCode]);

  // Push / alert deep links: open the matching People stage.
  useEffect(() => {
    if (deepLinkApplied.current) return;
    if (deepNegotiationId && backend) {
      const neg = props.liveNegotiations?.find((n) => n.id === deepNegotiationId);
      if (!neg) return;
      deepLinkApplied.current = true;
      setOpenId(neg.p2pRequestId);
      const offer =
        (props.liveOffers ?? []).find((o) => o.id === neg.p2pRequestId) ||
        (props.liveMine ?? []).find((o) => o.id === neg.p2pRequestId);
      setLocalNegId(neg.id);
      const me = props.userId ?? null;
      const pending =
        [...(neg.offers ?? [])].reverse().find((o) => o.status === 'PENDING') ?? null;
      const pendingRate = pending ? Number.parseFloat(String(pending.rate)) || 0 : 0;
      const pendingAmt = pending ? Number.parseFloat(String(pending.amount)) || 0 : 0;
      if (offer) {
        setTake(String(pendingAmt > 0 ? pendingAmt : offer.amt));
        setDealRate(pendingRate > 0 ? pendingRate : offer.rate);
        setMyPrice(Math.max(rateLow, (pendingRate > 0 ? pendingRate : offer.rate) - 10));
      } else if (pendingRate > 0) {
        if (pendingAmt > 0) setTake(String(pendingAmt));
        setDealRate(pendingRate);
        setMyPrice(Math.max(rateLow, pendingRate - 10));
      }
      const bubbles =
        (neg.offers ?? [])
          .filter((o) => o.status === 'PENDING' || o.status === 'ACCEPTED')
          .map((o) => ({
            me: !!me && o.offeredBy === me,
            rate: Number.parseFloat(String(o.rate)) || 0,
          }))
          .filter((b) => b.rate > 0) ?? [];
      setTalk(bubbles.length ? bubbles : []);
      setSaidNo(false);
      setWaiting(false);
      setStage('talk');
      return;
    }
    if (deepRequestId) {
      const inOffers = offers.find((o) => o.id === deepRequestId) || (props.liveOffers ?? []).find((o) => o.id === deepRequestId);
      const inMine = mine.find((o) => o.id === deepRequestId) || (props.liveMine ?? []).find((o) => o.id === deepRequestId);
      if (!inOffers && !inMine && (backend ? props.peopleLoading : false)) return;
      deepLinkApplied.current = true;
      if (inMine || (deepNudge && inMine)) {
        setMineId(deepRequestId);
        setStage('live');
        if (deepNudge) setWaved((w) => w.filter((id) => id !== deepRequestId));
        return;
      }
      if (inOffers || deepRequestId) {
        setOpenId(deepRequestId);
        const o = inOffers as Offer | undefined;
        if (o) {
          setTake(String(o.amt));
          setDealRate(o.rate);
          setMyPrice(Math.max(rateLow, o.rate - 10));
        }
        setStage(startStage === 'talk' ? 'talk' : 'offer');
      }
    }
  }, [
    backend,
    deepNegotiationId,
    deepNudge,
    deepRequestId,
    mine,
    offers,
    props.liveMine,
    props.liveNegotiations,
    props.liveOffers,
    props.peopleLoading,
    rateLow,
    startStage,
  ]);

  const bal = useCallback(
    (k: Code) => {
      if (!backend) return DEMO_BAL[k] ?? 0;
      const key = k.toUpperCase() as Code;
      const fromMap = props.liveBalances?.[key] ?? props.liveBalances?.[k];
      if (typeof fromMap === 'number' && Number.isFinite(fromMap)) return fromMap;
      const wallet = props.liveWallets?.find((w) => (w.code || '').toUpperCase() === key);
      return typeof wallet?.bal === 'number' && Number.isFinite(wallet.bal) ? wallet.bal : 0;
    },
    [backend, props.liveBalances, props.liveWallets],
  );

  const negotiationFor = useCallback(
    (requestId: string) => {
      if (!backend || !requestId) return null;
      return (
        props.liveNegotiations?.find((n) => n.p2pRequestId === requestId && n.status === 'OPEN') ?? null
      );
    },
    [backend, props.liveNegotiations],
  );

  // Count down every offer each second (shows h/m/s); when one of mine ends, show "Your offer ended".
  useEffect(() => {
    const t = setInterval(() => {
      const tick = (o: Offer) => ({ ...o, left: Math.max(0, o.left - 1) });
      setOffers((os) => os.map(tick).filter((o) => o.left > 0));
      setMine((ms) => {
        const next = ms.map(tick);
        const gone = next.find((o) => o.left <= 0);
        if (gone) {
          setStage((s) => {
            if (s === 'live') {
              setSharing(false);
              setEndedAmt(fmt(gone.giveCode, gone.amt));
              return 'ended';
            }
            return s;
          });
        }
        return next.filter((o) => o.left > 0);
      });
    }, 1000);
    return () => {
      clearInterval(t);
      if (reply.current) clearTimeout(reply.current);
    };
  }, []);

  const any = offers.length + mine.length > 0;
  const meId = props.userId ?? null;
  // Alerts / deep links may open Talk for my listing (liveMine) or someone else's (liveOffers).
  const openRaw =
    offers.find((o) => o.id === openId) ||
    mine.find((o) => o.id === openId) ||
    (backend ? offers[0] : undefined) ||
    SAMPLE_OFFER;
  const open = openRaw;
  const neg =
    (localNegId && props.liveNegotiations?.find((n) => n.id === localNegId)) ||
    (deepNegotiationId && props.liveNegotiations?.find((n) => n.id === deepNegotiationId)) ||
    (openRaw ? negotiationFor(openRaw.id) : null);
  const pendingOffer =
    neg?.offers ? [...neg.offers].reverse().find((o) => o.status === 'PENDING') ?? null : null;
  const pendingTheirs =
    pendingOffer && meId && pendingOffer.offeredBy !== meId ? pendingOffer : null;
  const pendingMine =
    pendingOffer && meId && pendingOffer.offeredBy === meId ? pendingOffer : null;
  const talkLive = neg?.offers
    ? neg.offers
        .filter((o) => o.status === 'PENDING' || o.status === 'ACCEPTED' || o.status === 'SUPERSEDED')
        .map((o) => ({
          me: !!meId && o.offeredBy === meId,
          rate: parseFloat(o.rate) || 0,
          text: undefined as string | undefined,
        }))
    : talk;
  // Always prefer the latest offered rate (not sample/hardcoded defaults).
  const lastOffered =
    pendingTheirs ||
    pendingMine ||
    (neg?.offers?.length ? [...neg.offers].reverse().find((o) => Number.parseFloat(o.rate) > 0) : null);
  const dealRateLive = lastOffered
    ? Number.parseFloat(String(lastOffered.rate)) || dealRate
    : talkLive.length
      ? talkLive[talkLive.length - 1]!.rate
      : open.rate || dealRate;
  const lastOfferAmt = lastOffered ? Number.parseFloat(String(lastOffered.amount)) || 0 : 0;
  const waitingLive =
    waiting ||
    !!(neg?.status === 'OPEN' && pendingMine) ||
    !!(
      !meId &&
      neg?.offers?.length &&
      neg.offers[neg.offers.length - 1]?.offeredBy === neg.counterpartyId &&
      neg.offers[neg.offers.length - 1]?.status === 'PENDING'
    );
  const takeNum =
    lastOfferAmt > 0 ? lastOfferAmt : parseFloat(take) || (backend ? open.amt : 0);
  const takeShown = take;
  const feeEats = takeNum > 0 && feeOf(open.giveCode, takeNum, dealRateLive) >= takeNum;
  const takeBad = takeNum < open.least || takeNum > open.amt || feeEats;
  const deal = buyerView(open, dealRateLive, takeNum, reward);
  const iAmListingOwner =
    !!mine.find((o) => o.id === open.id) || (!!neg && !!meId && neg.requesterId === meId);
  const lastRateShown = Math.round(dealRateLive);
  const dealLine =
    lastRateShown > 0
      ? iAmListingOwner
        ? `At ₦${lastRateShown}: the buyer gets ${deal.youGet}, you get ${deal.youGive}`
        : `At ₦${lastRateShown}: you give ${deal.youGive}, you get ${deal.youGet}`
      : 'Talk about the price until you agree.';
  const acceptLabel = iAmListingOwner
    ? `Accept ₦${lastRateShown}`
    : `Accept ₦${lastRateShown} and buy`;
  const theySaidNo =
    !!neg &&
    neg.status === 'CANCELLED' &&
    neg.closedReason === 'REJECTED' &&
    !!neg.closedBy &&
    !!meId &&
    neg.closedBy !== meId;
  const iSaidNo =
    saidNo ||
    talk.some((t) => t.text === 'No') ||
    (!!neg &&
      neg.status === 'CANCELLED' &&
      neg.closedReason === 'REJECTED' &&
      !!neg.closedBy &&
      !!meId &&
      neg.closedBy === meId);
  const acceptedOffer =
    neg?.status === 'ACCEPTED'
      ? [...(neg.offers ?? [])].reverse().find((o) => o.status === 'ACCEPTED') ?? null
      : null;
  const acceptedRate = acceptedOffer
    ? Math.round(Number.parseFloat(String(acceptedOffer.rate)) || dealRateLive)
    : 0;
  const displayTalk = [
    ...talkLive,
    ...(acceptedRate > 0
      ? [
          {
            // Acceptor is the participant who did not author the accepted offer.
            me: !!(meId && acceptedOffer && acceptedOffer.offeredBy !== meId),
            rate: acceptedRate,
            text: `Accepted ₦${acceptedRate}`,
          },
        ]
      : []),
    ...(iSaidNo ? [{ me: true, rate: 0, text: 'No' }] : []),
    ...(theySaidNo ? [{ me: false, rate: 0, text: 'No' }] : []),
  ];
  const clampedMyPrice = Math.min(HIGH, Math.max(LOW, myPrice || rateMid));
  const mineDeal = buyerView(open, clampedMyPrice, takeNum, reward);
  const sellerCounterDeal = sellerView({
    ...open,
    rate: clampedMyPrice,
    amt: takeNum > 0 ? takeNum : open.amt,
  });
  const short = deal.pay > bal(deal.payCode);
  const n = parseFloat(amount) || 0;
  // Minimum defaults to the "You give" amount (editable downward).
  const leastText = least === null ? (n > 0 ? String(n) : dir === 'CAD' ? String(MIN_CAD) : String(Math.ceil(MIN_CAD * rate))) : least;
  const leastNum = parseFloat(leastText) || 0;
  const amountSmall = tooSmall(dir, n, rate);
  const leastSmall = !amountSmall && tooSmall(dir, leastNum, rate);
  const leastBad = leastNum > n || leastSmall;
  const tooMuch = n > bal(dir);
  const rateBad = rate < LOW || rate > HIGH;
  const blocked = n <= 0 || tooMuch || leastBad || amountSmall || rateBad;
  const tipFloorCad = FLAT_UP_TO_CAD;
  const tipFloorText = dir === 'CAD' ? 'C$' + tipFloorCad : '₦' + Math.round(tipFloorCad * rate).toLocaleString('en-CA');
  const ratePickText = 'You can pick ₦' + LOW.toLocaleString('en-CA') + ' to ₦' + HIGH.toLocaleString('en-CA');
  const nudgeOffer =
    ['live', 'list'].includes(stage) && !sharing && !rewardPanel && !stopping
      ? mine.find((o) => o.left > 0 && o.left <= 1800 && !waved.includes(o.id))
      : undefined;
  const nq = nudgeOffer ? palQuote(nudgeOffer) : null;
  const nudge = nudgeOffer && nq ? { palText: price(nq.rate), mineText: price(nudgeOffer.rate), give: fmt(nudgeOffer.giveCode, nudgeOffer.amt), get: fmt(nq.getCode, nq.get) } : null;
  const postView = sellerView({ id: 'new', giveCode: dir, amt: n, least: leastNum, rate, reward, left: hours * 3600 });
  const liveOffer = mine.find((o) => o.id === mineId) || mine[0] || (backend ? null : SAMPLE_MINE);
  const live = sellerView((liveOffer || EMPTY_MINE) as Offer);
  const rec = receipt || deal;
  const offerLink = liveOffer?.id
    ? props.shareUrlFor
      ? props.shareUrlFor(liveOffer.id)
      : '/p2p/share/' + liveOffer.id
    : '';
  const shareText = liveOffer?.id
    ? "I'm selling " + live.give + ' on PALPEER at ' + live.priceText + '. Buy from me: ' + offerLink
    : '';
  const savedNow = stage === 'post' ? postView.saved : stage === 'counter' ? mineDeal.saved : deal.saved;
  const rewardLine = savedNow ? 'Reward used: you save ' + savedNow : 'Cut your fee: use a code or points';

  const finish = async () => {
    if (pinFor === 'nudge') {
      const o = mine.find((m) => m.id === nudgeId) || liveOffer;
      if (!o) return;
      const q = palQuote(o);
      setMine(mine.filter((m) => m.id !== o.id));
      setNow({ get: fmt(q.getCode, q.get), give: fmt(o.giveCode, o.amt), getName: WD[q.getCode].name, palText: price(q.rate) });
      setPinFor('buy');
      setStage('nowDone');
      return;
    }
    if (pinFor === 'post') {
      let id = 'm' + Date.now();
      const amt = parseFloat(amount) || 0;
      if (backend && props.onCreateOffer) {
        const r = await props.onCreateOffer({ giveCode: dir, amount: String(amt), rate: String(rate), hours });
        if (!r?.ok) {
          setApiError(r?.error || 'Could not post my offer.');
          setStage('post');
          return;
        }
        if (r.data && typeof r.data === 'object' && r.data !== null && 'id' in r.data) {
          id = String((r.data as { id: string }).id);
        }
      }
      const made: Offer = {
        id,
        giveCode: dir,
        amt,
        least: leastNum,
        reward,
        rate,
        left: hours * 3600,
      };
      if (!backend) setMine([made, ...mine]);
      setMineId(id);
      if (reward && reward.type === 'code') setCodeUsed(true);
      setReward(null);
      setApiError('');
      setStage('live');
      return;
    }
    const bought = buyerView(open, dealRateLive, takeNum, reward);
    const rest = Math.round((open.amt - takeNum) * 100) / 100;
    setReceipt(bought);
    if (reward && reward.type === 'code') setCodeUsed(true);
    if (reward && reward.type === 'points') setPoints(points - bought.usedPoints);
    setReward(null);
    if (!backend) {
      setOffers(
        rest > 0 && feeOf(open.giveCode, rest, open.rate) < rest
          ? offers.map((x) =>
              x.id === open.id ? { ...x, amt: rest, sold: (x.sold || 0) + takeNum, least: Math.min(x.least, rest) } : x,
            )
          : offers.filter((x) => x.id !== open.id),
      );
    }
    setNegAccept(null);
    setDoneAt(new Date());
    setApiError('');
    setStage('bought');
  };

  const confirmBackendPin = async (pin: string, bio: boolean) => {
    if (pinBusy.current) return false;
    pinBusy.current = true;
    try {
      let r: { ok: boolean; error?: string } | undefined;
      if (pinFor === 'buy' && !negAccept) {
        r = bio
          ? (await props.confirmAcceptBiometric?.()) ?? { ok: false, error: 'Fingerprint is not ready.' }
          : (await props.confirmAcceptPin?.(pin)) ?? { ok: false, error: 'Could not check your PIN.' };
      } else if (bio) {
        r = (await props.confirmBiometric?.()) ?? { ok: false, error: 'Enter your PIN to continue.' };
      } else {
        const ok = (await props.confirmPin?.(pin)) ?? false;
        r = ok ? { ok: true } : { ok: false, error: 'Wrong PIN.' };
      }
      if (r?.ok && pinFor === 'buy' && negAccept) {
        r = (await props.onAcceptNegotiation?.(negAccept.id, negAccept.requestId)) ?? {
          ok: false,
          error: 'Could not accept this price.',
        };
      }
      if (!r?.ok) {
        setApiError(r?.error === 'Wrong PIN.' ? '' : r?.error || 'Something went wrong.');
        return false;
      }
      await finish();
      return true;
    } finally {
      pinBusy.current = false;
    }
  };

  const openCounter = () => {
    const next = Math.min(HIGH, Math.max(LOW, myPrice || rateMid));
    setMyPrice(next);
    setSendingPrice(false);
    setStage('counter');
  };

  const sendPrice = async () => {
    const rateToSend = Math.min(HIGH, Math.max(LOW, myPrice || rateMid));
    if (rateToSend < LOW || rateToSend > HIGH) {
      setApiError(`Pick a rate from ₦${LOW.toLocaleString('en-CA')} to ₦${HIGH.toLocaleString('en-CA')}.`);
      return;
    }
    setMyPrice(rateToSend);
    const opening = talkLive.length ? talkLive : [{ me: false, rate: dealRateLive }];
    if (backend) {
      if (!openRaw || !props.onSendCounter || sendingPrice) return;
      // Stay on Talk about the price after send (Offer again / first counter).
      setSendingPrice(true);
      setStage('talk');
      setWaiting(true);
      setApiError('');
      setSaidNo(false);
      setTalk([...opening, { me: true, rate: rateToSend }]);
      const negId = neg?.id ?? localNegId ?? deepNegotiationId ?? null;
      const r = await props.onSendCounter({
        requestId: openRaw.id,
        amount: String(takeNum || open.amt),
        rate: String(rateToSend),
        negotiationId: negId,
      });
      setSendingPrice(false);
      if (!r?.ok) {
        setApiError(r?.error || 'Could not send my price.');
        setStage('counter');
        setWaiting(false);
        return;
      }
      const createdId =
        r.data && typeof r.data === 'object' && r.data !== null && 'id' in r.data
          ? String((r.data as { id: string }).id)
          : null;
      if (createdId) setLocalNegId(createdId);
      // Keep waiting until the other person answers (live pendingMine drives waitingLive).
      setWaiting(true);
      return;
    }
    setStage('talk');
    setWaiting(true);
    setTalk([...opening, { me: true, rate: rateToSend }]);
    reply.current = setTimeout(() => {
      const answer = Math.min(
        HIGH,
        Math.max(LOW, Math.round((rateToSend + dealRateLive) / 2 / STEP) * STEP),
      );
      setWaiting(false);
      setDealRate(answer);
      setTalk((t) => [...t, { me: false, rate: answer }]);
    }, 2500);
  };
  const goList = () => {
    setStage('list');
    setTalk([]);
    setWaiting(false);
    setSaidNo(false);
    setLocalNegId(null);
  };
  const sayNo = async () => {
    if (backend) {
      const negId = neg?.id ?? localNegId ?? deepNegotiationId;
      if (!negId) {
        goList();
        return;
      }
      setApiError('');
      setTalk((t) => [...t, { me: true, rate: 0, text: 'No' }]);
      setSaidNo(true);
      // On my turn → reject (push + chat No). Waiting on my own offer → cancel (still notifies).
      const r = pendingTheirs
        ? (await props.onRejectNegotiation?.(negId)) ?? { ok: false, error: 'Could not say no.' }
        : (await props.onCancelNegotiation?.(negId)) ?? { ok: false, error: 'Could not say no.' };
      if (!r?.ok) {
        setApiError(r?.error || 'Could not say no.');
        setSaidNo(false);
        return;
      }
      setWaiting(false);
      return;
    }
    setTalk((t) => [...t, { me: true, rate: 0, text: 'No' }]);
    setSaidNo(true);
    setWaiting(false);
  };
  const copyShare = (label: string) => {
    Clipboard.setStringAsync(shareText).catch(() => {});
    setCopied(label);
  };
  const applyCode = async () => {
    const k = code.trim().toUpperCase();
    if (backend && props.validatePromoCode) {
      const r = await props.validatePromoCode({
        code: k,
        baseCurrencyCode: open.baseCurrencyCode || (open.giveCode === 'CAD' ? 'CAD' : 'NGN'),
        quoteCurrencyCode: open.quoteCurrencyCode || (open.giveCode === 'CAD' ? 'NGN' : 'CAD'),
        amount: String(takeNum || open.amt || 0),
        rate: String(dealRateLive || open.rate || 0),
      });
      if (!r?.ok) {
        setCodeBad((r?.reason as typeof codeBad) || true);
        return;
      }
      const applied = (r.data && typeof r.data === 'object' && r.data !== null && 'code' in r.data
        ? String((r.data as { code: string }).code)
        : k) as string;
      setReward({ type: 'code', code: applied });
      setCode(k);
      setRewardPanel(false);
      setCodeBad(false);
      return;
    }
    if (k === PROMO_CODE && codeUsed) setCodeBad('used');
    else if (k === PROMO_CODE) {
      setReward({ type: 'code' });
      setRewardPanel(false);
      setCodeBad(false);
    } else setCodeBad(k === OLD_CODE ? 'old' : true);
  };

  const startAccept = async () => {
    if (backend) {
      if (!openRaw) return;
      setApiError('');
      // Talk Accept always uses the last negotiated offer amount + rate.
      if (stage === 'talk' && neg) {
        if (pendingMine) {
          setApiError('Waiting for the person to answer your price.');
          return;
        }
        if (!pendingTheirs) {
          setApiError('Nothing to accept yet. Wait for a new price, or offer again.');
          return;
        }
        setNegAccept({ id: neg.id, requestId: openRaw.id });
        setPinFor('buy');
        setPinBack(stage);
        setStage('pin');
        return;
      }
      const rewardOpts = reward
        ? {
            applyBonusCredit: reward.type === 'bonus' || reward.type === 'points',
            promotionCode: reward.type === 'code' ? reward.code || code : null,
          }
        : undefined;
      props.prepareAccept?.(openRaw.id, String(takeNum), rewardOpts);
      setNegAccept(null);
    }
    setPinFor('buy');
    setPinBack(stage);
    setStage('pin');
  };

  const stopLiveOffer = async () => {
    if (backend && liveOffer && props.onCancelMine) {
      const r = await props.onCancelMine(liveOffer.id);
      if (!r?.ok) {
        setApiError(r?.error || 'Could not stop my offer.');
        return;
      }
    }
    if (!backend && liveOffer) setMine(mine.filter((o) => o.id !== liveOffer.id));
    setStage('list');
    setApiError('');
  };

  if (props.peopleLoading && backend && !any) {
    return (
      <Screen>
        <Loading title="Loading offers" text="Just a moment." />
      </Screen>
    );
  }

  const say: Record<Stage, string> = {
    list: any ? 'Trade Peer to Peer. Tap an offer to see it. Or make your own offer.' : 'No one is here yet. Make your own offer and a person can take it. Or use Instant Exchange instead.',
    offer: "A person's offer. You give " + deal.youGive + '. After the fee, you get ' + deal.youGet + '. Tap Accept and buy, or offer a different price.',
    counter:
      'Offer a different price. Your price is ' +
      clampedMyPrice +
      ' naira for one Canada dollar. Tap minus or plus, then send.',
    talk: waitingLive
      ? 'Waiting for the person to answer.'
      : iSaidNo
        ? 'You said no. The offer can stay open for others.'
        : "The person's price is " +
          lastRateShown +
          ' naira for one Canada dollar. You can accept, offer again, or say no.',
    post: 'Create your offer. You give ' + postView.give + '. The person gets ' + postView.net + ' after their fee. You get ' + postView.get + ' after your fee.',
    pin: 'Enter your 4 number PIN, or use your fingerprint.',
    bought: 'Done. ' + rec.youGet + ' is now in your ' + rec.getName + '.',
    ended: 'Your offer ended. No one bought the rest. ' + endedAmt + ' is back in your wallet.',
    nowDone: 'Done. ' + now.get + ' is now in your ' + now.getName + '. Your offer is closed.',
    live:
      (liveOffer && liveOffer.left <= 1800 ? leftLabel(liveOffer.left) + '. You can use Instant Exchange with no waiting. ' : '') +
      'Your offer is posted. You are waiting for a person. You give ' + live.give + '. The person gets ' + live.net + ' after their fee. You get ' + live.get + ' after your fee. ' + live.leftText + '.',
  };

  /* ---------- Pieces ---------- */
  const priceStepper = (value: number, set: (v: number) => void, color: string, padKey: string) => (
    <Row between>
      <Pressable accessibilityRole="button" accessibilityLabel="Lower your price" disabled={value <= LOW} onPress={() => set(Math.max(LOW, value - STEP))} style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: value <= LOW ? c.off : color, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="minus" size={30} color="#FFFFFF" />
      </Pressable>
      <Row gap={2} style={{ flex: 1, minWidth: 0, justifyContent: 'center', alignItems: 'center' }}>
        <Txt size={34} w="800" noTr>
          ₦
        </Txt>
        <PadNumberInput
          accessibilityLabel="My rate for CA$1"
          padKey={padKey}
          maxLength={4}
          value={value ? String(value) : ''}
          onChangeText={(raw) => {
            const digits = raw.replace(/\D/g, '');
            if (!digits) {
              set(LOW);
              return;
            }
            let n = parseInt(digits, 10);
            if (!Number.isFinite(n)) return;
            if (n > HIGH) n = HIGH;
            // Keep admin min–max: once digit count reaches the min rate, snap up to LOW.
            if (digits.length >= String(LOW).length && n < LOW) n = LOW;
            set(n);
          }}
          style={{ minWidth: 88, maxWidth: 160, fontSize: 34, fontFamily: 'NotoSans_800ExtraBold', textAlign: 'center', paddingVertical: 4 }}
        />
      </Row>
      <Pressable accessibilityRole="button" accessibilityLabel="Raise your price" disabled={value >= HIGH} onPress={() => set(Math.min(HIGH, value + STEP))} style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: value >= HIGH ? c.off : color, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="plus2" size={30} color="#FFFFFF" />
      </Pressable>
    </Row>
  );
  const moneyRow = (cc: string, label: string, value: string) => (
    <Row gap={12}>
      <Flag cc={cc} w={46} />
      <View>
        <Txt size={15} color="text2">
          {label}
        </Txt>
        <Txt size={22} w="800" noTr>
          {value}
        </Txt>
      </View>
    </Row>
  );
  const rewardBtn = <Btn kind="outline" size="small" label={rewardLine} onPress={() => { setRewardPanel(true); setCodeBad(false); }} style={{ borderColor: '#5E3AB8' }} />;
  const bubbles = (
    <View style={{ gap: 8 }}>
      {displayTalk.map((b, i) => (
        <View key={i} style={{ alignSelf: b.me ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
          <Txt size={14} w="700" color="text3" style={{ textAlign: b.me ? 'right' : 'left' }}>
            {b.text === 'No'
              ? b.me
                ? 'My reply'
                : 'Their reply'
              : b.text?.startsWith('Accepted')
                ? b.me
                  ? 'Accepted'
                  : 'Accepted'
                : b.me
                  ? 'My price'
                  : "The person's price"}
          </Txt>
          <View
            style={{
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor: b.text === 'No' ? c.red : b.text?.startsWith('Accepted') ? '#0B6E4F' : b.me ? '#1D5BC7' : c.field,
            }}
          >
            <Txt size={19} w="800" color={b.me || b.text === 'No' || b.text?.startsWith('Accepted') ? '#FFFFFF' : c.text} noTr>
              {b.text === 'No' ? 'No' : b.text?.startsWith('Accepted') ? b.text : price(b.rate)}
            </Txt>
          </View>
        </View>
      ))}
    </View>
  );

  /* ---------- Overlays shared by several stages ---------- */
  const overlays = (
    <>
      {/* 30 minutes before my offer ends: offer the Palpeer rate */}
      <Modal
        visible={!!nudge}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => nudgeOffer && setWaved([...waved, nudgeOffer.id])}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
            // Sit above the phone footer tab bar (DesignTabDock lives outside the Stack).
            paddingBottom: tabDockOffset,
            zIndex: 1000,
            elevation: 24,
          }}
        >
          <View
            style={{
              backgroundColor: c.bg,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 16,
              gap: 10,
              elevation: 28,
              zIndex: 1001,
            }}
          >
            <Row between>
              <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: c.warnBg }}>
                <Txt size={16} w="800" color="orange">
                  30 minutes left
                </Txt>
              </View>
              <Pill icon="listen" dark label={listenLabel} a11y="Listen to this screen" onPress={() => nudge && listen('Your offer ends soon. 30 minutes left. The Palpeer rate is ' + nudge.palText + '. You give ' + nudge.give + '. You get ' + nudge.get + '. No fee. Press Accept Palpeer rate, or Keep waiting.')} />
            </Row>
            <H2>Your offer ends soon</H2>
            {nudge ? (
              <Card gap={4}>
                <Line k="Palpeer rate" v={nudge.palText} strong />
                <Line k="My rate" v={nudge.mineText} />
                <Line k="You give" v={nudge.give} />
                <Line k="Fee" v="No fee" />
                <Line k="You get" v={nudge.get} strong />
              </Card>
            ) : null}
            <Btn
              label="Accept Palpeer rate"
              onPress={() => {
                if (!nudgeOffer) return;
                setNudgeId(nudgeOffer.id);
                setMineId(nudgeOffer.id);
                setPinFor('nudge');
                setPinBack('live');
                setWaved([...waved, nudgeOffer.id]);
                setStage('pin');
              }}
            />
            <Btn kind="outline" size="mid" label="Keep waiting" onPress={() => nudgeOffer && setWaved([...waved, nudgeOffer.id])} />
          </View>
        </View>
      </Modal>

      {/* Cut your fee: points or a discount code */}
      <Overlay open={rewardPanel}>
        <Screen scroll>
          <TopBar onBack={() => setRewardPanel(false)} />
          <H1>Cut your fee</H1>
          <Card>
            <H2>My points</H2>
            <Txt size={17} color="text2">
              {backend
                ? props.bonusText || 'No points yet. Invite friends or use a promo code.'
                : 'You have ' + points + ' points, worth ' + fmt('CAD', points / POINTS_PER_CAD) + '. Use them by ' + POINTS_END + '.'}
            </Txt>
            <Btn
              size="mid"
              label="Use your points"
              disabled={backend ? !props.hasBonusCredit : points <= 0}
              style={{ backgroundColor: (backend ? props.hasBonusCredit : points > 0) ? '#5E3AB8' : c.off }}
              onPress={() => {
                setReward(
                  backend
                    ? { type: 'bonus', points: props.pointsBalance || 0 }
                    : { type: 'points', points },
                );
                setRewardPanel(false);
              }}
            />
          </Card>
          <Card>
            <Field label="Discount code" placeholder="Enter code" value={code} onChangeText={(v) => { setCode(v); setCodeBad(false); }} autoCapitalize="characters" />
            {codeBad ? (
              <Txt size={16} w="700" color="red" role="alert">
                {codeBad === 'old' ? 'This code has ended.' : codeBad === 'used' ? 'You already used this code.' : 'This code does not work. Check it and try again.'}
              </Txt>
            ) : null}
            <Btn size="mid" label="Use this code" onPress={() => void applyCode()} />
          </Card>
          {reward ? (
            <Btn
              kind="link"
              label="Remove your reward"
              onPress={() => {
                setReward(null);
                setRewardPanel(false);
                setCode('');
              }}
            />
          ) : null}
        </Screen>
      </Overlay>
    </>
  );

  /* ---------- Stages ---------- */
  if (stage === 'pin')
    return (
      <PinStep
        onBack={() => {
          setStage(pinBack);
          setPinFor('buy');
          setNegAccept(null);
          setApiError('');
        }}
        confirmPin={backend ? (pin) => confirmBackendPin(pin, false) : undefined}
        confirmBiometric={backend ? () => confirmBackendPin('', true) : undefined}
        onDone={() => {
          if (!backend) void finish();
        }}
      />
    );

  if (stage === 'offer')
    return (
      <Screen scroll>
        <H1>{"A person's offer"}</H1>
        <Card>
          <Txt size={16} color="text2">
            Set amount you want to buy
          </Txt>
          <Row gap={6}>
            <Txt size={28} w="800" noTr>
              {WD[open.giveCode].sym}
            </Txt>
            <PadNumberInput
              accessibilityLabel="Set amount you want to buy"
              decimal
              padKey="people-take"
              value={amtShow(takeShown)}
              onChangeText={(v) => setTake(amtIn(v))}
              style={{ minWidth: 88, flexShrink: 1, fontSize: 28, fontFamily: 'NotoSans_800ExtraBold', paddingVertical: 4 }}
            />
          </Row>
          <Txt size={15} w="600" color="text3">
            {deal.rangeText}
          </Txt>
          <Line k={deal.feeLabel} v={deal.feeShow} />
          {rewardBtn}
          <Divider />
          {moneyRow(deal.getCc, 'You get', deal.youGet)}
          {moneyRow(deal.giveCc, 'You give', deal.youGive)}
          <Divider />
          <Txt size={17} w="700" noTr>
            {deal.priceText}
          </Txt>
          <Txt size={16} w="700" color="orange">
            {deal.leftText}
          </Txt>
          <Txt size={16} w="700" color={takeBad || short ? 'red' : 'text2'}>
            {apiError || (takeBad ? (feeEats ? 'Too small. The fee is more than this amount.' : deal.rangeText) : short ? 'Not enough money. You have ' + fmt(deal.payCode, bal(deal.payCode)) : 'The money moves at once when you accept.')}
          </Txt>
        </Card>
        <TopBar onBack={goList} say={say.offer} />
        <Btn label="Accept and buy" disabled={takeBad || short} onPress={() => void startAccept()} />
        <Btn kind="outline" size="mid" label="Offer a different price" onPress={openCounter} />
        {overlays}
      </Screen>
    );

  if (stage === 'counter')
    return (
      <Screen scroll>
        <H1>Offer a different price</H1>
        <Card>
          <H2>My rate for CA$1</H2>
          {priceStepper(clampedMyPrice, setMyPrice, '#1D5BC7', 'people-counter-rate')}
          <Txt size={16} w="600" color="text2" center>
            {'The person asked for ₦' + lastRateShown.toLocaleString('en-CA') + '. ' + ratePickText}
          </Txt>
          <Divider />
          {iAmListingOwner ? (
            <>
              <Line k="You give" v={sellerCounterDeal.give} />
              <Line k="You get" v={sellerCounterDeal.get} strong />
              <Line k={sellerCounterDeal.myFeeLabel} v={sellerCounterDeal.myFeeShow} />
            </>
          ) : (
            <>
              <Line k="You buy" v={mineDeal.offerAmt} />
              <Line k={mineDeal.feeLabel} v={mineDeal.feeShow} />
              <Line k="You get" v={mineDeal.youGet} strong />
              <Line k="You give" v={mineDeal.youGive} />
            </>
          )}
        </Card>
        <TopBar onBack={() => setStage(talkLive.length ? 'talk' : 'offer')} say={say.counter} />
        <View style={{ flex: 1 }} />
        {apiError ? (
          <Txt size={16} w="700" color="red" role="alert">
            {apiError}
          </Txt>
        ) : null}
        <Btn
          label="Send your price"
          busy={sendingPrice}
          disabled={false}
          onPress={() => void sendPrice()}
        />
      </Screen>
    );

  if (stage === 'talk')
    return (
      <Screen scroll>
        <H1>Talk about the price</H1>
        {bubbles}
        {waitingLive && !iSaidNo ? (
          <Txt size={17} w="800" color="orange" role="alert">
            Waiting for the person to answer
          </Txt>
        ) : null}
        {iSaidNo ? (
          <Txt size={17} w="800" color="red" role="alert">
            You said no. The offer can stay open for others.
          </Txt>
        ) : null}
        {theySaidNo ? (
          <Txt size={17} w="800" color="red" role="alert">
            The person said no. The offer can stay open for others.
          </Txt>
        ) : null}
        {apiError ? (
          <Txt size={16} w="700" color="red" role="alert">
            {apiError}
          </Txt>
        ) : null}
        <TopBar onBack={goList} say={say.talk} />
        {!iSaidNo && !theySaidNo && neg?.status !== 'ACCEPTED' ? (
          <>
            <Card>
              <Txt size={16} w="700">
                {dealLine}
              </Txt>
            </Card>
            <Btn label={acceptLabel} disabled={false} onPress={() => void startAccept()} />
            <Row gap={8}>
              <Btn
                size="mid"
                kind="outline"
                label="Offer again"
                disabled={false}
                onPress={openCounter}
                style={{ flex: 1 }}
              />
              <Btn
                size="mid"
                kind="outline"
                label="Say no"
                disabled={false}
                onPress={() => void sayNo()}
                style={{ flex: 1, borderColor: c.red }}
              />
            </Row>
          </>
        ) : null}
        {iSaidNo || theySaidNo ? <Btn kind="outline" label="Back to offers" onPress={goList} /> : null}
      </Screen>
    );

  if (stage === 'post')
    return (
      <Screen scroll>
        <H1>Create your offer</H1>
        <Card>
          <Row gap={10}>
            <Flag cc={WD[dir].cc} w={46} />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Txt size={16} color="text2">
                You give
              </Txt>
              <Row gap={4}>
                <Txt size={28} w="800" noTr>
                  {WD[dir].sym}
                </Txt>
                <PadNumberInput accessibilityLabel="You give" decimal padKey="people-give" value={amtShow(amount)} onChangeText={(v) => setAmount(amtIn(v))} style={{ minWidth: 118, flexShrink: 1, fontSize: 28, fontFamily: 'NotoSans_800ExtraBold', textAlign: 'right', paddingVertical: 4 }} />
              </Row>
            </View>
          </Row>
          <Txt size={16} w="700" color={tooMuch ? 'red' : 'text3'}>
            {tooMuch ? 'Not enough money. You have ' + fmt(dir, bal(dir)) : 'You have ' + fmt(dir, bal(dir))}
          </Txt>
          <Divider />
          <Row gap={10}>
            <Flag cc={WD[other(dir)].cc} w={46} />
            <Txt size={19} w="800" style={{ flex: 1 }}>
              {'You want ' + WD[other(dir)].word}
            </Txt>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Swap the two moneys"
              onPress={() => {
                setDir(other(dir));
                setAmount(dir === 'CAD' ? '100000' : '100');
                setLeast(null);
              }}
              style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.field, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="swap" size={28} color={c.text} />
            </Pressable>
          </Row>
        </Card>
        <TopBar onBack={goList} say={say.post} />
        <Card>
          <H2>My rate for CA$1</H2>
          {priceStepper(rate, setRate, '#0B6E4F', 'people-rate')}
          <Txt size={16} w="600" color="text2" center>
            {ratePickText}
          </Txt>
        </Card>
        <Card>
          <Txt size={17} w="800">
            Minimum a person can buy from this offer
          </Txt>
          <Row gap={4}>
            <Txt size={24} w="800" noTr>
              {WD[dir].sym}
            </Txt>
            <PadNumberInput accessibilityLabel="Minimum a person can buy from this offer" decimal padKey="people-least" value={amtShow(leastText)} onChangeText={(v) => setLeast(amtIn(v))} style={{ minWidth: 100, flexShrink: 1, fontSize: 24, fontFamily: 'NotoSans_800ExtraBold', paddingVertical: 4 }} />
          </Row>
          <Txt size={15} w="600" color={leastBad ? 'red' : 'text3'}>
            {leastSmall
              ? 'It must be ' + minText(dir, rate) + ' or more'
              : leastBad
                ? 'It must not be more than ' + postView.give
                : 'Selling a large amount? Consider setting your minimum order above ' + tipFloorText}
          </Txt>
        </Card>
        {rewardBtn}
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: more }} onPress={() => setMore(!more)} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt size={18} w="800">
            More choices
          </Txt>
          <Icon name={more ? 'up' : 'down'} size={22} color={c.text} />
        </Pressable>
        {more ? (
          <Card>
            <Txt size={17} w="700">
              Your offer ends in
            </Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
              {OFFER_END_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.hours}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: opt.hours === hours }}
                  onPress={() => setHours(opt.hours)}
                  style={{
                    minWidth: 104,
                    paddingHorizontal: 14,
                    minHeight: 52,
                    borderRadius: 14,
                    backgroundColor: opt.hours === hours ? c.brand : c.field,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt size={16} w="800" color={opt.hours === hours ? '#FFFFFF' : c.text} noTr>
                    {opt.label}
                  </Txt>
                </Pressable>
              ))}
            </ScrollView>
          </Card>
        ) : null}
        <Card gap={4} bg={c.tileGreen}>
          <Line k={postView.theirFeeLabel} v={'−' + postView.fee} />
          <Line k="The person gets" v={postView.net} />
          <Line k={postView.myFeeLabel} v={postView.myFeeShow} />
          <Line k="You get" v={postView.get} strong />
          <Txt size={16} w="700" color={amountSmall ? 'red' : 'text2'}>
            {apiError || (amountSmall ? 'Too small. The least is ' + minText(dir, rate) : rateBad ? 'Pick a price from ₦' + LOW.toLocaleString('en-CA') + ' to ₦' + HIGH.toLocaleString('en-CA') : 'Your offer ends in ' + hoursLabel(hours))}
          </Txt>
        </Card>
        <Btn label="Post your offer" disabled={blocked} onPress={() => { setPinFor('post'); setPinBack('post'); setStage('pin'); }} />
        {overlays}
      </Screen>
    );

  if (stage === 'bought')
    return (
      <Screen scroll>
        <View style={{ alignItems: 'center', gap: 8, marginTop: 14 }}>
          <Circle icon="check" />
          <H1 center>Done!</H1>
          <Txt size={30} w="800" noTr>
            {rec.youGet}
          </Txt>
          <P center>{'is now in your ' + rec.getName}</P>
          <Txt size={16} w="700" color="text2" center>
            {rec.restText}
          </Txt>
        </View>
        <Card gap={4}>
          <Line k="You gave" v={rec.youGive} />
          <Line k={rec.feeLabel} v={rec.feeShow} />
          <Line k="Price" v={rec.priceText} />
          <Divider />
          <Txt size={15} w="600" color="text3" noTr>
            {doneAt.toLocaleString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </Txt>
        </Card>
        <TopBar onBack={false} say={say.bought} />
        <View style={{ flex: 1 }} />
        <Btn label="Go home" onPress={() => router.replace('/Main')} />
        <Btn kind="outline" size="mid" label="See offers" onPress={goList} />
      </Screen>
    );

  if (stage === 'nowDone')
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: 8, marginTop: 14 }}>
          <Circle icon="check" />
          <H1 center>Done!</H1>
          <Txt size={30} w="800" noTr>
            {now.get}
          </Txt>
          <P center>{'is now in your ' + now.getName}</P>
        </View>
        <Card gap={4}>
          <Line k="You gave" v={now.give} />
          <Line k="Palpeer rate" v={now.palText} />
          <Line k="Fee" v="No fee" />
          <Txt size={16} w="700" color="text2">
            Your offer is closed.
          </Txt>
        </Card>
        <TopBar onBack={false} say={say.nowDone} />
        <View style={{ flex: 1 }} />
        <Btn label="Go home" onPress={() => router.replace('/Main')} />
      </Screen>
    );

  if (stage === 'ended')
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: 8, marginTop: 14 }}>
          <Circle icon="clock" bg="#46574F" />
          <H1 center>Your offer ended</H1>
          <P center>No one bought the rest.</P>
          <Txt size={30} w="800" noTr>
            {endedAmt}
          </Txt>
          <P center>is back in your wallet</P>
        </View>
        <TopBar onBack={false} say={say.ended} />
        <View style={{ flex: 1 }} />
        <Btn label="Instant Exchange" onPress={() => router.replace('/Change')} />
        <Btn kind="outline" size="mid" label="Make a new offer" onPress={() => { setReward(null); setStage('post'); }} />
        <Btn kind="link" label="Go home" onPress={() => router.replace('/Main')} />
      </Screen>
    );

  if (stage === 'live' && liveOffer)
    return (
      <Screen scroll>
        <H1>My offer</H1>
        {liveOffer.left <= 1800 ? (
          <Row gap={10} style={{ borderRadius: 18, backgroundColor: c.warnBg, padding: 12 }}>
            <Txt size={16} w="700" style={{ flex: 1 }}>
              {live.leftText + '. No wait with Instant Exchange.'}
            </Txt>
            <Btn size="small" label="Instant Exchange" onPress={() => setStopping(true)} />
          </Row>
        ) : null}
        <H2>Waiting for a person</H2>
        <Card gap={6}>
          {live.hasSold ? (
            <>
              <Txt size={17} w="800" color="brandText">
                {live.soldText + ' bought. ' + live.give + ' still posted.'}
              </Txt>
              <View accessibilityLabel={live.soldText + ' bought of ' + live.original} style={{ height: 12, borderRadius: 6, backgroundColor: c.field, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(live.soldPct * 100)}%`, height: 12, backgroundColor: c.brand }} />
              </View>
              <Txt size={15} color="text3">
                {'Your full offer was ' + live.original}
              </Txt>
              <Divider />
            </>
          ) : null}
          <Line k="You still give" v={live.give} />
          <Line k={live.theirFeeLabel} v={'−' + live.fee} />
          <Line k="The person gets" v={live.net} />
          <Line k={live.myFeeLabel} v={live.myFeeShow} />
          <Line k="You get" v={live.get} strong />
          <Divider />
          {live.hasReward ? (
            <Txt size={15} w="700" color="purple">
              {live.rewardNote}
            </Txt>
          ) : null}
          <Txt size={17} w="700" noTr>
            {live.priceText}
          </Txt>
          <Txt size={15} color="text2">
            {'Minimum a person can buy: ' + live.leastText}
          </Txt>
          <Txt size={16} w="700" color="orange">
            {live.leftText}
          </Txt>
          <Txt size={15} color="text3">
            {'Your ' + live.give + ' is held for this offer. It comes back if the offer ends or you stop it.'}
          </Txt>
        </Card>
        <TopBar onBack={goList} say={say.live} />
        <Btn icon="share" label="Share this offer" onPress={() => { setSharing(true); setCopied(''); }} />
        <Btn kind="outline" size="mid" label="Stop this offer" style={{ borderColor: c.red }} onPress={() => void stopLiveOffer()} />

        <Overlay open={sharing}>
          <Screen scroll>
            <TopBar onBack={() => setSharing(false)} />
            <H1>Share your offer</H1>
            <Card>
              <Txt size={18} w="700" noTr>
                {shareText}
              </Txt>
            </Card>
            <Btn size="mid" label={copied || 'Copy message'} onPress={() => copyShare('Copied')} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                { name: 'WhatsApp', href: 'https://wa.me/?text=' + encodeURIComponent(shareText) },
                { name: 'Facebook', href: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(offerLink) },
                { name: 'TikTok', paste: true },
                { name: 'Instagram', paste: true },
                { name: 'X', href: 'https://x.com/intent/tweet?text=' + encodeURIComponent(shareText) },
                { name: 'Telegram', href: 'https://t.me/share/url?url=' + encodeURIComponent(offerLink) + '&text=' + encodeURIComponent(shareText) },
                { name: 'Text message', href: 'sms:?&body=' + encodeURIComponent(shareText) },
                { name: 'Other apps', other: true },
              ].map((a) => (
                <Btn
                  key={a.name}
                  size="small"
                  kind="soft"
                  label={a.name}
                  style={{ flexBasis: '47%', flexGrow: 1 }}
                  onPress={() => {
                    if (a.href) Linking.openURL(a.href).catch(() => copyShare('Copied'));
                    else if (a.other) Share.share({ message: shareText }).catch(() => {});
                    else copyShare('Copied. Paste it in ' + a.name);
                  }}
                />
              ))}
            </View>
          </Screen>
        </Overlay>

        <Overlay open={stopping}>
          <Screen>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <H1 center>Stop your offer?</H1>
              <P center>To use Instant Exchange, your offer must stop first.</P>
              <Txt size={30} w="800" noTr>
                {live.give}
              </Txt>
              <P center>comes back to your wallet</P>
            </View>
            <Btn
              label="Yes, stop and change"
              onPress={() => {
                setStopping(false);
                void (async () => {
                  await stopLiveOffer();
                  router.replace('/Change');
                })();
              }}
            />
            <Btn kind="outline" size="mid" label="No, keep your offer" onPress={() => setStopping(false)} />
          </Screen>
        </Overlay>
        {overlays}
      </Screen>
    );

  /* list */
  if (!any)
    return (
      <Screen>
        <H1>Trade Peer to Peer</H1>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Circle icon="people" bg="#1D5BC7" />
          <H2 center>No one is here yet</H2>
          <P center>Make your own offer. A person can take it.</P>
        </View>
        <TopBar say={say.list} />
        <Btn label="Create your offer" onPress={() => { setReward(null); setStage('post'); }} />
        <Btn kind="link" label="Instant Exchange instead" onPress={() => router.replace('/Change')} />
      </Screen>
    );

  return (
    <Screen scroll>
      <Row between>
        <H1>Trade Peer to Peer</H1>
        <Row gap={4}>
          <Flag cc="CA" w={36} />
          <Flag cc="NG" w={36} />
        </Row>
      </Row>
      <H2>{"People's offers"}</H2>
      {offers.map((o) => {
        const v = buyerView(o, o.rate);
        return (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            onPress={() => {
              setReward(null);
              setOpenId(o.id);
              setTake(String(o.amt));
              setDealRate(o.rate);
              setMyPrice(Math.max(LOW, o.rate - 10));
              setTalk([]);
              setWaiting(false);
              setStage('offer');
            }}
            style={{ borderRadius: 20, backgroundColor: c.card, padding: 14, gap: 8 }}
          >
            {moneyRow(v.getCc, 'You get, after fee', v.youGet)}
            {moneyRow(v.giveCc, 'You give', v.youGive)}
            <Txt size={16} w="700" color="orange" noTr={false}>
              {v.priceText + '. ' + v.leftText}
            </Txt>
            <Txt size={15} color="text3">
              {v.rangeText}
            </Txt>
          </Pressable>
        );
      })}
      {offers.length === 0 ? (
        <Card>
          <Txt size={17} w="700">
            No one else is here yet.
          </Txt>
        </Card>
      ) : null}
      {mine.length ? <H2>My offers</H2> : null}
      {mine.map((o) => {
        const v = sellerView(o);
        return (
          <Pressable key={o.id} accessibilityRole="button" onPress={() => { setMineId(o.id); setStage('live'); }} style={{ borderRadius: 20, backgroundColor: c.card, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 3, borderColor: '#1D5BC7' }}>
            <Flag cc={v.giveCc} w={46} />
            <View style={{ flex: 1 }}>
              <Txt size={18} w="800">
                {o.sold ? v.give + ' still posted' : 'You give ' + v.give}
              </Txt>
              <Txt size={15} w="600" color="text2">
                {'You get ' + v.get + '. ' + v.leftText}
              </Txt>
            </View>
          </Pressable>
        );
      })}
      <TopBar say={say.list} />
      <Btn icon="plus" label="Create your offer" onPress={() => { setReward(null); setStage('post'); }} />
      {overlays}
    </Screen>
  );
}
