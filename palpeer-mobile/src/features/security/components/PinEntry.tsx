import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { NumberPad } from '@/components/ui/NumberPad';
import {
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
  PIN_SETUP_LENGTH,
  PinDots,
} from '@/components/ui/PinPad';
import { useTheme } from '@/providers/ThemeProvider';

type Props = {
  title?: string;
  subtitle?: string;
  error?: string | null;
  statusMessage?: string | null;
  submitLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  /** When set, PIN length is fixed (Figma setup / verify uses 4). */
  length?: number;
  /**
   * When true, submit as soon as `length` digits are entered.
   * Proceed stays available above the pad as a fallback.
   */
  autoSubmit?: boolean;
  /** Receives the PIN; the field clears itself so a retry starts empty. */
  onSubmit: (pin: string) => void;
  footer?: ReactNode;
  testID?: string;
};

/**
 * PIN step matching Figma: copy + dots up top, full 3×4 pad pinned to the bottom.
 * Proceed sits above the pad so it never covers or shrinks the keypad.
 */
export function PinEntry({
  title,
  subtitle,
  error,
  statusMessage,
  submitLabel = 'Proceed',
  loading,
  disabled,
  length = PIN_SETUP_LENGTH,
  autoSubmit = false,
  onSubmit,
  footer,
  testID = 'pin-entry',
}: Props) {
  const theme = useTheme();
  const [pin, setPin] = useState('');
  const required = Math.max(PIN_MIN_LENGTH, Math.min(length, PIN_MAX_LENGTH));
  const submittedRef = useRef(false);

  const submit = (value = pin) => {
    if (value.length < required || disabled || loading || submittedRef.current) return;
    submittedRef.current = true;
    setPin('');
    onSubmit(value);
  };

  useEffect(() => {
    if (!loading && !disabled) submittedRef.current = false;
  }, [loading, disabled]);

  useEffect(() => {
    if (!autoSubmit || loading || disabled || submittedRef.current) return;
    if (pin.length === required) submit(pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when length is reached
  }, [autoSubmit, disabled, loading, pin, required]);

  return (
    <View style={styles.root} testID={testID}>
      <View style={[styles.header, { gap: theme.spacing.lg }]}>
        {title || subtitle ? (
          <View style={{ gap: theme.spacing.xs, alignItems: 'center' }}>
            {title ? (
              <AppText variant="h2" align="center" accessibilityRole="header">
                {title}
              </AppText>
            ) : null}
            {subtitle ? (
              <AppText tone="secondary" align="center">
                {subtitle}
              </AppText>
            ) : null}
          </View>
        ) : null}

        <FormAlert message={error} testID={`${testID}-error`} />

        <PinDots
          value={pin}
          slots={required}
          statusMessage={statusMessage}
          testID={`${testID}-pad`}
        />

        {/* Figma PIN screens have no button under the dots — pad fills the bottom.
            Keep Proceed only when the caller needs a manual confirm. */}
        {!autoSubmit ? (
          <Button
            label={submitLabel}
            shape="pill"
            onPress={() => submit()}
            loading={loading}
            loadingLabel="Validating pin"
            disabled={disabled || pin.length < required}
            testID={`${testID}-submit`}
          />
        ) : null}
      </View>

      <View style={styles.spacer} />

      <View style={[styles.padBlock, { gap: theme.spacing.md }]}>
        <NumberPad
          value={pin}
          onChange={setPin}
          maxLength={required}
          bottomLeft="*"
          variant="phone"
          disabled={disabled || loading}
          testID={`${testID}-pad`}
        />
        {footer}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', minHeight: 0 },
  header: { width: '100%', flexShrink: 1 },
  spacer: { flexGrow: 1, flexShrink: 1, minHeight: 16 },
  /** Keep the 3×4 pad at full size; never let the header squeeze it. */
  padBlock: { width: '100%', flexShrink: 0 },
});
