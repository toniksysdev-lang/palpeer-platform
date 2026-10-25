import { skipToken } from '@reduxjs/toolkit/query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, Switch, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { ConfirmDialog } from '@/components/ui/AppModal';
import { AppText } from '@/components/ui/AppText';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { NegotiationCard } from '@/features/negotiation/components/NegotiationCard';
import { chatErrorMessage } from '@/features/chat/logic';
import { negotiationErrorMessage } from '@/features/negotiation/logic';
import { useNegotiationRealtime } from '@/features/negotiation/useNegotiationRealtime';
import { ReviewRow } from '@/features/wallets/components/ReviewRow';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useNow } from '@/hooks/useNow';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { useOpenChatRoomMutation } from '@/services/api/chatApi';
import { toAppError } from '@/services/api/errors';
import {
  useCreateOfferMutation,
  useGetMyNegotiationsQuery,
} from '@/services/api/negotiationApi';
import {
  useAcceptRequestMutation,
  useCancelRequestMutation,
  useDeleteRequestMutation,
  useGetMyOrdersQuery,
  useGetP2PFeeEstimateQuery,
  useGetRequestQuery,
  useUpdateRequestMutation,
} from '@/services/api/p2pApi';
import { useGetWalletsQuery } from '@/services/api/walletApi';
import { useAppSelector } from '@/store';
import { formatDateTime } from '@/utils/datetime';
import { isPositiveMoney, toMoney } from '@/utils/money';

import { ExpiryCountdown } from '../components/ExpiryCountdown';
import { FlippableRateLine } from '../components/FlippableRateLine';
import { NoSettlementNotice } from '../components/NoSettlementNotice';
import { acceptFundingIssueMessage, requestActionErrorMessage } from '../errors';
import {
  acceptConfirmMessage,
  acceptorFundingRequirement,
  acceptFundingIssue,
  canAccept,
  canDeleteRequest,
  canManage,
  effectiveStatus,
  netBaseAfterFee,
  p2pRateLine,
  quoteTotal,
  sideLabel,
  viewerIsP2PBuyer,
} from '../logic';
import { canShareSellOrder, shareSellOrder } from '../shareSellOrder';

