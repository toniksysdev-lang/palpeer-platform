import { Redirect } from 'expo-router';

import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { useAppSelector } from '@/store';

/**
 * App entry at `/`. Signed-out users see Welcome here directly so Login cannot win as the
 * alphabetical default among protected groups.
 */
export default function Index() {
  const isAuthenticated = useAppSelector((state) => state.session.status === 'authenticated');
  if (isAuthenticated) return <Redirect href="/(tabs)" />;
  return <OnboardingScreen />;
}
