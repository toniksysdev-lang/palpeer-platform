import { router, type Href } from 'expo-router';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ChevronRight,
  Megaphone,
  Plus,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Wallet,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { ConfirmDialog } from '@/components/ui/AppModal';
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
import { useT } from '@/i18n/useT';
import { useTheme } from '@/providers/ThemeProvider';
import { toAppError } from '@/services/api/errors';
import { useGetKycStatusQuery } from '@/services/api/kycApi';
import { useGetMarketingAdvertsQuery } from '@/services/api/marketingApi';
import { useGetActivePromotionsQuery } from '@/services/api/promotionApi';
import { useGetRecentTransactionsQuery, useGetWalletsQuery } from '@/services/api/walletApi';

import { ChangeMoneySheet } from './components/ChangeMoneySheet';
import { MarketingCarousel } from './components/MarketingCarousel';
import { RecentTransactions } from './components/RecentTransactions';

const HOME_ACTIVITY = 5;

/** Balances are shown one currency per card and never added together (R-G-3). */
export function HomeScreen() {
  const theme = useTheme();
  const t = useT();
  const wallets = useGetWalletsQuery();
  const kyc = useGetKycStatusQuery();
  const { profile, loading: profileLoading } = useEnsureProfile();
  const recent = useGetRecentTransactionsQuery(HOME_ACTIVITY);
  const promotions = useGetActivePromotionsQuery();
  const marketing = useGetMarketingAdvertsQuery();
  const [walletIndex, setWalletIndex] = useState(0);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [profileGateOpen, setProfileGateOpen] = useState(false);

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

  const requireProfile = (action: () => void) => {
    if (profileIncomplete) {
      setProfileGateOpen(true);
      return;
    }
    action();
  };

  const moveMoney = (action: 'fund' | 'withdraw' | 'transfer') => {
    requireProfile(() => {
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
    });
  };

  const openChange = () => requireProfile(() => setChangeOpen(true));
  const openCreateWallet = () => requireProfile(() => router.push('/wallet/create'));
  const openAllMoney = () => router.navigate('/wallets');

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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <Pressable
            onPress={openAllMoney}
            accessibilityRole="link"
            accessibilityLabel={t('home.allMyMoney', { count: wallets.data.length })}
            testID="home-all-money"
            hitSlop={8}
          >
            <AppText variant="bodyStrong" style={{ color: theme.colors.info }}>
              {t('home.allMyMoney', { count: wallets.data.length })}
            </AppText>
          </Pressable>
          <IconButton
            icon={Plus}
            accessibilityLabel={t('home.createWallet')}
            onPress={openCreateWallet}
            testID="home-create-wallet"
          />
        </View>
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
        title={greetingName ? t('home.helloName', { name: greetingName }) : t('home.hello')}
        right={<NotificationBell />}
      />

      {balances}

      <QuickActionBar testID="home-quick-actions">
        <QuickAction
          icon={Plus}
          label={t('home.add')}
          onPress={() => moveMoney('fund')}
          testID="home-action-fund"
        />
        <QuickAction
          icon={ArrowUpFromLine}
          label={t('home.send')}
          onPress={() => moveMoney('transfer')}
          testID="home-action-transfer"
        />
        <QuickAction
          icon={ArrowLeftRight}
          label={t('home.change')}
          onPress={openChange}
          testID="home-action-change"
        />
        <QuickAction
          icon={ArrowDownToLine}
          label={t('home.takeOut')}
          onPress={() => moveMoney('withdraw')}
          testID="home-action-withdraw"
        />
      </QuickActionBar>

      <ChangeMoneySheet visible={changeOpen} onClose={() => setChangeOpen(false)} />
      <ConfirmDialog
        visible={profileGateOpen}
        title={t('home.profileGateTitle')}
        message={t('home.profileGateBody')}
        confirmLabel={t('home.profileGateAction')}
        cancelLabel="Not now"
        onConfirm={() => {
          setProfileGateOpen(false);
          router.push('/profile/personal');
        }}
        onCancel={() => setProfileGateOpen(false)}
      />

      {marketing.data && marketing.data.length > 0 ? (
        <MarketingCarousel adverts={marketing.data} />
      ) : null}

      {!profileLoading && profileIncomplete ? (
        <Card
          variant="outlined"
          padding="md"
          onPress={() => router.push('/profile/personal')}
          accessibilityLabel={t('home.completeProfile')}
          testID="home-profile-incomplete"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Icon icon={UserRound} color={theme.colors.warning} />
            <View style={{ flex: 1, gap: theme.spacing.xxs }}>
              <AppText variant="bodyStrong">{t('home.completeProfile')}</AppText>
              <AppText variant="caption" tone="secondary">
                {t('home.completeProfileHint')}
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
          onPress={() => router.push('/MyPromotions' as Href)}
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
