import { Stack } from 'expo-router';

import { useTheme } from '@/providers/ThemeProvider';

export default function ProfileLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
