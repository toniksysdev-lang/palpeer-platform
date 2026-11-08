import * as Clipboard from 'expo-clipboard';
import { useCallback, useMemo } from 'react';
import { Share } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { shareMessage } from '@/features/promotions/logic';
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
  const referrals = referralsQ.data ?? [];

  const joined = referrals.filter((r) => r.status === 'COMPLETED').length;
  const open = referrals.filter((r) => r.status === 'OPEN').length;

  const joinedText = useMemo(() => {
    if (joined > 0) {
      return `${joined} joined` + (open ? ` · ${open} waiting` : '');
    }
    if (open > 0) return `${open} invited, waiting to join`;
    return 'Nobody has joined yet';
  }, [joined, open]);

  const people = useMemo(() => {
    return referrals.map((r) => {
      const when = formatDateTime(r.createdAt) ?? '';
      if (r.status === 'COMPLETED') {
        return {
          title: r.referralCode,
          note: `Joined and checked · ${when}`,
        };
      }
      if (r.status === 'OPEN') {
        return {
          title: r.referralCode,
          note: `Invited · waiting · ${when}`,
        };
      }
      return {
        title: r.referralCode,
        note: `${r.status} · ${when}`,
      };
    });
  }, [referrals]);

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
