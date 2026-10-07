import { ArrowDownLeft, ArrowUpRight, Lock, LockOpen, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText, type TextTone } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import type { LedgerEntryType, LedgerTransactionResponse } from '@/types/api/wallet';
import { formatDateTime } from '@/utils/datetime';

import { useMoneyFormat } from '../useMoneyFormat';

/**
 * How each VERIFIED ledger entry type moves money: CREDIT adds to available, DEBIT removes from it,
 * HOLD moves available → pending, RELEASE moves pending → available.
 */
const ENTRY: Record<
  LedgerEntryType,
  { label: string; icon: LucideIcon; sign: '+' | '-' | ''; tone: TextTone }
> = {
  CREDIT: { label: 'Credit', icon: ArrowDownLeft, sign: '+', tone: 'success' },
  DEBIT: { label: 'Debit', icon: ArrowUpRight, sign: '-', tone: 'primary' },
  HOLD: { label: 'Held', icon: Lock, sign: '', tone: 'warning' },
  RELEASE: { label: 'Released', icon: LockOpen, sign: '', tone: 'secondary' },
};

export function LedgerRow({ entry }: { entry: LedgerTransactionResponse }) {
  const theme = useTheme();
  const { format } = useMoneyFormat();
  const meta = ENTRY[entry.entryType] ?? {
    label: entry.entryType,
    icon: ArrowUpRight,
    sign: '',
    tone: 'primary' as const,
  };
  const amount = format(entry.amount, entry.currencyCode);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
      }}
      accessible
      accessibilityLabel={`${meta.label} ${amount}, ${entry.description ?? ''}`}
      testID={`ledger-${entry.id}`}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.surfaceMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon icon={meta.icon} size="sm" color={theme.colors.textSecondary} />
      </View>
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {entry.description ?? meta.label}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {[meta.label, formatDateTime(entry.createdAt)].filter(Boolean).join(' · ')}
        </AppText>
      </View>
      <View style={{ alignItems: 'flex-end', gap: theme.spacing.xxs }}>
        <AppText variant="bodyStrong" tone={meta.tone} testID={`ledger-amount-${entry.id}`}>
          {meta.sign === '-' ? `−${amount}` : `${meta.sign}${amount}`}
        </AppText>
        <AppText variant="caption" tone="muted">
          Balance {format(entry.availableBalanceAfter, entry.currencyCode, { showCurrency: false })}
        </AppText>
      </View>
    </View>
  );
}
