import { ArrowLeftRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AmountInput } from '@/components/ui/AmountInput';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import {
  apiRateFromUnit,
  applyRateDisplayEdit,
  displayRateForUnit,
  otherOfPair,
  preferredRateUnit,
  RATE_INPUT_DECIMALS,
  rateEntryHint,
  type RateEntryAnchor,
} from '@/features/p2p/logic';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useTheme } from '@/providers/ThemeProvider';
import { isPositiveMoney, toMoney } from '@/utils/money';

function anchorFromApiRate(base: string, quote: string, apiRate: string): RateEntryAnchor {
  const unit = preferredRateUnit(base, quote);
  const value =
    unit.toUpperCase() === base.toUpperCase()
      ? toMoney(apiRate)
      : displayRateForUnit({ unitCode: base, value: toMoney(apiRate) }, unit);
  return { unitCode: unit, value };
}

/**
 * Amount in base currency and a switchable rate (1 UNIT = …). Both parties edit these.
 */
export function OfferTermsForm({
  base,
  quote,
  amount,
  rate,
  onAmountChange,
  onRateChange,
  amountError,
  rateError,
  editable = true,
  amountEditable,
  rateEditable,
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
  /** When set, applies to both fields unless `amountEditable` / `rateEditable` override. */
  editable?: boolean;
  amountEditable?: boolean;
  rateEditable?: boolean;
  testID: string;
}) {
  const theme = useTheme();
  const { precision } = useMoneyFormat();
  const amountOpen = amountEditable ?? editable;
  const rateOpen = rateEditable ?? editable;
  const [rateUnit, setRateUnit] = useState(() => preferredRateUnit(base, quote));
  const [rateAnchor, setRateAnchor] = useState<RateEntryAnchor | null>(() =>
    isPositiveMoney(rate) ? anchorFromApiRate(base, quote, rate) : null,
  );
  const [seededRate, setSeededRate] = useState(rate);

  if (rate !== seededRate) {
    setSeededRate(rate);
    setRateAnchor(isPositiveMoney(rate) ? anchorFromApiRate(base, quote, rate) : null);
    setRateUnit(preferredRateUnit(base, quote));
  }

  const rateOther = otherOfPair(rateUnit, base, quote);
  const displayRate = displayRateForUnit(rateAnchor, rateUnit);

  const publishRate = (anchor: RateEntryAnchor | null) => {
    setRateAnchor(anchor);
    if (!anchor || !isPositiveMoney(anchor.value)) return;
    onRateChange(apiRateFromUnit(base, quote, anchor.unitCode, toMoney(anchor.value)));
  };

  const onDisplayRateChange = (next: string) => {
    publishRate(applyRateDisplayEdit(rateAnchor, rateUnit, next));
  };

  const flipRateUnit = () => {
    setRateUnit(otherOfPair(rateUnit, base, quote));
  };

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
        editable={amountOpen}
        testID={`${testID}-amount`}
      />
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="caption" tone="muted">
          Rate
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
            onPress={rateOpen ? flipRateUnit : undefined}
            disabled={!rateOpen}
            accessibilityRole="button"
            accessibilityLabel={`Rate unit: ${rateUnit}. Tap to switch.`}
            testID={`${testID}-rate-unit`}
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
              opacity: rateOpen ? 1 : 0.6,
            }}
          >
            <AppText variant="bodyStrong">{rateUnit}</AppText>
            <Icon icon={ArrowLeftRight} size={16} color={theme.colors.primary} />
            <AppText variant="caption" tone="muted">
              Switch
            </AppText>
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
              error={rateError}
              editable={rateOpen}
              testID={`${testID}-rate`}
            />
          </View>
        </View>
        <AppText variant="caption" tone="secondary">
          {rateEntryHint(rateUnit, rateOther)}
        </AppText>
      </View>
    </View>
  );
}
