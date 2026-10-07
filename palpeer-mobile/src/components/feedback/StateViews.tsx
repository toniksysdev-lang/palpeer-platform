import { CloudOff, Inbox, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import type { AppError } from '@/services/api/errors';

type EmptyStateProps = {
  title: string;
  message?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  title,
  message,
  icon = Inbox,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: theme.spacing.xxl, gap: theme.spacing.sm }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: theme.spacing.sm,
        }}
      >
        <Icon icon={icon} size="xl" color={theme.colors.primary} />
      </View>
      <AppText variant="h3" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText tone="secondary" align="center">
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: theme.spacing.md }}>
          <Button label={actionLabel} onPress={onAction} fullWidth={false} size="md" />
        </View>
      ) : null}
    </View>
  );
}

type ErrorStateProps = {
  error: AppError;
  onRetry?: () => void;
};

/** Shows the normalised error message; request IDs help support trace a failure. */
export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const theme = useTheme();
  return (
    <View
      style={{ alignItems: 'center', padding: theme.spacing.xxl, gap: theme.spacing.sm }}
      accessibilityRole="alert"
    >
      <Icon icon={CloudOff} size="xl" color={theme.colors.danger} />
      <AppText variant="h3" align="center">
        {error.kind === 'offline' ? "You're offline" : 'Something went wrong'}
      </AppText>
      <AppText tone="secondary" align="center">
        {error.message}
      </AppText>
      {error.requestId ? (
        <AppText variant="caption" tone="muted" align="center" selectable>
          Reference: {error.requestId}
        </AppText>
      ) : null}
      {onRetry ? (
        <View style={{ marginTop: theme.spacing.md }}>
          <Button
            label="Try again"
            onPress={onRetry}
            variant="outline"
            fullWidth={false}
            size="md"
          />
        </View>
      ) : null}
    </View>
  );
}
