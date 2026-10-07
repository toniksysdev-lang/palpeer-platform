import { useEffect, useRef } from 'react';

import { baseApi } from '@/services/api/baseApi';
import { walletBalanceTags } from '@/services/api/walletApi';
import { useAppDispatch } from '@/store';

import { isInProgress } from './movementStatus';

/**
 * Refetches the wallet balance and ledger when a money movement seen in progress on this screen
 * reaches a final status, so the balance shown next is the backend's updated one.
 */
export function useFinalStatusRefresh(walletId: string | undefined, status: string | undefined) {
  const dispatch = useAppDispatch();
  const sawInProgress = useRef(false);

  useEffect(() => {
    if (!walletId || !status) return;
    if (isInProgress(status)) {
      sawInProgress.current = true;
      return;
    }
    if (sawInProgress.current) {
      sawInProgress.current = false;
      dispatch(baseApi.util.invalidateTags(walletBalanceTags(walletId)));
    }
  }, [dispatch, status, walletId]);
}
