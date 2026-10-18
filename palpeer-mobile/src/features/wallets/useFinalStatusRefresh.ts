import { useEffect, useRef } from 'react';

import { baseApi } from '@/services/api/baseApi';
import { walletBalanceTags } from '@/services/api/walletApi';
import { useAppDispatch } from '@/store';

import { isInProgress } from './movementStatus';

/**
 * Refetches the wallet balance and ledger when a money movement reaches a final status so Home /
 * wallet screens show the updated balance without a manual pull-to-refresh.
 *
 * Covers both:
 * - PENDING/PROCESSING → SUCCESS (funding webhooks, settlement)
 * - First paint already SUCCESS (InstantEX / sandbox auto-settle, exchange execute)
 */
export function useFinalStatusRefresh(walletId: string | undefined, status: string | undefined) {
  const dispatch = useAppDispatch();
  const previousStatus = useRef<string | undefined>(undefined);
  const refreshedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!walletId || !status) return;

    const prev = previousStatus.current;
    previousStatus.current = status;

    if (isInProgress(status)) return;

    const becameFinal = prev !== undefined && isInProgress(prev);
    const landedOnCredited = status === 'SUCCESS' || status === 'REVERSED';
    // FAILED after an in-progress hold also needs a balance refresh (hold released).
    const shouldRefresh = landedOnCredited || becameFinal;
    if (!shouldRefresh) return;

    const key = `${walletId}:${status}`;
    if (refreshedFor.current === key) return;
    refreshedFor.current = key;
    dispatch(baseApi.util.invalidateTags(walletBalanceTags(walletId)));
  }, [dispatch, status, walletId]);
}
