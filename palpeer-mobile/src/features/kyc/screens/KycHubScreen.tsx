import { router } from 'expo-router';
import {
  BadgeCheck,
  Camera,
  ChevronRight,
  CircleCheck,
  Circle,
  FileText,
  Hourglass,
  Send,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react-native';
import { RefreshControl, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/providers/ThemeProvider';
import { useEnsureProfile } from '@/features/profile/useEnsureProfile';
import { useGetKycProgressQuery, useGetKycStatusQuery } from '@/services/api/kycApi';
import { toAppError } from '@/services/api/errors';

import { canUpload, kycPhase, nextKycStep, type KycNextStep } from '../kycState';

/** Polls while a check is running so the result appears without a manual refresh. */
const REVIEW_POLL_MS = 30_000;

const STEP_ROUTES = {
  document: '/kyc/document-type',
  selfie: '/kyc/selfie',
  submit: '/kyc/submit',
} as const;

export function KycHubScreen() {
  const theme = useTheme();
  const status = useGetKycStatusQuery();
  const { profile } = useEnsureProfile();
  const phase = status.data ? kycPhase(status.data.status) : null;
  const progress = useGetKycProgressQuery(undefined, {
    pollingInterval: phase === 'reviewing' ? REVIEW_POLL_MS : 0,
    skipPollingIfUnfocused: true,
  });
  const profileIncomplete = Boolean(profile && !profile.complete);

  const refreshing =
    (status.isFetching || progress.isFetching) && !(status.isLoading || progress.isLoading);
  const refresh = () => {
    void status.refetch();
    void progress.refetch();
  };

  const error = status.error ?? progress.error;
  const header = <StackHeader title="Identity verification" />;

  if (error && !(status.data && progress.data)) {
    return (
      <Screen>
        {header}
        <ErrorState error={toAppError(error)} onRetry={refresh} />
      </Screen>
    );
  }

  if (!status.data || !progress.data || !phase) {
    return (
      <Screen>
        {header}
        <View style={{ gap: theme.spacing.md }} testID="kyc-loading">
          <Skeleton height={96} />
          <Skeleton height={64} />
          <Skeleton height={64} />
        </View>
      </Screen>
    );
  }

  // Status and progress come from separate requests; progress drives the steps, status the copy.
  const current = { ...progress.data, status: status.data.status };
  const next: KycNextStep = phase === 'rejected' ? 'document' : nextKycStep(current);
  const open = canUpload(current.status);

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={theme.colors.primary}
        />
      }
      footer={next ? <PrimaryAction step={next} rejected={phase === 'rejected'} /> : null}
    >
      {header}
      <Card testID="kyc-status-card">
        <View style={{ gap: theme.spacing.sm }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <AppText variant="overline" tone="muted">
              Status
            </AppText>
            <StatusBadge status={current.status} testID="kyc-status-badge" />
          </View>
          <PhaseSummary phase={phase} />
        </View>
      </Card>

      {profileIncomplete && phase === 'collecting' ? (
        <Card
          variant="outlined"
          padding="md"
          onPress={() => router.push('/profile/personal')}
          accessibilityLabel="Complete personal information"
          testID="kyc-profile-prompt"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <View style={{ flex: 1, gap: theme.spacing.xxs }}>
              <AppText variant="bodyStrong">Complete personal information</AppText>
              <AppText variant="caption" tone="secondary">
                Finish your profile so we can pre-fill your verification details
              </AppText>
            </View>
            <Icon icon={ChevronRight} color={theme.colors.textMuted} />
          </View>
        </Card>
      ) : null}

      {phase === 'rejected' ? (
        <FormAlert
          tone="danger"
          message={
            status.data.rejectionReason
              ? `Reason: ${status.data.rejectionReason}`
              : 'Your verification was not approved. Upload a new photo of your document to try again.'
          }
          testID="kyc-rejection"
        />
      ) : null}

      {open ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="overline" tone="muted">
            Steps
          </AppText>
          <StepRow
            icon={FileText}
            title="Identity document"
            done={current.hasDocument && phase !== 'rejected'}
            detail={
              current.hasDocument
                ? `${current.documentCount} uploaded — tap to add another`
                : 'Passport, national ID, driving licence or residence permit'
            }
            onPress={() => router.push('/kyc/document-type')}
            testID="kyc-step-document"
          />
          <StepRow
            icon={Camera}
            title="Live photo"
            done={current.hasSelfie && phase !== 'rejected'}
            detail={
              current.hasSelfie
                ? 'Captured — tap to retake'
                : 'A live photo of your face (required)'
            }
            onPress={() => router.push('/kyc/selfie')}
            testID="kyc-step-selfie"
          />
          <StepRow
            icon={Send}
            title="Start live verification"
            done={false}
            detail="Confirm your name and send your ID + live photo to ComplyCube"
            onPress={
              current.hasDocument && current.hasSelfie
                ? () => router.push('/kyc/submit')
                : undefined
            }
            testID="kyc-step-submit"
          />
        </View>
      ) : null}

      {phase === 'reviewing' ? (
        <Button
          label="Check again"
          variant="outline"
          onPress={refresh}
          loading={refreshing}
          testID="kyc-check-again"
        />
      ) : null}
    </Screen>
  );
}

