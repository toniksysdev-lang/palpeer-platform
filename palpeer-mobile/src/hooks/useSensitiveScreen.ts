import { usePreventScreenCapture } from 'expo-screen-capture';
import { useId } from 'react';

/**
 * Blocks screenshots and screen recording (and hides the Android recents thumbnail) while the
 * caller is mounted. Each caller gets its own key: with a shared key, closing one protected screen
 * would re-allow capture while another protected screen underneath is still showing.
 */
export function useSensitiveScreen(): void {
  usePreventScreenCapture(`palpeer-sensitive-${useId()}`);
}

/** For conditionally shown secrets (such as the PIN sheet): render only while the secret is visible. */
export function SensitiveScreenGuard(): null {
  useSensitiveScreen();
  return null;
}
