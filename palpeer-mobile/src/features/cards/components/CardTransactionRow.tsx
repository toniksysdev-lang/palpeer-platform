import { ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useTheme } from '@/providers/ThemeProvider';
import type { CardTransactionResponse } from '@/types/api/card';
import { formatDateTime } from '@/utils/datetime';

import { cardTransactionTypeLabel, isCardCredit } from '../logic';

export function CardTransactionRow({ transaction }: { transaction: CardTransactionResponse }) {
  const theme = useTheme();
  const { format } = useMoneyFormat();
  const credit = isCardCredit(transaction);
  const amount = format(transaction.amount, transaction.currencyCode);
  const title = transaction.merchantName || cardTransactionTypeLabel(transaction.entryType);

  return (
    <Card variant="outlined" padding="md" testID={`card-transaction-${transaction.id}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Icon icon={credit ? ArrowDownLeft : ArrowUpRight} color={theme.colors.primary} />
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="caption" tone="muted">
            {cardTransactionTypeLabel(transaction.entryType)} ·{' '}
            {formatDateTime(transaction.occurredAt)}
          </AppText>
          {transaction.failureReason ? (
            <AppText variant="caption" tone="danger">
              {transaction.failureReason}
            </AppText>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: theme.spacing.xxs }}>
          <AppText
            variant="bodyStrong"
            tone={credit ? 'success' : undefined}
            testID={`card-transaction-${transaction.id}-amount`}
          >
            {credit ? `+${amount}` : amount}
          </AppText>
          <StatusBadge status={transaction.status} />
        </View>
      </View>
    </Card>
  );
}
