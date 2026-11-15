import { Stack } from 'expo-router';

import { NewUiStackShell } from '@/newui/ui/NewUiStackShell';

export default function P2PLayout() {
  return (
    <NewUiStackShell>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { flex: 1, backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="create" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </NewUiStackShell>
  );
}
