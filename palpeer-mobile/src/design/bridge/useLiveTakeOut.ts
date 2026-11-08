import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useEnsureProfile } from '@/features/profile/useEnsureProfile';
import { usePinPrompt } from '@/features/security/PinPromptProvider';
import { cadReference, ngnReference } from '@/features/wallets/destination';
import { useIdempotencyKey } from '@/features/wallets/useIdempotencyKey';
import { toAppError } from '@/services/api/errors';
import {
  useCreateWithdrawalMutation,
  useGetWalletsQuery,
  useGetWithdrawalBanksQuery,
} from '@/services/api/walletApi';
import { interacAddressesStorage } from '@/services/storage/interacAddressesStorage';
import { useAppSelector } from '@/store';
import { toMoney } from '@/utils/money';

import { ownedDesignWallets } from './mapWallet';
import { verifyDesignPin } from './verifyPin';

export function useLiveTakeOut() {
  const authenticated = useAppSelector((s) => s.session.status === 'authenticated');
  const sessionEmail = useAppSelector((s) => s.session.email);
  const userId = useAppSelector((s) => s.session.userId) ?? '';
  const profile = useEnsureProfile();
  const walletsQ = useGetWalletsQuery(undefined, { skip: !authenticated });
  const banksQ = useGetWithdrawalBanksQuery(undefined, { skip: !authenticated });
  const [createWithdrawal] = useCreateWithdrawalMutation();
  const { requestPin } = usePinPrompt();
  const [interacEmails, setInteracEmails] = useState<string[]>(
    sessionEmail ? [sessionEmail] : [],
  );
  const pendingRef = useRef<{
    walletId: string;
    amount: string;
    destinationReference: string;
  } | null>(null);
  const idempotency = useIdempotencyKey();

  const liveWallets = useMemo(() => ownedDesignWallets(walletsQ.data), [walletsQ.data]);

  const helloName = useMemo(() => {
    const first = profile.profile?.firstName?.trim() ?? '';
    const last = profile.profile?.lastName?.trim() ?? '';
    return `${first} ${last}`.trim() || sessionEmail || '';
  }, [profile.profile?.firstName, profile.profile?.lastName, sessionEmail]);

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

  const bankNames = useMemo(
    () => (banksQ.data ?? []).map((b) => b.name),
    [banksQ.data],
  );

  const banksByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of banksQ.data ?? []) map.set(b.name, b.code);
    return map;
  }, [banksQ.data]);

  const prepareWithdrawal = useCallback(
    (code: string, amount: string, dest: { email?: string; bank?: string; acct?: string }) => {
      const wallet = walletsQ.data?.find((w) => w.currencyCode === code);
      if (!wallet) return { ok: false as const, error: 'Open this wallet first.' };
      let destinationReference: string;
      if (code === 'CAD') {
        if (!dest.email?.trim()) return { ok: false as const, error: 'Choose an Interac email.' };
        destinationReference = cadReference({ method: 'email', email: dest.email });
      } else {
        const bankCode = dest.bank ? banksByName.get(dest.bank) : undefined;
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
      idempotency.reset();
      return { ok: true as const };
    },
    [banksByName, idempotency, walletsQ.data],
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
    idempotency.reset();
    pendingRef.current = null;
    return true;
  }, [createWithdrawal, idempotency]);

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
      message: 'Confirm with fingerprint or enter your PIN to take out money.',
      allowBiometric: true,
    });
    if (!confirmed) return false;
    return runWithdrawal();
  }, [requestPin, runWithdrawal]);

  return {
    backend: true as const,
    liveWallets,
    bankNames,
    sessionEmail: sessionEmail ?? '',
    interacEmails,
    helloName,
    prepareWithdrawal,
    confirmPin,
    confirmBiometric,
  };
}
