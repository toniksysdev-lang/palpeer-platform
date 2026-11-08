import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { FormAlert } from '@/components/feedback/FormAlert';
import { Input } from '@/components/ui/Input';
import { SIMPLE_HOME as D } from '@/design/simpleHomeTokens';
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
      <View style={styles.card} testID={`${testID}-success`}>
        <Text style={styles.heading}>Ticket submitted</Text>
        <Text style={styles.note}>
          {result.ticketNumber
            ? `Your ticket number is ${result.ticketNumber}. Our team will follow up by email.`
            : 'Your support ticket was submitted. Our team will follow up by email.'}
        </Text>
        {trackUrl ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Track ticket"
            onPress={() => void Linking.openURL(trackUrl)}
            testID={`${testID}-track`}
            style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
          >
            <Text style={styles.outlineBtnLabel}>Track ticket</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.heading}>Support ticket</Text>
      <Text style={styles.note}>No live agent is online. Leave a ticket and our team will follow up.</Text>
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Submit ticket"
        accessibilityState={{ disabled: submitting, busy: submitting }}
        disabled={submitting}
        onPress={() => void submit()}
        testID={`${testID}-submit`}
        style={({ pressed }) => [
          styles.primaryBtn,
          submitting && styles.primaryBtnDisabled,
          pressed && !submitting && styles.pressed,
        ]}
      >
        <Text style={styles.primaryBtnLabel}>{submitting ? 'Submitting…' : 'Submit ticket'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 14,
    borderWidth: 2,
    borderColor: D.inputBorder,
    borderRadius: 18,
    backgroundColor: D.page,
  },
  heading: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 18,
    fontWeight: '800',
    color: D.ink,
  },
  note: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 15,
    fontWeight: '600',
    color: D.secondary,
    lineHeight: 20,
  },
  pressed: { opacity: 0.88 },
  outlineBtn: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: D.green,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  outlineBtnLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 16,
    fontWeight: '800',
    color: D.green,
  },
  primaryBtn: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: D.green,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryBtnDisabled: {
    backgroundColor: D.greenDisabled,
  },
  primaryBtnLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 18,
    fontWeight: '800',
    color: D.white,
  },
});
