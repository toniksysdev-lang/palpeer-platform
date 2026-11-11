/** Data for the start flow: countries (added by admin), provinces, questions, incomes, ID types, sample offers. */

export type Country = {
  id: string;
  name: string;
  dial: string;
  cc: string;
  wallet: string;
  sym: string;
  zero: string;
  scale: number;
  min: number;
  max: number;
  postal: boolean;
  provName: string;
  sample: string;
};

/** Every country the admin has added. Phone sign-up allows all of them. */
export const COUNTRIES: Country[] = [
  { id: 'ca', name: 'Canada', dial: '+1', cc: 'CA', wallet: 'Canada dollars', sym: 'CA$', zero: 'CA$0.00', scale: 1, min: 10, max: 10, postal: true, provName: 'Province or territory', sample: 'Ontario' },
  { id: 'ng', name: 'Nigeria', dial: '+234', cc: 'NG', wallet: 'Nigeria naira', sym: '₦', zero: '₦0', scale: 1000, min: 10, max: 10, postal: false, provName: 'State', sample: 'Lagos' },
  { id: 'us', name: 'USA', dial: '+1', cc: 'US', wallet: 'USA dollars', sym: 'US$', zero: 'US$0.00', scale: 1, min: 10, max: 10, postal: true, provName: 'State', sample: 'Sample state' },
  { id: 'gb', name: 'United Kingdom', dial: '+44', cc: 'GB', wallet: 'UK pounds', sym: '£', zero: '£0.00', scale: 1, min: 10, max: 10, postal: true, provName: 'County', sample: 'Sample county' },
  { id: 'gh', name: 'Ghana', dial: '+233', cc: 'GH', wallet: 'Ghana cedis', sym: 'GH₵', zero: 'GH₵0.00', scale: 10, min: 10, max: 10, postal: false, provName: 'Region', sample: 'Sample region' },
  { id: 'ke', name: 'Kenya', dial: '+254', cc: 'KE', wallet: 'Kenya shillings', sym: 'KSh ', zero: 'KSh 0', scale: 100, min: 10, max: 10, postal: false, provName: 'County', sample: 'Sample county' },
  { id: 'za', name: 'South Africa', dial: '+27', cc: 'ZA', wallet: 'South Africa rand', sym: 'R', zero: 'R0.00', scale: 10, min: 10, max: 10, postal: true, provName: 'Province', sample: 'Sample province' },
];
export const countryOf = (id: string): Country => COUNTRIES.find((c) => c.id === id) ?? COUNTRIES[0]!;
/** Where the six flags sit around the globe on the landing page (x, y in a 320 x 240 box). */
export const FLAG_SPOTS = [
  [30, 18],
  [240, 14],
  [2, 112],
  [268, 96],
  [212, 180],
  [58, 186],
];

/** Landing hero artboard (design units) — globe + orbiting registration-country flags. */
export const LAND_HERO = {
  width: 320,
  height: 240,
  /** Globe center in the hero box (matches globe left/top + half size). */
  cx: 160,
  cy: 122,
  /** Orbit radius for flag centers. */
  orbitR: 118,
  flag: 50,
} as const;

/** Evenly spaced flag positions on the landing orbit (design units, top-left of each flag). */
export function landFlagSpots(count: number, flagSize = LAND_HERO.flag): [number, number][] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  const { cx, cy, orbitR } = LAND_HERO;
  const half = flagSize / 2;
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return [cx + orbitR * Math.cos(angle) - half, cy + orbitR * Math.sin(angle) - half] as [number, number];
  });
}

