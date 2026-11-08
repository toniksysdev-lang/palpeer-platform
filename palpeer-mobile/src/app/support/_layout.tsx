import { Stack } from 'expo-router';

import { SIMPLE_HOME } from '@/design/simpleHomeTokens';

export default function SupportLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: SIMPLE_HOME.page },
      }}
    />
  );
}
