import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useTheme } from '@/providers/ThemeProvider';
import type { CurrencyAmountTotal, TransactionSummaryResponse } from '@/types/api/transaction';

import { inProgressCount, TRANSACTION_TYPES, typeLabel } from '../logic';

function Totals({
  title,
  totals,
  testID,
}: {
  title: string;
  totals: readonly CurrencyAmountTotal[];
  testID: string;
}) {
  const theme = useTheme();
  const { format } = useMoneyFormat();
  return (
    <View style={{ flex: 1, gap: theme.spacing.xxs }} testID={testID}>
      <AppText variant="caption" tone="secondary">
        {title}
      </AppText>
      {totals.length === 0 ? (
        <AppText tone="muted">None</AppText>
      ) : (
        totals.map((total) => (
          <AppText key={total.currencyCode} variant="bodyStrong">
            {format(total.totalAmount, total.currencyCode)}
          </AppText>
        ))
      )}
    </View>
  );
}

/**
 * Backend totals for the period. Money in and out are completed fundings and withdrawals only,
 * listed per currency and never added across currencies (R-G-3).
 */
export function ActivitySummaryCard({
  summary,
  periodTitle,
}: {
  summary: TransactionSummaryResponse;
  periodTitle: string;
}) {
  const theme = useTheme();
  const open = inProgressCount(summary);
  const counts = TRANSACTION_TYPES.map(
    (type) => `${summary.countByType[type] ?? 0} ${typeLabel(type).toLowerCase()}`,
  ).join(' · ');

  return (
    <Card variant="elevated" padding="lg" testID="activity-summary">
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ gap: theme.spacing.xxs }}>
          <AppText variant="overline" tone="muted">
            {periodTitle}
          </AppText>
          <AppText variant="h2" testID="activity-summary-total">
            {summary.totalCount === 1 ? '1 transaction' : `${summary.totalCount} transactions`}
          </AppText>
          <AppText variant="caption" tone="secondary" testID="activity-summary-counts">
            {counts}
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <Totals
            title="Money in (completed)"
            totals={summary.successfulFundingByCurrency}
            testID="activity-summary-in"
          />
          <Totals
            title="Money out (completed)"
            totals={summary.successfulWithdrawalByCurrency}
            testID="activity-summary-out"
          />
        </View>
        <AppText variant="caption" tone="secondary" testID="activity-summary-footer">
          {summary.successfulExchangeCount} completed{' '}
          {summary.successfulExchangeCount === 1 ? 'exchange' : 'exchanges'}
          {open > 0 ? ` · ${open} in progress` : ''}
        </AppText>
      </View>
    </Card>
  );
}
