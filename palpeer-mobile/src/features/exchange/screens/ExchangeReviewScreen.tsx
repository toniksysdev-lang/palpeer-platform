import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeftRight, Timer } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EmptyState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { TextLink } from '@/components/ui/TextLink';
import { FlippableRateLine } from '@/features/p2p/components/FlippableRateLine';
import { usePinPrompt } from '@/features/security/PinPromptProvider';
import { ReviewRow } from '@/features/wallets/components/ReviewRow';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useTheme } from '@/providers/ThemeProvider';
import { toAppError } from '@/services/api/errors';
import {
  EXCHANGE_QUOTE_CACHE_KEY,
  useExecuteExchangeMutation,
  usePreviewExchangeMutation,
} from '@/services/api/exchangeApi';
import { useGetPinStatusQuery } from '@/services/api/securityApi';
import type {
  ExchangeAmountRequest,
  ExchangeFixedSide,
  ExchangeQuoteResponse,
} from '@/types/api/exchange';

import { executeErrorMessage, needsNewQuote, quoteErrorMessage } from '../errors';
import { useQuoteCountdown } from '../useQuoteCountdown';
import { useQuoteIdempotencyKey } from '../useQuoteIdempotencyKey';

/**
 * The same request again. Quote amounts equal what was typed, because input is limited to the
 * currency precision the backend scales to.
 */
function requoteRequest(
  quote: ExchangeQuoteResponse,
  side: ExchangeFixedSide,
): ExchangeAmountRequest {
  return {
    sourceWalletId: quote.sourceWalletId,
    targetWalletId: quote.targetWalletId,
    fixedSide: side,
    amount: side === 'SOURCE' ? quote.sourceAmount : quote.targetAmount,
  };
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Shows the quote locked by `POST /exchange/preview` (shared through the mutation cache), then
 * PIN (if set, client step R-SEC-2) → `POST /exchange/execute` with one idempotency key per quote.
 */
export function ExchangeReviewScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ side?: string }>();
  const side: ExchangeFixedSide = params.side === 'TARGET' ? 'TARGET' : 'SOURCE';
  const { format } = useMoneyFormat();
  const pinStatus = useGetPinStatusQuery();
  const { requestPin } = usePinPrompt();
  const [preview, previewState] = usePreviewExchangeMutation({
    fixedCacheKey: EXCHANGE_QUOTE_CACHE_KEY,
  });
  const [execute, executeState] = useExecuteExchangeMutation();
  const keyForQuote = useQuoteIdempotencyKey();
  const [error, setError] = useState<string | null>(null);
  const [staleQuote, setStaleQuote] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const quote = previewState.data;
  const { remaining, expired } = useQuoteCountdown(quote?.expiresAt);

  if (!quote) {
    return (
      <Screen>
        <StackHeader title="Review exchange" />
        <EmptyState
          icon={ArrowLeftRight}
          title="Nothing to review"
          message="Start an exchange to get a quote."
          actionLabel="Go to exchange"
          onAction={() => router.dismissTo('/exchange')}
        />
      </Screen>
    );
  }

  const unusable = expired || staleQuote;

  const requote = async () => {
    setError(null);
    const result = await preview(requoteRequest(quote, side));
    if ('error' in result) {
      setError(quoteErrorMessage(toAppError(result.error)));
      return;
    }
    setStaleQuote(false);
  };

  const confirm = async () => {
    setError(null);
    if (!pinStatus.data) {
      setError("We couldn't check your PIN status. Try again.");
      void pinStatus.refetch();
      return;
    }
    setConfirming(true);
    if (pinStatus.data.pinSet) {
      const confirmed = await requestPin({
        title: 'Confirm exchange',
        message: `Enter your PIN to exchange ${format(quote.sourceAmount, quote.sourceCurrencyCode)}.`,
      });
      if (!confirmed) {
        setConfirming(false);
        return;
      }
    }
    const result = await execute({ quote, idempotencyKey: keyForQuote(quote.quoteId) });
    setConfirming(false);
    if ('error' in result) {
      const appError = toAppError(result.error);
      if (needsNewQuote(appError)) setStaleQuote(true);
      setError(executeErrorMessage(appError));
      return;
    }
    router.replace({ pathname: '/exchange/[exchangeId]', params: { exchangeId: result.data.id } });
    previewState.reset();
  };

  return (
    <Screen
      scroll
      footer={
        unusable ? (
          <Button
            label="Get a new quote"
            onPress={() => void requote()}
            loading={previewState.isLoading}
            testID="exchange-requote"
          />
        ) : (
          <Button
            label="Confirm exchange"
            onPress={() => void confirm()}
            loading={confirming || executeState.isLoading}
            loadingLabel="Confirming…"
            testID="exchange-confirm"
          />
        )
      }
    >
      <StackHeader title="Review exchange" />
      <FormAlert message={error} testID="exchange-error" />

      <Card variant="elevated" padding="lg">
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="caption" tone="secondary">
            You send
          </AppText>
          <AppText variant="amount" testID="exchange-review-send">
            {format(quote.sourceAmount, quote.sourceCurrencyCode)}
          </AppText>
          <AppText variant="caption" tone="secondary" style={{ marginTop: theme.spacing.md }}>
            You receive
          </AppText>
          <AppText variant="amount" tone="success" testID="exchange-review-receive">
            {format(quote.targetAmount, quote.targetCurrencyCode)}
          </AppText>
        </View>
      </Card>

      <Card variant="outlined" padding="md">
        <ReviewRow label="From" value={`${quote.sourceCurrencyCode} wallet`} />
        <ReviewRow label="To" value={`${quote.targetCurrencyCode} wallet`} />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          }}
        >
          <AppText tone="secondary" style={{ flex: 1 }}>
            Rate
          </AppText>
          <View style={{ flex: 2, alignItems: 'flex-end' }}>
            <FlippableRateLine
              rate={quote.appliedRate}
              base={quote.sourceCurrencyCode}
              quote={quote.targetCurrencyCode}
              variant="bodyStrong"
              align="right"
              testID="exchange-review-rate"
            />
          </View>
        </View>
        {quote.estimatedFeeAmount != null && Number(quote.estimatedFeeAmount) > 0 ? (
          <ReviewRow
            label="Platform fee"
            value={format(
              quote.estimatedFeeAmount,
              quote.estimatedFeeCurrency ?? quote.sourceCurrencyCode,
            )}
            testID="exchange-review-fee"
          />
        ) : null}
      </Card>

      {unusable ? (
        expired && !error ? (
          <FormAlert
            tone="warning"
            message="This quote has expired. Get a new quote to continue."
            testID="exchange-expired"
          />
        ) : null
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Icon icon={Timer} size="sm" color={theme.colors.textSecondary} />
          <AppText tone="secondary" testID="exchange-countdown">
            Quote valid for {formatCountdown(remaining)}
          </AppText>
        </View>
      )}
      <AppText variant="caption" tone="secondary">
        Both wallets update as soon as the exchange completes. The amounts shown are the ones that
        will move.
      </AppText>
      {pinStatus.data && !pinStatus.data.pinSet ? (
        <TextLink
          label="Set up a PIN to confirm exchanges"
          onPress={() => router.push('/security/pin/set')}
        />
      ) : null}
    </Screen>
  );
}
