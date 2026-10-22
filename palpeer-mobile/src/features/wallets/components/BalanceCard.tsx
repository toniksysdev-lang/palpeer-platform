import { ChevronRight, Eye, EyeOff, Wallet } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { AppText } from '@/components/ui/AppText';
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
const ON_HERO_SOFT = 'rgba(255, 255, 255, 0.86)';

/** Shared with the home marketing carousel (60% of this height). */
export const BALANCE_CARD_MIN_HEIGHT = 148;

/** Wallet name + available balance on a gradient card (swipeable in the carousel). */
export function BalanceCard({ wallet, hidden, onToggleHidden, onOpen }: Props) {
  const theme = useTheme();
  const { format } = useMoneyFormat();
  const code = wallet.currencyCode;
  const walletName = `${code} Wallet`;
  const available = format(wallet.availableBalance, code, { showCurrency: false });
  const hasPending = compareMoney(wallet.pendingBalance, '0') !== 0;

  // Outer card is a View + absolute Pressable so the eye toggle is not a nested <button> on web.
  return (
    <View
      style={[
        theme.shadows.card,
        {
          borderRadius: theme.radius.xl,
          overflow: 'hidden',
          minHeight: BALANCE_CARD_MIN_HEIGHT,
        },
      ]}
      testID={`balance-card-${code}`}
    >
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${walletName}, available ${hidden ? 'hidden' : `${code} ${available}`}`}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={[theme.colors.heroStart, theme.colors.heroEnd, '#0B6E4F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="box-none"
        style={{
          flex: 1,
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          pointerEvents="box-none"
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flex: 1 }}
            pointerEvents="none"
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: theme.radius.pill,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon icon={Wallet} size="md" color={ON_HERO} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="caption" style={{ color: ON_HERO_SOFT }}>
                Wallet
              </AppText>
              <AppText variant="bodyStrong" style={{ color: ON_HERO }} numberOfLines={1}>
                {walletName}
              </AppText>
            </View>
          </View>
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

        <View style={{ gap: theme.spacing.xxs }} pointerEvents="none">
          <AppText variant="caption" style={{ color: ON_HERO_SOFT }}>
            Available balance
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <AppText
              variant="h1"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ color: ON_HERO, flex: 1, marginRight: theme.spacing.sm }}
              testID={`wallet-available-${code}`}
            >
              {hidden ? `${code} ${MASK}` : `${code} ${available}`}
            </AppText>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: theme.radius.pill,
                backgroundColor: ON_HERO,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              testID={`balance-open-${code}`}
            >
              <Icon icon={ChevronRight} size="md" color={theme.colors.heroStart} />
            </View>
          </View>
          {hasPending && !hidden ? (
            <AppText variant="caption" style={{ color: ON_HERO_SOFT }} testID={`wallet-pending-${code}`}>
              {format(wallet.pendingBalance, code)} pending
            </AppText>
          ) : null}
        </View>
      </LinearGradient>
    </View>
  );
}
