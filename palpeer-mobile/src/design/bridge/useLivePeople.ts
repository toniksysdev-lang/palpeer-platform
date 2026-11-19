import { useCallback, useMemo, useRef } from 'react';

import { sellOrderShareUrl } from '@/features/p2p/shareSellOrder';
import { usePinPrompt } from '@/features/security/PinPromptProvider';
import { toAppError } from '@/services/api/errors';
import {
  useAcceptNegotiationMutation,
  useCancelNegotiationMutation,
  useCounterOfferMutation,
  useCreateOfferMutation,
  useGetMyNegotiationsQuery,
  useRejectNegotiationMutation,
} from '@/services/api/negotiationApi';
import { newIdempotencyKey } from '@/services/api/client';
import { useOpenChatRoomMutation, useSendChatMessageMutation } from '@/services/api/chatApi';
import {
  useAcceptRequestMutation,
  useCancelRequestMutation,
  useCreateRequestMutation,
  useGetMyRequestsQuery,
  useGetOpenRequestsQuery,
  useGetP2PRateBoundsQuery,
  useLazyGetP2PFeeEstimateQuery,
} from '@/services/api/p2pApi';
import { ALERTS_POLL_MS } from '@/services/api/notificationApi';
import { formatPoints } from '@/features/loyalty/logic';
import {
  useGetActivePromotionsQuery,
  useGetMyLoyaltyPointsBalanceQuery,
} from '@/services/api/promotionApi';
import { useGetWalletsQuery } from '@/services/api/walletApi';
import { useAppSelector } from '@/store';
import type { P2PRequestResponse, P2PSide } from '@/types/api/p2p';
import { formatMoney, toMoney } from '@/utils/money';

import { balanceNumber, ownedDesignWallets } from './mapWallet';
import { verifyDesignPin } from './verifyPin';

type OkErr = { ok: true; data?: unknown } | { ok: false; error: string; reason?: string };

type PendingAccept = {
  requestId: string;
  amount?: string;
  applyBonusCredit?: boolean;
  promotionCode?: string | null;
};

function toOffer(req: P2PRequestResponse) {
  const giveCode = req.side === 'SELL' ? req.baseCurrencyCode : req.quoteCurrencyCode;
  const amt = Number.parseFloat(req.amount) || 0;
  const rate = Number.parseFloat(req.rate) || 0;
  const left = req.expiresAt
    ? Math.max(0, Math.floor((Date.parse(req.expiresAt) - Date.now()) / 1000))
    : 3600;
  return {
    id: req.id,
    giveCode,
    amt,
    least: Math.min(10, amt),
    rate,
    left,
    posterDisplayName: req.posterDisplayName ?? undefined,
    side: req.side,
    baseCurrencyCode: req.baseCurrencyCode,
    quoteCurrencyCode: req.quoteCurrencyCode,
    userId: req.userId,
  };
}

function toMine(req: P2PRequestResponse) {
  return { ...toOffer(req), sold: 0 };
}

