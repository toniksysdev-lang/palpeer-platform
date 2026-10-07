import { KeySquare, LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { ConfirmDialog } from '@/components/ui/AppModal';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import {
  useGetSessionsQuery,
  useRevokeAllSessionsMutation,
  useRevokeSessionMutation,
} from '@/services/api/authApi';
import { toAppError } from '@/services/api/errors';
import { sessionManager } from '@/services/auth/session';
import type { SessionResponse } from '@/types/api/auth';
import { formatDateTime } from '@/utils/datetime';

/**
 * Active sign-ins (one per refresh token). The backend has no device or location data, so each
 * session is described by when it started and when it expires.
 */
export function SessionsScreen() {
  const theme = useTheme();
  const toast = useToast();
  const sessions = useGetSessionsQuery();
  const [revokeSession, revokeState] = useRevokeSessionMutation();
  const [revokeAll, revokeAllState] = useRevokeAllSessionsMutation();
  const [ending, setEnding] = useState<SessionResponse | null>(null);
  const [endingAll, setEndingAll] = useState(false);

  const endOne = async () => {
    if (!ending) return;
    const session = ending;
    const result = await revokeSession(session.id);
    setEnding(null);
    if ('error' in result && toAppError(result.error).kind !== 'notFound') {
      toast.show({ type: 'error', title: toAppError(result.error).message });
      return;
    }
    if (session.current) {
      await sessionManager.signOut('sessionEnded');
      return;
    }
    toast.show({ type: 'success', title: 'Session ended' });
  };

  const endAll = async () => {
    const result = await revokeAll();
    if ('error' in result) {
      setEndingAll(false);
      toast.show({ type: 'error', title: toAppError(result.error).message });
      return;
    }
    await sessionManager.signOut('allSessionsEnded');
  };

  const header = <StackHeader title="Active sessions" />;

  if (sessions.error && !sessions.data) {
    return (
      <Screen>
        {header}
        <ErrorState error={toAppError(sessions.error)} onRetry={() => void sessions.refetch()} />
      </Screen>
    );
  }

  if (!sessions.data) {
    return (
      <Screen>
        {header}
        <Skeleton height={88} />
        <Skeleton height={88} />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={sessions.isFetching && !sessions.isLoading}
          onRefresh={() => void sessions.refetch()}
          tintColor={theme.colors.primary}
        />
      }
      footer={
        sessions.data.length > 0 ? (
          <Button
            label="Sign out of all devices"
            variant="outline"
            leftIcon={LogOut}
            onPress={() => setEndingAll(true)}
            testID="sessions-end-all"
          />
        ) : null
      }
    >
      {header}
      <AppText tone="secondary">
        Every time you sign in, a session starts. End any you don&apos;t recognise. A device that is
        already open may keep access for up to 15 minutes after its session ends.
      </AppText>
      {sessions.data.length === 0 ? (
        <EmptyState
          icon={KeySquare}
          title="No active sessions"
          message="Sessions appear here each time you sign in."
        />
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {sessions.data.map((session, index) => (
            <Card key={session.id} variant="outlined" padding="md" testID={`session-${session.id}`}>
              <View style={{ gap: theme.spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <Icon icon={KeySquare} color={theme.colors.primary} />
                  <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                    <AppText variant="bodyStrong">
                      {session.current ? 'This phone' : `Session ${index + 1}`}
                    </AppText>
                    <AppText variant="caption" tone="secondary">
                      Signed in {formatDateTime(session.createdAt) ?? '—'}
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      Expires {formatDateTime(session.expiresAt) ?? '—'}
                    </AppText>
                  </View>
                  {session.current ? <Badge label="Current" tone="success" /> : null}
                </View>
                <Button
                  label={session.current ? 'Sign out here' : 'End session'}
                  variant="ghost"
                  onPress={() => setEnding(session)}
                  loading={revokeState.isLoading && revokeState.originalArgs === session.id}
                  testID={`session-end-${session.id}`}
                />
              </View>
            </Card>
          ))}
        </View>
      )}
      <ConfirmDialog
        visible={ending !== null}
        title={ending?.current ? 'Sign out on this phone?' : 'End this session?'}
        message={
          ending?.current
            ? "You'll need your email and password to sign in again."
            : 'That device will need to sign in again.'
        }
        confirmLabel={ending?.current ? 'Sign out' : 'End session'}
        destructive
        loading={revokeState.isLoading}
        onConfirm={() => void endOne()}
        onCancel={() => setEnding(null)}
      />
      <ConfirmDialog
        visible={endingAll}
        title="Sign out of all devices?"
        message="Every session ends, including this one. You'll need to sign in again everywhere."
        confirmLabel="Sign out everywhere"
        destructive
        loading={revokeAllState.isLoading}
        onConfirm={() => void endAll()}
        onCancel={() => setEndingAll(false)}
      />
    </Screen>
  );
}
