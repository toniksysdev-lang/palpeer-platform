import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { useSensitiveScreen } from '@/hooks/useSensitiveScreen';
import { FormAlert } from '@/components/feedback/FormAlert';
import { ErrorState } from '@/components/feedback/StateViews';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { baseApi } from '@/services/api/baseApi';
import { toAppError, type AppError } from '@/services/api/errors';
import { useGetPinStatusQuery, useGetSecurityQuestionsQuery } from '@/services/api/securityApi';
import { securityCommands } from '@/services/security/securityCommands';
import { useAppDispatch } from '@/store';
import type { SecurityAnswer } from '@/types/api/security';

import { PinEntry } from '../components/PinEntry';
import { isPinLocked, pinLockedMessage, securityErrorMessage } from '../errors';

type Step =
  | { name: 'answers'; error?: string }
  | { name: 'new'; answers: SecurityAnswer[] }
  | { name: 'confirm'; answers: SecurityAnswer[]; newPin: string }
  | { name: 'locked' };

/** PIN reset with the user's security-question answers (the only reset factor, P3-04). */
export function ForgotPinScreen() {
  useSensitiveScreen();
  const theme = useTheme();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const status = useGetPinStatusQuery();
  const questions = useGetSecurityQuestionsQuery();
  const [step, setStep] = useState<Step>({ name: 'answers' });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const header = <StackHeader title="Reset PIN" />;
  const loadError = status.error ?? questions.error;

  if (loadError && !(status.data && questions.data)) {
    return (
      <Screen>
        {header}
        <ErrorState
          error={toAppError(loadError)}
          onRetry={() => {
            void status.refetch();
            void questions.refetch();
          }}
        />
      </Screen>
    );
  }

  if (!status.data || !questions.data) {
    return (
      <Screen>
        {header}
        <Skeleton height={56} />
        <Skeleton height={56} />
      </Screen>
    );
  }

  if (!status.data.pinSet) {
    return (
      <Screen
        footer={<Button label="Set a PIN" onPress={() => router.replace('/security/pin/set')} />}
      >
        {header}
        <FormAlert
          tone="info"
          message="You haven't set a transaction PIN yet."
          testID="forgot-no-pin"
        />
      </Screen>
    );
  }

  if (questions.data.length === 0) {
    return (
      <Screen
        footer={
          <View style={{ gap: theme.spacing.sm }}>
            <Button
              label="Set up security questions"
              onPress={() => router.replace('/security/questions')}
              testID="forgot-setup-questions"
            />
            <Button label="Back" variant="outline" onPress={() => router.back()} />
          </View>
        }
      >
        {header}
        <FormAlert
          tone="warning"
          message="Resetting your PIN needs security questions, and you haven't set any up yet. Set them now, then return here to choose a new PIN."
          testID="forgot-no-questions"
        />
      </Screen>
    );
  }

  const answersLockedUntil = status.data.securityAnswersLockedUntil ?? null;
  if (step.name === 'locked' || answersLockedUntil) {
    return (
      <Screen footer={<Button label="Back" variant="outline" onPress={() => router.back()} />}>
        {header}
        <FormAlert message={pinLockedMessage(answersLockedUntil)} testID="forgot-locked" />
      </Screen>
    );
  }

  const configured = questions.data;
  const complete = configured.every((question) => (answers[question.questionKey] ?? '').trim());

  const handleAnswerFailure = (error: AppError) => {
    dispatch(baseApi.util.invalidateTags([{ type: 'Security', id: 'PIN' }]));
    if (isPinLocked(error)) {
      setAnswers({});
      setStep({ name: 'locked' });
      return;
    }
    const code = error.code;
    if (code === 'SECURITY_ANSWER_MISSING' || code === 'SECURITY_ANSWER_UNKNOWN') {
      setAnswers({});
      void questions.refetch();
    }
    setStep({ name: 'answers', error: securityErrorMessage(error) });
  };

  const continueWithAnswers = async () => {
    const collected: SecurityAnswer[] = configured.map((question) => ({
      questionKey: question.questionKey,
      answer: (answers[question.questionKey] ?? '').trim(),
    }));
    if (collected.some((item) => !item.answer)) return;

    setSaving(true);
    const result = await securityCommands.verifyAnswers({ answers: collected });
    setSaving(false);
    if (!result.ok) {
      handleAnswerFailure(result.error);
      return;
    }
    setStep({ name: 'new', answers: collected });
  };

  const reset = async (collected: SecurityAnswer[], newPin: string) => {
    setSaving(true);
    const result = await securityCommands.resetPin({ answers: collected, newPin });
    setSaving(false);
    dispatch(baseApi.util.invalidateTags([{ type: 'Security', id: 'PIN' }]));
    if (result.ok) {
      setAnswers({});
      toast.show({ type: 'success', title: 'Your PIN has been reset' });
      router.back();
      return;
    }
    handleAnswerFailure(result.error);
  };

  if (step.name === 'new' || step.name === 'confirm') {
    return (
      <Screen edges={['top', 'bottom']}>
        <StackHeader onBack={() => setStep({ name: 'answers' })} />
        {step.name === 'new' ? (
          <PinEntry
            key="new"
            title="Choose a new PIN"
            subtitle="4 to 8 digits."
            onSubmit={(newPin) => setStep({ name: 'confirm', answers: step.answers, newPin })}
            testID="forgot-new"
          />
        ) : (
          <PinEntry
            key="confirm"
            title="Confirm your new PIN"
            submitLabel="Reset PIN"
            loading={saving}
            onSubmit={(pin) => {
              if (pin !== step.newPin) {
                setStep({ name: 'new', answers: step.answers });
                toast.show({ type: 'error', title: "The new PINs didn't match" });
                return;
              }
              void reset(step.answers, step.newPin);
            }}
            testID="forgot-confirm"
          />
        )}
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      keyboardAware
      footer={
        <Button
          label="Continue"
          disabled={!complete || saving}
          loading={saving}
          loadingLabel="Checking…"
          onPress={() => void continueWithAnswers()}
          testID="forgot-answers-continue"
        />
      }
    >
      {header}
      <AppText tone="secondary">
        Answer your security questions to choose a new PIN. Wrong answers count towards the PIN
        lock.
      </AppText>
      <FormAlert message={step.error} testID="forgot-answers-error" />
      <View style={{ gap: theme.spacing.md }}>
        {configured.map((question, index) => (
          <Input
            key={question.id}
            label={question.questionText}
            value={answers[question.questionKey] ?? ''}
            onChangeText={(text) =>
              setAnswers((current) => ({ ...current, [question.questionKey]: text }))
            }
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            importantForAutofill="no"
            maxLength={200}
            testID={`forgot-answer-${index}`}
          />
        ))}
      </View>
    </Screen>
  );
}
