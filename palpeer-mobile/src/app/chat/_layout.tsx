import { Stack } from 'expo-router';

import { NewUiStackShell } from '@/newui/ui/NewUiStackShell';

export default function ChatLayout() {
  return (
    <NewUiStackShell>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { flex: 1, backgroundColor: 'transparent' },
        }}
      />
    </NewUiStackShell>
  );
}
