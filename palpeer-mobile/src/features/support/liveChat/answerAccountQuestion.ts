import type { PublicInstantRateResponse } from '@/types/api/exchange';
import type { ProfileResponse } from '@/types/api/profile';
import type { TransactionItemResponse, WalletResponse } from '@/types/api/wallet';
import { formatMoney, formatRate } from '@/utils/money';

export type AccountSnapshot = {
  email: string | null;
  userId: string | null;
  profile: ProfileResponse | null | undefined;
  wallets: WalletResponse[] | null | undefined;
  recentTransactions: TransactionItemResponse[] | null | undefined;
  instantRates: PublicInstantRateResponse[] | null | undefined;
};

export type AccountQuestionKind = 'wallets' | 'transactions' | 'profile' | 'rates';

/**
 * Detect personal/account questions that should be answered from the live Palpeer API
 * snapshot (not the Support AI's separate email directory).
 */
export function matchAccountQuestion(message: string): AccountQuestionKind | null {
  const text = message.toLowerCase().normalize('NFKD').replace(/\s+/g, ' ').trim();
  if (!text) return null;

  // Leave product how-tos to the Support AI + operational guide ("how do I fund my wallet").
  const instructional =
    (/\bhow (do|can|to) i\b/.test(text) ||
      /\bwhere (do|can) i\b/.test(text) ||
      /\bsteps to\b/.test(text)) &&
    !/\bhow much\b/.test(text);
  if (instructional) return null;

  if (
    /\b(wallet|wallets|balance|balances|funds?|how much|available)\b/.test(text) &&
    /\b(my|i have|on my|account|do i|what are|which|show|list)\b/.test(text)
  ) {
    return 'wallets';
  }
  if (
    /\b(my|recent|show|list|what)\b/.test(text) &&
    /\b(transaction|transactions|payment|payments|funding|withdrawal|withdrawals|activity)\b/.test(
      text,
    )
  ) {
    return 'transactions';
  }
  if (
    /\b(my\s+)?(profile|personal\s+info|account\s+details?|who\s+am\s+i)\b/.test(text) ||
    /\b(what|which)\s+(is\s+)?(my\s+)?(email|name)\b/.test(text) ||
    /\bmy (email|name)\b/.test(text)
  ) {
    return 'profile';
  }
  if (
    /\b(my|current|what|show|list)\b/.test(text) &&
    /\b(instant\s*ex|exchange\s+rate|rates?|fx)\b/.test(text)
  ) {
    return 'rates';
  }
  return null;
}

/** True when the Support AI ignored the app session and claimed no Palpeer account. */
export function isMissingAccountAiReply(text: string): boolean {
  const value = text.toLowerCase();
  return (
    value.includes("couldn't find a palpeer account") ||
    value.includes('could not find a palpeer account') ||
    value.includes('no palpeer account linked') ||
    (value.includes('confirm you') && value.includes('email registered'))
  );
}

/**
 * True when the Support AI returns its overloaded / capacity stub instead of a real answer
 * (e.g. "experiencing high demand… speak with an agent").
 */
export function isCapacityAiReply(text: string): boolean {
  const value = text.toLowerCase().normalize('NFKD');
  const highDemand =
    value.includes('high demand') ||
    value.includes('high traffic') ||
    value.includes('currently experiencing') ||
    value.includes('temporarily unavailable') ||
    value.includes('too many requests');
  const agentOffer =
    value.includes('human agent') ||
    value.includes('live agent') ||
    value.includes('speak with an agent') ||
    value.includes('talk to an agent') ||
    value.includes('connect you with a human') ||
    value.includes('connect you to a human');
  return highDemand && (agentOffer || value.includes('apolog'));
}

/** Answer from the authenticated app's Palpeer backend data. */
export function answerAccountQuestion(
  kind: AccountQuestionKind,
  snapshot: AccountSnapshot,
): string {
  switch (kind) {
    case 'wallets':
      return formatWallets(snapshot);
    case 'transactions':
      return formatTransactions(snapshot);
    case 'profile':
      return formatProfile(snapshot);
    case 'rates':
      return formatRates(snapshot);
  }
}

function formatWallets(snapshot: AccountSnapshot): string {
  const wallets = snapshot.wallets ?? [];
  if (wallets.length === 0) {
    return [
      "You're signed in on Palpeer, but this account has no wallets yet.",
      'Create one from the Wallets tab or Home → Fund wallet.',
    ].join(' ');
  }

  const lines = wallets.map((wallet) => {
    const available = formatMoney(wallet.availableBalance, { currencyCode: wallet.currencyCode });
    const pendingRaw = String(wallet.pendingBalance ?? '0').trim();
    const hasPending = pendingRaw !== '' && pendingRaw !== '0' && !/^0+(\.0+)?$/.test(pendingRaw);
    const pending = formatMoney(wallet.pendingBalance, { currencyCode: wallet.currencyCode });
    return (
      `• ${wallet.currencyCode}: ${available} available` +
      (hasPending ? ` (${pending} pending)` : '')
    );
  });

  return [
    `Here are the wallets on your Palpeer account${snapshot.email ? ` (${snapshot.email})` : ''}:`,
    ...lines,
    'Balances come from your live account in the app. Open Wallets for ledger detail.',
  ].join('\n');
}

function formatTransactions(snapshot: AccountSnapshot): string {
  const txns = (snapshot.recentTransactions ?? []).slice(0, 5);
  if (txns.length === 0) {
    return 'I do not see any recent funding, withdrawal, or InstantEX activity on your account. Check the Activity tab for the full history.';
  }
  const lines = txns.map((tx) => {
    const amount = formatMoney(tx.amount, { currencyCode: tx.currencyCode });
    const secondary =
      tx.secondaryCurrencyCode && tx.secondaryAmount != null
        ? ` → ${formatMoney(tx.secondaryAmount, { currencyCode: tx.secondaryCurrencyCode })}`
        : '';
    return `• ${tx.type} · ${tx.status} · ${amount}${secondary}`;
  });
  return ['Your most recent transactions:', ...lines, 'Open Activity for filters and older items.'].join(
    '\n',
  );
}

function formatProfile(snapshot: AccountSnapshot): string {
  const profile = snapshot.profile;
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim();
  const parts = [
    snapshot.email ? `Email: ${snapshot.email}` : null,
    name ? `Name: ${name}` : null,
    profile?.countryOfResidence ? `Country: ${profile.countryOfResidence}` : null,
    profile?.city ? `City: ${profile.city}` : null,
    profile ? `Profile complete: ${profile.complete ? 'yes' : 'no'}` : null,
  ].filter(Boolean);

  if (parts.length === 0) {
    return "You're signed in, but I could not load profile fields yet. Try Profile in the app, or ask again in a moment.";
  }
  return ['Here is what I see on your signed-in Palpeer account:', ...parts.map((p) => `• ${p}`)].join(
    '\n',
  );
}

function formatRates(snapshot: AccountSnapshot): string {
  const rates = snapshot.instantRates ?? [];
  if (rates.length === 0) {
    return 'There are no InstantEX rates published right now. Check View rates or the InstantEX tab.';
  }
  const lines = rates.map(
    (rate: PublicInstantRateResponse) =>
      `• ${rate.baseCurrencyCode}/${rate.quoteCurrencyCode}: buy ${formatRate(rate.buyRate)}, sell ${formatRate(rate.sellRate)}`,
  );
  return ['Current InstantEX rates:', ...lines].join('\n');
}
