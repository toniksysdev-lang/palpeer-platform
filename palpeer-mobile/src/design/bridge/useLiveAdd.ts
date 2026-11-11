import { useCallback, useMemo, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { useEnsureProfile } from '@/features/profile/useEnsureProfile';
import { FUNDING_POLL_MS, isInProgress } from '@/features/wallets/movementStatus';
import { useIdempotencyKey } from '@/features/wallets/useIdempotencyKey';
import { toAppError } from '@/services/api/errors';
import { baseApi } from '@/services/api/baseApi';
import { ALERTS } from '@/services/api/notificationApi';
import {
  useCreateFundingMutation,
  useGetWalletsQuery,
  useLazyGetFundingQuery,
  walletBalanceTags,
} from '@/services/api/walletApi';
import {
  interacAddressesStorage,
  type InteracAddress,
} from '@/services/storage/interacAddressesStorage';
import { useAppDispatch, useAppSelector } from '@/store';
import type { FundingTransactionResponse } from '@/types/api/wallet';
import { toMoney } from '@/utils/money';

import { metaFor } from './currencyMeta';
import { ownedDesignWallets } from './mapWallet';

export type FundingDetails = {
  bank?: string;
  name?: string;
  number?: string;
  ref?: string;
  payTo?: string;
  memo?: string;
  amountText: string;
  method: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useLiveAdd() {
  const dispatch = useAppDispatch();
  const authenticated = useAppSelector((s) => s.session.status === 'authenticated');
  const walletsQ = useGetWalletsQuery(undefined, { skip: !authenticated });
  const profile = useEnsureProfile();
  const userId = useAppSelector((s) => s.session.userId) ?? '';
  const sessionEmail = useAppSelector((s) => s.session.email);
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const codeParam = Array.isArray(params.code) ? params.code[0] : params.code;
  const [createFunding] = useCreateFundingMutation();
  const [fetchFunding] = useLazyGetFundingQuery();
  const fundingRef = useRef<FundingTransactionResponse | null>(null);
  const idempotency = useIdempotencyKey();

  const liveWallets = useMemo(() => ownedDesignWallets(walletsQ.data), [walletsQ.data]);

  const listInteracEmails = useCallback(async (): Promise<string[]> => {
    const emails: string[] = [];
    if (sessionEmail) emails.push(sessionEmail);
    if (userId) {
      const list = await interacAddressesStorage.list(userId);
      for (const a of list as InteracAddress[]) {
        if (!emails.includes(a.email)) emails.push(a.email);
      }
    }
    return emails;
  }, [sessionEmail, userId]);

  const saveInteracEmail = useCallback(
    async (email: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!userId) return { ok: false, error: 'Sign in first.' };
      const firstName = profile.profile?.firstName?.trim() || 'Account';
      const lastName = profile.profile?.lastName?.trim() || 'Holder';
      try {
        await interacAddressesStorage.save(userId, {
          email: email.trim().toLowerCase(),
          firstName,
          lastName,
        });
        return { ok: true };
      } catch (raw) {
        return { ok: false, error: toAppError(raw).message ?? 'Could not save this email.' };
      }
    },
    [profile.profile?.firstName, profile.profile?.lastName, userId],
  );

  const startFunding = useCallback(
    async (code: string, amount: string, interacEmail?: string) => {
      const wallet = walletsQ.data?.find((w) => w.currencyCode === code);
      if (!wallet) return { ok: false as const, error: 'Open this wallet first.' };
      let money;
      try {
        money = toMoney(amount);
      } catch {
        return { ok: false as const, error: 'Enter a valid amount.' };
      }

      idempotency.reset();
      const firstName = profile.profile?.firstName?.trim() || undefined;
      const lastName = profile.profile?.lastName?.trim() || undefined;
      const result = await createFunding({
        walletId: wallet.id,
        amount: money,
        idempotencyKey: idempotency.current(),
        ...(code === 'CAD' && interacEmail
          ? {
              interacEmail,
              ...(firstName ? { interacFirstName: firstName } : null),
              ...(lastName ? { interacLastName: lastName } : null),
            }
          : null),
      });
      if ('error' in result) {
        return {
          ok: false as const,
          error: toAppError(result.error).message ?? 'Could not start funding.',
        };
      }
      fundingRef.current = result.data;
      const pay = result.data.paymentDetails;
      const meta = metaFor(code);
      const n = Number.parseFloat(amount) || 0;
      const amountText =
        meta.sym +
        n.toLocaleString('en-CA', {
          minimumFractionDigits: meta.dec,
          maximumFractionDigits: meta.dec,
        });
      const details: FundingDetails = {
        amountText,
        method: pay?.method ?? null,
        payTo: pay?.collectionEmail ?? undefined,
        memo:
          pay?.trackingReference ??
          pay?.aplReference ??
          result.data.id.slice(0, 12).toUpperCase(),
        bank: pay?.bankName ?? undefined,
        name: pay?.accountName ?? undefined,
        number: pay?.accountNumber ?? undefined,
        ref: pay?.trackingReference ?? undefined,
      };
      return { ok: true as const, details, fundingId: result.data.id };
    },
    [createFunding, idempotency, profile.profile, walletsQ.data],
  );

  /** Refresh Home wallet card + recent activity + Alerts once funding settles. */
  const refreshAfterFunding = useCallback(
    (walletId?: string) => {
      dispatch(
        baseApi.util.invalidateTags(
          walletId ? [...walletBalanceTags(walletId), ...ALERTS] : [...ALERTS],
        ),
      );
    },
    [dispatch],
  );

  /** Poll funding until it leaves an in-progress status (or fails). */
  const waitForFunding = useCallback(
    async (fundingId: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      const id = fundingId || fundingRef.current?.id;
      if (!id) return { ok: false, error: 'No funding to watch.' };
      for (let attempt = 0; attempt < 40; attempt += 1) {
        try {
          const data = await fetchFunding(id, true).unwrap();
          if (data.status === 'SUCCESS') {
            // getFunding does not invalidate wallets — force Home balance refresh now.
            refreshAfterFunding(data.walletId);
            return { ok: true };
          }
          if (data.status === 'FAILED' || data.status === 'REVERSED') {
            refreshAfterFunding(data.walletId);
            return {
              ok: false,
              error: data.failureReason || 'Funding did not complete.',
            };
          }
          if (!isInProgress(data.status)) {
            refreshAfterFunding(data.walletId);
            return { ok: false, error: `Funding ended with status ${data.status}.` };
          }
        } catch (raw) {
          return { ok: false, error: toAppError(raw).message ?? 'Could not check funding.' };
        }
        await sleep(FUNDING_POLL_MS);
      }
      return {
        ok: false,
        error: 'Still waiting for your payment. Check History later.',
      };
    },
    [fetchFunding, refreshAfterFunding],
  );

  return {
    backend: true as const,
    liveWallets,
    ...(codeParam ? { code: codeParam } : null),
    listInteracEmails,
    saveInteracEmail,
    startFunding,
    waitForFunding,
    sessionEmail: sessionEmail ?? '',
    helloName: (() => {
      const first = profile.profile?.firstName?.trim() ?? '';
      const last = profile.profile?.lastName?.trim() ?? '';
      return `${first} ${last}`.trim();
    })(),
  };
}
