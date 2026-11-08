import { useCallback, useMemo } from 'react';
import { router, type Href } from 'expo-router';

import { useEnsureProfile } from '@/features/profile/useEnsureProfile';
import { usePinPrompt } from '@/features/security/PinPromptProvider';
import { useToast } from '@/providers/ToastProvider';
import { badgeLabel } from '@/features/notifications/logic';
import { toAppError } from '@/services/api/errors';
import { useGetCurrenciesQuery } from '@/services/api/currencyApi';
import { useGetUnreadCountQuery } from '@/services/api/notificationApi';
import { useGetPinStatusQuery } from '@/services/api/securityApi';
import {
  useCreateWalletMutation,
  useGetRecentTransactionsQuery,
  useGetWalletsQuery,
} from '@/services/api/walletApi';
import { sessionManager } from '@/services/auth/session';
import { useAppSelector } from '@/store';
import { formatMoney } from '@/utils/money';

import { buildWalletCatalog, ownedDesignWallets } from './mapWallet';

function latestMovementLine(
  tx:
    | {
        type: string;
        amount: string;
        currencyCode: string;
        secondaryAmount?: string | null;
        secondaryCurrencyCode?: string | null;
        createdAt: string;
      }
    | undefined,
): { title: string; time: string } | null {
  if (!tx) return null;
  const amt = formatMoney(tx.amount, {
    currencyCode: tx.currencyCode,
    precision: tx.currencyCode === 'NGN' || tx.currencyCode === 'KES' ? 0 : 2,
  });
  const secondary =
    tx.secondaryAmount && tx.secondaryCurrencyCode
      ? formatMoney(tx.secondaryAmount, {
          currencyCode: tx.secondaryCurrencyCode,
          precision:
            tx.secondaryCurrencyCode === 'NGN' || tx.secondaryCurrencyCode === 'KES' ? 0 : 2,
        })
      : null;
  let title = `${tx.type}: ${amt}`;
  if (tx.type === 'EXCHANGE' && secondary) title = `You changed ${amt} to ${secondary}`;
  else if (tx.type === 'FUNDING') title = `You added ${amt}`;
  else if (tx.type === 'WITHDRAWAL') title = `You took out ${amt}`;
  else if (tx.type === 'TRANSFER') title = `You sent ${amt}`;
  else if (tx.type === 'P2P' && secondary) title = `You changed ${amt} to ${secondary}`;
  const time = new Date(tx.createdAt).toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return { title, time };
}

export function useLiveMain() {
  const authenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const walletsQ = useGetWalletsQuery(undefined, { skip: !authenticated });
  const currenciesQ = useGetCurrenciesQuery(undefined, { skip: !authenticated });
  const recent = useGetRecentTransactionsQuery(1, { skip: !authenticated });
  const notifUnread = useGetUnreadCountQuery(undefined, { skip: !authenticated });
  const profile = useEnsureProfile();
  const pinStatus = useGetPinStatusQuery(undefined, { skip: !authenticated });
  const { requestPin } = usePinPrompt();
  const toast = useToast();
  const [createWallet] = useCreateWalletMutation();

  const liveWallets = useMemo(() => ownedDesignWallets(walletsQ.data), [walletsQ.data]);
  const liveCatalog = useMemo(
    () => buildWalletCatalog(walletsQ.data, currenciesQ.data),
    [walletsQ.data, currenciesQ.data],
  );

  const helloName = useMemo(() => {
    const first = profile.profile?.firstName?.trim();
    if (first) return first;
    return 'there';
  }, [profile.profile?.firstName]);

  const unreadCount = notifUnread.data ?? 0;
  const msgBadge = badgeLabel(unreadCount) ?? '';

  const lastMovement = useMemo(
    () => latestMovementLine(recent.data?.[0]),
    [recent.data],
  );

  const onAddWallet = useCallback(
    async (code: string) => {
      const fail = (error: string) => {
        toast.show({ type: 'error', title: error });
        return { ok: false as const, error };
      };

      if (profile.loading) {
        return fail('Loading your profile…');
      }
      if (profile.profile && !profile.profile.complete) {
        return fail('Complete your profile before creating a wallet.');
      }

      if (pinStatus.isLoading || (!pinStatus.data && !pinStatus.isError)) {
        return fail('Checking your PIN status…');
      }
      if (!pinStatus.data) {
        void pinStatus.refetch();
        return fail("We couldn't check your PIN status. Try again.");
      }
      if (!pinStatus.data.pinSet) {
        router.push({
          pathname: '/security/pin/set',
          params: { required: '1', returnTo: '/WalletAdd' },
        } as Href);
        return fail('Set up a PIN, then create your wallet.');
      }

      const confirmed = await requestPin({
        title: 'Confirm new wallet',
        message: `Confirm with fingerprint, face, or your PIN to create a ${code} wallet.`,
        allowBiometric: true,
      });
      if (!confirmed) {
        return { ok: false as const };
      }

      try {
        await createWallet({ currencyCode: code }).unwrap();
        return { ok: true as const };
      } catch (raw) {
        return fail(toAppError(raw).message ?? 'Could not add wallet');
      }
    },
    [createWallet, pinStatus, profile.loading, profile.profile, requestPin, toast],
  );

  const profileIncomplete = !!profile.profile && !profile.profile.complete;

  const goAddMoney = useCallback((code?: string) => {
    if (code) {
      router.push({ pathname: '/Add', params: { code } } as Href);
      return;
    }
    router.push('/Add' as Href);
  }, []);

  const onLogBack = useCallback(async () => {
    await sessionManager.dismissToLogin();
  }, []);

  return {
    backend: true as const,
    liveWallets,
    liveCatalog,
    helloName,
    profileIncomplete,
    openProfile: () => router.push('/StartDetails' as Href),
    goAddMoney,
    unreadCount,
    msgBadge,
    lastMovement,
    walletsLoading: walletsQ.isLoading || currenciesQ.isLoading,
    walletsError: walletsQ.error ? toAppError(walletsQ.error).message : null,
    onAddWallet,
    refetchWallets: () => void walletsQ.refetch(),
    onLogBack,
  };
}
