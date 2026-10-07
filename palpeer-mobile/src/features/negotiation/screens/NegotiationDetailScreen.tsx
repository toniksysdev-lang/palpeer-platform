import { skipToken } from '@reduxjs/toolkit/query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { ConfirmDialog } from '@/components/ui/AppModal';
import { AppText } from '@/components/ui/AppText';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { effectiveStatus, p2pRateLine } from '@/features/p2p/logic';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useNow } from '@/hooks/useNow';
import { useTheme } from '@/providers/ThemeProvider';
import { toAppError } from '@/services/api/errors';
import {
  useAcceptNegotiationMutation,
  useCancelNegotiationMutation,
  useCounterOfferMutation,
  useGetNegotiationQuery,
  useRejectNegotiationMutation,
} from '@/services/api/negotiationApi';
import { useGetMyOrdersQuery, useGetRequestQuery } from '@/services/api/p2pApi';
import { useRealtimeStatus } from '@/services/websocket/realtime';
import type { NegotiationResponse, OfferResponse } from '@/types/api/negotiation';
import type { P2PRequestResponse } from '@/types/api/p2p';
import { useAppSelector } from '@/store';
import { formatDateTime } from '@/utils/datetime';
import { isPositiveMoney, toMoney } from '@/utils/money';

import { OfferTermsForm } from '../components/OfferTermsForm';
import {
  closedExplanation,
  currentOffer,
  isMyTurn,
  negotiationErrorMessage,
  negotiationRole,
  negotiationSummary,
  offerAuthor,
} from '../logic';
import { useNegotiationRealtime } from '../useNegotiationRealtime';

/** Fallback while live updates are down: an open negotiation is re-read while focused. */
const POLL_MS = 15_000;

export function NegotiationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [open, setOpen] = useState(true);
  useNegotiationRealtime();
  const live = useRealtimeStatus() === 'connected';
  const negotiation = useGetNegotiationQuery(id ?? skipToken, {
    pollingInterval: open && !live ? POLL_MS : 0,
    skipPollingIfUnfocused: true,
  });
  const request = useGetRequestQuery(negotiation.data?.p2pRequestId ?? skipToken);
  const isOpen = negotiation.data?.status === 'OPEN';
  if (negotiation.data && isOpen !== open) setOpen(isOpen);

  const header = (
    <StackHeader
      title="Offer"
      onBack={() =>
        router.canGoBack()
          ? router.back()
          : router.replace({ pathname: '/p2p/history', params: { tab: 'offers' } })
      }
    />
  );

  const failed = (negotiation.error && !negotiation.data) || (request.error && !request.data);
  if (failed) {
    return (
      <Screen>
        {header}
        <ErrorState
          error={toAppError(negotiation.error ?? request.error)}
          onRetry={() => {
            void negotiation.refetch();
            if (negotiation.data) void request.refetch();
          }}
        />
      </Screen>
    );
  }
  if (!negotiation.data || !request.data) {
    return (
      <Screen>
        {header}
        <Skeleton height={120} />
        <Skeleton height={200} />
      </Screen>
    );
  }
  return (
    <NegotiationView
      negotiation={negotiation.data}
      request={request.data}
      header={header}
      refreshing={negotiation.isFetching && !negotiation.isLoading}
      onRefresh={() => {
        void negotiation.refetch();
        void request.refetch();
      }}
    />
  );
}

