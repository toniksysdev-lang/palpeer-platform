import { Decimal } from 'decimal.js-light';
import { router } from 'expo-router';
import { ArrowRight, Coins } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AmountInput } from '@/components/ui/AmountInput';
import { AppModal } from '@/components/ui/AppModal';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { useOptionalNumberPad } from '@/components/ui/NumberPadContext';
import { Skeleton } from '@/components/ui/Skeleton';
import { PickerField, PickerSheet } from '@/features/exchange/components/PickerSheet';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useTheme } from '@/providers/ThemeProvider';
import { useGetCurrenciesQuery } from '@/services/api/currencyApi';
import { toAppError } from '@/services/api/errors';
import { useCreateRequestMutation, useGetP2PRateBoundsQuery } from '@/services/api/p2pApi';
import { useGetWalletsQuery } from '@/services/api/walletApi';
import type { P2PSide } from '@/types/api/p2p';
import { compareMoney, isPositiveMoney, toMoney } from '@/utils/money';

import { p2pErrorMessage } from '../errors';
import {
  EXPIRY_OPTIONS,
  RATE_ANCHOR_CODE,
  RATE_INPUT_DECIMALS,
  apiAmountFromSell,
  apiRateFromUnit,
  applyRateDisplayEdit,
  createPayloadCurrencies,
  currencyDisplayName,
  currencyFlag,
  displayRateForUnit,
  expiresAtFor,
  isApiRateWithinBounds,
  otherOfPair,
  rateBoundsMessage,
  rateEntryHint,
  receiveAmountForSell,
  receivePreviewEquation,
  type ExpiryKey,
  type RateEntryAnchor,
} from '../logic';

type Picker = 'sell' | 'receive' | 'expiry' | 'rateUnit';

