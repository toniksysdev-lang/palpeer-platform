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
import { NegotiationCard } from '@/features/negotiation/components/NegotiationCard';
import { useNegotiationRealtime } from '@/features/negotiation/useNegotiationRealtime';
import { ReviewRow } from '@/features/wallets/components/ReviewRow';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useNow } from '@/hooks/useNow';
import { useTheme } from '@/providers/ThemeProvider';
import { toAppError } from '@/services/api/errors';
import { useGetMyNegotiationsQuery } from '@/services/api/negotiationApi';
import {
  useAcceptRequestMutation,
  useCancelRequestMutation,
  useGetMyOrdersQuery,
  useGetRequestQuery,
} from '@/services/api/p2pApi';
import { useAppSelector } from '@/store';
import { formatDateTime } from '@/utils/datetime';

import { ExpiryCountdown } from '../components/ExpiryCountdown';
import { NoSettlementNotice } from '../components/NoSettlementNotice';
import { requestActionErrorMessage } from '../errors';
import { canAccept, canManage, effectiveStatus, p2pRateLine, sideLabel } from '../logic';

export function RequestDetailScreen() {
  const theme = useTheme();
  const now = useNow();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAppSelector((state) => state.session.userId);
  const { format } = useMoneyFormat();
  const request = useGetRequestQuery(id);
  const [accept, acceptState] = useAcceptRequestMutation();
  const [cancel, cancelState] = useCancelRequestMutation();
  const [confirming, setConfirming] = useState<'accept' | 'cancel' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  const data = request.data;
  const status = data ? effectiveStatus(data, now) : null;
  const matched = status === 'ACCEPTED' || status === 'COMPLETED';
  const orders = useGetMyOrdersQuery(matched ? undefined : skipToken);
  const order = orders.data?.find((item) => item.requestId === id);
  const negotiations = useGetMyNegotiationsQuery(id ? { p2pRequestId: id } : skipToken);
  useNegotiationRealtime();

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
  const base = data.baseCurrencyCode;
  const quote = data.quoteCurrencyCode;
  const amount = format(data.amount, base);
  const rate = p2pRateLine(data.rate, base, quote);
  const acceptable = canAccept(data, userId, now);
  const manageable = canManage(data, userId, now);

  const runAccept = async () => {
    setActionError(null);
    const result = await accept(data.id);
    setConfirming(null);
    if ('error' in result) {
      setActionError(requestActionErrorMessage(toAppError(result.error)));
      return;
    }
    router.replace({ pathname: '/p2p/order/[id]', params: { id: result.data.id } });
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

  // At most one negotiation per counterparty per request (R-N-1); the owner can have several.
  const myNegotiation = own
    ? undefined
    : negotiations.data?.find((negotiation) => negotiation.counterpartyId === userId);
  const openNegotiation = (negotiationId: string) =>
    router.push({ pathname: '/negotiation/[id]', params: { id: negotiationId } });

  let footer = null;
  if (acceptable) {
    footer = (
      <View style={{ gap: theme.spacing.sm }}>
        <Button
          label="Accept request"
          onPress={() => setConfirming('accept')}
          loading={acceptState.isLoading}
          testID="p2p-accept"
        />
        {myNegotiation ? (
          <Button
            label="View your offer"
            variant="outline"
            onPress={() => openNegotiation(myNegotiation.id)}
            testID="p2p-view-offer"
          />
        ) : (
          <Button
            label="Make an offer"
            variant="outline"
            onPress={() =>
              router.push({ pathname: '/negotiation/offer', params: { requestId: data.id } })
            }
            testID="p2p-make-offer"
          />
        )}
      </View>
    );
  } else if (manageable) {
    footer = (
      <View style={{ gap: theme.spacing.sm }}>
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
        message={cancelled ? 'Your request was cancelled.' : null}
        testID="p2p-cancelled"
      />
      <FormAlert message={actionError} testID="p2p-action-error" />
      {!own && !acceptable && !order ? (
        <FormAlert tone="info" message="This request is no longer open." testID="p2p-not-open" />
      ) : null}

      <Card variant="outlined" padding="md">
        <ReviewRow label="Amount" value={amount} testID="p2p-request-amount" />
        <ReviewRow label="Rate" value={rate} testID="p2p-request-rate" />
        <ReviewRow
          label="Expires"
          value={formatDateTime(data.expiresAt) ?? 'No expiry'}
          testID="p2p-request-expires"
        />
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
        message={`You agree to ${amount} at ${rate}. This creates an order between you and the person who posted it. Palpeer doesn't move any money for it.`}
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
    </Screen>
  );
}
