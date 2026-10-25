/** Test stand-in for expo-notifications with helpers to simulate OS events. */
type Listener<T> = (event: T) => void;

type Content = { title?: string | null; body?: string | null; data?: Record<string, unknown> };

const received = new Set<Listener<unknown>>();
const responses = new Set<Listener<unknown>>();
const tokens = new Set<Listener<unknown>>();

let permission = { granted: false, status: 'undetermined', canAskAgain: true };
let permissionAfterRequest = { granted: true, status: 'granted', canAskAgain: true };
let lastResponse: unknown = null;
let counter = 0;

export const DEFAULT_ACTION_IDENTIFIER = 'expo.modules.notifications.actions.DEFAULT';
export const AndroidImportance = { DEFAULT: 3, HIGH: 4 };

function subscribe<T>(set: Set<Listener<T>>, listener: Listener<T>) {
  set.add(listener);
  return { remove: () => set.delete(listener) };
}

function notification(content: Content, identifier?: string) {
  counter += 1;
  return {
    date: Date.now(),
    request: {
      identifier: identifier ?? `n-${counter}`,
      content: { title: null, body: null, data: {}, ...content },
      trigger: null,
    },
  };
}

function response(content: Content, identifier?: string, actionIdentifier?: string) {
  return {
    notification: notification(content, identifier),
    actionIdentifier: actionIdentifier ?? DEFAULT_ACTION_IDENTIFIER,
  };
}

export const setNotificationHandler = jest.fn();
export const addNotificationReceivedListener = jest.fn((listener: Listener<unknown>) =>
  subscribe(received, listener),
);
export const addNotificationResponseReceivedListener = jest.fn((listener: Listener<unknown>) =>
  subscribe(responses, listener),
);
export const addPushTokenListener = jest.fn((listener: Listener<unknown>) =>
  subscribe(tokens, listener),
);
export const getLastNotificationResponseAsync = jest.fn(async () => lastResponse);
export const clearLastNotificationResponseAsync = jest.fn(async () => {
  lastResponse = null;
});
export const getPermissionsAsync = jest.fn(async () => ({ ...permission }));
export const requestPermissionsAsync = jest.fn(async () => {
  permission = { ...permissionAfterRequest };
  return { ...permission };
});
export const getDevicePushTokenAsync = jest.fn(async () => ({
  type: 'android',
  data: 'fcm-token-1',
}));
export const getExpoPushTokenAsync = jest.fn(async () => ({
  type: 'expo',
  data: 'ExponentPushToken[test-token]',
}));
export const setNotificationChannelAsync = jest.fn(async () => null);

export const notifications = {
  /** A push arriving while the app is in the foreground. */
  receive(content: Content) {
    const event = notification(content);
    received.forEach((listener) => listener(event));
  },
  /** The user tapping a notification while the app is running in the background. */
  tap(content: Content, options: { identifier?: string; actionIdentifier?: string } = {}) {
    const event = response(content, options.identifier, options.actionIdentifier);
    responses.forEach((listener) => listener(event));
  },
  /** The notification that launched the app from a closed state. */
  setLaunchResponse(content: Content | null, identifier?: string) {
    lastResponse = content ? response(content, identifier) : null;
  },
  rotateToken(data: string) {
    tokens.forEach((listener) => listener({ type: 'android', data }));
  },
  setPermission(next: { granted: boolean; status: string; canAskAgain: boolean }) {
    permission = next;
  },
  setPermissionAfterRequest(next: { granted: boolean; status: string; canAskAgain: boolean }) {
    permissionAfterRequest = next;
  },
  reset() {
    received.clear();
    responses.clear();
    tokens.clear();
    permission = { granted: false, status: 'undetermined', canAskAgain: true };
    permissionAfterRequest = { granted: true, status: 'granted', canAskAgain: true };
    lastResponse = null;
    getDevicePushTokenAsync.mockImplementation(async () => ({
      type: 'android',
      data: 'fcm-token-1',
    }));
    getExpoPushTokenAsync.mockImplementation(async () => ({
      type: 'expo',
      data: 'ExponentPushToken[test-token]',
    }));
  },
};

export const GRANTED = { granted: true, status: 'granted', canAskAgain: true };
export const DENIED = { granted: false, status: 'denied', canAskAgain: false };
