import { skipToken } from '@reduxjs/toolkit/query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowDownUp, ArrowLeftRight, ChartLine } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AmountInput } from '@/components/ui/AmountInput';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useTheme } from '@/providers/ThemeProvider';
import { toAppError } from '@/services/api/errors';
import {
  EXCHANGE_QUOTE_CACHE_KEY,
  useCalculateExchangeQuery,
  usePreviewExchangeMutation,
} from '@/services/api/exchangeApi';
import { useGetWalletsQuery } from '@/services/api/walletApi';
import type { ExchangeAmountRequest, ExchangeFixedSide } from '@/types/api/exchange';
import type { WalletResponse } from '@/types/api/wallet';
import { compareMoney, isPositiveMoney, toMoney } from '@/utils/money';

import { PickerField, PickerSheet } from '../components/PickerSheet';
import { NEED_TWO_WALLETS_MESSAGE, quoteErrorMessage } from '../errors';
import { canExchange, formatRateLine } from '../format';

const CALCULATE_DEBOUNCE_MS = 400;

function defaultTarget(wallets: readonly WalletResponse[], source: WalletResponse | undefined) {
  return wallets.find((wallet) => wallet.currencyCode !== source?.currencyCode);
}

/**
 * Pick wallets, type an amount on either side; the backend calculates the other side and the rate
 * (`POST /exchange/calculate`). Continue locks a quote (`POST /exchange/preview`).
 */
