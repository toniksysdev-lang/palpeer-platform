import { ChevronRight } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import type { WalletResponse } from '@/types/api/wallet';
import { compareMoney } from '@/utils/money';

import { useMoneyFormat } from '../useMoneyFormat';

type Props = {
  wallet: WalletResponse;
  onPress: () => void;
};

/** One currency wallet: available balance first, pending only when there is some. */
export function WalletCard({ wallet, onPress }: Props) {
  const theme = useTheme();
  const { format } = useMoneyFormat();
  const available = format(wallet.availableBalance, wallet.currencyCode);
  const hasPending = compareMoney(wallet.pendingBalance, '0') !== 0;

  return (
    <Card
      variant="elevated"
      padding="lg"
      onPress={onPress}
      accessibilityLabel={`${wallet.currencyCode} wallet, available ${available}`}
      testID={`wallet-card-${wallet.currencyCode}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="bodyStrong" tone="brand">
            {wallet.currencyCode}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <AppText variant="caption" tone="secondary">
            Available
          </AppText>
          <AppText variant="h2" testID={`wallet-available-${wallet.currencyCode}`}>
            {available}
          </AppText>
          {hasPending ? (
            <AppText
              variant="caption"
              tone="warning"
              testID={`wallet-pending-${wallet.currencyCode}`}
            >
              {format(wallet.pendingBalance, wallet.currencyCode)} pending
            </AppText>
          ) : null}
        </View>
        <Icon icon={ChevronRight} color={theme.colors.textMuted} />
      </View>
    </Card>
  );
}
