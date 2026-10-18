import { router, type Href } from 'expo-router';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ChevronRight,
  HandCoins,
  Megaphone,
  Menu,
  Plus,
  Repeat,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Wallet,
} from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { AppText } from '@/components/ui/AppText';
import { StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { QuickAction, QuickActionBar } from '@/components/ui/QuickAction';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { useEnsureProfile } from '@/features/profile/useEnsureProfile';
import { BalanceCarousel } from '@/features/wallets/components/BalanceCarousel';
import { StaleDataNotice } from '@/features/wallets/components/StaleDataNotice';
import { useTheme } from '@/providers/ThemeProvider';
import { toAppError } from '@/services/api/errors';
import { useGetKycStatusQuery } from '@/services/api/kycApi';
import { useGetMarketingAdvertsQuery } from '@/services/api/marketingApi';
import { useGetActivePromotionsQuery } from '@/services/api/promotionApi';
import { useGetRecentTransactionsQuery, useGetWalletsQuery } from '@/services/api/walletApi';

import { MarketingCarousel } from './components/MarketingCarousel';
import { RecentTransactions } from './components/RecentTransactions';

const HOME_ACTIVITY = 5;

/** Balances are shown one currency per card and never added together (R-G-3). */
export function HomeScreen() {
  const theme = useTheme();
  const wallets = useGetWalletsQuery();
  const kyc = useGetKycStatusQuery();
  const { profile, loading: profileLoading } = useEnsureProfile();
  const recent = useGetRecentTransactionsQuery(HOME_ACTIVITY);
  const promotions = useGetActivePromotionsQuery();
  const marketing = useGetMarketingAdvertsQuery();
  const [walletIndex, setWalletIndex] = useState(0);
  const [balanceHidden, setBalanceHidden] = useState(false);

  const walletList = wallets.data ?? [];
  const selected = walletList[Math.min(walletIndex, walletList.length - 1)];
  const profileIncomplete = Boolean(profile && !profile.complete);
  const kycIncomplete =
    Boolean(kyc.data) && kyc.data!.status !== 'APPROVED' && kyc.data!.status !== 'UNDER_REVIEW';
  const kycReviewing = kyc.data?.status === 'UNDER_REVIEW' || kyc.data?.status === 'SUBMITTED';
  const greetingName = profile?.firstName?.trim();

  const refresh = () => {
    void wallets.refetch();
    void kyc.refetch();
    void recent.refetch();
    void promotions.refetch();
    void marketing.refetch();
  };

  const moveMoney = (action: 'fund' | 'withdraw' | 'transfer') => {
    if (!selected) {
      router.push('/wallet/create');
      return;
    }
    if (action === 'transfer') {
      router.push({
        pathname: '/wallet/[id]/transfer',
        params: { id: selected.id },
      } as Href);
      return;
    }
    router.push({
      pathname: action === 'fund' ? '/wallet/[id]/fund' : '/wallet/[id]/withdraw',
      params: { id: selected.id },
    });
  };

  let balances;
  if (wallets.error && !wallets.data) {
    balances = (
      <ErrorState error={toAppError(wallets.error)} onRetry={() => void wallets.refetch()} />
    );
  } else if (!wallets.data) {
    balances = <Skeleton height={112} />;
  } else if (wallets.data.length === 0) {
    balances = (
      <EmptyState
        icon={Wallet}
        title="No Wallets Available"
        message="Create a new wallet to get started"
        actionLabel="Create wallet"
        onAction={() => router.push('/wallet/create')}
      />
    );
  } else {
    balances = (
      <View style={{ gap: theme.spacing.sm }}>
        <StaleDataNotice
          error={wallets.error}
          fulfilledTimeStamp={wallets.fulfilledTimeStamp}
          testID="home-stale"
        />
        <BalanceCarousel
          wallets={wallets.data}
          index={Math.min(walletIndex, wallets.data.length - 1)}
          onIndexChange={setWalletIndex}
          hidden={balanceHidden}
          onToggleHidden={() => setBalanceHidden((value) => !value)}
          onOpen={(wallet) => router.push({ pathname: '/wallet/[id]', params: { id: wallet.id } })}
        />
      </View>
    );
  }

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={wallets.isFetching && !wallets.isLoading}
          onRefresh={refresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      <AppHeader
        title={greetingName ? `Welcome back, ${greetingName}` : 'Welcome back'}
        left={
          <IconButton
            icon={Menu}
            accessibilityLabel="Menu"
            onPress={() => router.push('/profile')}
            testID="home-profile"
          />
        }
        right={<NotificationBell />}
      />

      {balances}

      <QuickActionBar testID="home-quick-actions">
        <QuickAction
          icon={Plus}
          label="Fund wallet"
          onPress={() => moveMoney('fund')}
          testID="home-action-fund"
        />
        <QuickAction
          icon={Repeat}
          label="InstantEX"
          onPress={() => router.navigate('/exchange')}
          testID="home-action-exchange"
        />
        <QuickAction
          icon={HandCoins}
          label="Buy | Sell"
          onPress={() => router.navigate('/p2p')}
          testID="home-action-p2p"
        />
        <QuickAction
          icon={ArrowDownToLine}
          label="Withdraw"
          onPress={() => moveMoney('withdraw')}
          testID="home-action-withdraw"
        />
        <QuickAction
          icon={ArrowLeftRight}
          label="Transfer"
          onPress={() => moveMoney('transfer')}
          testID="home-action-transfer"
        />
      </QuickActionBar>

      {marketing.data && marketing.data.length > 0 ? (
        <MarketingCarousel adverts={marketing.data} />
      ) : null}

      {!profileLoading && profileIncomplete ? (
        <Card
          variant="outlined"
          padding="md"
          onPress={() => router.push('/profile/personal')}
          accessibilityLabel="Complete your personal information"
          testID="home-profile-incomplete"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Icon icon={UserRound} color={theme.colors.warning} />
            <View style={{ flex: 1, gap: theme.spacing.xxs }}>
              <AppText variant="bodyStrong">Complete your profile</AppText>
              <AppText variant="caption" tone="secondary">
                Add your personal details to unlock full access
              </AppText>
            </View>
            <StatusBadge status="PENDING" />
            <Icon icon={ChevronRight} color={theme.colors.textMuted} />
          </View>
        </Card>
      ) : null}

      {kycIncomplete ? (
        <Card
          variant="outlined"
          padding="md"
          onPress={() => router.push(profileIncomplete ? '/profile/personal' : '/kyc')}
          accessibilityLabel="Complete identity verification"
          testID="home-kyc"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Icon
              icon={kyc.data?.status === 'REJECTED' ? ShieldAlert : ShieldCheck}
              color={kyc.data?.status === 'REJECTED' ? theme.colors.danger : theme.colors.warning}
            />
            <View style={{ flex: 1, gap: theme.spacing.xxs }}>
              <AppText variant="bodyStrong">
                {kyc.data?.status === 'REJECTED'
                  ? 'Identity verification needed'
                  : 'Verify your identity'}
              </AppText>
              <AppText variant="caption" tone="secondary">
                {profileIncomplete
                  ? 'Finish your profile first, then complete KYC'
                  : kyc.data?.status === 'REJECTED'
                    ? 'Upload new documents to try again'
                    : 'Upload an ID document and selfie to get verified'}
              </AppText>
            </View>
            <StatusBadge status={kyc.data?.status} />
            <Icon icon={ChevronRight} color={theme.colors.textMuted} />
          </View>
        </Card>
      ) : kycReviewing ? (
        <Card
          variant="outlined"
          padding="md"
          onPress={() => router.push('/kyc')}
          accessibilityLabel="Identity verification in review"
          testID="home-kyc"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Icon icon={ShieldCheck} color={theme.colors.primary} />
            <View style={{ flex: 1, gap: theme.spacing.xxs }}>
              <AppText variant="bodyStrong">Identity verification</AppText>
              <AppText variant="caption" tone="secondary">
                Your documents are under review
              </AppText>
            </View>
            <StatusBadge status={kyc.data?.status} />
            <Icon icon={ChevronRight} color={theme.colors.textMuted} />
          </View>
        </Card>
      ) : null}

      {promotions.data && promotions.data.length > 0 ? (
        <Card
          variant="outlined"
          padding="md"
          onPress={() => router.push('/promotions')}
          accessibilityLabel="Promotions"
          testID="home-promotions"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Icon icon={Megaphone} color={theme.colors.primary} />
            <View style={{ flex: 1, gap: theme.spacing.xxs }}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {promotions.data.length === 1
                  ? (promotions.data[0]?.title ?? 'Promotion')
                  : `${promotions.data.length} promotions available`}
              </AppText>
              <AppText variant="caption" tone="secondary">
                See current offers
              </AppText>
            </View>
            <Icon icon={ChevronRight} color={theme.colors.textMuted} />
          </View>
        </Card>
      ) : null}

      {recent.data ? (
        <View style={{ gap: theme.spacing.xs }} testID="home-activity">
          <SectionHeader
            title="Recent Transactions"
            actionLabel="see all"
            onAction={() => router.navigate('/activity')}
            actionTestID="home-activity-all"
          />
          {recent.data.length > 0 ? (
            <RecentTransactions items={recent.data} />
          ) : (
            <AppText tone="muted" style={{ paddingVertical: theme.spacing.md }}>
              Your transactions will show up here.
            </AppText>
          )}
        </View>
      ) : null}
    </Screen>
  );
}
