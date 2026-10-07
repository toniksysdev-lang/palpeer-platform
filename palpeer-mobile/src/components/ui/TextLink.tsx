import { Pressable } from 'react-native';

import { AppText } from './AppText';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  align?: 'left' | 'center' | 'right';
  tone?: 'brand' | 'info';
  testID?: string;
};

export function TextLink({ label, onPress, disabled, align, tone = 'brand', testID }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="link"
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={{
        alignSelf: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      <AppText variant="bodyStrong" tone={disabled ? 'muted' : tone}>
        {label}
      </AppText>
    </Pressable>
  );
}
