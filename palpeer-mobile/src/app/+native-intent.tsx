import { resolveDeepLink } from '@/services/navigation/deepLinks';
import { pendingNavigation } from '@/services/navigation/pendingNavigation';

/**
 * Every incoming link lands on `/`; an allowed destination is queued and opened by the signed-in
 * navigator (after sign-in if needed). Unknown links do nothing beyond opening the app.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  const target = resolveDeepLink(path);
  if (target) pendingNavigation.set(target);
  return '/';
}
