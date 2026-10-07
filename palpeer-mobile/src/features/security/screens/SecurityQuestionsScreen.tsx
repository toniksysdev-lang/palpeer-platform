import { Check, ChevronDown, HelpCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { useSensitiveScreen } from '@/hooks/useSensitiveScreen';
import { FormAlert } from '@/components/feedback/FormAlert';
import { ErrorState } from '@/components/feedback/StateViews';
import { AppText } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { baseApi } from '@/services/api/baseApi';
import { toAppError } from '@/services/api/errors';
import { useGetPinStatusQuery, useGetSecurityQuestionsQuery } from '@/services/api/securityApi';
import { securityCommands } from '@/services/security/securityCommands';
import { useAppDispatch } from '@/store';

import { securityErrorMessage } from '../errors';
import { usePinPrompt } from '../PinPromptProvider';
import {
  SECURITY_ANSWER_MAX,
  SECURITY_QUESTION_CATALOGUE,
  SECURITY_QUESTION_COUNT,
} from '../questionCatalogue';

type Slot = { questionKey: string | null; answer: string };

const emptySlots = (): Slot[] =>
  Array.from({ length: SECURITY_QUESTION_COUNT }, () => ({ questionKey: null, answer: '' }));

export function SecurityQuestionsScreen() {
  useSensitiveScreen();
  const theme = useTheme();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const { requestPin } = usePinPrompt();
  const questions = useGetSecurityQuestionsQuery();
  const pinStatus = useGetPinStatusQuery();
  const [editing, setEditing] = useState(false);
  const [slots, setSlots] = useState<Slot[]>(emptySlots);
  const [picking, setPicking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const header = <StackHeader title="Security questions" />;

  if (questions.error && !questions.data) {
    return (
      <Screen>
        {header}
        <ErrorState error={toAppError(questions.error)} onRetry={() => void questions.refetch()} />
      </Screen>
    );
  }

  if (!questions.data) {
    return (
      <Screen>
        {header}
        <Skeleton height={64} />
        <Skeleton height={64} />
      </Screen>
    );
  }

  const configured = questions.data;

  if (!editing && configured.length > 0) {
    return (
      <Screen
        scroll
        footer={
          <Button
            label="Change questions"
            variant="outline"
            onPress={() => setEditing(true)}
            testID="questions-change"
          />
        }
      >
        {header}
        <AppText tone="secondary">
          These questions let you reset your transaction PIN if you forget it. Answers are never
          shown.
        </AppText>
        <View style={{ gap: theme.spacing.sm }} testID="questions-configured">
          {configured.map((question) => (
            <Card key={question.id} variant="outlined" padding="md">
              <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
                <Icon icon={Check} color={theme.colors.success} />
                <AppText style={{ flex: 1 }}>{question.questionText}</AppText>
              </View>
            </Card>
          ))}
        </View>
      </Screen>
    );
  }

  const chosen = slots.map((slot) => slot.questionKey);
  const complete = slots.every((slot) => slot.questionKey && slot.answer.trim().length > 0);

  const save = async () => {
    setError(null);
    if (!pinStatus.data) {
      setError("We couldn't check your PIN status. Try again.");
      void pinStatus.refetch();
      return;
    }
    if (pinStatus.data.pinSet) {
      const confirmed = await requestPin({
        title: 'Confirm with your PIN',
        message: 'Changing your security questions changes how your PIN can be reset.',
      });
      if (!confirmed) return;
    }
    setSaving(true);
    const result = await securityCommands.setQuestions({
      questions: slots.map((slot) => {
        const entry = SECURITY_QUESTION_CATALOGUE.find(
          (item) => item.questionKey === slot.questionKey,
        );
        return {
          questionKey: entry?.questionKey ?? '',
          questionText: entry?.questionText ?? '',
          answer: slot.answer.trim(),
        };
      }),
    });
    setSaving(false);
    if (result.ok) {
      setSlots(emptySlots());
      setEditing(false);
      dispatch(baseApi.util.invalidateTags([{ type: 'Security', id: 'QUESTIONS' }]));
      toast.show({ type: 'success', title: 'Security questions saved' });
      return;
    }
    setError(securityErrorMessage(result.error));
  };

  return (
    <Screen
      scroll
      keyboardAware
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label="Save questions"
            onPress={() => void save()}
            loading={saving}
            disabled={!complete}
            testID="questions-save"
          />
          {configured.length > 0 ? (
            <Button
              label="Cancel"
              variant="ghost"
              onPress={() => {
                setSlots(emptySlots());
                setError(null);
                setEditing(false);
              }}
              disabled={saving}
            />
          ) : null}
        </View>
      }
    >
      {header}
      <AppText tone="secondary">
        Choose {SECURITY_QUESTION_COUNT} questions only you can answer. You&apos;ll need these
        answers to reset your transaction PIN. Answers aren&apos;t case-sensitive.
      </AppText>
      {configured.length > 0 ? (
        <FormAlert
          tone="info"
          message="Saving replaces your current questions and answers."
          testID="questions-replace-note"
        />
      ) : null}
      <FormAlert message={error} testID="questions-error" />
      {slots.map((slot, index) => {
        const entry = SECURITY_QUESTION_CATALOGUE.find(
          (item) => item.questionKey === slot.questionKey,
        );
        return (
          <View key={index} style={{ gap: theme.spacing.sm }}>
            <AppText variant="overline" tone="muted">
              Question {index + 1}
            </AppText>
            <Pressable
              onPress={() => setPicking(index)}
              accessibilityRole="button"
              accessibilityLabel={
                entry
                  ? `Question ${index + 1}: ${entry.questionText}`
                  : `Choose question ${index + 1}`
              }
              testID={`questions-pick-${index}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                padding: theme.spacing.md,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.borderStrong,
              }}
            >
              <Icon icon={HelpCircle} color={theme.colors.primary} />
              <AppText style={{ flex: 1 }} tone={entry ? 'primary' : 'muted'}>
                {entry?.questionText ?? 'Choose a question'}
              </AppText>
              <Icon icon={ChevronDown} color={theme.colors.textMuted} />
            </Pressable>
            <Input
              label="Answer"
              value={slot.answer}
              onChangeText={(text) =>
                setSlots((current) =>
                  current.map((item, i) => (i === index ? { ...item, answer: text } : item)),
                )
              }
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              importantForAutofill="no"
              maxLength={SECURITY_ANSWER_MAX}
              testID={`questions-answer-${index}`}
            />
          </View>
        );
      })}

      <BottomSheet
        visible={picking !== null}
        onClose={() => setPicking(null)}
        title="Choose a question"
        testID="questions-sheet"
      >
        <View style={{ gap: theme.spacing.xs }}>
          {SECURITY_QUESTION_CATALOGUE.map((item) => {
            const takenElsewhere = chosen.some(
              (key, index) => key === item.questionKey && index !== picking,
            );
            return (
              <Pressable
                key={item.questionKey}
                disabled={takenElsewhere}
                onPress={() => {
                  setSlots((current) =>
                    current.map((slot, index) =>
                      index === picking ? { ...slot, questionKey: item.questionKey } : slot,
                    ),
                  );
                  setPicking(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ disabled: takenElsewhere }}
                testID={`questions-option-${item.questionKey}`}
                style={{ paddingVertical: theme.spacing.md, opacity: takenElsewhere ? 0.4 : 1 }}
              >
                <AppText>{item.questionText}</AppText>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </Screen>
  );
}
