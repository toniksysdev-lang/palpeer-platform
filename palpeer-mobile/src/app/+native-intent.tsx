import { isGuestDeepLink, resolveDeepLink } from '@/services/navigation/deepLinks';
import { pendingNavigation } from '@/services/navigation/pendingNavigation';

/**
 * Guest share links open immediately (no auth). Other allowed destinations are queued and opened
 * by the signed-in navigator (after sign-in if needed). Unknown links only open the app.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  const target = resolveDeepLink(path);
  if (isGuestDeepLink(target)) return target!;
  if (target) pendingNavigation.set(target);
  return '/';
}
