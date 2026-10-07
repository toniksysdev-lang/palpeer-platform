import { skipToken } from '@reduxjs/toolkit/query';
import { ArrowDownUp, Coins } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { ReviewRow } from '@/features/wallets/components/ReviewRow';
import { useTheme } from '@/providers/ThemeProvider';
import { useGetCurrenciesQuery, useGetLatestRateQuery } from '@/services/api/currencyApi';
import { toAppError } from '@/services/api/errors';
import { formatDateTime } from '@/utils/datetime';

import { PickerField, PickerSheet } from '../components/PickerSheet';
import { formatRateValue } from '../format';

/**
 * Currency list (`GET /currencies`) and the latest published rate for one pair
 * (`GET /exchange-rates/latest`). There is no customer endpoint for all pairs (X-1). Buy and sell
 * are shown under the backend's own names; which one an exchange uses is decided by the backend
 * (P7-01) and shown on the Exchange screen.
 */
export function RatesScreen() {
  const theme = useTheme();
  const currencies = useGetCurrenciesQuery();
  const [base, setBase] = useState<string | null>(null);
  const [quote, setQuote] = useState<string | null>(null);
  const [picker, setPicker] = useState<'base' | 'quote' | null>(null);

  const list = currencies.data ?? [];
  const baseCode = base ?? list[0]?.code ?? null;
  const quoteCode = quote ?? list.find((currency) => currency.code !== baseCode)?.code ?? null;
  const pair =
    baseCode && quoteCode && baseCode !== quoteCode ? { base: baseCode, quote: quoteCode } : null;
  const rate = useGetLatestRateQuery(pair ?? skipToken);
  const rateData = rate.currentData;
  const noRate = !!rate.error && toAppError(rate.error).status === 404;

  const header = <StackHeader title="Currencies and rates" />;

  if (currencies.error && !currencies.data) {
    return (
      <Screen>
        {header}
        <ErrorState
          error={toAppError(currencies.error)}
          onRetry={() => void currencies.refetch()}
        />
      </Screen>
    );
  }
  if (!currencies.data) {
    return (
      <Screen>
        {header}
        <Skeleton height={120} />
      </Screen>
    );
  }
  if (list.length === 0) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={Coins}
          title="No currencies yet"
          message="Currencies will appear here once they're available."
        />
      </Screen>
    );
  }

  const options = list.map((currency) => ({
    key: currency.code,
    title: currency.code,
    subtitle: currency.symbol,
  }));
  const choose = (side: 'base' | 'quote', code: string) => {
    const other = side === 'base' ? quoteCode : baseCode;
    const current = side === 'base' ? baseCode : quoteCode;
    if (side === 'base') setBase(code);
    else setQuote(code);
    if (code === other) {
      if (side === 'base') setQuote(current);
      else setBase(current);
    }
  };

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={rate.isFetching && !rate.isLoading}
          onRefresh={() => {
            void currencies.refetch();
            if (pair) void rate.refetch();
          }}
          tintColor={theme.colors.primary}
        />
      }
    >
      {header}

      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="overline" tone="muted">
          Rate lookup
        </AppText>
        <PickerField
          label="Base currency"
          value={baseCode ?? '—'}
          onPress={() => setPicker('base')}
          testID="rates-base"
        />
        <View style={{ alignItems: 'center' }}>
          <IconButton
            icon={ArrowDownUp}
            accessibilityLabel="Swap currencies"
            onPress={() => {
              setBase(quoteCode);
              setQuote(baseCode);
            }}
            testID="rates-swap"
          />
        </View>
        <PickerField
          label="Quote currency"
          value={quoteCode ?? '—'}
          onPress={() => setPicker('quote')}
          testID="rates-quote"
        />
      </View>

      {!pair ? (
        <FormAlert tone="info" message="Add another currency to look up a rate." />
      ) : noRate ? (
        <FormAlert
          tone="info"
          message={`No rate is published for ${pair.base}/${pair.quote}.`}
          testID="rates-none"
        />
      ) : rate.error ? (
        <ErrorState error={toAppError(rate.error)} onRetry={() => void rate.refetch()} />
      ) : !rateData ? (
        <Skeleton height={120} />
      ) : (
        <Card variant="outlined" padding="md" testID="rates-card">
          <AppText variant="bodyStrong">
            {rateData.baseCurrencyCode}/{rateData.quoteCurrencyCode}
          </AppText>
          <ReviewRow label="Buy" value={formatRateValue(rateData.buyRate)} testID="rates-buy" />
          <ReviewRow label="Sell" value={formatRateValue(rateData.sellRate)} testID="rates-sell" />
          <ReviewRow label="Published" value={formatDateTime(rateData.effectiveDate) ?? '—'} />
        </Card>
      )}
      <AppText variant="caption" tone="secondary">
        Rates are published by Palpeer and can change. The rate for your exchange is shown when you
        enter an amount on the Exchange screen.
      </AppText>

      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="overline" tone="muted">
          Currencies
        </AppText>
        {list.map((currency) => (
          <View
            key={currency.code}
            style={{
              flexDirection: 'row',
              paddingVertical: theme.spacing.sm,
              gap: theme.spacing.md,
            }}
            testID={`rates-currency-${currency.code}`}
          >
            <AppText variant="bodyStrong" style={{ width: 64 }}>
              {currency.code}
            </AppText>
            <AppText tone="secondary">{currency.symbol}</AppText>
          </View>
        ))}
      </View>

      <PickerSheet
        visible={picker !== null}
        title={picker === 'quote' ? 'Quote currency' : 'Base currency'}
        options={options}
        selectedKey={picker === 'quote' ? quoteCode : baseCode}
        onSelect={(code) => picker && choose(picker, code)}
        onClose={() => setPicker(null)}
        testID="rates-picker"
      />
    </Screen>
  );
}
