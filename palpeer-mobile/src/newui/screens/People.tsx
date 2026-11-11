import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, Share, View } from 'react-native';
import type { useLivePeople } from '@/design/bridge/useLivePeople';
import { PinStep } from '@/newui/features/PinStep';
import { amtIn, amtShow } from '@/newui/lib/money';
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
const LOW = 950;
const HIGH = 1000;
const STEP = 5;
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
const hoursLabel = (h: number) => h + (h === 1 ? ' hour' : ' hours');
const leftLabel = (s: number) => {
  const m = Math.ceil(s / 60);
  if (m >= 60) return hoursLabel(Math.ceil(m / 60)) + ' left';
  return m + (m === 1 ? ' minute left' : ' minutes left');
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
  const backend = !!props.backend;
  const { listen, listenLabel } = useListen();
  const startStage = props.stage || 'list';
  const none = startStage === 'empty';
  const talking = startStage === 'talk';
  const offersSeed: Offer[] = backend ? mapLiveOffers(props.liveOffers) : none ? [] : [SAMPLE_OFFER, SAMPLE_OFFER_2];
  const mineSeed: Offer[] = backend ? mapLiveMine(props.liveMine) : none ? [] : [SAMPLE_MINE];
  const firstMine = backend ? props.liveMine?.[0] : mineSeed[0] ?? SAMPLE_MINE;

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
  const [endedAmt, setEndedAmt] = useState(
    firstMine ? fmt(asCode(firstMine.giveCode), firstMine.amt) : fmt('NGN', SAMPLE_MINE.amt),
  );
  const [offers, setOffers] = useState<Offer[]>(none ? [] : offersSeed);
  const [mine, setMine] = useState<Offer[]>(none ? [] : mineSeed);
  const [openId, setOpenId] = useState(offersSeed[0]?.id ?? (backend ? '' : 'p1'));
  const [take, setTake] = useState('100');
  const [mineId, setMineId] = useState(mineSeed[0]?.id ?? (backend ? '' : 'm1'));
  const [dealRate, setDealRate] = useState(talking ? 975 : 980);
  const [myPrice, setMyPrice] = useState(970);
  const [talk, setTalk] = useState<{ me: boolean; rate: number }[]>(talking ? [{ me: false, rate: 980 }, { me: true, rate: 970 }, { me: false, rate: 975 }] : []);
  const [waiting, setWaiting] = useState(false);
  const [dir, setDir] = useState<Code>('CAD');
  const [amount, setAmount] = useState('100');
  const [least, setLeast] = useState<string | null>(null);
  const [rate, setRate] = useState(990);
  const [hours, setHours] = useState(1);
  const [more, setMore] = useState(false);
  const [pinFor, setPinFor] = useState<'buy' | 'post' | 'nudge'>('buy');
  const [pinBack, setPinBack] = useState<Stage>('offer');
  const [waved, setWaved] = useState<string[]>(!props.stage || props.stage === 'live' ? [] : ['m1']);
  const [nudgeId, setNudgeId] = useState<string | null>(null);
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
    setOpenId((id) => next.find((o) => o.id === id)?.id ?? next[0]?.id ?? '');
    if (!next.length) {
      setStage((s) => (['offer', 'counter', 'talk'].includes(s) ? 'list' : s));
      setTalk([]);
      setWaiting(false);
    }
  }, [backend, props.liveOffers]);

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

  const bal = useCallback(
    (k: Code) => (backend ? props.liveBalances?.[k] ?? 0 : DEMO_BAL[k] ?? 0),
    [backend, props.liveBalances],
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

  const negOtherOffer = useCallback((neg: NonNullable<LivePeople['liveNegotiations']>[number] | null) => {
    if (!neg?.offers) return null;
    return (
      [...neg.offers].reverse().find((o) => o.offeredBy !== neg.counterpartyId && o.status === 'PENDING') ?? null
    );
  }, []);

  // Count down every offer; when one of mine ends while I look at it, show "Your offer ended".
  useEffect(() => {
    const t = setInterval(() => {
      const tick = (o: Offer) => ({ ...o, left: Math.max(0, o.left - 10) });
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
    }, 10000);
    return () => {
      clearInterval(t);
      if (reply.current) clearTimeout(reply.current);
    };
  }, []);

  const any = offers.length + mine.length > 0;
  const openRaw = offers.find((o) => o.id === openId) || (backend ? offers[0] : undefined) || SAMPLE_OFFER;
  const open = openRaw;
  const neg = openRaw ? negotiationFor(openRaw.id) : null;
  const negOther = negOtherOffer(neg);
  const talkLive = neg?.offers
    ? neg.offers.map((o) => ({ me: o.offeredBy === neg.counterpartyId, rate: parseFloat(o.rate) || 0 }))
    : talk;
  const dealRateLive = negOther ? parseFloat(negOther.rate) || dealRate : dealRate;
  const waitingLive = waiting || !!(neg?.offers?.length && neg.offers[neg.offers.length - 1]?.offeredBy === neg.counterpartyId && neg.offers[neg.offers.length - 1]?.status === 'PENDING');
  const takeNum = backend
    ? (negOther ? parseFloat(String(negOther.amount)) || open.amt : parseFloat(take) || open.amt)
    : parseFloat(take) || 0;
  const takeShown = backend ? String(takeNum) : take;
  const feeEats = takeNum > 0 && feeOf(open.giveCode, takeNum, dealRateLive) >= takeNum;
  const takeBad = takeNum < open.least || takeNum > open.amt || feeEats;
  const deal = buyerView(open, dealRateLive, takeNum, reward);
  const mineDeal = buyerView(open, myPrice, takeNum, reward);
  const short = deal.pay > bal(deal.payCode);
  const n = parseFloat(amount) || 0;
  const leastText = least === null ? (dir === 'CAD' ? String(MIN_CAD) : String(Math.ceil(MIN_CAD * rate))) : least;
  const leastNum = parseFloat(leastText) || 0;
  const amountSmall = tooSmall(dir, n, rate);
  const leastSmall = !amountSmall && tooSmall(dir, leastNum, rate);
  const leastBad = leastNum > n || leastSmall;
  const tooMuch = n > bal(dir);
  const rateBad = rate < LOW || rate > HIGH;
  const blocked = n <= 0 || tooMuch || leastBad || amountSmall || rateBad;
  const nudgeOffer =
    !backend && ['list', 'offer', 'live'].includes(stage) && !sharing && !rewardPanel
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

  const sendPrice = async () => {
    const opening = talkLive.length ? talkLive : [{ me: false, rate: dealRateLive }];
    if (backend) {
      if (!openRaw || !props.onSendCounter) return;
      setStage('talk');
      setWaiting(true);
      setApiError('');
      setTalk([...opening, { me: true, rate: myPrice }]);
      const r = await props.onSendCounter({
        requestId: openRaw.id,
        amount: String(takeNum || open.amt),
        rate: String(myPrice),
        negotiationId: neg?.id ?? null,
      });
      if (!r?.ok) {
        setApiError(r?.error || 'Could not send my price.');
        setStage('counter');
        setWaiting(false);
        return;
      }
      setWaiting(false);
      if (!neg && r.data && typeof r.data === 'object' && r.data !== null && 'id' in r.data) {
        void props.onOpenNegotiationChat?.(String((r.data as { id: string }).id));
      }
      return;
    }
    setStage('talk');
    setWaiting(true);
    setTalk([...opening, { me: true, rate: myPrice }]);
    reply.current = setTimeout(() => {
      const answer = Math.round((myPrice + dealRateLive) / 2 / STEP) * STEP;
      setWaiting(false);
      setDealRate(answer);
      setTalk((t) => [...t, { me: false, rate: answer }]);
    }, 2500);
  };
  const goList = () => {
    setStage('list');
    setTalk([]);
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
      if (stage === 'talk' && neg && negOther) {
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
    list: any ? 'Choose a person. Tap an offer to see it. Or make your own offer.' : 'No one is here yet. Make your own offer and a person can take it. Or change now instead.',
    offer: "A person's offer. You give " + deal.youGive + '. After the fee, you get ' + deal.youGet + '. Tap Accept and buy, or offer a different price.',
    counter: 'Offer a different price. Your price is ' + myPrice + ' naira for one Canada dollar. Tap minus or plus, then send.',
    talk: waiting ? 'Waiting for the person to answer.' : "The person's price is " + dealRate + ' naira for one Canada dollar. You can accept, offer again, or say no.',
    post: 'Make your offer. You give ' + postView.give + '. The person gets ' + postView.net + ' after their fee. You get ' + postView.get + ' after your fee.',
    pin: 'Enter your 4 number PIN, or use your fingerprint.',
    bought: 'Done. ' + rec.youGet + ' is now in your ' + rec.getName + '.',
    ended: 'Your offer ended. No one bought the rest. ' + endedAmt + ' is back in your wallet.',
    nowDone: 'Done. ' + now.get + ' is now in your ' + now.getName + '. Your offer is closed.',
    live:
      (liveOffer && liveOffer.left <= 1800 ? leftLabel(liveOffer.left) + '. You can use Change now with no waiting. ' : '') +
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
          accessibilityLabel="My price for CA$1"
          padKey={padKey}
          maxLength={4}
          value={value ? String(value) : ''}
          onChangeText={(raw) => {
            const digits = raw.replace(/\D/g, '');
            if (!digits) {
              set(0);
              return;
            }
            const n = parseInt(digits, 10);
            if (!Number.isFinite(n)) return;
            // Cap at HIGH while typing; allow below LOW so 9 → 95 → 950 works on the pad.
            set(Math.min(HIGH, n));
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
      {talkLive.map((b, i) => (
        <View key={i} style={{ alignSelf: b.me ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
          <Txt size={14} w="700" color="text3" style={{ textAlign: b.me ? 'right' : 'left' }}>
            {b.me ? 'My price' : "The person's price"}
          </Txt>
          <View style={{ borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: b.me ? '#1D5BC7' : c.field }}>
            <Txt size={19} w="800" color={b.me ? '#FFFFFF' : c.text} noTr>
              {price(b.rate)}
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
      <Modal visible={!!nudge} transparent animationType="fade" onRequestClose={() => nudgeOffer && setWaved([...waved, nudgeOffer.id])}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, gap: 10 }}>
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
            You want to buy
          </Txt>
          <Row gap={6}>
            <Txt size={28} w="800" noTr>
              {WD[open.giveCode].sym}
            </Txt>
            <PadNumberInput
              accessibilityLabel="You want to buy"
              decimal
              padKey="people-take"
              value={amtShow(takeShown)}
              onChangeText={(v) => !backend && setTake(amtIn(v))}
              editable={!backend}
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
        <Btn kind="outline" size="mid" label="Offer a different price" onPress={() => setStage('counter')} />
        {overlays}
      </Screen>
    );

  if (stage === 'counter')
    return (
      <Screen scroll>
        <H1>Offer a different price</H1>
        <Card>
          <H2>My price for CA$1</H2>
          {priceStepper(myPrice, setMyPrice, '#1D5BC7', 'people-counter-rate')}
          <Txt size={16} w="600" color="text2" center>
            {'The person asks ₦' + dealRateLive + '. You can pick ₦950 to ₦1,000'}
          </Txt>
          <Divider />
          <Line k="You buy" v={mineDeal.offerAmt} />
          <Line k={mineDeal.feeLabel} v={mineDeal.feeShow} />
          <Line k="You get" v={mineDeal.youGet} strong />
          <Line k="You give" v={mineDeal.youGive} />
        </Card>
        <TopBar onBack={() => setStage(talkLive.length ? 'talk' : 'offer')} say={say.counter} />
        <View style={{ flex: 1 }} />
        <Btn label="Send your price" onPress={() => void sendPrice()} />
      </Screen>
    );

  if (stage === 'talk')
    return (
      <Screen scroll>
        <H1>Talk about the price</H1>
        {bubbles}
        {waitingLive ? (
          <Txt size={17} w="800" color="orange" role="alert">
            Waiting for the person to answer
          </Txt>
        ) : null}
        <TopBar onBack={goList} say={say.talk} />
        {!waitingLive ? (
          <>
            <Card>
              <Txt size={16} w="700">
                {'At ₦' + dealRateLive + ': you give ' + deal.youGive + ', you get ' + deal.youGet}
              </Txt>
            </Card>
            <Btn label={'Accept ₦' + dealRateLive + ' and buy'} disabled={takeBad || short} onPress={() => void startAccept()} />
            <Row gap={8}>
              <Btn size="mid" kind="outline" label="Offer again" onPress={() => setStage('counter')} style={{ flex: 1 }} />
              <Btn size="mid" kind="outline" label="Say no" onPress={goList} style={{ flex: 1, borderColor: c.red }} />
            </Row>
          </>
        ) : null}
      </Screen>
    );

  if (stage === 'post')
    return (
      <Screen scroll>
        <H1>Make your offer</H1>
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
          <H2>My price for CA$1</H2>
          {priceStepper(rate, setRate, '#0B6E4F', 'people-rate')}
          <Txt size={16} w="600" color="text2" center>
            You can pick ₦950 to ₦1,000
          </Txt>
        </Card>
        <Card>
          <Txt size={17} w="800">
            Least a person can buy
          </Txt>
          <Row gap={4}>
            <Txt size={24} w="800" noTr>
              {WD[dir].sym}
            </Txt>
            <PadNumberInput accessibilityLabel="Least a person can buy" decimal padKey="people-least" value={amtShow(leastText)} onChangeText={(v) => setLeast(amtIn(v))} style={{ minWidth: 100, flexShrink: 1, fontSize: 24, fontFamily: 'NotoSans_800ExtraBold', paddingVertical: 4 }} />
          </Row>
          <Txt size={15} w="600" color={leastBad ? 'red' : 'text3'}>
            {leastSmall ? 'It must be ' + minText(dir, rate) + ' or more' : leastBad ? 'It must not be more than ' + postView.give : 'You choose this. Buyers cannot change it.'}
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
            <Row gap={8}>
              {[1, 6, 24].map((h) => (
                <Pressable key={h} accessibilityRole="radio" accessibilityState={{ selected: h === hours }} onPress={() => setHours(h)} style={{ flex: 1, minHeight: 52, borderRadius: 14, backgroundColor: h === hours ? c.brand : c.field, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt size={17} w="800" color={h === hours ? '#FFFFFF' : c.text}>
                    {hoursLabel(h)}
                  </Txt>
                </Pressable>
              ))}
            </Row>
          </Card>
        ) : null}
        <Card gap={4} bg={c.tileGreen}>
          <Line k={postView.theirFeeLabel} v={'−' + postView.fee} />
          <Line k="The person gets" v={postView.net} />
          <Line k={postView.myFeeLabel} v={postView.myFeeShow} />
          <Line k="You get" v={postView.get} strong />
          <Txt size={16} w="700" color={amountSmall ? 'red' : 'text2'}>
            {apiError || (amountSmall ? 'Too small. The least is ' + minText(dir, rate) : rateBad ? 'Pick a price from ₦950 to ₦1,000' : 'Your offer ends in ' + hoursLabel(hours))}
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
        <Btn label="Change now" onPress={() => router.replace('/Change')} />
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
              {live.leftText + '. No wait with Change now.'}
            </Txt>
            <Btn size="small" label="Change now" onPress={() => setStopping(true)} />
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
            {'Least a person can buy: ' + live.leastText}
          </Txt>
          <Txt size={16} w="700" color="orange">
            {live.leftText}
          </Txt>
          <Txt size={15} color="text3">
            {'Your ' + live.give + ' is held for this offer. It comes back if the offer ends or you stop it.'}
          </Txt>
        </Card>
        <TopBar onBack={goList} say={say.live} />
        <Btn icon="share" label="Share your offer" onPress={() => { setSharing(true); setCopied(''); }} />
        <Btn kind="outline" size="mid" label="Stop your offer" style={{ borderColor: c.red }} onPress={() => void stopLiveOffer()} />

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
              <P center>To use Change now, your offer must stop first.</P>
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
        <H1>Choose a person</H1>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Circle icon="people" bg="#1D5BC7" />
          <H2 center>No one is here yet</H2>
          <P center>Make your own offer. A person can take it.</P>
        </View>
        <TopBar say={say.list} />
        <Btn label="Make your offer" onPress={() => { setReward(null); setStage('post'); }} />
        <Btn kind="link" label="Change now instead" onPress={() => router.replace('/Change')} />
      </Screen>
    );

  return (
    <Screen scroll>
      <Row between>
        <H1>Choose a person</H1>
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
      <Btn icon="plus" label="Make your offer" onPress={() => { setReward(null); setStage('post'); }} />
      {overlays}
    </Screen>
  );
}
