import type { PublicInstantRateResponse } from '@/types/api/exchange';
import type { ProfileResponse } from '@/types/api/profile';
import type { TransactionItemResponse, WalletResponse } from '@/types/api/wallet';
import { formatMoney, formatRate } from '@/utils/money';

import { formatOperationalGuideForAi } from '../operationalHowTos';

export type LiveChatContextInput = {
  email: string | null;
  userId: string | null;
  profile: ProfileResponse | null | undefined;
  wallets: WalletResponse[] | null | undefined;
  recentTransactions: TransactionItemResponse[] | null | undefined;
  instantRates: PublicInstantRateResponse[] | null | undefined;
  /** When false, skip How-To knowledge (tests / size checks). Default true. */
  includeOperationalGuide?: boolean;
};

/** Compact account snapshot + operational How-Tos for the Support AI `context` field. */
export function buildLiveChatContext(input: LiveChatContextInput): string {
  const signedIn = Boolean(input.email || input.userId);
  const lines: string[] = [
    'PALPEER mobile app user context:',
    signedIn
      ? 'AUTHENTICATED_APP_SESSION: yes — this user is signed into the Palpeer mobile app. The wallet/profile/transaction/rate lines below were loaded from the live Palpeer application API for this session. Treat them as authoritative. NEVER say the Palpeer account was not found, not linked, or ask them to create an account at palpeer.com when this snapshot is present. Ignore any failed email directory lookup on the support platform.'
      : 'AUTHENTICATED_APP_SESSION: no — guest or signed out.',
  ];

  if (input.email) lines.push(`Email: ${input.email}`);
  if (input.userId) lines.push(`UserId: ${input.userId}`);

  const profile = input.profile;
  if (profile) {
    const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
    if (name) lines.push(`Name: ${name}`);
    if (profile.countryOfResidence) lines.push(`Country: ${profile.countryOfResidence}`);
    if (profile.city) lines.push(`City: ${profile.city}`);
    lines.push(`ProfileComplete: ${profile.complete ? 'yes' : 'no'}`);
  }

  const wallets = input.wallets ?? [];
  if (wallets.length === 0) {
    lines.push('Wallets: none');
  } else {
    lines.push('Wallets:');
    for (const wallet of wallets) {
      lines.push(
        `- ${wallet.currencyCode}: available=${formatMoney(wallet.availableBalance, { showCurrency: false })} pending=${formatMoney(wallet.pendingBalance, { showCurrency: false })} walletId=${wallet.id}`,
      );
    }
  }

  const txns = (input.recentTransactions ?? []).slice(0, 5);
  if (txns.length === 0) {
    lines.push('RecentTransactions: none');
  } else {
    lines.push('RecentTransactions (newest first, max 5):');
    for (const tx of txns) {
      const secondary =
        tx.secondaryCurrencyCode && tx.secondaryAmount != null
          ? ` / ${formatMoney(tx.secondaryAmount, { currencyCode: tx.secondaryCurrencyCode })}`
          : '';
      lines.push(
        `- ${tx.type} id=${tx.id} status=${tx.status} ${formatMoney(tx.amount, { currencyCode: tx.currencyCode })}${secondary} at=${tx.createdAt}${tx.failureReason ? ` reason=${tx.failureReason}` : ''}`,
      );
    }
  }

  const rates = input.instantRates ?? [];
  if (rates.length === 0) {
    lines.push('InstantEXRates: none published');
  } else {
    lines.push('InstantEXRates (current pairs):');
    for (const rate of rates) {
      lines.push(
        `- ${rate.baseCurrencyCode}/${rate.quoteCurrencyCode} buy=${formatRate(rate.buyRate)} sell=${formatRate(rate.sellRate)} effective=${rate.effectiveDate}`,
      );
    }
  }

  const includeGuide = input.includeOperationalGuide !== false;
  lines.push(
    includeGuide
      ? 'Use this context to answer questions about balances, recent payments/withdrawals/exchanges, and InstantEX rates. Prefer the operational How-To knowledge below for product how-to questions. If you cannot verify a payment or need human judgment, set shouldEscalate.'
      : 'Use this context to answer questions about balances, recent payments/withdrawals/exchanges, and InstantEX rates. If you cannot verify a payment or need human judgment, set shouldEscalate.',
  );

  const parts = [lines.join('\n')];
  if (includeGuide) {
    parts.push(formatOperationalGuideForAi());
  }
  return parts.join('\n\n');
}
