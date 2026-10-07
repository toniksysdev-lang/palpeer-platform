import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/providers/ThemeProvider';
import { formatClockTime, formatDateTime } from '@/utils/datetime';

/** Clock time for today's messages, date and time for older ones. */
function messageTime(iso: string): string | null {
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString()
    ? formatClockTime(iso)
    : formatDateTime(iso);
}

type Props = {
  content: string;
  mine: boolean;
  createdAt: string;
  state?: 'sent' | 'sending' | 'failed';
  error?: string | null;
  onRetry?: () => void;
  /** The other participant has read this message. */
  seen?: boolean;
  testID?: string;
};

export function MessageBubble({
  content,
  mine,
  createdAt,
  state = 'sent',
  error,
  onRetry,
  seen = false,
  testID,
}: Props) {
  const theme = useTheme();
  const failed = state === 'failed';
  const meta =
    state === 'sending'
      ? 'Sending…'
      : failed
        ? `${error ?? 'Not sent.'} Tap to retry.`
        : (messageTime(createdAt) ?? '');

  const bubble = (
    <View
      style={{
        maxWidth: '80%',
        alignSelf: mine ? 'flex-end' : 'flex-start',
        backgroundColor: mine ? theme.colors.primary : theme.colors.surface,
        borderColor: failed ? theme.colors.danger : theme.colors.border,
        borderWidth: mine && !failed ? 0 : 1,
        borderRadius: theme.radius.lg,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        opacity: state === 'sending' ? 0.7 : 1,
        gap: theme.spacing.xxs,
      }}
    >
      <AppText
        style={{ color: mine ? theme.colors.onPrimary : theme.colors.textPrimary }}
        selectable
      >
        {content}
      </AppText>
      <AppText
        variant="caption"
        style={{
          color: failed
            ? mine
              ? theme.colors.onPrimary
              : theme.colors.danger
            : mine
              ? theme.colors.onPrimary
              : theme.colors.textMuted,
          alignSelf: 'flex-end',
        }}
        testID={testID ? `${testID}-meta` : undefined}
      >
        {meta}
      </AppText>
    </View>
  );

  if (failed && onRetry) {
    return (
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={`Message not sent: ${content}. Tap to retry.`}
        testID={testID}
      >
        {bubble}
      </Pressable>
    );
  }
  return (
    <View testID={testID}>
      {bubble}
      {seen ? (
        <AppText
          variant="caption"
          style={{ color: theme.colors.textMuted, alignSelf: 'flex-end' }}
          testID={testID ? `${testID}-seen` : undefined}
        >
          Seen
        </AppText>
      ) : null}
    </View>
  );
}
