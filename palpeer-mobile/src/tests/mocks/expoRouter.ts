/** Test stand-in for expo-router's imperative API used by screens. */
export const router = {
  push: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismissTo: jest.fn(),
  canGoBack: jest.fn(() => false),
};

let params: Record<string, string> = {};
let pathname = '/';

export function setSearchParams(next: Record<string, string>) {
  params = next;
}

export function setPathname(next: string) {
  pathname = next;
}

export function useLocalSearchParams() {
  return params;
}

export function usePathname() {
  return pathname;
}

export function useRootNavigationState() {
  return { key: 'test-root' };
}

/** Runs on mount in tests (expo-router focuses the screen immediately). */
export function useFocusEffect(effect: () => void | (() => void)) {
  const { useEffect } = require('react') as typeof import('react');
  useEffect(() => {
    const cleanup = effect();
    return typeof cleanup === 'function' ? cleanup : undefined;
    // Intentionally omit deps — mirrors React Navigation's focus-effect contract in unit tests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function Redirect() {
  return null;
}
