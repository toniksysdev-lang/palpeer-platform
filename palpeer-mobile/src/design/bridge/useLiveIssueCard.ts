import { useCallback, useMemo, useState } from 'react';
import { router, type Href } from 'expo-router';

import { cardErrorMessage } from '@/features/cards/logic';
import { metaFor } from '@/design/bridge/currencyMeta';
import { useToast } from '@/providers/ToastProvider';
import { useGetFeatureFlagsQuery } from '@/services/api/authApi';
import { useIssueCardMutation } from '@/services/api/cardApi';
import { useGetCurrenciesQuery } from '@/services/api/currencyApi';
import { toAppError } from '@/services/api/errors';
import { useGetWalletsQuery } from '@/services/api/walletApi';
import { useAppSelector } from '@/store';
import type { IssueCardRequest } from '@/types/api/card';

/** Live props for design Issue a card screen. */
export function useLiveIssueCard() {
  const authenticated = useAppSelector((s) => s.session.status === 'authenticated');
  const toast = useToast();
  const flags = useGetFeatureFlagsQuery();
  const cardsEnabled = flags.data?.virtualCardsEnabled !== false;
  const currenciesQ = useGetCurrenciesQuery(undefined, {
    skip: !authenticated || !cardsEnabled || flags.isLoading,
  });
  const walletsQ = useGetWalletsQuery(undefined, {
    skip: !authenticated || !cardsEnabled || flags.isLoading,
  });
  const [issueCard, issueState] = useIssueCardMutation();
  const [error, setError] = useState<string | null>(null);

  const currencies = useMemo(() => {
    const wallets = walletsQ.data ?? [];
    return (currenciesQ.data ?? []).map((item) => {
      const meta = metaFor(item.code);
      return {
        code: item.code,
        symbol: item.symbol || meta.sym,
        name: meta.name,
        cc: meta.cc,
        hasWallet: wallets.some((w) => w.currencyCode === item.code),
      };
    });
  }, [currenciesQ.data, walletsQ.data]);

  const onIssue = useCallback(
    async (input: { currencyCode: string; linkWallet: boolean; cardholderName: string }) => {
      setError(null);
      const wallet = (walletsQ.data ?? []).find((w) => w.currencyCode === input.currencyCode);
      const body: IssueCardRequest = { currencyCode: input.currencyCode };
      if (input.linkWallet && wallet) body.walletId = wallet.id;
      if (input.cardholderName) body.cardholderName = input.cardholderName;
      try {
        const card = await issueCard(body).unwrap();
        toast.show({ type: 'success', title: `${card.currencyCode} card issued` });
        router.replace(`/Card?id=${encodeURIComponent(card.id)}` as Href);
        return { ok: true as const };
      } catch (raw) {
        const msg = cardErrorMessage(toAppError(raw));
        setError(msg);
        return { ok: false as const, error: msg };
      }
    },
    [issueCard, toast, walletsQ.data],
  );

  const onRetry = useCallback(() => {
    void flags.refetch();
    void currenciesQ.refetch();
    void walletsQ.refetch();
  }, [currenciesQ, flags, walletsQ]);

  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/More' as Href);
  }, []);

  const loadError =
    (flags.error && toAppError(flags.error).message) ||
    (currenciesQ.error && !currenciesQ.data ? toAppError(currenciesQ.error).message : null) ||
    (walletsQ.error && !walletsQ.data ? toAppError(walletsQ.error).message : null);

  return {
    backend: true as const,
    loading:
      flags.isLoading ||
      (cardsEnabled && (currenciesQ.isLoading || walletsQ.isLoading)),
    loadError,
    cardsEnabled,
    currencies,
    busy: issueState.isLoading,
    error,
    onIssue,
    onRetry,
    onBack,
  };
}
