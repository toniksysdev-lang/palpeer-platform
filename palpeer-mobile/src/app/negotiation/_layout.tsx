import { Stack } from 'expo-router';

import { useTheme } from '@/providers/ThemeProvider';

export default function NegotiationLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="offer" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
