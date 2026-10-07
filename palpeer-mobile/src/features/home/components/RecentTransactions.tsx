import { Fragment } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { TransactionListItem } from '@/features/transactions/components/TransactionListItem';
import { groupByDay } from '@/features/transactions/logic';
import { openTransaction } from '@/features/transactions/navigation';
import { useNow } from '@/hooks/useNow';
import { useTheme } from '@/providers/ThemeProvider';
import type { TransactionItemResponse } from '@/types/api/transaction';

type Props = { items: readonly TransactionItemResponse[] };

/** Newest first, grouped by day. Today's items come first without a heading, as in the design. */
export function RecentTransactions({ items }: Props) {
  const theme = useTheme();
  const now = useNow();
  const groups = groupByDay(items, now);
  return (
    <View>
      {groups.map((group, groupIndex) => (
        <Fragment key={group.key}>
          {group.label !== 'Today' ? (
            <AppText
              variant="caption"
              tone="muted"
              style={{ marginTop: groupIndex === 0 ? 0 : theme.spacing.md }}
            >
              {group.label}
            </AppText>
          ) : null}
          {group.items.map((item, index) => (
            <TransactionListItem
              key={`${item.type}-${item.id}`}
              item={item}
              onPress={() => openTransaction(item)}
              divider={index < group.items.length - 1}
            />
          ))}
        </Fragment>
      ))}
    </View>
  );
}
