import { View } from 'react-native';

import { AmountInput } from '@/components/ui/AmountInput';
import { AppText } from '@/components/ui/AppText';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { p2pRateLine } from '@/features/p2p/logic';
import { useTheme } from '@/providers/ThemeProvider';

/**
 * Amount in base currency (currency-formatted). Rate is locked to the listing/current
 * offer so negotiators only edit the amount.
 */
export function OfferTermsForm({
  base,
  quote,
  amount,
  rate,
  onAmountChange,
  amountError,
  testID,
}: {
  base: string;
  quote: string;
  amount: string;
  rate: string;
  onAmountChange: (value: string) => void;
  /** Kept for call-site compatibility; rate is not editable. */
  onRateChange?: (value: string) => void;
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
      <View style={{ gap: theme.spacing.xxs }} testID={`${testID}-rate`}>
        <AppText variant="caption" tone="muted">
          Rate ({quote} for 1 {base})
        </AppText>
        <AppText variant="bodyStrong">{p2pRateLine(rate, base, quote)}</AppText>
        <AppText variant="caption" tone="secondary">
          Rate is fixed for this negotiation. Change the amount only.
        </AppText>
      </View>
    </View>
  );
}
