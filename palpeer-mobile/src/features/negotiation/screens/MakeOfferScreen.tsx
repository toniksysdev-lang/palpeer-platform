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
import { p2pRateLine, sideLabel } from '@/features/p2p/logic';
import { ReviewRow } from '@/features/wallets/components/ReviewRow';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useTheme } from '@/providers/ThemeProvider';
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
  // Amount is editable; rate stays locked to the listing.
  const [amount, setAmount] = useState<string>(() => toMoney(request.amount));
  const rate = toMoney(request.rate);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState(false);
  const mine = useGetMyNegotiationsQuery(existing ? { p2pRequestId: request.id } : skipToken);
  const existingNegotiation = openNegotiationFor(mine.data, request.id, userId);

  const base = request.baseCurrencyCode;
  const quote = request.quoteCurrencyCode;
  const amountError = submitted && !isPositiveMoney(amount) ? 'Enter an amount above zero.' : null;

  const submit = async () => {
    setSubmitted(true);
    setError(null);
    setFieldErrors({});
    if (!isPositiveMoney(amount) || !isPositiveMoney(rate)) return;
    const result = await create({
      p2pRequestId: request.id,
      amount: toMoney(amount),
      rate: toMoney(rate),
    });
    if ('error' in result) {
      const appError = toAppError(result.error);
      setFieldErrors(appError.fieldErrors);
      setError(negotiationErrorMessage(appError));
      if (appError.code === 'NEGOTIATION_EXISTS') setExisting(true);
      return;
    }
    router.replace({ pathname: '/negotiation/[id]', params: { id: result.data.id } });
  };

  return (
    <Screen
      scroll
      keyboardAware
      footer={
        existingNegotiation ? (
          <Button
            label="View your offer"
            onPress={() =>
              router.replace({
                pathname: '/negotiation/[id]',
                params: { id: existingNegotiation.id },
              })
            }
            testID="offer-view-existing"
          />
        ) : (
          <Button
            label="Send offer"
            onPress={() => void submit()}
            loading={createState.isLoading}
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
          {sideLabel(request.side, base, quote, 'other')}. Suggest the amount you want at their
          listed rate; they can accept or reply with a counter-offer.
        </AppText>
      </View>
      <Card variant="outlined" padding="md">
        <ReviewRow
          label="Their amount"
          value={format(request.amount, base)}
          testID="offer-request-amount"
        />
        <ReviewRow
          label="Their rate"
          value={p2pRateLine(request.rate, base, quote)}
          testID="offer-request-rate"
        />
      </Card>
      <OfferTermsForm
        base={base}
        quote={quote}
        amount={amount}
        rate={rate}
        onAmountChange={setAmount}
        amountError={amountError ?? fieldErrors.amount}
        testID="offer"
      />
      <FormAlert message={error} testID="offer-error" />
      <AppText variant="caption" tone="secondary">
        If they accept, an order is created with these terms. Palpeer doesn&apos;t move any money
        for it.
      </AppText>
    </Screen>
  );
}
