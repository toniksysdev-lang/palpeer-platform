import { useState } from 'react';
import { ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';
import type { WalletResponse } from '@/types/api/wallet';

import { BalanceCard } from './BalanceCard';

type Props = {
  wallets: readonly WalletResponse[];
  index: number;
  onIndexChange: (index: number) => void;
  hidden: boolean;
  onToggleHidden: () => void;
  onOpen: (wallet: WalletResponse) => void;
};

/**
 * One balance card per wallet, swiped sideways. Each currency stays on its own card; balances are
 * never added together (R-G-3).
 */
export function BalanceCarousel({
  wallets,
  index,
  onIndexChange,
  hidden,
  onToggleHidden,
  onOpen,
}: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) onIndexChange(Math.max(0, Math.min(next, wallets.length - 1)));
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          scrollEnabled={wallets.length > 1}
          testID="balance-carousel"
        >
          {wallets.map((wallet) => (
            <View key={wallet.id} style={{ width: width || undefined }}>
              <BalanceCard
                wallet={wallet}
                hidden={hidden}
                onToggleHidden={onToggleHidden}
                onOpen={() => onOpen(wallet)}
              />
            </View>
          ))}
        </ScrollView>
      </View>
      {wallets.length > 1 ? (
        <View
          style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xs }}
          accessibilityLabel={`Wallet ${index + 1} of ${wallets.length}`}
        >
          {wallets.map((wallet, i) => (
            <View
              key={wallet.id}
              style={{
                height: 6,
                width: i === index ? 18 : 6,
                borderRadius: 3,
                backgroundColor: i === index ? theme.colors.primary : theme.colors.borderStrong,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
