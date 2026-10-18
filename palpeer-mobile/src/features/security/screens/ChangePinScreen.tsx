import { router } from 'expo-router';
import { useState } from 'react';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { useSensitiveScreen } from '@/hooks/useSensitiveScreen';
import { FormAlert } from '@/components/feedback/FormAlert';
import { Button } from '@/components/ui/Button';
import { TextLink } from '@/components/ui/TextLink';
import { useToast } from '@/providers/ToastProvider';
import { baseApi } from '@/services/api/baseApi';
import { useGetPinStatusQuery } from '@/services/api/securityApi';
import { securityCommands } from '@/services/security/securityCommands';
import { useAppDispatch } from '@/store';

import { PinEntry } from '../components/PinEntry';
import { isPinLocked, pinLockedMessage, securityErrorMessage } from '../errors';

type Step =
  | { name: 'current'; error?: string }
  | { name: 'new'; currentPin: string }
  | { name: 'confirm'; currentPin: string; newPin: string }
  | { name: 'locked' };

export function ChangePinScreen() {
  useSensitiveScreen();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const status = useGetPinStatusQuery();
  const [step, setStep] = useState<Step>({ name: 'current' });
  const [saving, setSaving] = useState(false);

  const lockedUntil = status.data?.lockedUntil ?? null;
  const locked = step.name === 'locked' || !!lockedUntil;

  const save = async (currentPin: string, newPin: string) => {
    setSaving(true);
    const result = await securityCommands.changePin({ currentPin, newPin });
    setSaving(false);
    dispatch(baseApi.util.invalidateTags([{ type: 'Security', id: 'PIN' }]));
    if (result.ok) {
      toast.show({ type: 'success', title: 'Transaction PIN changed' });
      router.back();
      return;
    }
    if (isPinLocked(result.error)) {
      setStep({ name: 'locked' });
    } else if (result.error.code === 'PIN_INVALID') {
      setStep({ name: 'current', error: 'Your current PIN is incorrect.' });
    } else {
      setStep({ name: 'current', error: securityErrorMessage(result.error) });
    }
  };

  if (locked) {
    return (
      <Screen
        footer={<Button label="Back to security" variant="outline" onPress={() => router.back()} />}
      >
        <StackHeader title="Change PIN" />
        <FormAlert message={pinLockedMessage(lockedUntil)} testID="change-pin-locked" />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <StackHeader />
      {step.name === 'current' ? (
        <PinEntry
          key="current"
          title="Enter your current PIN"
          error={step.error}
          autoSubmit
          onSubmit={(currentPin) => setStep({ name: 'new', currentPin })}
          footer={
            <TextLink
              label="Forgot your PIN?"
              align="center"
              onPress={() => router.replace('/security/pin/forgot')}
            />
          }
          testID="change-pin-current"
        />
      ) : step.name === 'new' ? (
        <PinEntry
          key="new"
          title="Choose a new PIN"
          subtitle="4 to 8 digits."
          onSubmit={(newPin) => setStep({ name: 'confirm', currentPin: step.currentPin, newPin })}
          testID="change-pin-new"
        />
      ) : (
        <PinEntry
          key="confirm"
          title="Confirm your new PIN"
          submitLabel="Change PIN"
          loading={saving}
          onSubmit={(pin) => {
            if (pin !== step.newPin) {
              setStep({ name: 'new', currentPin: step.currentPin });
              toast.show({ type: 'error', title: "The new PINs didn't match" });
              return;
            }
            void save(step.currentPin, step.newPin);
          }}
          testID="change-pin-confirm"
        />
      )}
    </Screen>
  );
}
