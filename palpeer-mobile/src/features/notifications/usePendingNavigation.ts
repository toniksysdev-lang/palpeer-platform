import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import {
  pendingNavigation,
  usePendingNavigationPath,
} from '@/services/navigation/pendingNavigation';

/**
 * Opens a queued link or notification destination. Mounted in the signed-in tab layout, so it
 * only runs once the user is signed in and the navigator exists.
 */
export function usePendingNavigation() {
  const pending = usePendingNavigationPath();

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      const path = pendingNavigation.take();
      if (path) router.push(path as Href);
    }, 0);
    return () => clearTimeout(timer);
  }, [pending]);
}
