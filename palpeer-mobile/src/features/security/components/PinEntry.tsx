import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH, PinPad } from '@/components/ui/PinPad';
import { useTheme } from '@/providers/ThemeProvider';

type Props = {
  title: string;
  subtitle?: string;
  error?: string | null;
  submitLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  /** Receives the PIN; the pad clears itself so a retry starts empty. */
  onSubmit: (pin: string) => void;
  footer?: ReactNode;
  testID?: string;
};

/** One PIN step: heading, dots + keypad, and Continue once 4–8 digits are entered. */
export function PinEntry({
  title,
  subtitle,
  error,
  submitLabel = 'Continue',
  loading,
  disabled,
  onSubmit,
  footer,
  testID = 'pin-entry',
}: Props) {
  const theme = useTheme();
  const [pin, setPin] = useState('');

  const submit = () => {
    if (pin.length < PIN_MIN_LENGTH) return;
    const value = pin;
    setPin('');
    onSubmit(value);
  };

  return (
    <View style={{ gap: theme.spacing.xl }} testID={testID}>
      <View style={{ gap: theme.spacing.xs, alignItems: 'center' }}>
        <AppText variant="h2" align="center" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText tone="secondary" align="center">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <FormAlert message={error} testID={`${testID}-error`} />
      <PinPad
        value={pin}
        onChange={setPin}
        maxLength={PIN_MAX_LENGTH}
        disabled={disabled || loading}
        testID={`${testID}-pad`}
      />
      <Button
        label={submitLabel}
        onPress={submit}
        loading={loading}
        loadingLabel="Checking…"
        disabled={disabled || pin.length < PIN_MIN_LENGTH}
        testID={`${testID}-submit`}
      />
      {footer}
    </View>
  );
}
