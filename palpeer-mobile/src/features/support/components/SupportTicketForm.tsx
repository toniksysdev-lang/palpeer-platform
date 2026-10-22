import { useState } from 'react';
import { Linking, View } from 'react-native';

import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/providers/ThemeProvider';
import {
  createPublicTicket,
  supportTicketTrackingUrl,
  type CreatePublicTicketResponse,
} from '@/services/supportChat/supportChatApi';

export type SupportTicketPrefill = {
  fullName?: string | null;
  email?: string | null;
  subject?: string | null;
};

type Props = {
  prefill?: SupportTicketPrefill;
  onSubmitted?: (ticket: CreatePublicTicketResponse) => void;
  testID?: string;
};

const MIN_DESCRIPTION = 10;

/** Basic public ticket form → `POST /api/publictickets` on app.palpeer.com.ng. */
export function SupportTicketForm({ prefill, onSubmitted, testID = 'support-ticket-form' }: Props) {
  const theme = useTheme();
  // Name/email stay hidden — taken from the signed-in session and sent with the ticket.
  const fullName = prefill?.fullName?.trim() || 'Palpeer user';
  const email = prefill?.email?.trim() ?? '';
  const [subject, setSubject] = useState(prefill?.subject?.trim() ?? 'Support request from chat');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatePublicTicketResponse | null>(null);

  const submit = async () => {
    setError(null);
    if (!email || !email.includes('@')) {
      setError('Sign in so we can attach your account email to this ticket.');
      return;
    }
    if (!subject.trim()) {
      setError('Please enter a subject.');
      return;
    }
    if (!description.trim() || description.trim().length < MIN_DESCRIPTION) {
      setError(`Please enter a description (minimum ${MIN_DESCRIPTION} characters).`);
      return;
    }

    setSubmitting(true);
    try {
      const created = await createPublicTicket({
        fullName,
        email,
        subject,
        description,
        source: 'AIChat',
      });
      if (!created.ok) {
        setError(created.error);
        return;
      }
      setResult(created.data);
      onSubmitted?.(created.data);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const trackUrl = supportTicketTrackingUrl(result);
    return (
      <View
        style={{
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surface,
        }}
        testID={`${testID}-success`}
      >
        <AppText variant="bodyStrong">Ticket submitted</AppText>
        <AppText tone="secondary">
          {result.ticketNumber
            ? `Your ticket number is ${result.ticketNumber}. Our team will follow up by email.`
            : 'Your support ticket was submitted. Our team will follow up by email.'}
        </AppText>
        {trackUrl ? (
          <Button
            label="Track ticket"
            variant="outline"
            size="md"
            onPress={() => void Linking.openURL(trackUrl)}
            testID={`${testID}-track`}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={{
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
      }}
      testID={testID}
    >
      <AppText variant="bodyStrong">Support ticket</AppText>
      <AppText variant="caption" tone="secondary">
        No live agent is online. Leave a ticket and our team will follow up.
      </AppText>
      <Input
        label="Subject"
        value={subject}
        onChangeText={setSubject}
        testID={`${testID}-subject`}
      />
      <Input
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        hint={`At least ${MIN_DESCRIPTION} characters`}
        testID={`${testID}-description`}
      />
      {error ? <FormAlert tone="danger" message={error} testID={`${testID}-error`} /> : null}
      <Button
        label="Submit ticket"
        onPress={() => void submit()}
        loading={submitting}
        loadingLabel="Submitting…"
        disabled={submitting}
        testID={`${testID}-submit`}
      />
    </View>
  );
}
