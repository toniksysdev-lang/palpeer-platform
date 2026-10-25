import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { useSensitiveScreen } from '@/hooks/useSensitiveScreen';
import { useToast } from '@/providers/ToastProvider';
import { baseApi } from '@/services/api/baseApi';
import { buildRegistration } from '@/services/biometrics/deviceRegistration';
import { securityCommands } from '@/services/security/securityCommands';
import { useAppDispatch, useAppSelector } from '@/store';

import { PinEntry } from '../components/PinEntry';
import { markDeviceVerifiedForSession } from '../deviceSession';
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
  const userId = useAppSelector((state) => state.session.userId);
  const { required, returnTo } = useLocalSearchParams<{ required?: string; returnTo?: string }>();
  const mustSet = required === '1';
  const [step, setStep] = useState<Step>({ name: 'enter' });
  const [saving, setSaving] = useState(false);

  const finish = () => {
    toast.show({ type: 'success', title: 'Transaction PIN set' });
    // PIN reset depends on security questions — collect them before returning to the app.
    router.replace({
      pathname: '/security/questions',
      params: {
        required: '1',
        ...(returnTo && typeof returnTo === 'string' ? { returnTo } : {}),
      },
    });
  };

  const save = async (pin: string) => {
    setSaving(true);
    setStep({ name: 'confirm', pin, validating: true });
    const result = await securityCommands.setPin({ pin });
    setSaving(false);
    dispatch(baseApi.util.invalidateTags([{ type: 'Security', id: 'PIN' }]));
    if (result.ok) {
      // First-time PIN on this install counts as device confirmation for this session.
      if (userId) markDeviceVerifiedForSession(userId);
      void buildRegistration().then((registration) =>
        securityCommands.registerDevice(registration),
      );
      finish();
      return;
    }
    setStep({ name: 'enter', error: securityErrorMessage(result.error) });
  };

  const title = step.name === 'enter' ? 'Set Your Pin' : 'Confirm Your Pin';

  return (
    <Screen edges={['top', 'bottom']}>
      {mustSet ? (
        <View style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="h3" accessibilityRole="header">
            {title}
          </AppText>
        </View>
      ) : (
        <StackHeader title={title} />
      )}
      {step.name === 'enter' ? (
        <PinEntry
          key="enter"
          subtitle={PIN_COPY}
          error={step.error}
          autoSubmit
          onSubmit={(pin) => setStep({ name: 'confirm', pin })}
          testID="set-pin-enter"
        />
      ) : (
        <PinEntry
          key="confirm"
          subtitle={PIN_COPY}
          statusMessage={step.validating || saving ? 'Validating pin' : null}
          loading={saving}
          autoSubmit
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
