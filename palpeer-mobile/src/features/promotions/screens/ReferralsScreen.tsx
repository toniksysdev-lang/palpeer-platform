import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronRight, Copy, Gift, Share2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, Share, View } from 'react-native';

import { FormAlert } from '@/components/feedback/FormAlert';
import { ErrorState } from '@/components/feedback/StateViews';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ConfirmDialog } from '@/components/ui/AppModal';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { toAppError } from '@/services/api/errors';
import {
  useApplyReferralMutation,
  useGetMyReferralCodeQuery,
  useGetMyReferralsQuery,
} from '@/services/api/promotionApi';
import { formatDateTime } from '@/utils/datetime';

import {
  normalizeReferralCode,
  REFERRAL_CODE_MAX,
  referralErrorMessage,
  referralStatusLabel,
  shareMessage,
} from '../logic';

/** Codes are single-use; a new one is issued once yours is used (R-RF-1). */
export function ReferralsScreen() {
  const theme = useTheme();
  const toast = useToast();
  const params = useLocalSearchParams<{ code?: string }>();
  const myCode = useGetMyReferralCodeQuery();
  const referrals = useGetMyReferralsQuery();
  const [applyReferral, applyState] = useApplyReferralMutation();
  const [code, setCode] = useState(() => normalizeReferralCode(params.code ?? ''));
  const [linkedCode, setLinkedCode] = useState(params.code);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (params.code !== linkedCode) {
    setLinkedCode(params.code);
    if (params.code) setCode(normalizeReferralCode(params.code));
  }

  const share = async () => {
    if (!myCode.data) return;
    try {
      await Share.share({ message: shareMessage(myCode.data.referralCode) });
    } catch {
      toast.show({ type: 'error', title: "Couldn't open the share sheet" });
    }
  };

  const copyCode = async () => {
    if (!myCode.data) return;
    try {
      await Clipboard.setStringAsync(myCode.data.referralCode);
      setCopied(true);
      toast.show({ type: 'success', title: 'Code copied' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.show({ type: 'error', title: "Couldn't copy the code" });
    }
  };

  const apply = async () => {
    setError(null);
    const result = await applyReferral({ referralCode: code });
    setConfirming(false);
    if ('error' in result) {
      setError(referralErrorMessage(toAppError(result.error)));
      return;
    }
    setCode('');
    toast.show({ type: 'success', title: 'Referral code applied' });
  };

  const used = (referrals.data ?? []).filter((item) => item.refereeUserId !== null);

  return (
    <Screen
      scroll
      keyboardAware
      refreshControl={
        <RefreshControl
          refreshing={myCode.isFetching && !myCode.isLoading}
          onRefresh={() => {
            void myCode.refetch();
            void referrals.refetch();
          }}
          tintColor={theme.colors.primary}
        />
      }
    >
      <StackHeader title="Invite friends" />

      <AppText tone="secondary">
        Share your code so friends can join PALPEER. When they apply it, you both earn a referral
        bonus when a promotion is active.
      </AppText>

      <Card variant="elevated" padding="lg" testID="referral-my-code">
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="overline" tone="muted">
            Your referral code
          </AppText>
          {myCode.data ? (
            <AppText variant="h1" selectable testID="referral-code" style={{ letterSpacing: 1 }}>
              {myCode.data.referralCode}
            </AppText>
          ) : myCode.error ? (
            <ErrorState error={toAppError(myCode.error)} onRetry={() => void myCode.refetch()} />
          ) : (
            <Skeleton height={36} />
          )}
          <AppText variant="caption" tone="secondary">
            Each code works once. After a friend uses it, you get a new one here.
          </AppText>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                label={copied ? 'Copied' : 'Copy'}
                variant="outline"
                leftIcon={copied ? Check : Copy}
                onPress={() => void copyCode()}
                disabled={!myCode.data}
                testID="referral-copy"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Share"
                leftIcon={Share2}
                onPress={() => void share()}
                disabled={!myCode.data}
                testID="referral-share"
              />
            </View>
          </View>
        </View>
      </Card>

      <Card variant="outlined" padding="md" testID="referral-stats">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Icon icon={Users} color={theme.colors.primary} />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <AppText variant="bodyStrong">
              {referrals.data
                ? `${used.length} friend${used.length === 1 ? '' : 's'} joined`
                : 'Friends who joined'}
            </AppText>
            <AppText variant="caption" tone="muted">
              Only completed invites are counted.
            </AppText>
          </View>
        </View>
      </Card>

      <View style={{ gap: theme.spacing.sm }} testID="referral-how">
        <AppText variant="h3">How it works</AppText>
        <Card variant="outlined" padding="md">
          <View style={{ gap: theme.spacing.sm }}>
            <AppText tone="secondary">1. Share your code or invite link with a friend.</AppText>
            <AppText tone="secondary">
              2. They enter it under Invite friends (or during sign-up).
            </AppText>
            <AppText tone="secondary">
              3. When an active referral promotion exists, bonuses show under My bonuses.
            </AppText>
          </View>
        </Card>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="h3">Have a code?</AppText>
        <Input
          label="Friend's referral code"
          value={code}
          onChangeText={(value) => setCode(normalizeReferralCode(value))}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={REFERRAL_CODE_MAX}
          testID="referral-apply-code"
        />
        <FormAlert message={error} testID="referral-apply-error" />
        <Button
          label="Apply code"
          variant="outline"
          onPress={() => setConfirming(true)}
          disabled={!code}
          testID="referral-apply"
        />
      </View>

      <Card
        variant="outlined"
        padding="md"
        onPress={() => router.push('/referrals/bonuses')}
        accessibilityLabel="My bonuses"
        testID="referral-bonuses"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Icon icon={Gift} color={theme.colors.primary} />
          <AppText variant="bodyStrong" style={{ flex: 1 }}>
            My bonuses
          </AppText>
          <Icon icon={ChevronRight} color={theme.colors.textMuted} />
        </View>
      </Card>

      <View style={{ gap: theme.spacing.sm }} testID="referral-history">
        <AppText variant="h3">Friends who joined</AppText>
        {referrals.error && !referrals.data ? (
          <ErrorState
            error={toAppError(referrals.error)}
            onRetry={() => void referrals.refetch()}
          />
        ) : !referrals.data ? (
          <Skeleton height={56} />
        ) : used.length === 0 ? (
          <AppText tone="secondary">No one has used your codes yet. Share yours to get started.</AppText>
        ) : (
          used.map((item) => (
            <Card key={item.id} variant="outlined" padding="md" testID={`referral-${item.id}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                  <AppText variant="bodyStrong">{item.referralCode}</AppText>
                  <AppText variant="caption" tone="muted">
                    Created {formatDateTime(item.createdAt)}
                  </AppText>
                </View>
                <Badge label={referralStatusLabel(item.status)} tone="success" />
              </View>
            </Card>
          ))
        )}
      </View>

      <ConfirmDialog
        visible={confirming}
        title="Apply this code?"
        message={`You can only use one referral code. Apply ${code}?`}
        confirmLabel="Apply code"
        loading={applyState.isLoading}
        onConfirm={() => void apply()}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}
