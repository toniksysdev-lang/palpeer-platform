import { Eye, EyeOff } from 'lucide-react-native';
import { forwardRef, useState } from 'react';
import { Pressable, type TextInput } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

import { Icon } from './Icon';
import { Input, type InputProps } from './Input';

export const PasswordInput = forwardRef<TextInput, Omit<InputProps, 'secureTextEntry' | 'right'>>(
  function PasswordInput(props, ref) {
    const theme = useTheme();
    const [visible, setVisible] = useState(false);

    return (
      <Input
        ref={ref}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password"
        textContentType="password"
        {...props}
        secureTextEntry={!visible}
        right={
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          >
            <Icon icon={visible ? EyeOff : Eye} size="md" color={theme.colors.textMuted} />
          </Pressable>
        }
      />
    );
  },
);
