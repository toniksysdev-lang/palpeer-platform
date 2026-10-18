import { router } from 'expo-router';
import { Coins } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AmountInput } from '@/components/ui/AmountInput';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { PickerField, PickerSheet } from '@/features/exchange/components/PickerSheet';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useTheme } from '@/providers/ThemeProvider';
import { useGetCurrenciesQuery } from '@/services/api/currencyApi';
import { toAppError } from '@/services/api/errors';
import { useCreateRequestMutation } from '@/services/api/p2pApi';
import { useGetWalletsQuery } from '@/services/api/walletApi';
import type { P2PSide } from '@/types/api/p2p';
import { isPositiveMoney, toMoney } from '@/utils/money';

import { p2pErrorMessage } from '../errors';
import {
  EXPIRY_OPTIONS,
  expiresAtFor,
  NOTES_MAX,
  RATE_INPUT_DECIMALS,
  sideLabel,
  type ExpiryKey,
} from '../logic';

const SIDE_OPTIONS: readonly { value: P2PSide; label: string }[] = [
  { value: 'BUY', label: 'I want to buy' },
  { value: 'SELL', label: 'I want to sell' },
];

type Picker = 'base' | 'quote' | 'expiry';

/** Fields are exactly `CreateP2PRequestDto`; there is no payment-method field (P-6). */
export function CreateRequestScreen() {
  const theme = useTheme();
  const { format } = useMoneyFormat();
  const currencies = useGetCurrenciesQuery();
  const wallets = useGetWalletsQuery();
  const [create, createState] = useCreateRequestMutation();

  const [side, setSide] = useState<P2PSide>('BUY');
  const [baseCode, setBaseCode] = useState<string | null>(null);
  const [quoteCode, setQuoteCode] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [expiry, setExpiry] = useState<ExpiryKey>('NONE');
  const [notes, setNotes] = useState('');
  const [picker, setPicker] = useState<Picker | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const header = <StackHeader title="New P2P request" />;
  const list = currencies.data ?? [];

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
        <Skeleton height={56} />
        <Skeleton height={56} />
      </Screen>
    );
  }
  const base = list.find((currency) => currency.code === baseCode) ?? list[0];
  const quote =
    list.find((currency) => currency.code === quoteCode && currency.code !== base?.code) ??
    list.find((currency) => currency.code !== base?.code);

  if (!base || !quote) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={Coins}
          title="Not available yet"
          message="P2P requests need at least two currencies, and Palpeer doesn't support enough yet."
        />
      </Screen>
    );
  }

  const amountError = submitted && !isPositiveMoney(amount) ? 'Enter an amount above zero.' : null;
  const rateError = submitted && !isPositiveMoney(rate) ? 'Enter a rate above zero.' : null;
  const baseWallet = (wallets.data ?? []).find(
    (wallet) => wallet.currencyCode.toUpperCase() === base.code.toUpperCase(),
  );
  const showWalletBalance = amount.trim().length > 0;

  /** Picking the other side's currency swaps the pair instead of making base = quote. */
  const choose = (which: 'base' | 'quote', code: string) => {
    if (which === 'base') {
      setQuoteCode(code === quote.code ? base.code : quote.code);
      setBaseCode(code);
    } else {
      setBaseCode(code === base.code ? quote.code : base.code);
      setQuoteCode(code);
    }
  };

  const submit = async () => {
    setSubmitted(true);
    setError(null);
    setFieldErrors({});
    if (!isPositiveMoney(amount) || !isPositiveMoney(rate)) return;
    const trimmedNotes = notes.trim();
    const expiresAt = expiresAtFor(expiry, Date.now());
    const result = await create({
      side,
      baseCurrencyCode: base.code,
      quoteCurrencyCode: quote.code,
      amount: toMoney(amount),
      rate: toMoney(rate),
      ...(expiresAt ? { expiresAt } : null),
      ...(trimmedNotes ? { notes: trimmedNotes } : null),
    });
    if ('error' in result) {
      const appError = toAppError(result.error);
      setFieldErrors(appError.fieldErrors);
      setError(p2pErrorMessage(appError));
      return;
    }
    router.replace({ pathname: '/p2p/request/[id]', params: { id: result.data.id } });
  };

  const currencyOptions = list.map((currency) => ({ key: currency.code, title: currency.code }));

  return (
    <Screen
      scroll
      keyboardAware
      footer={
        <Button
          label="Post request"
          onPress={() => void submit()}
          loading={createState.isLoading}
          loadingLabel="Publishing…"
          testID="p2p-create-submit"
        />
      }
    >
      {header}
      <SegmentedControl
        options={SIDE_OPTIONS}
        value={side}
        onChange={setSide}
        accessibilityLabel="Buy or sell"
      />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <PickerField
            label={side === 'BUY' ? 'Buy' : 'Sell'}
            value={base.code}
            onPress={() => setPicker('base')}
            testID="p2p-create-base"
          />
        </View>
        <View style={{ flex: 1 }}>
          <PickerField
            label="For"
            value={quote.code}
            onPress={() => setPicker('quote')}
            testID="p2p-create-quote"
          />
        </View>
      </View>
      <AppText tone="secondary" testID="p2p-create-summary">
        {sideLabel(side, base.code, quote.code, 'self')}
      </AppText>

      <AmountInput
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        precision={base.precision}
        currencyCode={base.code}
        placeholder="0.00"
        error={amountError ?? fieldErrors.amount}
        testID="p2p-create-amount"
      />
      {showWalletBalance ? (
        <AppText variant="caption" tone="secondary" testID="p2p-create-wallet-balance">
          {baseWallet
            ? `Wallet balance: ${format(baseWallet.availableBalance, base.code)}`
            : `No ${base.code} wallet yet — create one to post a sell request.`}
        </AppText>
      ) : null}
      <AmountInput
        label={`Rate (${quote.code} for 1 ${base.code})`}
        value={rate}
        onChangeText={setRate}
        precision={RATE_INPUT_DECIMALS}
        currencyCode={quote.code}
        placeholder="0.00"
        padOnBlur={false}
        error={rateError ?? fieldErrors.rate}
        testID="p2p-create-rate"
      />
      <PickerField
        label="Expires"
        value={EXPIRY_OPTIONS.find((option) => option.key === expiry)?.title ?? ''}
        onPress={() => setPicker('expiry')}
        testID="p2p-create-expiry"
      />
      <Input
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        maxLength={NOTES_MAX}
        multiline
        hint={`${notes.length}/${NOTES_MAX}`}
        error={fieldErrors.notes}
        testID="p2p-create-notes"
      />
      <FormAlert message={error} testID="p2p-create-error" />
      <AppText variant="caption" tone="secondary">
        Your request is shown to other Palpeer users until someone accepts it, you cancel it, or it
        expires. Sell requests temporarily hold the amount from your wallet until then.
      </AppText>

      <PickerSheet
        visible={picker === 'base' || picker === 'quote'}
        title={
          picker === 'quote' ? 'Pay with' : side === 'BUY' ? 'Currency to buy' : 'Currency to sell'
        }
        options={currencyOptions}
        selectedKey={picker === 'quote' ? quote.code : base.code}
        onSelect={(code) => (picker === 'base' || picker === 'quote') && choose(picker, code)}
        onClose={() => setPicker(null)}
        testID="p2p-currency-sheet"
      />
      <PickerSheet
        visible={picker === 'expiry'}
        title="Expires"
        options={EXPIRY_OPTIONS}
        selectedKey={expiry}
        onSelect={(key) => setExpiry(key as ExpiryKey)}
        onClose={() => setPicker(null)}
        testID="p2p-expiry-sheet"
      />
    </Screen>
  );
}
