import { Stack } from 'expo-router';

import { useTheme } from '@/providers/ThemeProvider';

export default function ExchangeLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="[exchangeId]" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
