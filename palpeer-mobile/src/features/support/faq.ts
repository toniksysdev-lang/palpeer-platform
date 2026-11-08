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

/** Expand casual wording so Live Chat matches How-To titles without the remote AI. */
const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['add', 'fund', 'funding', 'deposit', 'topup', 'top-up', 'money', 'naira', 'dollars'],
  ['take', 'withdraw', 'withdrawal', 'cashout', 'cash-out', 'payout'],
  ['change', 'swap', 'convert', 'exchange', 'instantex', 'instant'],
  ['send', 'transfer', 'pay'],
  ['p2p', 'peer', 'marketplace', 'offer', 'trade', 'negotiate'],
  ['pin', 'password', 'biometric', 'fingerprint', 'face'],
  ['kyc', 'identity', 'verify', 'verification', 'id', 'passport', 'selfie'],
  ['wallet', 'wallets', 'balance', 'balances'],
  ['card', 'cards', 'virtual'],
  ['bonus', 'referral', 'invite', 'points', 'promotion', 'promotions'],
  ['notification', 'notifications', 'alert', 'alerts'],
  ['rate', 'rates', 'fx'],
  ['chat', 'support', 'agent', 'ticket', 'help'],
  ['profile', 'details', 'account', 'email', 'phone'],
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
      if (score >= minScore) scored.push({ item, score });
    }
  }
  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score || a.item.question.length - b.item.question.length);
  return scored[0]!.item.answer;
}

/** Short topics list when we cannot match a specific How-To. */
export function localAssistantTopicsHint(): string {
  return [
    "I can still help from Palpeer's in-app Help topics — try asking about wallets, adding money, InstantEX, P2P, PIN, KYC, cards, or referrals.",
    'Or tap Talk to agent / leave a support ticket.',
  ].join(' ');
}
