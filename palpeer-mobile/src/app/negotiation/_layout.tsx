import { Stack } from 'expo-router';

import { NewUiStackShell } from '@/newui/ui/NewUiStackShell';

export default function NegotiationLayout() {
  return (
    <NewUiStackShell>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { flex: 1, backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="offer" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </NewUiStackShell>
  );
}
