import { Stack } from 'expo-router';

import { useTheme } from '@/providers/ThemeProvider';

export default function P2PLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="create" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
