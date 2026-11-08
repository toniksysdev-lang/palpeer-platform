import { router } from 'expo-router';
import { Plus, Wallet } from 'lucide-react-native';
import { RefreshControl, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useT } from '@/i18n/useT';
import { useTheme } from '@/providers/ThemeProvider';
import { toAppError } from '@/services/api/errors';
import { useGetWalletsQuery } from '@/services/api/walletApi';

import { StaleDataNotice } from '../components/StaleDataNotice';
import { WalletCard } from '../components/WalletCard';

/** Former Wallet tab — now “All my money” from Home (design change map). */
export function WalletsScreen() {
  const theme = useTheme();
  const t = useT();
  const wallets = useGetWalletsQuery();
  const createWallet = () => router.push('/wallet/create');

  const header = (
    <View style={{ gap: theme.spacing.sm }}>
      <StackHeader title={t('wallets.title')} />
      {wallets.data && wallets.data.length > 0 ? (
        <Button
          label={t('wallets.create')}
          leftIcon={Plus}
          size="md"
          shape="pill"
          onPress={createWallet}
          testID="wallets-create"
        />
      ) : null}
    </View>
  );

  let body;
  if (wallets.error && !wallets.data) {
    body = <ErrorState error={toAppError(wallets.error)} onRetry={() => void wallets.refetch()} />;
  } else if (!wallets.data) {
    body = (
      <View style={{ gap: theme.spacing.md }} testID="wallets-loading">
        <Skeleton height={96} />
        <Skeleton height={96} />
      </View>
    );
  } else if (wallets.data.length === 0) {
    body = (
      <EmptyState
        icon={Wallet}
        title="No Wallets Available"
        message="Create a new wallet to get started"
        actionLabel={t('wallets.create')}
        onAction={createWallet}
      />
    );
  } else {
    body = (
      <View style={{ gap: theme.spacing.md }}>
        <StaleDataNotice
          error={wallets.error}
          fulfilledTimeStamp={wallets.fulfilledTimeStamp}
          testID="wallets-stale"
        />
        {wallets.data.map((wallet) => (
          <WalletCard
            key={wallet.id}
            wallet={wallet}
            onPress={() => router.push({ pathname: '/wallet/[id]', params: { id: wallet.id } })}
          />
        ))}
      </View>
    );
  }

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={wallets.isFetching && !wallets.isLoading}
          onRefresh={() => void wallets.refetch()}
          tintColor={theme.colors.primary}
        />
      }
    >
      {header}
      {body}
    </Screen>
  );
}
