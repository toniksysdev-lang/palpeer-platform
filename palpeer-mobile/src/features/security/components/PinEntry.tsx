import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import {
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
  PIN_SETUP_LENGTH,
  PinPad,
} from '@/components/ui/PinPad';
import { useTheme } from '@/providers/ThemeProvider';

type Props = {
  title: string;
  subtitle?: string;
  error?: string | null;
  statusMessage?: string | null;
  submitLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  /** When set, PIN length is fixed (Figma setup uses 4). */
  length?: number;
  /** Receives the PIN; the pad clears itself so a retry starts empty. */
  onSubmit: (pin: string) => void;
  footer?: ReactNode;
  testID?: string;
};

/** One PIN step: heading, circular slots + flat keypad, and Proceed. */
export function PinEntry({
  title,
  subtitle,
  error,
  statusMessage,
  submitLabel = 'Proceed',
  loading,
  disabled,
  length = PIN_SETUP_LENGTH,
  onSubmit,
  footer,
  testID = 'pin-entry',
}: Props) {
  const theme = useTheme();
  const [pin, setPin] = useState('');
  const required = Math.max(PIN_MIN_LENGTH, Math.min(length, PIN_MAX_LENGTH));

  const submit = () => {
    if (pin.length < required) return;
    const value = pin;
    setPin('');
    onSubmit(value);
  };

  return (
    <View style={{ gap: theme.spacing.xl, flex: 1 }} testID={testID}>
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
        maxLength={required}
        slots={required}
        disabled={disabled || loading}
        statusMessage={statusMessage}
        testID={`${testID}-pad`}
      />
      <Button
        label={submitLabel}
        shape="pill"
        onPress={submit}
        loading={loading}
        loadingLabel="Validating pin"
        disabled={disabled || pin.length < required}
        testID={`${testID}-submit`}
      />
      {footer}
    </View>
  );
}
