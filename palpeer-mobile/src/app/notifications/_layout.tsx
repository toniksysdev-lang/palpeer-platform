import { Stack } from 'expo-router';

import { NewUiProviders } from '@/newui/providers';
import { useC } from '@/newui/lib/theme';

function NotificationsStack() {
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

/** Notification inbox / detail use newui kit. */
export default function NotificationsLayout() {
  return (
    <NewUiProviders>
      <NotificationsStack />
    </NewUiProviders>
  );
}
