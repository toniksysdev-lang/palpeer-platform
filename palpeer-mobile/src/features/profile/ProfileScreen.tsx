import { router, type Href } from 'expo-router';
import {
  Bell,
  CreditCard,
  Gift,
  Languages,
  LifeBuoy,
  LockKeyhole,
  Megaphone,
  MessageCircle,
  Settings,
  ShieldCheck,
  ShieldHalf,
  UserRound,
  Wallet,
} from 'lucide-react-native';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { NavRow, RowSection } from '@/components/ui/NavRow';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { useLanguage } from '@/hooks/useLanguage';
import { useT } from '@/i18n/useT';
import { useTheme } from '@/providers/ThemeProvider';
import { useGetKycStatusQuery } from '@/services/api/kycApi';
import { useAppSelector } from '@/store';
import type { AppLanguage } from '@/store/slices/preferencesSlice';

import { useEnsureProfile } from './useEnsureProfile';

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
] as const satisfies readonly { value: AppLanguage; label: string }[];

/** More tab — Profile list + hamburger contents from the change map. */
export function ProfileScreen() {
  const theme = useTheme();
  const t = useT();
  const email = useAppSelector((state) => state.session.email);
  const { profile, loading, error, retry } = useEnsureProfile();
  const kyc = useGetKycStatusQuery();
  const { language, setLanguage } = useLanguage();
  const displayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');

  return (
    <Screen scroll>
      <StackHeader title={t('more.title')} />

      <Card testID="profile-card">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon icon={UserRound} size="lg" color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            {displayName ? (
              <AppText variant="bodyStrong" numberOfLines={1} testID="profile-name">
                {displayName}
              </AppText>
            ) : null}
            <AppText variant="overline" tone="muted">
              {t('more.myEmail')}
            </AppText>
            <AppText variant="bodyStrong" numberOfLines={1} testID="profile-email">
              {email ?? '—'}
            </AppText>
            {kyc.data?.status === 'APPROVED' ? (
              <AppText variant="caption" tone="secondary" testID="profile-identity-checked">
                {t('more.identityChecked')}
              </AppText>
            ) : null}
          </View>
        </View>
      </Card>

      {loading ? (
        <Skeleton height={48} testID="profile-loading" />
      ) : error ? (
        <View style={{ gap: theme.spacing.xs }}>
          <FormAlert message={error.message} testID="profile-error" />
          <Button label="Try again" variant="outline" onPress={retry} testID="profile-retry" />
        </View>
      ) : null}

      <Button
        label={t('more.getHelp')}
        shape="pill"
        leftIcon={LifeBuoy}
        onPress={() => router.push('/MoreHelp' as Href)}
        testID="profile-support"
      />

      <RowSection title={t('more.myDetails')}>
        <NavRow
          icon={UserRound}
          title={t('more.myName')}
          detail={
            profile?.complete
              ? displayName || 'Completed'
              : t('home.completeProfileHint')
          }
          right={
            profile && !profile.complete ? (
              <StatusBadge status="PENDING" testID="profile-personal-incomplete" />
            ) : null
          }
          onPress={() => router.push('/StartDetails' as Href)}
          testID="profile-personal"
        />
        <NavRow
          icon={ShieldCheck}
          title={t('more.myIdentity')}
          detail={
            kyc.data?.status === 'APPROVED'
              ? 'Verified'
              : kyc.data?.status === 'REJECTED'
                ? 'Action needed'
                : 'Verify your identity'
          }
          right={
            kyc.data ? <StatusBadge status={kyc.data.status} testID="profile-kyc-status" /> : null
          }
          onPress={() => router.push('/kyc')}
          testID="profile-kyc"
        />
      </RowSection>

      <RowSection title={t('more.staySafe')}>
        <NavRow
          icon={LockKeyhole}
          title={t('more.staySafe')}
          detail="My PIN, My password, Fingerprint, Signed-in phones"
          onPress={() => router.push('/security')}
          testID="profile-security"
        />
      </RowSection>

      <RowSection title={t('more.myCards')}>
        <NavRow
          icon={CreditCard}
          title={t('more.myCards')}
          detail="Get a card, Freeze a card, Card history"
          onPress={() => router.push('/cards')}
          testID="profile-cards"
        />
      </RowSection>

      <RowSection title={t('more.myRewards')}>
        <NavRow
          icon={Gift}
          title="Invite friends"
          detail="My invite code, People I invited"
          onPress={() => router.push('/InviteFriends' as Href)}
          testID="profile-referrals"
        />
        <NavRow
          icon={Gift}
          title="My points"
          detail="Loyalty points ledger (100 pts = CA$1)"
          onPress={() => router.push('/MyPoints' as Href)}
          testID="profile-points"
        />
        <NavRow
          icon={Wallet}
          title="My bonuses"
          detail="Totals by wallet, unused and used bonuses"
          onPress={() => router.push('/MyBonuses' as Href)}
          testID="profile-bonuses"
        />
        <NavRow
          icon={Megaphone}
          title="Promotions"
          onPress={() => router.push('/MyPromotions' as Href)}
          testID="profile-promotions"
        />
      </RowSection>

      <RowSection title={t('more.language')}>
        <View style={{ gap: theme.spacing.xs, paddingHorizontal: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Icon icon={Languages} color={theme.colors.textMuted} />
            <AppText variant="bodyStrong">{t('more.language')}</AppText>
          </View>
          <AppText variant="caption" tone="muted">
            {t('more.languageHint')}
          </AppText>
          <SegmentedControl
            options={LANGUAGE_OPTIONS}
            value={language}
            onChange={setLanguage}
            accessibilityLabel={t('more.language')}
          />
        </View>
      </RowSection>

      <RowSection title={t('more.settings')}>
        <NavRow
          icon={Bell}
          title={t('more.alerts')}
          detail="Push notifications on this phone and your other devices"
          onPress={() => router.push('/notifications/settings')}
          testID="profile-notifications"
        />
        <NavRow
          icon={ShieldHalf}
          title={t('more.privacy')}
          detail="Permissions, policies and your data"
          onPress={() => router.push('/settings/privacy')}
          testID="profile-privacy"
        />
        <NavRow
          icon={Settings}
          title={t('more.settings')}
          detail="App look, App version, Sign out"
          onPress={() => router.push('/settings')}
          testID="profile-settings"
        />
        <NavRow
          icon={MessageCircle}
          title={t('more.chatWithUs')}
          detail="Tonia can help — a person can join if needed"
          onPress={() => router.push('/support/live-chat')}
          testID="profile-live-chat"
        />
      </RowSection>
    </Screen>
  );
}