export function ExchangeScreen() {
  const theme = useTheme();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { format, precision } = useMoneyFormat();
  // Balances bound what can be exchanged, so don't start from a cached list.
  const wallets = useGetWalletsQuery(undefined, { refetchOnMountOrArgChange: true });
  const [preview, previewState] = usePreviewExchangeMutation({
    fixedCacheKey: EXCHANGE_QUOTE_CACHE_KEY,
  });

  const [sourceId, setSourceId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [fixedSide, setFixedSide] = useState<ExchangeFixedSide>('SOURCE');
  const [amount, setAmount] = useState('');
  const [picker, setPicker] = useState<'source' | 'target' | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [appliedFrom, setAppliedFrom] = useState<string | undefined>(undefined);

  // Opening from a wallet's Exchange button preselects that wallet, even if the tab was used before.
  if (from && from !== appliedFrom) {
    setAppliedFrom(from);
    setSourceId(from);
  }

  const list = wallets.data ?? [];
  const source = list.find((wallet) => wallet.id === sourceId) ?? list[0];
  const target =
    list.find((wallet) => wallet.id === targetId && wallet.currencyCode !== source?.currencyCode) ??
    defaultTarget(list, source);

  const validAmount = isPositiveMoney(amount);
  const request = useMemo<ExchangeAmountRequest | null>(
    () =>
      source && target && validAmount
        ? {
            sourceWalletId: source.id,
            targetWalletId: target.id,
            fixedSide,
            amount: toMoney(amount),
          }
        : null,
    [source, target, validAmount, fixedSide, amount],
  );
  const debounced = useDebouncedValue(request, CALCULATE_DEBOUNCE_MS);
  const settled = request !== null && debounced === request;
  const calculation = useCalculateExchangeQuery(settled ? request : skipToken);
  const quote = settled ? calculation.currentData : undefined;
  const calculating = request !== null && (!settled || calculation.isFetching);

  if (wallets.error && !wallets.data) {
    return (
      <Screen>
        <AppText variant="h1" accessibilityRole="header">
          Exchange
        </AppText>
        <ErrorState error={toAppError(wallets.error)} onRetry={() => void wallets.refetch()} />
      </Screen>
    );
  }

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <AppText variant="h1" accessibilityRole="header" style={{ flex: 1 }}>
        Exchange
      </AppText>
      <IconButton
        icon={ChartLine}
        accessibilityLabel="Currencies and rates"
        onPress={() => router.push('/exchange/rates')}
        testID="exchange-rates"
      />
    </View>
  );

  if (!wallets.data) {
    return (
      <Screen>
        {header}
        <Skeleton height={88} />
        <Skeleton height={88} />
      </Screen>
    );
  }

  if (!canExchange(list) || !source || !target) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={ArrowLeftRight}
          title="Add another wallet"
          message={NEED_TWO_WALLETS_MESSAGE}
          actionLabel="Create wallet"
          onAction={() => router.push('/wallet/create')}
        />
      </Screen>
    );
  }

  const sendValue = fixedSide === 'SOURCE' ? amount : (quote?.sourceAmount ?? '');
  const receiveValue = fixedSide === 'TARGET' ? amount : (quote?.targetAmount ?? '');
  const sourceAmount = fixedSide === 'SOURCE' ? (validAmount ? amount : null) : quote?.sourceAmount;
  // Mirrors the backend's 422 at execute; the backend still decides.
  const overBalance =
    !!sourceAmount && compareMoney(sourceAmount, source.availableBalance) > 0
      ? `You can exchange up to ${format(source.availableBalance, source.currencyCode)}.`
      : null;
  const quoteError =
    settled && calculation.error ? quoteErrorMessage(toAppError(calculation.error)) : null;
  const canContinue = !!quote && !calculating && !overBalance && !quoteError;

  const walletOptions = list.map((wallet) => ({
    key: wallet.id,
    title: `${wallet.currencyCode} wallet`,
    subtitle: `Available ${format(wallet.availableBalance, wallet.currencyCode)}`,
  }));

  /** Choosing the other side's currency swaps the two wallets instead. */
  const choose = (side: 'source' | 'target', id: string) => {
    const chosen = list.find((wallet) => wallet.id === id);
    if (!chosen) return;
    if (side === 'source') {
      const clash = chosen.currencyCode === target.currencyCode;
      setSourceId(chosen.id);
      setTargetId(clash ? source.id : target.id);
    } else {
      const clash = chosen.currencyCode === source.currencyCode;
      setTargetId(chosen.id);
      setSourceId(clash ? target.id : source.id);
    }
  };

  const swap = () => {
    setSourceId(target.id);
    setTargetId(source.id);
  };

  const editSide = (side: ExchangeFixedSide, text: string) => {
    setPreviewError(null);
    setFixedSide(side);
    setAmount(text);
  };

  const continueToReview = async () => {
    if (!request || !canContinue) return;
    setPreviewError(null);
    const result = await preview(request);
    if ('error' in result) {
      setPreviewError(quoteErrorMessage(toAppError(result.error)));
      return;
    }
    router.push({ pathname: '/exchange/review', params: { side: request.fixedSide } });
  };

  return (
    <Screen
      scroll
      keyboardAware
      footer={
        <Button
          label="Review exchange"
          onPress={() => void continueToReview()}
          disabled={!canContinue}
          loading={previewState.isLoading}
          loadingLabel="Getting quote…"
          testID="exchange-continue"
        />
      }
    >
      {header}

      <View style={{ gap: theme.spacing.sm }}>
        <PickerField
          label="From"
          value={`${source.currencyCode} wallet`}
          caption={`Available ${format(source.availableBalance, source.currencyCode)}`}
          onPress={() => setPicker('source')}
          testID="exchange-source"
        />
        <AmountInput
          label="You send"
          value={sendValue}
          onChangeText={(text) => editSide('SOURCE', text)}
          precision={precision(source.currencyCode) ?? 2}
          currencyCode={source.currencyCode}
          placeholder={fixedSide === 'TARGET' && calculating ? 'Calculating…' : '0.00'}
          error={overBalance}
          testID="exchange-send"
        />
      </View>

      <View style={{ alignItems: 'center' }}>
        <IconButton
          icon={ArrowDownUp}
          variant="filled"
          accessibilityLabel="Swap wallets"
          onPress={swap}
          testID="exchange-swap"
        />
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <PickerField
          label="To"
          value={`${target.currencyCode} wallet`}
          caption={`Available ${format(target.availableBalance, target.currencyCode)}`}
          onPress={() => setPicker('target')}
          testID="exchange-target"
        />
        <AmountInput
          label="You receive"
          value={receiveValue}
          onChangeText={(text) => editSide('TARGET', text)}
          precision={precision(target.currencyCode) ?? 2}
          currencyCode={target.currencyCode}
          placeholder={fixedSide === 'SOURCE' && calculating ? 'Calculating…' : '0.00'}
          testID="exchange-receive"
        />
      </View>

      {quote && !calculating ? (
        <AppText tone="secondary" align="center" testID="exchange-rate">
          {formatRateLine(quote.appliedRate, quote.sourceCurrencyCode, quote.targetCurrencyCode)}
        </AppText>
      ) : calculating ? (
        <AppText tone="muted" align="center" testID="exchange-calculating">
          Getting the latest rate…
        </AppText>
      ) : null}
      <FormAlert message={quoteError ?? previewError} testID="exchange-quote-error" />
      <AppText variant="caption" tone="secondary">
        Amounts and the rate come from Palpeer and are locked for a short time when you review.
      </AppText>

      <PickerSheet
        visible={picker !== null}
        title={picker === 'target' ? 'Exchange to' : 'Exchange from'}
        options={walletOptions}
        selectedKey={picker === 'target' ? target.id : source.id}
        onSelect={(id) => picker && choose(picker, id)}
        onClose={() => setPicker(null)}
        testID="exchange-picker"
      />
    </Screen>
  );
}