export const PROVINCES: Record<string, string[]> = {
  ca: ['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Yukon'],
  ng: ['Abia', 'Abuja (FCT)', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'],
};

export const INCOMES = ['My job', 'My business', 'Pension', 'Savings', 'Investment', 'Family or gift', 'Other'];

/** Monthly ranges in the currency of the verified phone's country. */
const HIGHS = [2000, 5000, 10000, 30000];
export const monthRanges = (c: Country) => {
  const f = (n: number) => c.sym + n.toLocaleString('en-CA');
  const list = HIGHS.map((h, i) => {
    const lo = i ? HIGHS[i - 1]! * c.scale + 1 : 1;
    return f(lo) + ' to ' + f(h * c.scale);
  });
  return [...list, 'More than ' + f(HIGHS[3]! * c.scale)];
};

export const ID_TYPES = [
  { name: 'Passport', hint: 'The data page with your photo' },
  { name: 'National ID card', hint: 'Front of the card' },
  { name: "Driver's licence", hint: 'Front of the licence' },
  { name: 'Residence permit', hint: 'Front of the permit' },
];

export const QUESTIONS = [
  'What was the name of your first school?',
  'What is the first name of your childhood best friend?',
  'In which town or city were you born?',
  'What was the name of your first pet?',
  'What was the surname of your favourite teacher?',
  'What street did you live on as a child?',
  'What was the name of the company of your first job?',
  'In which city did your parents meet?',
];

/** Sample offers shown on "Best rate now" before log in (rate in ₦ per CA$1, amount, seconds left). */
export const OFFERS = [
  { rate: 975, amt: 500, left: 3180, ca: true },
  { rate: 980, amt: 100, left: 2674, ca: true },
  { rate: 990, amt: 250000, left: 7200, ca: false },
  { rate: 985, amt: 90000, left: 1500, ca: false },
];
export const leftLabel = (t: number) => {
  const m = Math.ceil(t / 60);
  if (t <= 0) return 'Ended';
  if (m >= 60) {
    const h = Math.ceil(m / 60);
    return h + (h === 1 ? ' hour left' : ' hours left');
  }
  return m + (m === 1 ? ' minute left' : ' minutes left');
};

/** Seconds remaining until an ISO expiry (0 when past or missing). */
export const leftSeconds = (expiresAt: string | null | undefined): number => {
  if (!expiresAt) return 0;
  const ms = Date.parse(expiresAt);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.floor((ms - Date.now()) / 1000));
};

export const ageOf = (t: string) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t.trim());
  if (!m) return -1;
  const d = new Date(+m[3]!, +m[2]! - 1, +m[1]!);
  if (d.getMonth() !== +m[2]! - 1) return -1;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age -= 1;
  return age;
};

/** Sample values so the prototype is quick to click through. */
export const SAMPLE = {
  country: 'ca',
  phone: '5065550123',
  pcode: '123456',
  ecode: '123456',
  mail: 'oluwasesan@example.com',
  uname: 'oluwasesan',
  refer: '',
  pw1: 'sample123',
  pw2: 'sample123',
  who: 'oluwasesan@example.com',
  pass: 'sample123',
  created: false,
  showPw: false,
  tab: 'people' as 'people' | 'admin',
  way: 'pin' as 'pin' | 'bio',
  pinA: '',
  pinB: '',
  pinDiff: false,
  qSheet: 0,
  q1: 0,
  q2: 3,
  a1: 'Sample school',
  a2: 'Sample pet',
  gateOpen: false,
  fname: 'Oluwasesan',
  lname: 'Afolabi',
  dob: '01/01/1990',
  job: 'Employed — salary or wages',
  live: 'ca',
  prov: 'Ontario',
  addr1: '12 Sample Street',
  addr2: '',
  city: 'Sample City',
  postal: 'A1A 1A1',
  income: 'My job',
  month: 0,
  idType: 0,
  idDone: false,
  selfieDone: false,
  agree: false,
  nameEdit: false,
  mcode: '',
  mq1: '',
  mq2: '',
  mqTries: 0,
  mqErr: false,
  fails: 0,
  bizMail: '',
  fmail: 'oluwasesan@example.com',
  fcode: '123456',
  np1: 'newpass123',
  np2: 'newpass123',
  passChanged: false,
  wantHelp: false,
  buying: false,
  pickOpen: '' as '' | 'phone' | 'live' | 'prov' | 'job',
  notice: false,
};
export type StartState = typeof SAMPLE;
