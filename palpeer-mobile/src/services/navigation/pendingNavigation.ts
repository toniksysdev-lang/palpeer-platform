import { useSyncExternalStore } from 'react';

let pending: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/**
 * One queued destination from a link or a notification tap. It's opened once the signed-in
 * navigator is mounted, so links that arrive during launch or while signed out aren't lost.
 * Only the latest destination is kept.
 */
export const pendingNavigation = {
  set(path: string) {
    pending = path;
    emit();
  },
  take(): string | null {
    const next = pending;
    pending = null;
    if (next) emit();
    return next;
  },
  peek(): string | null {
    return pending;
  },
  clear() {
    if (pending === null) return;
    pending = null;
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function usePendingNavigationPath(): string | null {
  return useSyncExternalStore(
    pendingNavigation.subscribe,
    pendingNavigation.peek,
    pendingNavigation.peek,
  );
}
