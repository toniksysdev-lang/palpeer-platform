import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useEnsureProfile } from '@/features/profile/useEnsureProfile';
import { usePinPrompt } from '@/features/security/PinPromptProvider';
import { cadReference, ngnReference } from '@/features/wallets/destination';
import { FUNDING_POLL_MS, isInProgress } from '@/features/wallets/movementStatus';
import { useIdempotencyKey } from '@/features/wallets/useIdempotencyKey';
import { baseApi } from '@/services/api/baseApi';
import { toAppError } from '@/services/api/errors';
import { ALERTS } from '@/services/api/notificationApi';
import {
  useCreateWithdrawalMutation,
  useGetWalletsQuery,
  useGetWithdrawalBanksQuery,
  useLazyGetWithdrawalQuery,
  walletBalanceTags,
} from '@/services/api/walletApi';
import { interacAddressesStorage } from '@/services/storage/interacAddressesStorage';
import {
  ngnBankAccountsStorage,
  type NgnBankAccount,
} from '@/services/storage/ngnBankAccountsStorage';
import { useAppDispatch, useAppSelector } from '@/store';
import { toMoney } from '@/utils/money';

import { ownedDesignWallets } from './mapWallet';
import { verifyDesignPin } from './verifyPin';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useLiveTakeOut() {
  const dispatch = useAppDispatch();
  const authenticated = useAppSelector((s) => s.session.status === 'authenticated');
  const sessionEmail = useAppSelector((s) => s.session.email);
  const userId = useAppSelector((s) => s.session.userId) ?? '';
  const profile = useEnsureProfile();
  const walletsQ = useGetWalletsQuery(undefined, { skip: !authenticated });
  const banksQ = useGetWithdrawalBanksQuery(undefined, { skip: !authenticated });
  const [createWithdrawal] = useCreateWithdrawalMutation();
  const [fetchWithdrawal] = useLazyGetWithdrawalQuery();
  const { requestPin } = usePinPrompt();
  const [interacEmails, setInteracEmails] = useState<string[]>(
    sessionEmail ? [sessionEmail] : [],
  );
  const [ngnAccounts, setNgnAccounts] = useState<NgnBankAccount[]>([]);
  const pendingRef = useRef<{
    walletId: string;
    amount: string;
    destinationReference: string;
  } | null>(null);
  const withdrawalIdRef = useRef<string | null>(null);
  const idempotency = useIdempotencyKey();

  const liveWallets = useMemo(() => ownedDesignWallets(walletsQ.data), [walletsQ.data]);

  const helloName = useMemo(() => {
    const first = profile.profile?.firstName?.trim() ?? '';
    const last = profile.profile?.lastName?.trim() ?? '';
    return `${first} ${last}`.trim() || sessionEmail || '';
  }, [profile.profile?.firstName, profile.profile?.lastName, sessionEmail]);

  const reloadNgnAccounts = useCallback(async () => {
    if (!userId) {
      setNgnAccounts([]);
      return;
    }
    const list = await ngnBankAccountsStorage.list(userId);
    setNgnAccounts(list);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const emails: string[] = [];
      if (sessionEmail) emails.push(sessionEmail);
      if (userId) {
        const list = await interacAddressesStorage.list(userId);
        for (const a of list) {
          if (!emails.includes(a.email)) emails.push(a.email);
        }
      }
      if (!cancelled) setInteracEmails(emails);
    };
    if (authenticated) void load();
    return () => {
      cancelled = true;
    };
  }, [authenticated, sessionEmail, userId]);

  useEffect(() => {
    if (authenticated && userId) void reloadNgnAccounts();
  }, [authenticated, userId, reloadNgnAccounts]);

  const bankNames = useMemo(
    () => (banksQ.data ?? []).map((b) => b.name),
    [banksQ.data],
  );

  const banksByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of banksQ.data ?? []) map.set(b.name, b.code);
    return map;
  }, [banksQ.data]);

  const refreshAlerts = useCallback(
    (walletId?: string) => {
      dispatch(
        baseApi.util.invalidateTags(
          walletId ? [...walletBalanceTags(walletId), ...ALERTS] : [...ALERTS],
        ),
      );
    },
    [dispatch],
  );

  const prepareWithdrawal = useCallback(
    (
      code: string,
      amount: string,
      dest: { email?: string; bank?: string; acct?: string; bankCode?: string },
    ) => {
      const wallet = walletsQ.data?.find((w) => w.currencyCode === code);
      if (!wallet) return { ok: false as const, error: 'Open this wallet first.' };
      let destinationReference: string;
      if (code === 'CAD') {
        if (!dest.email?.trim()) return { ok: false as const, error: 'Choose an Interac email.' };
        destinationReference = cadReference({ method: 'email', email: dest.email });
      } else {
        const bankCode =
          (dest.bankCode && dest.bankCode.trim()) ||
          (dest.bank ? banksByName.get(dest.bank) : undefined);
        if (!bankCode || !dest.acct?.trim()) {
          return { ok: false as const, error: 'Choose a bank account.' };
        }
        destinationReference = ngnReference({
          bankCode,
          accountNumber: dest.acct.trim(),
        });
      }
      pendingRef.current = {
        walletId: wallet.id,
        amount,
        destinationReference,
      };
      withdrawalIdRef.current = null;
      idempotency.reset();
      return { ok: true as const };
    },
    [banksByName, idempotency, walletsQ.data],
  );

  /** Poll until withdrawal leaves in-progress (triggers Kuda TSQ reconcile on GET). */
  const waitForWithdrawal = useCallback(
    async (withdrawalId: string, walletId: string) => {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        try {
          const data = await fetchWithdrawal(withdrawalId, true).unwrap();
          if (!isInProgress(data.status)) {
            refreshAlerts(walletId);
            return;
          }
        } catch {
          // Keep polling — webhook/reconcile may still settle.
        }
        await sleep(FUNDING_POLL_MS);
      }
      // Still pending: refresh Alerts once so "Withdrawal started" is visible.
      refreshAlerts(walletId);
    },
    [fetchWithdrawal, refreshAlerts],
  );

  const runWithdrawal = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return false;
    let money;
    try {
      money = toMoney(pending.amount);
    } catch {
      return false;
    }
    const result = await createWithdrawal({
      walletId: pending.walletId,
      amount: money,
      destinationReference: pending.destinationReference,
      idempotencyKey: idempotency.current(),
    });
    if ('error' in result) {
      console.warn('withdrawal failed', toAppError(result.error).message);
      return false;
    }
    const tx = result.data;
    withdrawalIdRef.current = tx.id;
    idempotency.reset();
    pendingRef.current = null;

    // Mutation invalidates ALERTS; force another pass so Messages badge/list catch
    // AFTER_COMMIT notify (and SUCCESS settle on the same request).
    refreshAlerts(pending.walletId);

    if (isInProgress(tx.status)) {
      void waitForWithdrawal(tx.id, pending.walletId);
    }
    return true;
  }, [createWithdrawal, idempotency, refreshAlerts, waitForWithdrawal]);

  const confirmPin = useCallback(
    async (pin: string) => {
      const ok = await verifyDesignPin(pin);
      if (!ok) return false;
      return runWithdrawal();
    },
    [runWithdrawal],
  );

  const confirmBiometric = useCallback(async () => {
    const confirmed = await requestPin({
      title: 'Confirm withdrawal',
      message: 'Confirm with fingerprint or enter your PIN to withdraw money.',
      allowBiometric: true,
    });
    if (!confirmed) return false;
    return runWithdrawal();
  }, [requestPin, runWithdrawal]);

  const saveNgnAccount = useCallback(
    async (input: {
      bankName: string;
      accountNumber: string;
      accountName?: string;
    }): Promise<{ ok: true; account: NgnBankAccount } | { ok: false; error: string }> => {
      const bankCode = banksByName.get(input.bankName);
      if (!bankCode) return { ok: false, error: 'Choose a bank.' };
      const accountNumber = input.accountNumber.replace(/\D/g, '');
      if (!/^\d{10}$/.test(accountNumber)) {
        return { ok: false, error: 'Account number must be 10 digits.' };
      }
      if (!userId) return { ok: false, error: 'Sign in again to save an account.' };
      try {
        const account = await ngnBankAccountsStorage.save(userId, {
          bankCode,
          bankName: input.bankName,
          accountNumber,
          accountName: (input.accountName || helloName || 'Saved account').trim() || 'Saved account',
        });
        await reloadNgnAccounts();
        return { ok: true, account };
      } catch (raw) {
        return { ok: false, error: toAppError(raw).message ?? 'Could not save bank account.' };
      }
    },
    [banksByName, helloName, reloadNgnAccounts, userId],
  );

  const deleteNgnAccount = useCallback(
    async (id: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!userId) return { ok: false, error: 'Sign in again to delete an account.' };
      try {
        await ngnBankAccountsStorage.remove(userId, id);
        await reloadNgnAccounts();
        return { ok: true };
      } catch (raw) {
        return { ok: false, error: toAppError(raw).message ?? 'Could not delete bank account.' };
      }
    },
    [reloadNgnAccounts, userId],
  );

  return {
    backend: true as const,
    liveWallets,
    bankNames,
    sessionEmail: sessionEmail ?? '',
    interacEmails,
    ngnAccounts,
    helloName,
    prepareWithdrawal,
    confirmPin,
    confirmBiometric,
    saveNgnAccount,
    deleteNgnAccount,
  };
}
