import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { TransactionRow } from '@/features/transactions/components/TransactionRow';
import { groupByDay } from '@/features/transactions/logic';
import { openTransaction } from '@/features/transactions/navigation';
import { useNow } from '@/hooks/useNow';
import { useTheme } from '@/providers/ThemeProvider';
import type { TransactionItemResponse } from '@/types/api/transaction';

type Props = { items: readonly TransactionItemResponse[] };

/** Same card rows and day grouping as Activity (transaction history). */
export function RecentTransactions({ items }: Props) {
  const theme = useTheme();
  const now = useNow();
  const groups = groupByDay(items, now);
  return (
    <View style={{ gap: theme.spacing.lg }} testID="home-recent-list">
      {groups.map((group) => (
        <View key={group.key} style={{ gap: theme.spacing.sm }}>
          <AppText variant="overline" tone="muted" accessibilityRole="header">
            {group.label}
          </AppText>
          {group.items.map((item) => (
            <TransactionRow
              key={`${item.type}-${item.id}`}
              item={item}
              timeOnly
              onPress={() => openTransaction(item)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
