import { View } from 'react-native';

import { AmountInput } from '@/components/ui/AmountInput';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { RATE_INPUT_DECIMALS } from '@/features/p2p/logic';
import { useTheme } from '@/providers/ThemeProvider';

/** Amount (base currency) and rate (quote for 1 base), as on P2P requests. */
export function OfferTermsForm({
  base,
  quote,
  amount,
  rate,
  onAmountChange,
  onRateChange,
  amountError,
  rateError,
  testID,
}: {
  base: string;
  quote: string;
  amount: string;
  rate: string;
  onAmountChange: (value: string) => void;
  onRateChange: (value: string) => void;
  amountError?: string | null;
  rateError?: string | null;
  testID: string;
}) {
  const theme = useTheme();
  const { precision } = useMoneyFormat();
  return (
    <View style={{ gap: theme.spacing.md }}>
      <AmountInput
        label="Amount"
        value={amount}
        onChangeText={onAmountChange}
        precision={precision(base) ?? 2}
        currencyCode={base}
        placeholder="0.00"
        error={amountError}
        testID={`${testID}-amount`}
      />
      <AmountInput
        label={`Rate (${quote} for 1 ${base})`}
        value={rate}
        onChangeText={onRateChange}
        precision={RATE_INPUT_DECIMALS}
        currencyCode={quote}
        placeholder="0.00"
        error={rateError}
        testID={`${testID}-rate`}
      />
    </View>
  );
}
