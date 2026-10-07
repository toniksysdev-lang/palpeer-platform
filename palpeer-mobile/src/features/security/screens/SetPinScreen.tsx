import { router } from 'expo-router';
import { useState } from 'react';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { useSensitiveScreen } from '@/hooks/useSensitiveScreen';
import { useToast } from '@/providers/ToastProvider';
import { baseApi } from '@/services/api/baseApi';
import { securityCommands } from '@/services/security/securityCommands';
import { useAppDispatch } from '@/store';

import { PinEntry } from '../components/PinEntry';
import { securityErrorMessage } from '../errors';

type Step = { name: 'enter'; error?: string } | { name: 'confirm'; pin: string };

export function SetPinScreen() {
  useSensitiveScreen();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const [step, setStep] = useState<Step>({ name: 'enter' });
  const [saving, setSaving] = useState(false);

  const save = async (pin: string) => {
    setSaving(true);
    const result = await securityCommands.setPin({ pin });
    setSaving(false);
    dispatch(baseApi.util.invalidateTags([{ type: 'Security', id: 'PIN' }]));
    if (result.ok) {
      toast.show({ type: 'success', title: 'Transaction PIN set' });
      router.back();
      return;
    }
    setStep({ name: 'enter', error: securityErrorMessage(result.error) });
  };

  return (
    <Screen scroll>
      <StackHeader />
      {step.name === 'enter' ? (
        <PinEntry
          key="enter"
          title="Create a transaction PIN"
          subtitle="Choose 4 to 8 digits. Avoid birthdays or repeated numbers."
          error={step.error}
          onSubmit={(pin) => setStep({ name: 'confirm', pin })}
          testID="set-pin-enter"
        />
      ) : (
        <PinEntry
          key="confirm"
          title="Confirm your PIN"
          subtitle="Enter the same PIN again."
          submitLabel="Set PIN"
          loading={saving}
          onSubmit={(pin) => {
            if (pin !== step.pin) {
              setStep({ name: 'enter', error: "The PINs didn't match. Start again." });
              return;
            }
            void save(pin);
          }}
          testID="set-pin-confirm"
        />
      )}
    </Screen>
  );
}
