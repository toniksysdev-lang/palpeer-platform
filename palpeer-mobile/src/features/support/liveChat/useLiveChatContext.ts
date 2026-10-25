import { useCallback, useMemo } from 'react';

import { useGetPublicInstantRatesQuery } from '@/services/api/currencyApi';
import { useGetMyProfileQuery } from '@/services/api/profileApi';
import { useGetRecentTransactionsQuery, useGetWalletsQuery } from '@/services/api/walletApi';
import { useAppSelector } from '@/store';

import type { AccountSnapshot } from './answerAccountQuestion';
import { buildLiveChatContext } from './buildLiveChatContext';

/** Loads main-app account data from the Palpeer backend for Live Chat. */
export function useLiveChatContext() {
  const email = useAppSelector((state) => state.session.email);
  const userId = useAppSelector((state) => state.session.userId);
  const profile = useGetMyProfileQuery();
  const wallets = useGetWalletsQuery();
  const recent = useGetRecentTransactionsQuery(5);
  const rates = useGetPublicInstantRatesQuery();

  const snapshot: AccountSnapshot = useMemo(
    () => ({
      email,
      userId,
      profile: profile.data,
      wallets: wallets.data,
      recentTransactions: recent.data,
      instantRates: rates.data,
    }),
    [email, userId, profile.data, wallets.data, recent.data, rates.data],
  );

  const context = useMemo(() => buildLiveChatContext(snapshot), [snapshot]);

  const refreshAccount = useCallback(async (): Promise<AccountSnapshot> => {
    const [walletsResult, profileResult, recentResult, ratesResult] = await Promise.all([
      wallets.refetch(),
      profile.refetch(),
      recent.refetch(),
      rates.refetch(),
    ]);
    return {
      email,
      userId,
      profile: profileResult.data ?? profile.data,
      wallets: walletsResult.data ?? wallets.data,
      recentTransactions: recentResult.data ?? recent.data,
      instantRates: ratesResult.data ?? rates.data,
    };
  }, [email, userId, wallets, profile, recent, rates]);

  const firstName = profile.data?.firstName?.trim() || null;
  // Never block the chat UI on profile/wallets/rates — boot the AI session immediately.
  const ready = true;

  return {
    email,
    userId,
    firstName,
    context,
    snapshot,
    refreshAccount,
    ready,
  };
}
