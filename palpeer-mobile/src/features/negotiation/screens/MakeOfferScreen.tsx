import { skipToken } from '@reduxjs/toolkit/query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { negotiationTermsMessage } from '@/features/chat/logic';
import { FlippableRateLine } from '@/features/p2p/components/FlippableRateLine';
import { p2pRateLine, sideLabel } from '@/features/p2p/logic';
import { ReviewRow } from '@/features/wallets/components/ReviewRow';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useTheme } from '@/providers/ThemeProvider';
import { newIdempotencyKey } from '@/services/api/client';
import { useOpenChatRoomMutation, useSendChatMessageMutation } from '@/services/api/chatApi';
import { toAppError } from '@/services/api/errors';
import { useCreateOfferMutation, useGetMyNegotiationsQuery } from '@/services/api/negotiationApi';
import { useGetRequestQuery } from '@/services/api/p2pApi';
import type { P2PRequestResponse } from '@/types/api/p2p';
import { useAppSelector } from '@/store';
import { isPositiveMoney, toMoney } from '@/utils/money';

import { OfferTermsForm } from '../components/OfferTermsForm';
import { negotiationErrorMessage, openNegotiationFor } from '../logic';

export function MakeOfferScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const request = useGetRequestQuery(requestId ?? skipToken);
  const header = <StackHeader title="Make an offer" />;

  if (request.error && !request.data) {
    return (
      <Screen>
        {header}
        <ErrorState error={toAppError(request.error)} onRetry={() => void request.refetch()} />
      </Screen>
    );
  }
  if (!request.data) {
    return (
      <Screen>
        {header}
        <Skeleton height={200} />
      </Screen>
    );
  }
  return <OfferForm request={request.data} header={header} />;
}

function OfferForm({ request, header }: { request: P2PRequestResponse; header: React.ReactNode }) {
  const theme = useTheme();
  const userId = useAppSelector((state) => state.session.userId);
  const { format } = useMoneyFormat();
  const [create, createState] = useCreateOfferMutation();
  const [openRoom, openRoomState] = useOpenChatRoomMutation();
  const [sendMessage, sendState] = useSendChatMessageMutation();
  const [amount, setAmount] = useState<string>(() => toMoney(request.amount));
  const [rate, setRate] = useState<string>(() => toMoney(request.rate));
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState(false);
  const mine = useGetMyNegotiationsQuery(existing ? { p2pRequestId: request.id } : skipToken);
  const existingNegotiation = openNegotiationFor(mine.data, request.id, userId);

  const base = request.baseCurrencyCode;
  const quote = request.quoteCurrencyCode;
  const amountError = submitted && !isPositiveMoney(amount) ? 'Enter an amount above zero.' : null;
  const rateError = submitted && !isPositiveMoney(rate) ? 'Enter a rate above zero.' : null;
  const busy = createState.isLoading || openRoomState.isLoading || sendState.isLoading;

  const goToNegotiationChat = async (negotiationId: string, prefills?: { amount: string; rate: string }) => {
    const roomResult = await openRoom({ negotiationId });
    if ('error' in roomResult) {
      router.replace({ pathname: '/negotiation/[id]', params: { id: negotiationId } });
      return;
    }
    if (prefills) {
      const content = negotiationTermsMessage(
        format(prefills.amount, base),
        p2pRateLine(prefills.rate, base, quote),
      );
      await sendMessage({
        roomId: roomResult.data.id,
        message: { content, clientMessageId: newIdempotencyKey() },
      });
    }
    router.replace({ pathname: '/chat/[roomId]', params: { roomId: roomResult.data.id } });
  };

  const submit = async () => {
    setSubmitted(true);
    setError(null);
    setFieldErrors({});
    if (!isPositiveMoney(amount) || !isPositiveMoney(rate)) return;
    const offerAmount = toMoney(amount);
    const offerRate = toMoney(rate);
    const result = await create({
      p2pRequestId: request.id,
      amount: offerAmount,
      rate: offerRate,
    });
    if ('error' in result) {
      const appError = toAppError(result.error);
      setFieldErrors(appError.fieldErrors);
      setError(negotiationErrorMessage(appError));
      if (appError.code === 'NEGOTIATION_EXISTS') setExisting(true);
      return;
    }
    await goToNegotiationChat(result.data.id, { amount: offerAmount, rate: offerRate });
  };

  return (
    <Screen
      scroll
      keyboardAware
      footer={
        existingNegotiation ? (
          <Button
            label="Open negotiation chat"
            onPress={() => void goToNegotiationChat(existingNegotiation.id)}
            loading={openRoomState.isLoading}
            testID="offer-view-existing"
          />
        ) : (
          <Button
            label="Send offer"
            onPress={() => void submit()}
            loading={busy}
            loadingLabel="Sending…"
            testID="offer-submit"
          />
        )
      }
    >
      {header}
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="h2">What is your best offer?</AppText>
        <AppText tone="secondary">
          {sideLabel(request.side, base, quote, 'other')}. Suggest the amount and rate you want;
          you&apos;ll continue in chat where either of you can accept amount, rate, or the full offer.
        </AppText>
      </View>
      <Card variant="outlined" padding="md">
        <ReviewRow
          label="Their amount"
          value={format(request.amount, base)}
          testID="offer-request-amount"
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          }}
        >
          <AppText tone="secondary" style={{ flex: 1 }}>
            Their rate
          </AppText>
          <View style={{ flex: 2, alignItems: 'flex-end' }}>
            <FlippableRateLine
              rate={request.rate}
              base={base}
              quote={quote}
              variant="bodyStrong"
              tone="primary"
              align="right"
              testID="offer-request-rate"
            />
          </View>
        </View>
      </Card>
      <OfferTermsForm
        base={base}
        quote={quote}
        amount={amount}
        rate={rate}
        onAmountChange={setAmount}
        onRateChange={setRate}
        amountError={amountError ?? fieldErrors.amount}
        rateError={rateError ?? fieldErrors.rate}
        testID="offer"
      />
      <FormAlert message={error} testID="offer-error" />
      <AppText variant="caption" tone="secondary">
        Sending opens a negotiation chat with your offer prefilled. If they accept, an order is
        created with those terms. Palpeer doesn&apos;t move any money for it.
      </AppText>
    </Screen>
  );
}