function NegotiationView({
  negotiation,
  request,
  header,
  refreshing,
  onRefresh,
}: {
  negotiation: NegotiationResponse;
  request: P2PRequestResponse;
  header: React.ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const theme = useTheme();
  const now = useNow();
  const userId = useAppSelector((state) => state.session.userId);
  const { format } = useMoneyFormat();
  const [counter, counterState] = useCounterOfferMutation();
  const [accept, acceptState] = useAcceptNegotiationMutation();
  const [reject, rejectState] = useRejectNegotiationMutation();
  const [cancel, cancelState] = useCancelNegotiationMutation();
  const [countering, setCountering] = useState(false);
  const [confirming, setConfirming] = useState<'accept' | 'decline' | 'cancel' | null>(null);
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const accepted = negotiation.status === 'ACCEPTED';
  // Negotiations accepted before the order link existed have no p2pOrderId; find the order by request.
  const orders = useGetMyOrdersQuery(accepted && !negotiation.p2pOrderId ? undefined : skipToken);
  const orderId =
    negotiation.p2pOrderId ??
    orders.data?.find((item) => item.requestId === negotiation.p2pRequestId)?.id;

  const base = request.baseCurrencyCode;
  const quote = request.quoteCurrencyCode;
  const offer = currentOffer(negotiation);
  const myTurn = isMyTurn(negotiation, userId);
  const requestOpen = effectiveStatus(request, now) === 'OPEN';
  const role = negotiationRole(negotiation, userId);
  const termsLine = (item: Pick<OfferResponse, 'amount' | 'rate'>) =>
    `${format(item.amount, base)} at ${p2pRateLine(item.rate, base, quote)}`;

  const startCounter = () => {
    if (!offer) return;
    setAmount(toMoney(offer.amount));
    setRate(toMoney(offer.rate));
    setSubmitted(false);
    setError(null);
    setCountering(true);
  };

  const sendCounter = async () => {
    setSubmitted(true);
    setError(null);
    if (!isPositiveMoney(amount) || !isPositiveMoney(rate)) return;
    const result = await counter({
      id: negotiation.id,
      offer: { amount: toMoney(amount), rate: toMoney(rate) },
    });
    if ('error' in result) {
      setError(negotiationErrorMessage(toAppError(result.error)));
      return;
    }
    setCountering(false);
    setNotice('Counter-offer sent.');
  };

  const runConfirmed = async () => {
    setError(null);
    const action = confirming;
    const result =
      action === 'accept'
        ? await accept({ id: negotiation.id, p2pRequestId: negotiation.p2pRequestId })
        : action === 'decline'
          ? await reject(negotiation.id)
          : await cancel(negotiation.id);
    setConfirming(null);
    if ('error' in result) {
      setError(negotiationErrorMessage(toAppError(result.error)));
      return;
    }
    setCountering(false);
    setNotice(
      action === 'accept'
        ? 'Offer accepted. An order was created with these terms.'
        : action === 'decline'
          ? 'Offer declined.'
          : 'Negotiation cancelled.',
    );
  };

  const isOpen = negotiation.status === 'OPEN';
  const cancelButton = (
    <Button
      label="Cancel negotiation"
      variant="ghost"
      onPress={() => setConfirming('cancel')}
      loading={cancelState.isLoading}
      testID="negotiation-cancel"
    />
  );

  let footer = null;
  if (accepted && orderId) {
    footer = (
      <Button
        label="View order"
        onPress={() => router.push({ pathname: '/p2p/order/[id]', params: { id: orderId } })}
        testID="negotiation-view-order"
      />
    );
  } else if (myTurn && countering) {
    footer = (
      <View style={{ gap: theme.spacing.sm }}>
        <Button
          label="Send counter-offer"
          onPress={() => void sendCounter()}
          loading={counterState.isLoading}
          testID="negotiation-counter-submit"
        />
        <Button
          label="Back"
          variant="ghost"
          onPress={() => setCountering(false)}
          testID="negotiation-counter-cancel"
        />
      </View>
    );
  } else if (myTurn) {
    footer = (
      <View style={{ gap: theme.spacing.sm }}>
        {requestOpen ? (
          <Button
            label="Accept offer"
            onPress={() => setConfirming('accept')}
            loading={acceptState.isLoading}
            testID="negotiation-accept"
          />
        ) : null}
        <Button
          label="Make a counter-offer"
          variant="outline"
          onPress={startCounter}
          testID="negotiation-counter"
        />
        <Button
          label="Decline offer"
          variant="ghost"
          onPress={() => setConfirming('decline')}
          loading={rejectState.isLoading}
          testID="negotiation-decline"
        />
      </View>
    );
  } else if (isOpen) {
    footer = cancelButton;
  }

  const dialog =
    confirming === 'accept'
      ? {
          title: 'Accept this offer?',
          message: offer
            ? `You agree to ${termsLine(offer)}. This creates an order between you and the other person.`
            : '',
          confirmLabel: 'Accept',
          loading: acceptState.isLoading,
        }
      : confirming === 'decline'
        ? {
            title: 'Decline this offer?',
            message:
              'This ends the negotiation. To suggest different terms, make a counter-offer instead.',
            confirmLabel: 'Decline',
            loading: rejectState.isLoading,
          }
        : {
            title: 'Cancel this negotiation?',
            message:
              offer?.status === 'PENDING'
                ? 'The current offer is withdrawn and the negotiation ends.'
                : 'The negotiation ends.',
            confirmLabel: 'Cancel negotiation',
            loading: cancelState.isLoading,
          };

  return (
    <Screen
      scroll
      keyboardAware
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
        />
      }
      footer={footer}
    >
      {header}
      <View style={{ gap: theme.spacing.xs }}>
        <StatusBadge status={negotiation.status} testID="negotiation-status" />
        <AppText variant="h2">
          {base}/{quote}
        </AppText>
        <AppText tone="secondary" testID="negotiation-role">
          {role === 'owner' ? 'An offer on your request' : 'Your offer on their request'}
        </AppText>
      </View>

      <FormAlert tone="success" message={notice} testID="negotiation-notice" />
      <FormAlert message={error} testID="negotiation-error" />
      <FormAlert
        tone="info"
        message={closedExplanation(negotiation, userId) ?? negotiationSummary(negotiation, userId)}
        testID="negotiation-turn"
      />
      {negotiation.status === 'OPEN' && !requestOpen ? (
        <FormAlert
          tone="warning"
          message="The request is no longer open, so offers on it can't be accepted."
          testID="negotiation-request-closed"
        />
      ) : null}

      {offer && negotiation.status === 'OPEN' ? (
        <Card variant="outlined" padding="md" testID="negotiation-current">
          <AppText variant="caption" tone="secondary">
            {offerAuthor(offer, userId)}
          </AppText>
          <AppText variant="h3">{format(offer.amount, base)}</AppText>
          <AppText tone="secondary">{p2pRateLine(offer.rate, base, quote)}</AppText>
        </Card>
      ) : null}

      {countering ? (
        <OfferTermsForm
          base={base}
          quote={quote}
          amount={amount}
          rate={rate}
          onAmountChange={setAmount}
          onRateChange={setRate}
          amountError={submitted && !isPositiveMoney(amount) ? 'Enter an amount above zero.' : null}
          rateError={submitted && !isPositiveMoney(rate) ? 'Enter a rate above zero.' : null}
          testID="counter"
        />
      ) : null}

      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="bodyStrong">History</AppText>
        {negotiation.offers.map((item) => (
          <Card key={item.id} variant="muted" padding="md" testID={`negotiation-offer-${item.id}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                <AppText variant="caption" tone="secondary">
                  {offerAuthor(item, userId)}
                </AppText>
                <AppText>{termsLine(item)}</AppText>
                <AppText variant="caption" tone="muted">
                  {formatDateTime(item.createdAt) ?? ''}
                </AppText>
              </View>
              <StatusBadge status={item.status} />
            </View>
          </Card>
        ))}
      </View>

      <AppText variant="caption" tone="secondary">
        Offers take turns: after you send one, wait for the other person to accept or counter.
        Palpeer doesn&apos;t move any money for P2P orders.
      </AppText>

      <ConfirmDialog
        visible={confirming !== null}
        title={dialog.title}
        message={dialog.message}
        confirmLabel={dialog.confirmLabel}
        loading={dialog.loading}
        onConfirm={() => void runConfirmed()}
        onCancel={() => setConfirming(null)}
      />
    </Screen>
  );
}
