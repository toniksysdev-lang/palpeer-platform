import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Share } from 'react-native';

import {
  completedReferrals,
  invitedFriendsSummary,
  shareMessage,
} from '@/features/promotions/logic';
import {
  useGetMyReferralCodeQuery,
  useGetMyReferralsQuery,
} from '@/services/api/promotionApi';
import { useAppSelector } from '@/store';
import { formatDateTime } from '@/utils/datetime';

/** Live props for design InviteFriends screen. */
export function useLiveInviteFriends() {
  const authenticated = useAppSelector((s) => s.session.status === 'authenticated');
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const codeQ = useGetMyReferralCodeQuery(undefined, { skip: !authenticated });
  const referralsQ = useGetMyReferralsQuery(undefined, { skip: !authenticated });

  const referralCode = codeQ.data?.referralCode ?? '';
  const joinedRows = useMemo(
    () => completedReferrals(referralsQ.data ?? []),
    [referralsQ.data],
  );
  const joinedCount = joinedRows.length;
  const joinedText = invitedFriendsSummary(joinedCount);

  const people = useMemo(() => {
    return joinedRows.map((r) => {
      const when = formatDateTime(r.createdAt) ?? '';
      const who = (r.refereeUsername && `@${r.refereeUsername}`) || 'A friend';
      return {
        title: who,
        note: when ? `Joined and checked · ${when}` : 'Joined and checked',
      };
    });
  }, [joinedRows]);

  const onShare = useCallback(async () => {
    if (!referralCode) return;
    try {
      await Share.share({ message: shareMessage(referralCode) });
    } catch {
      /* cancelled */
    }
  }, [referralCode]);

  const onCopy = useCallback(async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!referralCode) return { ok: false, error: 'No code yet' };
    try {
      await Clipboard.setStringAsync(referralCode);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not copy' };
    }
  }, [referralCode]);

  return {
    backend: true as const,
    tab: tab === 'people' ? 'people' : 'code',
    referralCode,
    shareMessage: referralCode ? shareMessage(referralCode) : '',
    joinedText,
    people,
    onShare,
    onCopy,
  };
}
