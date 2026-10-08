import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { useSensitiveScreen } from '@/hooks/useSensitiveScreen';
import { useToast } from '@/providers/ToastProvider';
import { baseApi } from '@/services/api/baseApi';
import { securityCommands } from '@/services/security/securityCommands';
import { useAppDispatch } from '@/store';

import { PinEntry } from '../components/PinEntry';
import { securityErrorMessage } from '../errors';

const PIN_COPY =
  "Set up your 4 digit pin to make your account more secure. You'll be asked to enter this pin when making transcations.";

type Step =
  | { name: 'enter'; error?: string }
  | { name: 'confirm'; pin: string; validating?: boolean };

export function SetPinScreen() {
  useSensitiveScreen();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const { required } = useLocalSearchParams<{ required?: string }>();
  const mustSet = required === '1';
  const [step, setStep] = useState<Step>({ name: 'enter' });
  const [saving, setSaving] = useState(false);

  const finish = () => {
    toast.show({ type: 'success', title: 'Transaction PIN set' });
    if (mustSet) {
      router.replace('/');
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  };

  const save = async (pin: string) => {
    setSaving(true);
    setStep({ name: 'confirm', pin, validating: true });
    const result = await securityCommands.setPin({ pin });
    setSaving(false);
    dispatch(baseApi.util.invalidateTags([{ type: 'Security', id: 'PIN' }]));
    if (result.ok) {
      finish();
      return;
    }
    setStep({ name: 'enter', error: securityErrorMessage(result.error) });
  };

  return (
    <Screen scroll>
      {mustSet ? <View style={{ height: 44 }} /> : <StackHeader />}
      {step.name === 'enter' ? (
        <PinEntry
          key="enter"
          title="Set Your Pin"
          subtitle={PIN_COPY}
          submitLabel="Proceed"
          error={step.error}
          onSubmit={(pin) => setStep({ name: 'confirm', pin })}
          testID="set-pin-enter"
        />
      ) : (
        <PinEntry
          key="confirm"
          title="Confirm Your Pin"
          subtitle={PIN_COPY}
          submitLabel="Proceed"
          statusMessage={step.validating || saving ? 'Validating pin' : null}
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
