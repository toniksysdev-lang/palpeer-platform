import { ChevronRight, Eye, EyeOff } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { GradientCard } from '@/components/ui/GradientCard';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { palette } from '@/theme/colors';
import type { WalletResponse } from '@/types/api/wallet';
import { compareMoney } from '@/utils/money';

import { useMoneyFormat } from '../useMoneyFormat';

type Props = {
  wallet: WalletResponse;
  hidden: boolean;
  onToggleHidden: () => void;
  onOpen: () => void;
};

const MASK = '••••••';
const ON_HERO = palette.neutral0;
const ON_HERO_SOFT = 'rgba(255, 255, 255, 0.8)';

/** One wallet's available balance on the hero gradient ("CAD 80.00"). */
export function BalanceCard({ wallet, hidden, onToggleHidden, onOpen }: Props) {
  const theme = useTheme();
  const { format } = useMoneyFormat();
  const code = wallet.currencyCode;
  const available = `${code} ${format(wallet.availableBalance, code, { showCurrency: false })}`;
  const hasPending = compareMoney(wallet.pendingBalance, '0') !== 0;

  return (
    <GradientCard testID={`balance-card-${code}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: theme.touchTarget }} />
        <View style={{ flex: 1, alignItems: 'center', gap: theme.spacing.xs }}>
          <AppText variant="caption" style={{ color: ON_HERO_SOFT }}>
            Available balance
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <AppText
              variant="h1"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ color: ON_HERO, flexShrink: 1 }}
              accessibilityLabel={
                hidden ? `${code} balance hidden` : `${code} available ${available}`
              }
              testID={`wallet-available-${code}`}
            >
              {hidden ? `${code} ${MASK}` : available}
            </AppText>
            <Pressable
              onPress={onToggleHidden}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}
              testID="balance-visibility"
            >
              <Icon icon={hidden ? Eye : EyeOff} size="md" color={ON_HERO} />
            </Pressable>
          </View>
          {hasPending && !hidden ? (
            <AppText
              variant="caption"
              style={{ color: ON_HERO_SOFT }}
              testID={`wallet-pending-${code}`}
            >
              {format(wallet.pendingBalance, code)} pending
            </AppText>
          ) : null}
        </View>
        <Pressable
          onPress={onOpen}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Open ${code} wallet`}
          testID={`balance-open-${code}`}
          style={{
            width: theme.touchTarget,
            alignItems: 'flex-end',
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: theme.radius.pill,
              backgroundColor: ON_HERO,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon icon={ChevronRight} size="md" color={theme.colors.heroStart} />
          </View>
        </Pressable>
      </View>
    </GradientCard>
  );
}
