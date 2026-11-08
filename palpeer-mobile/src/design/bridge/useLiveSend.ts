import { useCallback, useMemo, useRef } from 'react';

import { usePinPrompt } from '@/features/security/PinPromptProvider';
import { useIdempotencyKey } from '@/features/wallets/useIdempotencyKey';
import { toAppError } from '@/services/api/errors';
import {
  useCreateWalletTransferMutation,
  useGetWalletsQuery,
  useLazyLookupTransferRecipientQuery,
} from '@/services/api/walletApi';
import type { TransferRecipientResponse } from '@/types/api/wallet';
import { toMoney } from '@/utils/money';

import { formatDesignMoney } from './currencyMeta';
import { balanceNumber, ownedDesignWallets } from './mapWallet';
import { verifyDesignPin } from './verifyPin';

export type ResolveRecipientResult =
  | { ok: true; person: string; recipientUserId: string }
  | { ok: false; error: string };

export function useLiveSend() {
  const walletsQ = useGetWalletsQuery();
  const [lookupRecipient] = useLazyLookupTransferRecipientQuery();
  const [createTransfer] = useCreateWalletTransferMutation();
  const { requestPin } = usePinPrompt();
  const recipientRef = useRef<TransferRecipientResponse | null>(null);
  const pendingRef = useRef<{
    walletId: string;
    amount: string;
    currencyCode: string;
    recipient: string;
  } | null>(null);
  const idempotency = useIdempotencyKey();

  const liveWallets = useMemo(() => ownedDesignWallets(walletsQ.data), [walletsQ.data]);

  const resolveRecipient = useCallback(
    async (who: string, code: string, amount: string): Promise<ResolveRecipientResult> => {
      const wallet = walletsQ.data?.find((w) => w.currencyCode === code);
      if (!wallet) return { ok: false, error: 'Open this wallet first.' };
      const result = await lookupRecipient({ q: who.trim(), currencyCode: code });
      if (result.error || !result.data) {
        return {
          ok: false,
          error: toAppError(result.error).message ?? 'No Palpeer user found for that contact.',
        };
      }
      if (result.data.hasWallet === false) {
        return {
          ok: false,
          error: `${result.data.displayName} doesn't have a ${code} wallet yet.`,
        };
      }
      recipientRef.current = result.data;
      pendingRef.current = {
        walletId: wallet.id,
        amount,
        currencyCode: code,
        recipient: result.data.recipient,
      };
      idempotency.reset();
      return {
        ok: true,
        person: result.data.displayName || who.trim(),
        recipientUserId: result.data.userId,
      };
    },
    [idempotency, lookupRecipient, walletsQ.data],
  );

  const runTransfer = useCallback(async () => {
    const recipient = recipientRef.current;
    const pending = pendingRef.current;
    if (!recipient || !pending) return { ok: false as const };
    let money;
    try {
      money = toMoney(pending.amount);
    } catch {
      return { ok: false as const };
    }
    const result = await createTransfer({
      sourceWalletId: pending.walletId,
      recipient: pending.recipient,
      amount: money,
      idempotencyKey: idempotency.current(),
    });
    if ('error' in result) return { ok: false as const };
    const after = balanceNumber(
      walletsQ.data?.find((w) => w.id === pending.walletId)?.availableBalance,
    );
    const sent = Number.parseFloat(pending.amount) || 0;
    idempotency.reset();
    return {
      ok: true as const,
      afterText: formatDesignMoney(pending.currencyCode, Math.max(0, after - sent)),
      person: recipient.displayName,
    };
  }, [createTransfer, idempotency, walletsQ.data]);

  const confirmPin = useCallback(
    async (pin: string) => {
      const ok = await verifyDesignPin(pin);
      if (!ok) return { ok: false as const };
      return runTransfer();
    },
    [runTransfer],
  );

  const confirmBiometric = useCallback(async () => {
    const confirmed = await requestPin({
      title: 'Confirm transfer',
      message: 'Confirm with fingerprint or enter your PIN to send money.',
      allowBiometric: true,
    });
    if (!confirmed) return { ok: false as const };
    return runTransfer();
  }, [requestPin, runTransfer]);

  return {
    backend: true as const,
    liveWallets,
    resolveRecipient,
    confirmPin,
    confirmBiometric,
  };
}
