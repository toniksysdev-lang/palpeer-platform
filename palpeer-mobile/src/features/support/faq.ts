/**
 * Help-center answers. Sourced from operational How-Tos so FAQ and Live Chat stay aligned.
 * Describes only screens/behaviours that exist (R-SP-2). Product should approve wording (SP-1).
 */
import { OPERATIONAL_HOW_TOS, type HowToSection } from './operationalHowTos';

export type FaqItem = { id: string; question: string; answer: string };
export type FaqSection = { id: string; title: string; items: readonly FaqItem[] };

function toFaqSections(sections: readonly HowToSection[]): FaqSection[] {
  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    items: section.items.map((item) => ({
      id: item.id,
      question: item.title,
      answer: item.body,
    })),
  }));
}

export const FAQ_SECTIONS: readonly FaqSection[] = toFaqSections(OPERATIONAL_HOW_TOS);

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'how',
  'do',
  'does',
  'did',
  'i',
  'my',
  'a',
  'an',
  'to',
  'of',
  'is',
  'are',
  'can',
  'could',
  'what',
  'where',
  'when',
  'why',
  'with',
  'on',
  'in',
  'me',
  'you',
  'your',
  'please',
  'want',
  'need',
  'help',
  'about',
  'this',
  'that',
  'from',
  'into',
  'just',
  'tell',
]);

/**
 * Expand casual wording so Live Chat matches How-To titles.
 * Keep verbs in separate groups — do not put shared nouns like "money" in fund/withdraw
 * (that made "withdraw money" score as "add money").
 */
const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['add', 'fund', 'funding', 'deposit', 'topup', 'top-up'],
  ['take', 'withdraw', 'withdrawal', 'cashout', 'cash-out', 'payout'],
  ['change', 'swap', 'convert', 'exchange', 'instantex', 'instant', 'changing'],
  ['send', 'transfer', 'pay'],
  ['p2p', 'peer', 'marketplace', 'offer', 'trade', 'negotiate'],
  ['pin', 'password', 'biometric', 'fingerprint', 'face'],
  ['kyc', 'identity', 'verify', 'verification', 'id', 'passport', 'selfie'],
  ['wallet', 'wallets', 'balance', 'balances'],
  ['card', 'cards', 'virtual'],
  ['bonus', 'referral', 'invite', 'points', 'promotion', 'promotions'],
  ['notification', 'notifications', 'alert', 'alerts'],
  ['rate', 'rates', 'fx'],
  ['fee', 'fees', 'charge', 'charges', 'cost', 'costs'],
  ['chat', 'support', 'agent', 'ticket', 'help'],
  ['profile', 'details', 'account', 'email', 'phone'],
];

