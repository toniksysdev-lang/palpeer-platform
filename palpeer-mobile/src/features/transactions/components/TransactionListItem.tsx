import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRightLeft,
  Gift,
  Plus,
  Users,
  type LucideIcon,
} from 'lucide-react-native';

import { IconTile } from '@/components/ui/IconTile';
import { ListItem } from '@/components/ui/ListItem';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import type { TransactionActivityType, TransactionItemResponse } from '@/types/api/transaction';
import { formatClockTime } from '@/utils/datetime';
import { humanizeStatus } from '@/utils/status';

import { typeLabel } from '../logic';

const ICONS: Record<TransactionActivityType, LucideIcon> = {
  FUNDING: Plus,
  WITHDRAWAL: ArrowDownToLine,
  EXCHANGE: ArrowRightLeft,
  TRANSFER: ArrowLeftRight,
  P2P: Users,
  BONUS: Gift,
};

type Props = {
  item: TransactionItemResponse;
  onPress: () => void;
  divider?: boolean;
};

/**
 * Compact feed row: type and status on the left, "CAD/NGN 100.00" and the time on the right.
 * The amount is the source amount and carries no sign; the status says whether money moved.
 */
export function TransactionListItem({ item, onPress, divider }: Props) {
  const { format } = useMoneyFormat();
  const currencies =
    (item.type === 'EXCHANGE' || item.type === 'P2P') && item.secondaryCurrencyCode
      ? `${item.currencyCode}/${item.secondaryCurrencyCode}`
      : item.currencyCode;
  const amount = `${currencies} ${format(item.amount, item.currencyCode, { showCurrency: false })}`;
  const status = humanizeStatus(item.status);
  const title = typeLabel(item.type);

  return (
    <ListItem
      leading={<IconTile icon={ICONS[item.type]} size="md" />}
      title={title}
      subtitle={status}
      trailingTitle={amount}
      trailingSubtitle={formatClockTime(item.createdAt)}
      onPress={onPress}
      divider={divider}
      accessibilityLabel={`${title}, ${format(item.amount, item.currencyCode)}, ${status.toLowerCase()}`}
      testID={`transaction-${item.id}`}
      trailingTitleTestID={`transaction-${item.id}-amount`}
    />
  );
}