export function RequestDetailScreen() {
  const theme = useTheme();
  const toast = useToast();
  const now = useNow();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAppSelector((state) => state.session.userId);
  const { format, precision } = useMoneyFormat();
  const request = useGetRequestQuery(id);
  const wallets = useGetWalletsQuery();
  const [accept, acceptState] = useAcceptRequestMutation();
  const [cancel, cancelState] = useCancelRequestMutation();
  const [remove, removeState] = useDeleteRequestMutation();
  const [updateRequest, updateState] = useUpdateRequestMutation();
  const [createOffer, createOfferState] = useCreateOfferMutation();
  const [openChatRoom, openChatRoomState] = useOpenChatRoomMutation();
  const [confirming, setConfirming] = useState<'accept' | 'cancel' | 'delete' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [openingOfferChat, setOpeningOfferChat] = useState(false);
  /** Buyer opt-in: apply PENDING referral/promo bonus credit to the platform fee. */
  const [applyBonusCredit, setApplyBonusCredit] = useState(false);
  /** Draft + applied promo code — discount is never auto-applied without Apply. */
  const [promoDraft, setPromoDraft] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const data = request.data;
  const status = data ? effectiveStatus(data, now) : null;
  const matched = status === 'ACCEPTED' || status === 'COMPLETED';
  const orders = useGetMyOrdersQuery(matched ? undefined : skipToken);
  const order = orders.data?.find((item) => item.requestId === id);
  const negotiations = useGetMyNegotiationsQuery(id ? { p2pRequestId: id } : skipToken);
  useNegotiationRealtime();

  const ownPreview = data != null && userId != null && data.userId === userId;
  const buyerPreview = data != null && viewerIsP2PBuyer(data.side, ownPreview);

  useEffect(() => {
    if (data && ownPreview && data.side === 'BUY') {
      setApplyBonusCredit(!!data.applyBonusCredit);
    }
  }, [data?.id, data?.applyBonusCredit, data?.side, ownPreview]);

  // Load fee-estimate for buyers; promo only when applied, bonus only when opted in.
  const feeEstimate = useGetP2PFeeEstimateQuery(
    buyerPreview && data
      ? {
          baseCurrencyCode: data.baseCurrencyCode,
          quoteCurrencyCode: data.quoteCurrencyCode,
          amount: String(data.amount),
          rate: String(data.rate),
          applyBonusCredit,
          promotionCode: appliedPromoCode,
        }
      : skipToken,
  );

  useEffect(() => {
    if (!appliedPromoCode || !feeEstimate.data || feeEstimate.isFetching) return;
    const matchedCode = feeEstimate.data.appliedPromotionCode?.trim().toUpperCase() ?? null;
    if (matchedCode) {
      setPromoError(null);
      return;
    }
    setPromoError("That promo code isn't valid for this fee.");
    setAppliedPromoCode(null);
  }, [appliedPromoCode, feeEstimate.data, feeEstimate.isFetching]);

  const header = <StackHeader title="P2P request" />;

  if (request.error && !data) {
    return (
      <Screen>
        {header}
        <ErrorState error={toAppError(request.error)} onRetry={() => void request.refetch()} />
      </Screen>
    );
  }
  if (!data || !status) {
    return (
      <Screen>
        {header}
        <Skeleton height={240} />
      </Screen>
    );
  }

  const own = data.userId === userId;
  const showBuyerFee = viewerIsP2PBuyer(data.side, own);
  const base = data.baseCurrencyCode;
  const quote = data.quoteCurrencyCode;
  const basePrecision = precision(base) ?? 2;
  const amount = format(data.amount, base);
  const rate = p2pRateLine(data.rate, base, quote);
  const quotePrecision = precision(quote) ?? 2;
  // Acceptor funding debit (SELL buyer pays quote; BUY acceptor/seller pays base).
  const debitCurrency = data.side === 'SELL' ? quote : base;
  const debitRaw =
    data.side === 'SELL' ? quoteTotal(data.amount, data.rate, quotePrecision) : data.amount;
  // Buyer summary: always pay quote, receive base (net of platform fee).
  const buyerPayRaw = quoteTotal(String(data.amount), String(data.rate), quotePrecision);
  const buyerPayCurrency = quote;
  const grossFeeRaw =
    feeEstimate.data?.estimatedFeeAmount != null &&
    isPositiveMoney(String(feeEstimate.data.estimatedFeeAmount))
      ? String(feeEstimate.data.estimatedFeeAmount)
      : data.estimatedFeeAmount != null && isPositiveMoney(String(data.estimatedFeeAmount))
        ? String(data.estimatedFeeAmount)
        : null;
  const feeDiscountRaw =
    feeEstimate.data?.feeDiscountAmount != null &&
    isPositiveMoney(String(feeEstimate.data.feeDiscountAmount))
      ? String(feeEstimate.data.feeDiscountAmount)
      : null;
  const feeAfterFromApi =
    feeEstimate.data?.feeAfterDiscount != null
      ? String(feeEstimate.data.feeAfterDiscount)
      : null;
  const feeAmountRaw = feeAfterFromApi ?? grossFeeRaw;
  const feeCurrency =
    feeEstimate.data?.estimatedFeeCurrency ?? data.estimatedFeeCurrency ?? base;
  const promoCode = feeEstimate.data?.appliedPromotionCode ?? null;
  const pendingBonusRaw =
    feeEstimate.data?.pendingBonusCredit != null &&
    isPositiveMoney(String(feeEstimate.data.pendingBonusCredit))
      ? String(feeEstimate.data.pendingBonusCredit)
      : null;
  const netBaseRaw =
    showBuyerFee && feeAmountRaw && isPositiveMoney(feeAmountRaw)
      ? netBaseAfterFee(String(data.amount), feeAmountRaw, basePrecision)
      : showBuyerFee && feeAmountRaw && !isPositiveMoney(feeAmountRaw)
        ? String(data.amount)
        : null;
  const formattedFeeForConfirm =
    showBuyerFee && feeAmountRaw != null
      ? format(isPositiveMoney(feeAmountRaw) ? feeAmountRaw : '0', feeCurrency)
      : null;
  const acceptMessage = acceptConfirmMessage({
    side: data.side,
    formattedBaseAmount: amount,
    rateLine: rate,
    posterName: data.posterDisplayName ?? 'Palpeer user',
    formattedDebitAmount: format(debitRaw, debitCurrency),
    debitCurrencyCode: debitCurrency,
    formattedFeeAmount: formattedFeeForConfirm,
    formattedNetBaseAmount:
      showBuyerFee && netBaseRaw ? format(netBaseRaw, base) : null,
  });
  const acceptable = canAccept(data, userId, now);
  const fundingRequirement = acceptorFundingRequirement(
    data.side,
    base,
    quote,
    String(data.amount),
    String(data.rate),
    quotePrecision,
  );
  const fundingWallet = (wallets.data ?? []).find(
    (wallet) => wallet.currencyCode.toUpperCase() === fundingRequirement.currencyCode.toUpperCase(),
  );
  const fundingIssue = acceptable
    ? acceptFundingIssue(fundingRequirement, fundingWallet)
    : null;
  const fundingError = fundingIssue ? acceptFundingIssueMessage(fundingIssue) : null;
  const manageable = canManage(data, userId, now);
  const deletable = cancelled || canDeleteRequest(data, userId, now);

  const tryAccept = () => {
    setActionError(null);
    if (fundingIssue) {
      setActionError(acceptFundingIssueMessage(fundingIssue));
      return;
    }
    setConfirming('accept');
  };

  const runAccept = async () => {
    setActionError(null);
    if (fundingIssue) {
      setConfirming(null);
      setActionError(acceptFundingIssueMessage(fundingIssue));
      return;
    }
    const result = await accept({
      id: data.id,
      applyBonusCredit,
      promotionCode: appliedPromoCode,
    });
    setConfirming(null);
    if ('error' in result) {
      setActionError(requestActionErrorMessage(toAppError(result.error)));
      return;
    }
    toast.show({ type: 'success', title: 'P2P order completed' });
    router.replace('/(tabs)/p2p');
  };

  const runCancel = async () => {
    setActionError(null);
    const result = await cancel(data.id);
    setConfirming(null);
    if ('error' in result) {
      setActionError(requestActionErrorMessage(toAppError(result.error)));
      return;
    }
    setCancelled(true);
  };

  const runDelete = async () => {
    setActionError(null);
    const result = await remove(data.id);
    setConfirming(null);
    if ('error' in result) {
      setActionError(requestActionErrorMessage(toAppError(result.error)));
      return;
    }
    router.replace({ pathname: '/p2p/history', params: { tab: 'requests' } });
  };

  // At most one open negotiation per counterparty per request (R-N-1); the owner can have several.
  const myNegotiation = own
    ? undefined
    : negotiations.data?.find(
        (negotiation) =>
          negotiation.counterpartyId === userId && negotiation.status === 'OPEN',
      );
  const openNegotiation = (negotiationId: string) =>
    router.push({ pathname: '/negotiation/[id]', params: { id: negotiationId } });

  /** Opens the buyer–seller negotiation chat (message picker lives on the chat screen). */
  const goToNegotiationChat = async (negotiationId: string) => {
    const roomResult = await openChatRoom({ negotiationId });
    if ('error' in roomResult) {
      setActionError(chatErrorMessage(toAppError(roomResult.error)));
      return;
    }
    router.push({ pathname: '/chat/[roomId]', params: { roomId: roomResult.data.id } });
  };

  /**
   * Make an offer → chat: seed a negotiation with the listing terms (if needed), open the room,
   * and let the buyer pick a suggested message there. No auto-sent offer line.
   */
  const startOfferChat = async () => {
    if (openingOfferChat) return;
    setOpeningOfferChat(true);
    setActionError(null);
    try {
      if (myNegotiation) {
        await goToNegotiationChat(myNegotiation.id);
        return;
      }
      const result = await createOffer({
        p2pRequestId: data.id,
        amount: toMoney(String(data.amount)),
        rate: toMoney(String(data.rate)),
      });
      if ('error' in result) {
        const appError = toAppError(result.error);
        if (appError.code === 'NEGOTIATION_EXISTS') {
          const refreshed = await negotiations.refetch();
          const existing = refreshed.data?.find(
            (negotiation) => negotiation.counterpartyId === userId && negotiation.status === 'OPEN',
          );
          if (existing) {
            await goToNegotiationChat(existing.id);
            return;
          }
        }
        setActionError(negotiationErrorMessage(appError));
        return;
      }
      await goToNegotiationChat(result.data.id);
    } finally {
      setOpeningOfferChat(false);
    }
  };

  const offerChatBusy =
    openingOfferChat || createOfferState.isLoading || openChatRoomState.isLoading;

  let footer = null;
  if (acceptable) {
    footer = (
      <View style={{ gap: theme.spacing.sm }}>
        {fundingError ? (
          <FormAlert tone="danger" message={fundingError} testID="p2p-accept-funding-error" />
        ) : null}
        <Button
          label="Accept request"
          onPress={tryAccept}
          loading={acceptState.isLoading}
          disabled={!!fundingIssue}
          testID="p2p-accept"
        />
        {myNegotiation ? (
          <Button
            label="View your offer"
            variant="outline"
            onPress={() => void goToNegotiationChat(myNegotiation.id)}
            loading={offerChatBusy}
            testID="p2p-view-offer"
          />
        ) : (
          <Button
            label="Make an offer"
            variant="outline"
            onPress={() => void startOfferChat()}
            loading={offerChatBusy}
            loadingLabel="Opening chat…"
            testID="p2p-make-offer"
          />
        )}
      </View>
    );
  } else if (manageable) {
    const shareable = canShareSellOrder(data, own, status);
    footer = (
      <View style={{ gap: theme.spacing.sm }}>
        {shareable ? (
          <Button
            label="Share Your Sell Order"
            onPress={() => {
              void (async () => {
                setSharing(true);
                try {
                  await shareSellOrder(data, amount);
                } catch {
                  toast.show({ type: 'error', title: "Couldn't open the share sheet" });
                } finally {
                  setSharing(false);
                }
              })();
            }}
            loading={sharing}
            testID="p2p-share-sell"
          />
        ) : null}
        <Button
          label="Edit request"
          variant="outline"
          onPress={() =>
            router.push({ pathname: '/p2p/request/[id]/edit', params: { id: data.id } })
          }
          testID="p2p-edit"
        />
        <Button
          label="Cancel request"
          variant="danger"
          onPress={() => setConfirming('cancel')}
          loading={cancelState.isLoading}
          testID="p2p-cancel"
        />
      </View>
    );
  } else if (order) {
    footer = (
      <Button
        label="View order"
        onPress={() => router.push({ pathname: '/p2p/order/[id]', params: { id: order.id } })}
        testID="p2p-view-order"
      />
    );
  } else if (deletable) {
    footer = (
      <Button
        label="Delete from history"
        variant="danger"
        onPress={() => setConfirming('delete')}
        loading={removeState.isLoading}
        testID="p2p-delete-request"
      />
    );
  } else if (myNegotiation) {
    footer = (
      <Button
        label="View your offer"
        variant="outline"
        onPress={() => openNegotiation(myNegotiation.id)}
        testID="p2p-view-offer"
      />
    );
  }

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={request.isFetching && !request.isLoading}
          onRefresh={() => void request.refetch()}
          tintColor={theme.colors.primary}
        />
      }
      footer={footer}
    >
      {header}
      <View style={{ gap: theme.spacing.xs }}>
        <StatusBadge status={status} testID="p2p-request-status" />
        <AppText variant="h2">
          {base}/{quote}
        </AppText>
        <AppText tone="secondary" testID="p2p-request-side">
          {sideLabel(data.side, base, quote, own ? 'self' : 'other')}
        </AppText>
      </View>

      <FormAlert
        tone="success"
        message={
          cancelled
            ? 'Your request was cancelled. You can delete it from your history below.'
            : null
        }
        testID="p2p-cancelled"
      />
      <FormAlert message={actionError} testID="p2p-action-error" />
      {!own && !acceptable && !order ? (
        <FormAlert tone="info" message="This request is no longer open." testID="p2p-not-open" />
      ) : null}

      <Card variant="outlined" padding="md">
        <ReviewRow label="Amount" value={amount} testID="p2p-request-amount" />
        <View style={{ gap: theme.spacing.xs, paddingVertical: theme.spacing.sm }}>
          <AppText tone="secondary">Rate</AppText>
          <FlippableRateLine
            rate={data.rate}
            base={base}
            quote={quote}
            variant="bodyStrong"
            tone="primary"
            full
            maxDecimals={12}
            testID="p2p-request-rate"
          />
        </View>
        <ReviewRow
          label="Expires"
          value={formatDateTime(data.expiresAt) ?? 'No expiry'}
          testID="p2p-request-expires"
        />
        {showBuyerFee && grossFeeRaw ? (
          <>
            {feeDiscountRaw ? (
              <ReviewRow
                label="Platform fee (before promo)"
                value={format(grossFeeRaw, feeCurrency)}
                testID="p2p-request-fee-gross"
              />
            ) : null}
            {feeDiscountRaw ? (
              <ReviewRow
                label={
                  promoCode
                    ? `Promo discount (${promoCode})`
                    : applyBonusCredit
                      ? 'Bonus credit'
                      : 'Promo / bonus discount'
                }
                value={`−${format(feeDiscountRaw, feeCurrency)}`}
                testID="p2p-request-fee-discount"
              />
            ) : null}
            <ReviewRow
              label="Platform fee"
              value={format(
                feeAmountRaw != null && isPositiveMoney(feeAmountRaw) ? feeAmountRaw : '0',
                feeCurrency,
              )}
              testID="p2p-request-fee"
            />
            {status === 'OPEN' ? (
              <View style={{ gap: theme.spacing.sm, width: '100%' }} testID="p2p-promo-code">
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    gap: theme.spacing.sm,
                    width: '100%',
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Input
                      label="Promo code"
                      value={promoDraft}
                      onChangeText={(value) => {
                        setPromoDraft(value);
                        setPromoError(null);
                      }}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      placeholder="Enter code"
                      testID="p2p-promo-code-input"
                    />
                  </View>
                  <View style={{ flexShrink: 0, marginBottom: 1 }}>
                    <Button
                      label={
                        appliedPromoCode &&
                        promoDraft.trim().toUpperCase() === appliedPromoCode &&
                        !!promoCode
                          ? 'Applied'
                          : 'Apply'
                      }
                      variant="outline"
                      size="md"
                      fullWidth={false}
                      disabled={!promoDraft.trim() || feeEstimate.isFetching}
                      loading={feeEstimate.isFetching && !!appliedPromoCode}
                      onPress={() => {
                        const code = promoDraft.trim().toUpperCase();
                        if (!code) return;
                        setPromoError(null);
                        setAppliedPromoCode(code);
                      }}
                      testID="p2p-promo-code-apply"
                    />
                  </View>
                </View>
                {appliedPromoCode && promoCode ? (
                  <Button
                    label="Remove promo"
                    variant="ghost"
                    onPress={() => {
                      setAppliedPromoCode(null);
                      setPromoDraft('');
                      setPromoError(null);
                    }}
                    testID="p2p-promo-code-clear"
                  />
                ) : null}
                <FormAlert message={promoError} testID="p2p-promo-code-error" />
              </View>
            ) : null}
            {pendingBonusRaw && status === 'OPEN' ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                }}
                testID="p2p-apply-bonus"
              >
                <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                  <AppText variant="bodyStrong">Apply bonus credit</AppText>
                  <AppText variant="caption" tone="secondary">
                    Use {format(pendingBonusRaw, feeCurrency)} from your pending bonuses toward this
                    fee. Updates what you receive below.
                  </AppText>
                </View>
                <Switch
                  value={applyBonusCredit}
                  onValueChange={(value) => {
                    setApplyBonusCredit(value);
                    if (own && data.side === 'BUY') {
                      void updateRequest({
                        id: data.id,
                        changes: { applyBonusCredit: value },
                      });
                    }
                  }}
                  disabled={updateState.isLoading}
                  accessibilityLabel="Apply bonus credit to platform fee"
                  trackColor={{ true: theme.colors.primary, false: theme.colors.borderStrong }}
                  testID="p2p-apply-bonus-switch"
                />
              </View>
            ) : null}
            <ReviewRow
              label="You pay"
              value={format(buyerPayRaw, buyerPayCurrency)}
              testID="p2p-request-you-pay"
            />
            {netBaseRaw ? (
              <ReviewRow
                label="You receive"
                value={format(netBaseRaw, base)}
                testID="p2p-request-net-receive"
              />
            ) : null}
          </>
        ) : null}
        {status === 'OPEN' && data.expiresAt ? (
          <ExpiryCountdown expiresAt={data.expiresAt} testID="p2p-request-countdown" />
        ) : null}
        <ReviewRow label="Posted" value={formatDateTime(data.createdAt) ?? '—'} />
        {own ? <ReviewRow label="Posted by" value="You" /> : null}
      </Card>

      {data.notes ? (
        <Card variant="muted" padding="md">
          <AppText variant="caption" tone="secondary">
            Notes
          </AppText>
          <AppText testID="p2p-request-notes">{data.notes}</AppText>
        </Card>
      ) : null}

      {own && negotiations.data && negotiations.data.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }} testID="p2p-request-offers">
          <AppText variant="bodyStrong">Offers ({negotiations.data.length})</AppText>
          {negotiations.data.map((negotiation) => (
            <NegotiationCard
              key={negotiation.id}
              negotiation={negotiation}
              userId={userId}
              onPress={() => openNegotiation(negotiation.id)}
            />
          ))}
        </View>
      ) : null}

      <NoSettlementNotice />

      <ConfirmDialog
        visible={confirming === 'accept'}
        title="Accept this request?"
        message={acceptMessage}
        confirmLabel="Accept"
        loading={acceptState.isLoading}
        onConfirm={() => void runAccept()}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        visible={confirming === 'cancel'}
        title="Cancel this request?"
        message="It will be removed from the marketplace. This can't be undone."
        confirmLabel="Cancel request"
        cancelLabel="Keep request"
        destructive
        loading={cancelState.isLoading}
        onConfirm={() => void runCancel()}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        visible={confirming === 'delete'}
        title="Delete from history?"
        message="This cancelled request will be removed from your P2P history. This can't be undone."
        confirmLabel="Delete"
        cancelLabel="Keep"
        destructive
        loading={removeState.isLoading}
        onConfirm={() => void runDelete()}
        onCancel={() => setConfirming(null)}
      />
    </Screen>
  );
}
