import { Stack } from 'expo-router';

import { NewUiProviders } from '@/newui/providers';
import { useC } from '@/newui/lib/theme';

function TransactionStack() {
  const c = useC();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: c.bg },
      }}
    />
  );
}

/** Transaction receipt (Messages → See details) uses newui kit. */
export default function TransactionLayout() {
  return (
    <NewUiProviders>
      <TransactionStack />
    </NewUiProviders>
  );
}