/** Fields map to `CreateP2PRequestDto`; rate row lets you pick which pair currency stays at 1. */
export function CreateRequestScreen() {
  const theme = useTheme();
  const { format } = useMoneyFormat();
  const numberPad = useOptionalNumberPad();
  const currencies = useGetCurrenciesQuery();
  const wallets = useGetWalletsQuery();
  const [create, createState] = useCreateRequestMutation();

  /** Buy tab hidden — posts are sell-side only (You sell → You receive). */
  const side: P2PSide = 'SELL';
  const [sellCode, setSellCode] = useState<string | null>(null);
  const [receiveCode, setReceiveCode] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  /** Exact typed rate + unit — flipping the dropdown re-derives display without losing precision. */
  const [rateAnchor, setRateAnchor] = useState<RateEntryAnchor | null>(null);
  const [rateUnitCode, setRateUnitCode] = useState<string | null>(null);
  const [minOrder, setMinOrder] = useState('');
  const [expiry, setExpiry] = useState<ExpiryKey>('1H');
  const [notes, setNotes] = useState('');
  const [picker, setPicker] = useState<Picker | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const header = <StackHeader title="Post Exchange Request" />;
  const allCurrencies = currencies.data ?? [];
  const walletCodes = new Set(
    (wallets.data ?? []).map((wallet) => wallet.currencyCode.toUpperCase()),
  );
  /** Only currencies the user already has a wallet for. */
  const list = allCurrencies.filter((currency) => walletCodes.has(currency.code.toUpperCase()));

  // Provisional pair for bounds fetch (mirrors sell/receive defaults after loading).
  const previewCad = list.find((c) => c.code.toUpperCase() === RATE_ANCHOR_CODE);
  const previewSell = list.find((c) => c.code === sellCode) ?? previewCad ?? list[0];
  const previewReceive =
    list.find((c) => c.code === receiveCode && c.code !== previewSell?.code) ??
    list.find((c) => c.code.toUpperCase() === 'NGN' && c.code !== previewSell?.code) ??
    list.find((c) => c.code !== previewSell?.code);
  const boundsPair =
    previewSell && previewReceive
      ? createPayloadCurrencies(side, previewSell.code, previewReceive.code)
      : null;
  const rateBoundsQuery = useGetP2PRateBoundsQuery(
    {
      baseCurrencyCode: boundsPair?.baseCurrencyCode ?? '',
      quoteCurrencyCode: boundsPair?.quoteCurrencyCode ?? '',
    },
    { skip: !boundsPair },
  );

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
  if (wallets.error && !wallets.data) {
    return (
      <Screen>
        {header}
        <ErrorState error={toAppError(wallets.error)} onRetry={() => void wallets.refetch()} />
      </Screen>
    );
  }
  if (!currencies.data || wallets.isLoading) {
    return (
      <Screen>
        {header}
        <Skeleton height={56} />
        <Skeleton height={56} />
      </Screen>
    );
  }

  if (list.length < 2) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={Coins}
          title="Wallets needed"
          message="Open at least two currency wallets before posting an exchange request. Only currencies you hold appear in the sell and receive lists."
        />
      </Screen>
    );
  }

  const cad = list.find((c) => c.code.toUpperCase() === RATE_ANCHOR_CODE);
  const defaultForeign =
    list.find((c) => c.code.toUpperCase() === 'NGN') ??
    list.find((c) => c.code.toUpperCase() !== RATE_ANCHOR_CODE);

  const sell = list.find((c) => c.code === sellCode) ?? cad ?? list[0];
  const receive =
    list.find((c) => c.code === receiveCode && c.code !== sell?.code) ??
    defaultForeign ??
    list.find((c) => c.code !== sell?.code);

  if (!sell || !receive) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={Coins}
          title="Not available yet"
          message="P2P requests need at least two of your wallets with different currencies."
        />
      </Screen>
    );
  }

  // Default rate unit = sell currency so "You receive" is amount × rate (1 sell = rate receive).
  const rateUnit =
    rateUnitCode &&
    (rateUnitCode.toUpperCase() === sell.code.toUpperCase() ||
      rateUnitCode.toUpperCase() === receive.code.toUpperCase())
      ? rateUnitCode.toUpperCase() === sell.code.toUpperCase()
        ? sell.code
        : receive.code
      : sell.code;
  const rateOther = otherOfPair(rateUnit, sell.code, receive.code);
  const displayRate = displayRateForUnit(rateAnchor, rateUnit);
  /** Exact typed unit/value for math — not the truncated reciprocal shown after a flip. */
  const mathUnit = rateAnchor?.unitCode ?? rateUnit;
  const mathRate = rateAnchor?.value ?? displayRate;

  const pair = createPayloadCurrencies(side, sell.code, receive.code);
  const apiRatePreview = isPositiveMoney(mathRate)
    ? apiRateFromUnit(pair.baseCurrencyCode, pair.quoteCurrencyCode, mathUnit, mathRate)
    : '';
  const rateBounds = rateBoundsQuery.data ?? null;
  const rateOutOfBounds =
    !!rateBounds &&
    isPositiveMoney(apiRatePreview) &&
    !isApiRateWithinBounds(apiRatePreview, String(rateBounds.minRate), String(rateBounds.maxRate));
  const rateBoundsHint = rateBounds
    ? rateBoundsMessage(
        String(rateBounds.minRate),
        String(rateBounds.maxRate),
        rateBounds.baseCurrencyCode,
        rateBounds.quoteCurrencyCode,
        rateUnit,
      )
    : null;

  const sellWallet = (wallets.data ?? []).find(
    (wallet) => wallet.currencyCode.toUpperCase() === sell.code.toUpperCase(),
  );
  const availableBalance = sellWallet?.availableBalance ?? null;
  const exceedsBalance =
    !!availableBalance &&
    isPositiveMoney(amount) &&
    compareMoney(amount, availableBalance) > 0;

  const amountError = !isPositiveMoney(amount)
    ? submitted
      ? 'Enter an amount above zero.'
      : null
    : exceedsBalance
      ? `Amount cannot exceed your ${sell.code} wallet balance (${format(availableBalance!, sell.code)}).`
      : null;
  const rateError = !isPositiveMoney(mathRate)
    ? submitted
      ? 'Enter a rate above zero.'
      : null
    : rateOutOfBounds
      ? rateBoundsHint
      : null;
  const minOrderMissing = !isPositiveMoney(minOrder);
  const minOrderTooLarge =
    isPositiveMoney(minOrder) &&
    isPositiveMoney(amount) &&
    new Decimal(minOrder).greaterThan(new Decimal(amount));
  const minOrderError = submitted
    ? minOrderMissing
      ? 'Enter a minimum order above zero.'
      : minOrderTooLarge
        ? 'Minimum order cannot exceed the amount to sell.'
        : null
    : minOrderTooLarge
      ? 'Minimum order cannot exceed the amount to sell.'
      : null;

  const receivePreview = receiveAmountForSell(
    amount,
    sell.code,
    receive.code,
    mathRate,
    mathUnit,
    receive.precision,
  );
  const receiveEquation = receivePreview
    ? receivePreviewEquation(
        amount,
        sell.code,
        receive.code,
        displayRate,
        rateUnit,
        receivePreview,
      )
    : null;

  const choose = (which: 'sell' | 'receive', code: string) => {
    const nextSell = which === 'sell' ? code : code === sell.code ? receive.code : sell.code;
    const nextReceive = which === 'receive' ? code : code === receive.code ? sell.code : receive.code;
    const samePair =
      new Set([nextSell.toUpperCase(), nextReceive.toUpperCase()]).size === 2 &&
      new Set([
        sell.code.toUpperCase(),
        receive.code.toUpperCase(),
        nextSell.toUpperCase(),
        nextReceive.toUpperCase(),
      ]).size === 2;
    const sellChanged = nextSell.toUpperCase() !== sell.code.toUpperCase();
    if (which === 'sell') {
      setReceiveCode(code === receive.code ? sell.code : receive.code);
      setSellCode(code);
    } else {
      setSellCode(code === sell.code ? receive.code : sell.code);
      setReceiveCode(code);
    }
    // Keep rate unit aligned with the currency being sold so amount × rate = receive by default.
    if (sellChanged || !samePair) {
      setRateUnitCode(nextSell);
    }
    if (!samePair) {
      setRateAnchor(null);
    }
    if (sellChanged) {
      setAmount('');
      setMinOrder('');
    }
  };

  const chooseRateUnit = (code: string) => {
    if (code.toUpperCase() === rateUnit.toUpperCase()) return;
    // Keep the typed anchor; displayRateForUnit derives the other side. Close the pad so a
    // stale keypress cannot adopt the truncated reciprocal as a new anchor.
    numberPad?.close();
    setRateUnitCode(code);
  };

  const onDisplayRateChange = (value: string) => {
    setRateAnchor((current) => applyRateDisplayEdit(current, rateUnit, value));
  };

  const canReview =
    isPositiveMoney(amount) &&
    isPositiveMoney(mathRate) &&
    !minOrderMissing &&
    !minOrderTooLarge &&
    !exceedsBalance &&
    !rateOutOfBounds;

  const openReview = () => {
    setSubmitted(true);
    setError(null);
    setFieldErrors({});
    if (!canReview) {
      return;
    }
    setReviewOpen(true);
  };

  const submit = async () => {
    setError(null);
    setFieldErrors({});

    // SELL posts: base = currency sold (held in that wallet), quote = currency received.
    const pair = createPayloadCurrencies(side, sell.code, receive.code);
    const apiAmount = apiAmountFromSell(
      side,
      amount,
      sell.code,
      receive.code,
      mathRate,
      mathUnit,
    );
    const apiRate = apiRateFromUnit(
      pair.baseCurrencyCode,
      pair.quoteCurrencyCode,
      mathUnit,
      mathRate,
    );
    if (!apiAmount || !isPositiveMoney(apiRate)) {
      setReviewOpen(false);
      setError('Could not calculate the request amount from this rate.');
      return;
    }
    // Guard: sell-side amount must be the sold wallet amount (never the CAD-converted receive side).
    if (side === 'SELL' && pair.baseCurrencyCode.toUpperCase() !== sell.code.toUpperCase()) {
      setReviewOpen(false);
      setError('Sell currency mismatch — refresh the app and try again.');
      return;
    }

    const trimmedNotes = notes.trim();
    const expiresAt = expiresAtFor(expiry, Date.now());
    const result = await create({
      side,
      baseCurrencyCode: pair.baseCurrencyCode,
      quoteCurrencyCode: pair.quoteCurrencyCode,
      amount: toMoney(apiAmount),
      rate: toMoney(apiRate),
      ...(expiresAt ? { expiresAt } : null),
      ...(trimmedNotes ? { notes: trimmedNotes } : null),
    });
    if ('error' in result) {
      const appError = toAppError(result.error);
      setFieldErrors(appError.fieldErrors);
      setError(p2pErrorMessage(appError));
      setReviewOpen(false);
      return;
    }
    setReviewOpen(false);
    router.replace('/(tabs)/p2p');
  };

  const SummaryRow = ({ label, value }: { label: string; value: string }) => (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingVertical: 6,
      }}
    >
      <AppText tone="secondary" style={{ flexShrink: 0 }}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" align="right" style={{ flex: 1 }}>
        {value}
      </AppText>
    </View>
  );

  const currencyOptions = list.map((currency) => ({
    key: currency.code,
    title: `${currencyFlag(currency.code)}  ${currency.code}`,
    subtitle: currencyDisplayName(currency.code),
  }));

  const CurrencyTile = ({
    label,
    code,
    onPress,
    testID,
  }: {
    label: string;
    code: string;
    onPress: () => void;
    testID: string;
  }) => (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${code}`}
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.md,
        backgroundColor: theme.colors.surface,
        gap: 4,
      }}
    >
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <AppText variant="h3">{currencyFlag(code)}</AppText>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{code}</AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {currencyDisplayName(code)}
          </AppText>
        </View>
        <AppText tone="muted">▾</AppText>
      </View>
    </Pressable>
  );

  return (
    <Screen
      scroll
      keyboardAware
      footer={
        <Button
          label="Review request"
          onPress={openReview}
          disabled={createState.isLoading || !canReview}
          testID="p2p-create-submit"
        />
      }
    >
      {header}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <CurrencyTile
          label="You sell"
          code={sell.code}
          onPress={() => setPicker('sell')}
          testID="p2p-create-base"
        />
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon icon={ArrowRight} color="#FFFFFF" size={18} />
        </View>
        <CurrencyTile
          label="You receive"
          code={receive.code}
          onPress={() => setPicker('receive')}
          testID="p2p-create-quote"
        />
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: theme.spacing.xs,
        }}
      >
        <AppText tone="secondary">Wallet Balance</AppText>
        <AppText variant="bodyStrong" testID="p2p-create-wallet-balance">
          {sellWallet
            ? `${currencyFlag(sell.code)} ${format(sellWallet.availableBalance, sell.code)}`
            : `No ${sell.code} wallet`}
        </AppText>
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="body" style={{ fontWeight: '600' }}>
          Set your exchange rate
        </AppText>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <AppText variant="bodyStrong">1</AppText>
          <Pressable
            onPress={() => setPicker('rateUnit')}
            accessibilityRole="button"
            accessibilityLabel={`Rate unit: ${rateUnit}`}
            testID="p2p-create-rate-unit"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: theme.spacing.sm,
              backgroundColor: theme.colors.surface,
              minHeight: 52,
            }}
          >
            <AppText variant="bodyStrong">{rateUnit}</AppText>
            <AppText tone="muted">▾</AppText>
          </Pressable>
          <AppText variant="bodyStrong">=</AppText>
          <View style={{ flex: 1, minWidth: 120 }}>
            <AmountInput
              label=""
              value={displayRate}
              onChangeText={onDisplayRateChange}
              precision={RATE_INPUT_DECIMALS}
              currencyCode={rateOther}
              placeholder="0.00"
              padOnBlur={false}
              error={rateError ?? fieldErrors.rate}
              testID="p2p-create-rate"
            />
          </View>
        </View>
        <AppText variant="caption" tone="muted" testID="p2p-create-rate-hint">
          {rateEntryHint(rateUnit, rateOther)}
        </AppText>
        {rateBoundsHint ? (
          <AppText
            variant="caption"
            tone={rateOutOfBounds ? 'danger' : 'secondary'}
            testID="p2p-create-rate-bounds"
          >
            {rateBoundsHint}
          </AppText>
        ) : null}
      </View>

      <AmountInput
        label="Enter amount to sell"
        value={amount}
        onChangeText={setAmount}
        precision={sell.precision}
        currencyCode={sell.code}
        placeholder="0.00"
        error={amountError ?? fieldErrors.amount}
        hint={
          availableBalance
            ? `Available ${format(availableBalance, sell.code)}`
            : `No ${sell.code} wallet balance`
        }
        testID="p2p-create-amount"
      />

      <View
        style={{
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.primarySoft,
          padding: theme.spacing.md,
          gap: 4,
        }}
        testID="p2p-create-receive-preview"
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText tone="secondary">You receive</AppText>
          <AppText variant="caption" tone="muted">
            Before fees
          </AppText>
        </View>
        <AppText variant="h2" tone="brand" testID="p2p-create-receive-amount">
          {receivePreview ? format(receivePreview, receive.code) : `— ${receive.code}`}
        </AppText>
        {receiveEquation ? (
          <AppText variant="caption" tone="muted" testID="p2p-create-receive-equation">
            {receiveEquation}
          </AppText>
        ) : null}
      </View>

      <AmountInput
        label="Minimum order"
        value={minOrder}
        onChangeText={setMinOrder}
        precision={sell.precision}
        currencyCode={sell.code}
        placeholder="0.00"
        error={minOrderError}
        testID="p2p-create-min-order"
      />

      <PickerField
        label="Post expires in"
        value={EXPIRY_OPTIONS.find((option) => option.key === expiry)?.title ?? ''}
        onPress={() => setPicker('expiry')}
        testID="p2p-create-expiry"
      />

      <Input
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        maxLength={500}
        multiline
        error={fieldErrors.notes}
        testID="p2p-create-notes"
      />
      <FormAlert message={error} testID="p2p-create-error" />
      <AppText variant="caption" tone="secondary">
        Your request is shown to other Palpeer users until someone accepts it, you cancel it, or it
        expires. Selling holds the amount from your wallet until then.
      </AppText>

      <PickerSheet
        visible={picker === 'sell' || picker === 'receive'}
        title={picker === 'receive' ? 'You receive' : 'You sell'}
        options={currencyOptions}
        selectedKey={picker === 'receive' ? receive.code : sell.code}
        onSelect={(code) => (picker === 'sell' || picker === 'receive') && choose(picker, code)}
        onClose={() => setPicker(null)}
        testID="p2p-currency-sheet"
      />
      <PickerSheet
        visible={picker === 'rateUnit'}
        title="Rate for 1"
        options={[
          {
            key: sell.code,
            title: `${currencyFlag(sell.code)}  ${sell.code}`,
            subtitle: currencyDisplayName(sell.code),
          },
          {
            key: receive.code,
            title: `${currencyFlag(receive.code)}  ${receive.code}`,
            subtitle: currencyDisplayName(receive.code),
          },
        ]}
        selectedKey={rateUnit}
        onSelect={chooseRateUnit}
        onClose={() => setPicker(null)}
        testID="p2p-rate-unit-sheet"
      />
      <PickerSheet
        visible={picker === 'expiry'}
        title="Post expires in"
        options={EXPIRY_OPTIONS}
        selectedKey={expiry}
        onSelect={(key) => setExpiry(key as ExpiryKey)}
        onClose={() => setPicker(null)}
        testID="p2p-expiry-sheet"
      />

      {reviewOpen ? (
        <AppModal
          visible
          onClose={() => setReviewOpen(false)}
          title="Review request"
          dismissible={!createState.isLoading}
          testID="p2p-create-review"
        >
          <AppText tone="secondary">
            Confirm the details below, then post your exchange request to the marketplace.
          </AppText>
          <View
            style={{
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.lg,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              backgroundColor: theme.colors.surfaceMuted,
            }}
          >
            <SummaryRow
              label="You sell"
              value={`${currencyFlag(sell.code)} ${format(amount, sell.code)}`}
            />
            <SummaryRow
              label="You receive"
              value={
                receivePreview
                  ? `${currencyFlag(receive.code)} ${format(receivePreview, receive.code)}`
                  : `— ${receive.code}`
              }
            />
            <SummaryRow
              label="Rate"
              value={`1 ${rateUnit} = ${displayRate} ${rateOther}`}
            />
            {minOrder.trim() ? (
              <SummaryRow label="Minimum order" value={format(minOrder, sell.code)} />
            ) : null}
            <SummaryRow
              label="Expires"
              value={EXPIRY_OPTIONS.find((option) => option.key === expiry)?.title ?? '—'}
            />
            {notes.trim() ? <SummaryRow label="Notes" value={notes.trim()} /> : null}
          </View>
          <AppText variant="caption" tone="muted">
            Before fees. Selling holds the amount from your wallet until the request is accepted,
            cancelled, or expires.
          </AppText>
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
            <Button
              label="Post request"
              onPress={() => void submit()}
              loading={createState.isLoading}
              loadingLabel="Publishing…"
              testID="p2p-create-confirm"
            />
            <Button
              label="Edit"
              variant="ghost"
              onPress={() => setReviewOpen(false)}
              disabled={createState.isLoading}
              testID="p2p-create-review-edit"
            />
          </View>
        </AppModal>
      ) : null}
    </Screen>
  );
}
