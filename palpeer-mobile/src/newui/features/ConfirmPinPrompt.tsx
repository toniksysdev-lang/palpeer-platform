import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useC } from '@/newui/lib/theme';
import { Btn, Dots, H1, P, PinPad, Txt } from '@/newui/ui/kit';

type Props = {
  title: string;
  message?: string;
  error?: string | null;
  verifying?: boolean;
  blocked?: boolean;
  biometricLabel?: string | null;
  onSubmitPin: (pin: string) => void;
  onBiometric?: () => void;
  onCancel: () => void;
};

/**
 * Newui PIN confirm sheet used by PinPromptProvider
 * (e.g. "Confirm new wallet" when adding a wallet).
 */
export function ConfirmPinPrompt({
  title,
  message,
  error,
  verifying,
  blocked,
  biometricLabel,
  onSubmitPin,
  onBiometric,
  onCancel,
}: Props) {
  const c = useC();
  const [pin, setPin] = useState('');

  const press = (d: string) => {
    if (verifying || blocked) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      onSubmitPin(next);
      setPin('');
    }
  };

  const del = () => {
    if (verifying || blocked) return;
    setPin((p) => p.slice(0, -1));
  };

  return (
    <View
      testID="pin-prompt-entry"
      style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: 16, paddingTop: 12, gap: 12 }}
    >
      <H1>{title}</H1>
      {message ? <P>{message}</P> : null}
      <Dots n={verifying && pin.length === 0 ? 4 : pin.length} />
      {error ? (
        <View testID="pin-prompt-entry-error" accessibilityRole="alert">
          <Txt size={17} w="700" color="red" center role="alert" noTr>
            {error}
          </Txt>
        </View>
      ) : (
        <Txt size={17} w="700" color="text2" center>
          {verifying
            ? 'Checking…'
            : biometricLabel
              ? '4 numbers, or use fingerprint / face'
              : 'Enter your 4-number PIN'}
        </Txt>
      )}
      <View style={{ flex: 1 }} />
      {!blocked ? (
        <PinPad
          testID="pin-prompt-entry"
          onKey={press}
          onDel={del}
          left={
            biometricLabel && onBiometric
              ? { label: 'Finger', onPress: () => void onBiometric() }
              : undefined
          }
        />
      ) : null}
      {biometricLabel && !blocked ? (
        <Btn
          testID="pin-prompt-biometric"
          kind="outline"
          size="mid"
          label={`Use ${biometricLabel}`}
          disabled={!!verifying}
          onPress={() => void onBiometric?.()}
        />
      ) : null}
      <Btn
        testID="pin-prompt-cancel"
        kind={blocked ? 'primary' : 'link'}
        size="mid"
        label={blocked ? 'Close' : 'Cancel'}
        disabled={!!verifying}
        onPress={onCancel}
      />
      {blocked ? (
        <Btn kind="outline" size="mid" label="Reset your PIN" onPress={() => router.push('/PinReset')} />
      ) : (
        <Btn kind="link" label="Forgot your PIN?" onPress={() => router.push('/PinReset')} />
      )}
    </View>
  );
}
