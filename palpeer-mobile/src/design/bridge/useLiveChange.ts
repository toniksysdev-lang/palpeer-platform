import { useCallback, useMemo, useRef } from 'react';

import { usePinPrompt } from '@/features/security/PinPromptProvider';
import { useIdempotencyKey } from '@/features/wallets/useIdempotencyKey';
import { toAppError } from '@/services/api/errors';
import {
  useExecuteExchangeMutation,
  usePreviewExchangeMutation,
} from '@/services/api/exchangeApi';
import { useGetWalletsQuery } from '@/services/api/walletApi';
import type { ExchangeQuoteResponse } from '@/types/api/exchange';
import { toMoney } from '@/utils/money';

import { formatDesignMoney } from './currencyMeta';
import { balanceNumber, ownedDesignWallets } from './mapWallet';
import { verifyDesignPin } from './verifyPin';

export type LockQuoteInput = {
  giveCode: string;
  wantCode: string;
  amount: string;
};

export type LockQuoteResult =
  | {
      ok: true;
      secondsLeft: number;
      giveText: string;
      nowGet: string;
      rateText: string;
      afterText: string;
      targetAmount: number;
    }
  | { ok: false; error: string };

export function useLiveChange() {
  const walletsQ = useGetWalletsQuery();
  const [preview] = usePreviewExchangeMutation();
  const [execute] = useExecuteExchangeMutation();
  const { requestPin } = usePinPrompt();
  const quoteRef = useRef<ExchangeQuoteResponse | null>(null);
  const idempotency = useIdempotencyKey();

  const liveWallets = useMemo(() => ownedDesignWallets(walletsQ.data), [walletsQ.data]);

  const runExecute = useCallback(async () => {
    const quote = quoteRef.current;
    if (!quote) return false;
    const result = await execute({
      quote,
      idempotencyKey: idempotency.current(),
    });
    if ('error' in result) return false;
    idempotency.reset();
    quoteRef.current = null;
    return true;
  }, [execute, idempotency]);

  const lockQuote = useCallback(
    async ({ giveCode, wantCode, amount }: LockQuoteInput): Promise<LockQuoteResult> => {
      const source = walletsQ.data?.find((w) => w.currencyCode === giveCode);
      const target = walletsQ.data?.find((w) => w.currencyCode === wantCode);
      if (!source || !target) {
        return { ok: false, error: 'Open both wallets before changing money.' };
      }
      let money;
      try {
        money = toMoney(amount);
      } catch {
        return { ok: false, error: 'Enter a valid amount.' };
      }
      idempotency.reset();
      const result = await preview({
        sourceWalletId: source.id,
        targetWalletId: target.id,
        fixedSide: 'SOURCE',
        amount: money,
      });
      if ('error' in result) {
        return { ok: false, error: toAppError(result.error).message ?? 'Could not get a price.' };
      }
      const quote = result.data;
      quoteRef.current = quote;
      const secondsLeft = Math.max(
        0,
        Math.floor((Date.parse(quote.expiresAt) - Date.now()) / 1000),
      );
      const rate = Number.parseFloat(quote.appliedRate);
      const targetAmt = Number.parseFloat(quote.targetAmount);
      const sourceAmt = Number.parseFloat(quote.sourceAmount);
      const afterBal = balanceNumber(target.availableBalance) + (Number.isFinite(targetAmt) ? targetAmt : 0);
      const oneGive = giveCode === 'NGN' || giveCode === 'KES' ? 1000 : 1;
      const rateForOne = Number.isFinite(rate) ? rate * oneGive : 0;
      return {
        ok: true,
        secondsLeft: secondsLeft || 59,
        giveText: formatDesignMoney(giveCode, sourceAmt),
        nowGet: formatDesignMoney(wantCode, targetAmt),
        rateText: `${formatDesignMoney(giveCode, oneGive).replace(/\.00$/, '')} = ${formatDesignMoney(wantCode, rateForOne)}`,
        afterText: formatDesignMoney(wantCode, afterBal),
        targetAmount: targetAmt,
      };
    },
    [idempotency, preview, walletsQ.data],
  );

  const confirmPin = useCallback(
    async (pin: string) => {
      const ok = await verifyDesignPin(pin);
      if (!ok) return false;
      return runExecute();
    },
    [runExecute],
  );

  const confirmBiometric = useCallback(async () => {
    const confirmed = await requestPin({
      title: 'Confirm exchange',
      message: 'Confirm with fingerprint or enter your PIN to change money.',
      allowBiometric: true,
    });
    if (!confirmed) return false;
    return runExecute();
  }, [requestPin, runExecute]);

  return {
    backend: true as const,
    liveWallets,
    lockQuote,
    confirmPin,
    confirmBiometric,
  };
}
