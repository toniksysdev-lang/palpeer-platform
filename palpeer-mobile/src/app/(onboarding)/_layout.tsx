import { Stack } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'welcome',
};

/**
 * Single signed-out group: Welcome is the initial route so Login cannot win
 * alphabetically among sibling auth screens.
 */
export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" options={{ animation: 'fade' }} />
      <Stack.Screen name="enter-phone" />
      <Stack.Screen name="verify-phone" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