function PhaseSummary({ phase }: { phase: ReturnType<typeof kycPhase> }) {
  const theme = useTheme();
  const content: Record<
    typeof phase,
    { icon: LucideIcon; color: string; title: string; body: string }
  > = {
    collecting: {
      icon: ShieldAlert,
      color: theme.colors.warning,
      title: 'Live identity verification',
      body: 'Upload your identity document, take a live photo, then start ComplyCube verification.',
    },
    reviewing: {
      icon: Hourglass,
      color: theme.colors.warning,
      title: 'Live check in progress',
      body: "ComplyCube is verifying your document and live photo. This page updates automatically, or pull down to refresh.",
    },
    approved: {
      icon: BadgeCheck,
      color: theme.colors.success,
      title: "You're verified",
      body: 'Your identity has been confirmed.',
    },
    rejected: {
      icon: ShieldAlert,
      color: theme.colors.danger,
      title: 'Verification not approved',
      body: 'You can upload new photos and start live verification again.',
    },
  };
  const { icon, color, title, body } = content[phase];
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
      <Icon icon={icon} size="xl" color={color} />
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <AppText variant="h3">{title}</AppText>
        <AppText tone="secondary">{body}</AppText>
      </View>
    </View>
  );
}

type StepRowProps = {
  icon: LucideIcon;
  title: string;
  detail: string;
  done: boolean;
  onPress?: () => void;
  testID: string;
};

function StepRow({ icon, title, detail, done, onPress, testID }: StepRowProps) {
  const theme = useTheme();
  return (
    <Card
      variant="outlined"
      padding="md"
      onPress={onPress}
      accessibilityLabel={`${title}. ${done ? 'Done.' : 'Not done.'} ${detail}`}
      testID={testID}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          opacity: onPress ? 1 : 0.5,
        }}
      >
        <Icon icon={icon} color={theme.colors.primary} />
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <AppText variant="bodyStrong">{title}</AppText>
          <AppText variant="caption" tone="secondary">
            {detail}
          </AppText>
        </View>
        <Icon
          icon={done ? CircleCheck : onPress ? ChevronRight : Circle}
          color={done ? theme.colors.success : theme.colors.textMuted}
        />
      </View>
    </Card>
  );
}

function PrimaryAction({
  step,
  rejected,
}: {
  step: Exclude<KycNextStep, null>;
  rejected: boolean;
}) {
  const labels = {
    document: rejected ? 'Upload a new document' : 'Add identity document',
    selfie: 'Take a live photo',
    submit: 'Start live verification',
  };
  return (
    <Button label={labels[step]} onPress={() => router.push(STEP_ROUTES[step])} testID="kyc-next" />
  );
}