/** Exact / near-exact prompts → FAQ item id (quick chips + common phrasing). */
const PHRASE_ALIASES: readonly { re: RegExp; id: string }[] = [
  { re: /\b(what are|whats|what's|tell me|explain).*(fees?|charges?|costs?)\b/, id: 'fees-overview' },
  { re: /^(fees?|charges?|costs?)$/i, id: 'fees-overview' },
  { re: /\bp2p fee|fee.*(p2p|person|offer)|(p2p|person|offer).*fee\b/, id: 'fees-overview' },
  { re: /\btop[- ]?up\b/, id: 'fund-how' },
  { re: /\b(how (do|can|to) i )?(add|fund|deposit)(\s+(money|wallet|cad|ngn))?\b/, id: 'fund-how' },
  { re: /\b(how (do|can|to) i )?withdraw( money| funds?)?\b/, id: 'withdraw-how' },
  { re: /\b(how (do|can|to) i )?(change|swap|convert)( money| funds?)?\b/, id: 'exchange-how' },
  { re: /\bforgot.*\bpin\b/, id: 'forgot-pin' },
  { re: /\bforgot.*password\b/, id: 'forgot-password' },
];

/** Intent tokens that should win over rival How-Tos when present in the query. */
const INTENT_BOOSTS: readonly { tokens: readonly string[]; preferIdPrefix: string; boost: number }[] = [
  { tokens: ['withdraw', 'withdrawal', 'cashout', 'payout'], preferIdPrefix: 'withdraw', boost: 12 },
  { tokens: ['add', 'fund', 'funding', 'deposit', 'topup', 'top-up'], preferIdPrefix: 'fund', boost: 12 },
  { tokens: ['change', 'swap', 'convert', 'exchange', 'instantex', 'changing'], preferIdPrefix: 'exchange', boost: 12 },
  { tokens: ['fee', 'fees', 'charge', 'charges', 'cost'], preferIdPrefix: 'fees', boost: 14 },
  { tokens: ['send', 'transfer'], preferIdPrefix: 'send', boost: 10 },
  { tokens: ['p2p', 'peer', 'marketplace', 'negotiate'], preferIdPrefix: 'p2p', boost: 10 },
  { tokens: ['pin', 'password', 'biometric'], preferIdPrefix: 'forgot', boost: 8 },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(query: string): string[] {
  return normalize(query)
    .split(' ')
    .map((word) => word.replace(/^-+|-+$/g, ''))
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function expandTokens(tokens: string[]): string[] {
  const out = new Set(tokens);
  for (const token of tokens) {
    for (const group of SYNONYM_GROUPS) {
      if (group.includes(token)) {
        for (const alt of group) out.add(alt);
      }
    }
  }
  return [...out];
}

function findItemById(id: string): FaqItem | null {
  for (const section of FAQ_SECTIONS) {
    const hit = section.items.find((item) => item.id === id);
    if (hit) return hit;
  }
  return null;
}

/** Look up a How-To answer by stable FAQ item id (for quick chips). */
export function answerHowToById(id: string): string | null {
  return findItemById(id)?.answer ?? null;
}

function matchPhraseAlias(query: string): string | null {
  const text = normalize(query);
  for (const alias of PHRASE_ALIASES) {
    if (alias.re.test(text)) {
      const item = findItemById(alias.id);
      if (item) return item.answer;
    }
  }
  return null;
}

function intentScore(itemId: string, tokens: string[]): number {
  let score = 0;
  for (const intent of INTENT_BOOSTS) {
    const queryHas = intent.tokens.some((t) => tokens.includes(t));
    if (!queryHas) continue;
    if (itemId.startsWith(intent.preferIdPrefix) || itemId.includes(intent.preferIdPrefix)) {
      score += intent.boost;
    } else {
      // Penalize rival how-tos when the query clearly names another intent.
      score -= Math.floor(intent.boost / 2);
    }
  }
  return score;
}

/** Sections whose questions or answers contain every word of the query. */
export function searchFaq(
  query: string,
  sections: readonly FaqSection[] = FAQ_SECTIONS,
): FaqSection[] {
  const words = normalize(query).split(' ').filter(Boolean);
  if (words.length === 0) return [...sections];
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const text = normalize(`${item.question} ${item.answer}`);
        return words.every((word) => text.includes(word));
      }),
    }))
    .filter((section) => section.items.length > 0);
}

export type AnswerHowToOptions = {
  /** Lower score threshold — used when the remote Support AI is unavailable. */
  loose?: boolean;
};

/**
 * Best local How-To answer for Live Chat when the remote AI is overloaded or
 * when the user asks a product how-to that matches Help Center content.
 */
export function answerHowToFromFaq(
  query: string,
  options: AnswerHowToOptions = {},
): string | null {
  const alias = matchPhraseAlias(query);
  if (alias) return alias;

  const tokens = tokenize(query);
  if (tokens.length === 0) return null;
  const expanded = expandTokens(tokens);
  const loose = Boolean(options.loose);
  const minScore = loose ? 1 : 2;

  type Scored = { item: FaqItem; score: number };
  const scored: Scored[] = [];
  for (const section of FAQ_SECTIONS) {
    for (const item of section.items) {
      const question = normalize(item.question);
      const text = normalize(`${item.question} ${item.answer} ${section.title}`);
      let score = 0;
      for (const word of expanded) {
        if (question.includes(word)) score += 3;
        else if (text.includes(word)) score += 1;
      }
      // Exact-ish phrase boost for the original significant tokens.
      for (const word of tokens) {
        if (question.includes(word)) score += 1;
      }
      score += intentScore(item.id, tokens);
      if (score >= minScore) scored.push({ item, score });
    }
  }
  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score || a.item.question.length - b.item.question.length);
  // Reject weak loose matches that barely cleared the floor (often wrong how-tos).
  if (!loose && scored[0]!.score < minScore + 1 && tokens.length >= 2) {
    // still allow if title strongly matches
    const top = scored[0]!;
    const q = normalize(top.item.question);
    const strongTitle = tokens.some((word) => q.includes(word));
    if (!strongTitle) return null;
  }
  return scored[0]!.item.answer;
}

/** Short topics list when we cannot match a specific How-To. */
export function localAssistantTopicsHint(): string {
  return [
    "I can still help from Palpeer's in-app Help topics — try asking about wallets, adding money, InstantEX, P2P, PIN, KYC, cards, or referrals.",
    'Or tap Talk to agent / leave a support ticket.',
  ].join(' ');
}