export function useLivePeople() {
  const authenticated = useAppSelector((s) => s.session.status === 'authenticated');
  const open = useGetOpenRequestsQuery(undefined, {
    skip: !authenticated,
    pollingInterval: authenticated ? ALERTS_POLL_MS : 0,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const mine = useGetMyRequestsQuery(undefined, {
    skip: !authenticated,
    pollingInterval: authenticated ? ALERTS_POLL_MS : 0,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const walletsQ = useGetWalletsQuery(undefined, { skip: !authenticated });
  const userId = useAppSelector((s) => s.session.userId);
  const negotiations = useGetMyNegotiationsQuery(undefined, {
    skip: !authenticated,
    pollingInterval: authenticated ? ALERTS_POLL_MS : 0,
  });
  // CAD→NGN bounds drive "My rate for CA$1" on Create offer (admin min/max).
  const rateBoundsQ = useGetP2PRateBoundsQuery(
    { baseCurrencyCode: 'CAD', quoteCurrencyCode: 'NGN' },
    { skip: !authenticated },
  );
  const pointsBalanceQ = useGetMyLoyaltyPointsBalanceQuery(undefined, { skip: !authenticated });
  const promotionsQ = useGetActivePromotionsQuery(undefined, { skip: !authenticated });
  const [acceptRequest] = useAcceptRequestMutation();
  const [cancelRequest] = useCancelRequestMutation();
  const [createRequest] = useCreateRequestMutation();
  const [createOffer] = useCreateOfferMutation();
  const [counterOffer] = useCounterOfferMutation();
  const [acceptNegotiation] = useAcceptNegotiationMutation();
  const [cancelNegotiation] = useCancelNegotiationMutation();
  const [rejectNegotiation] = useRejectNegotiationMutation();
  const [openChatRoom] = useOpenChatRoomMutation();
  const [sendChatMessage] = useSendChatMessageMutation();
  const [estimateFee] = useLazyGetP2PFeeEstimateQuery();
  const { requestPin } = usePinPrompt();
  const pendingAccept = useRef<PendingAccept | null>(null);

  const liveOffers = useMemo(
    () =>
      (open.data ?? [])
        .filter((r) => r.status === 'OPEN' && r.userId !== userId)
        .map(toOffer),
    [open.data, userId],
  );

  const liveMine = useMemo(
    () => (mine.data ?? []).filter((r) => r.status === 'OPEN').map(toMine),
    [mine.data],
  );

  const liveBalances = useMemo(() => {
    const map: Record<string, number> = {};
    for (const w of walletsQ.data ?? []) {
      // Normalize codes so People bal('NGN') matches API keys like "ngn" / "NGN".
      const code = (w.currencyCode || '').trim().toUpperCase();
      if (!code) continue;
      map[code] = balanceNumber(w.availableBalance);
    }
    return map;
  }, [walletsQ.data]);

  const liveWallets = useMemo(() => ownedDesignWallets(walletsQ.data), [walletsQ.data]);

  const liveNegotiations = useMemo(() => negotiations.data ?? [], [negotiations.data]);

  const bonusCadUnused = useMemo(() => {
    const bal = pointsBalanceQ.data;
    if (bal) return Number.parseFloat(String(bal.balanceCad ?? '0')) || 0;
    return 0;
  }, [pointsBalanceQ.data]);

  const pointsBalance = pointsBalanceQ.data?.balancePoints ?? 0;

  const bonusText = useMemo(() => {
    const bal = pointsBalanceQ.data;
    if (!bal || bal.balancePoints <= 0) {
      return 'No points yet. Invite friends or use a promo code.';
    }
    const cad = formatMoney(bal.balanceCad, {
      currencyCode: bal.currencyCode || 'CAD',
      precision: 2,
    });
    return `You have ${formatPoints(bal.balancePoints)}, worth ${cad}. Use them on your next P2P fee.`;
  }, [pointsBalanceQ.data]);

  const prepareAccept = useCallback(
    (
      requestId: string,
      amount?: string,
      reward?: { applyBonusCredit?: boolean; promotionCode?: string | null },
    ) => {
      pendingAccept.current = {
        requestId,
        amount,
        applyBonusCredit: !!reward?.applyBonusCredit,
        promotionCode: reward?.promotionCode?.trim() || null,
      };
      return { ok: true as const };
    },
    [],
  );

  const runAccept = useCallback(async (): Promise<OkErr> => {
    const pending = pendingAccept.current;
    if (!pending) return { ok: false, error: 'Nothing to accept.' };
    try {
      const data = await acceptRequest({
        id: pending.requestId,
        applyBonusCredit: pending.applyBonusCredit,
        promotionCode: pending.promotionCode,
      }).unwrap();
      pendingAccept.current = null;
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: toAppError(error).message ?? 'Could not accept offer.' };
    }
  }, [acceptRequest]);

  const confirmAcceptPin = useCallback(
    async (pin: string): Promise<OkErr> => {
      const ok = await verifyDesignPin(pin);
      if (!ok) return { ok: false, error: 'Wrong PIN.' };
      return runAccept();
    },
    [runAccept],
  );

  const confirmAcceptBiometric = useCallback(async (): Promise<OkErr> => {
    const confirmed = await requestPin({
      title: 'Confirm P2P accept',
      message: 'Confirm with fingerprint or enter your PIN to accept this offer.',
      allowBiometric: true,
    });
    if (!confirmed) return { ok: false, error: 'Cancelled.' };
    return runAccept();
  }, [requestPin, runAccept]);

  const validatePromoCode = useCallback(
    async (input: {
      code: string;
      baseCurrencyCode: string;
      quoteCurrencyCode: string;
      amount: string;
      rate?: string;
    }): Promise<OkErr> => {
      const code = input.code.trim().toUpperCase();
      if (!code) return { ok: false, error: 'Enter a code.', reason: 'bad' };
      const listed = (promotionsQ.data ?? []).find(
        (p) => p.code.trim().toUpperCase() === code,
      );
      if (listed?.endsAt && Date.parse(listed.endsAt) < Date.now()) {
        return { ok: false, error: 'This code has ended.', reason: 'old' };
      }
      try {
        const estimate = await estimateFee({
          baseCurrencyCode: input.baseCurrencyCode,
          quoteCurrencyCode: input.quoteCurrencyCode,
          amount: input.amount,
          rate: input.rate,
          promotionCode: code,
        }).unwrap();
        if (!estimate.appliedPromotionCode && !estimate.feeDiscountAmount) {
          // Still allow listed active codes even if this estimate pair ignores them.
          if (listed?.active) return { ok: true, data: { code: listed.code } };
          return { ok: false, error: 'This code does not work.', reason: 'bad' };
        }
        return { ok: true, data: { code: estimate.appliedPromotionCode || code } };
      } catch (error) {
        if (listed?.active) return { ok: true, data: { code: listed.code } };
        return {
          ok: false,
          error: toAppError(error).message ?? 'This code does not work.',
          reason: 'bad',
        };
      }
    },
    [estimateFee, promotionsQ.data],
  );

  /** PIN gate for actions that have no accept endpoint of their own (post offer, accept a talked price). */
  const confirmPin = useCallback(async (pin: string): Promise<boolean> => verifyDesignPin(pin), []);

  const confirmBiometric = useCallback(async (): Promise<OkErr> => {
    const confirmed = await requestPin({
      title: 'Confirm',
      message: 'Confirm with fingerprint or enter your PIN.',
      allowBiometric: true,
    });
    return confirmed ? { ok: true } : { ok: false, error: 'Cancelled.' };
  }, [requestPin]);

  const onCreateOffer = useCallback(
    async (input: {
      giveCode: string;
      amount: string;
      rate: string;
      hours: number;
    }): Promise<OkErr> => {
      try {
        const side: P2PSide = 'SELL';
        const baseCurrencyCode = input.giveCode;
        const quoteCurrencyCode = input.giveCode === 'CAD' ? 'NGN' : 'CAD';
        const expiresAt = new Date(Date.now() + input.hours * 3600_000).toISOString();
        const data = await createRequest({
          side,
          baseCurrencyCode,
          quoteCurrencyCode,
          amount: toMoney(input.amount),
          rate: toMoney(input.rate),
          expiresAt,
        }).unwrap();
        return { ok: true, data };
      } catch (error) {
        return { ok: false, error: toAppError(error).message ?? 'Could not post offer.' };
      }
    },
    [createRequest],
  );

  const onCancelMine = useCallback(
    async (requestId: string): Promise<OkErr> => {
      try {
        await cancelRequest(requestId).unwrap();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: toAppError(error).message ?? 'Could not stop offer.' };
      }
    },
    [cancelRequest],
  );

  const onSendCounter = useCallback(
    async (input: {
      requestId: string;
      amount: string;
      rate: string;
      negotiationId?: string | null;
    }): Promise<OkErr> => {
      try {
        if (input.negotiationId) {
          const data = await counterOffer({
            id: input.negotiationId,
            offer: { amount: toMoney(input.amount), rate: toMoney(input.rate) },
          }).unwrap();
          return { ok: true, data };
        }
        const data = await createOffer({
          p2pRequestId: input.requestId,
          amount: toMoney(input.amount),
          rate: toMoney(input.rate),
        }).unwrap();
        return { ok: true, data };
      } catch (error) {
        return { ok: false, error: toAppError(error).message ?? 'Could not send price.' };
      }
    },
    [counterOffer, createOffer],
  );

  const onAcceptNegotiation = useCallback(
    async (negotiationId: string, p2pRequestId: string): Promise<OkErr> => {
      try {
        const data = await acceptNegotiation({ id: negotiationId, p2pRequestId }).unwrap();
        return { ok: true, data };
      } catch (error) {
        return { ok: false, error: toAppError(error).message ?? 'Could not accept price.' };
      }
    },
    [acceptNegotiation],
  );

  const onCancelNegotiation = useCallback(
    async (negotiationId: string): Promise<OkErr> => {
      try {
        // Best-effort chat "No" so Talk history shows the decline when leaving mid-wait.
        try {
          const room = await openChatRoom({ negotiationId }).unwrap();
          if (room?.id) {
            await sendChatMessage({
              roomId: room.id,
              message: { content: 'No', clientMessageId: newIdempotencyKey() },
            }).unwrap();
          }
        } catch {
          // Still cancel so the other party gets a push.
        }
        await cancelNegotiation(negotiationId).unwrap();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: toAppError(error).message ?? 'Could not end talk.' };
      }
    },
    [cancelNegotiation, openChatRoom, sendChatMessage],
  );

  /** Decline the pending price, post "No" in the negotiation chat, and notify the other party. */
  const onRejectNegotiation = useCallback(
    async (negotiationId: string): Promise<OkErr> => {
      try {
        // Best-effort chat "No" so Talk / Messages history shows the decline.
        try {
          const room = await openChatRoom({ negotiationId }).unwrap();
          if (room?.id) {
            await sendChatMessage({
              roomId: room.id,
              message: { content: 'No', clientMessageId: newIdempotencyKey() },
            }).unwrap();
          }
        } catch {
          // Chat may not exist yet — still reject the negotiation so push fires.
        }
        await rejectNegotiation(negotiationId).unwrap();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: toAppError(error).message ?? 'Could not say no.' };
      }
    },
    [openChatRoom, rejectNegotiation, sendChatMessage],
  );

  const onOpenNegotiationChat = useCallback(
    async (negotiationId: string): Promise<OkErr> => {
      try {
        const room = await openChatRoom({ negotiationId }).unwrap();
        return { ok: true, data: room };
      } catch (error) {
        return { ok: false, error: toAppError(error).message ?? 'Could not open chat.' };
      }
    },
    [openChatRoom],
  );

  const shareUrlFor = useCallback((requestId: string) => sellOrderShareUrl(requestId), []);

  const liveRateBounds = useMemo(() => {
    const b = rateBoundsQ.data;
    if (!b) return null;
    const min = Number.parseFloat(String(b.minRate)) || 0;
    const max = Number.parseFloat(String(b.maxRate)) || 0;
    if (!(min > 0) || !(max > 0) || max < min) return null;
    return {
      min,
      max,
      mid: Math.round((min + max) / 2),
    };
  }, [rateBoundsQ.data]);

  return {
    backend: true as const,
    userId: userId ?? null,
    liveOffers,
    liveMine,
    liveBalances,
    liveWallets,
    liveNegotiations,
    liveRateBounds,
    peopleLoading: open.isLoading || mine.isLoading,
    shareUrlFor,
    bonusCadUnused,
    bonusText,
    pointsBalance,
    hasBonusCredit: bonusCadUnused > 0,
    validatePromoCode,
    prepareAccept,
    confirmAcceptPin,
    confirmAcceptBiometric,
    confirmPin,
    confirmBiometric,
    onCreateOffer,
    onCancelMine,
    onSendCounter,
    onAcceptNegotiation,
    onCancelNegotiation,
    onRejectNegotiation,
    onOpenNegotiationChat,
  };
}
