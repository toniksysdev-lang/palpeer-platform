import { useEffect, useRef } from 'react';

import { useToast } from '@/providers/ToastProvider';
import { toAppError } from '@/services/api/errors';
import { useApplyReferralMutation } from '@/services/api/promotionApi';
import { referralStorage } from '@/services/storage/referralStorage';
import { useAppSelector } from '@/store';

import { referralErrorMessage } from './logic';

/**
 * After sign-up → verify → login, applies a referral code saved from the register form once.
 * Soft permanent failures clear the pending code so we never retry forever.
 */
export function useApplyPendingReferral() {
  const isAuthenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const [applyReferral] = useApplyReferralMutation();
  const toast = useToast();
  const attempted = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || attempted.current) return;
    attempted.current = true;

    void (async () => {
      const code = await referralStorage.peek();
      if (!code) return;

      const result = await applyReferral({ referralCode: code });
      if ('error' in result) {
        const error = toAppError(result.error);
        const permanent =
          error.code === 'REFERRAL_ALREADY_APPLIED' ||
          error.code === 'REFERRAL_NOT_OPEN' ||
          error.code === 'REFERRAL_SELF' ||
          error.status === 404;
        if (permanent) {
          await referralStorage.clear();
          if (error.code !== 'REFERRAL_ALREADY_APPLIED') {
            toast.show({
              type: 'warning',
              title: "Couldn't apply your referral code",
              message: referralErrorMessage(error),
            });
          }
        }
        return;
      }

      await referralStorage.clear();
      toast.show({ type: 'success', title: 'Referral code applied' });
    })();
  }, [applyReferral, isAuthenticated, toast]);
}
