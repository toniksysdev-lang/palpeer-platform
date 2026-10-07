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

export function Redirect() {
  return null;
}
