import { render, waitFor } from '@testing-library/react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { Platform } from 'react-native';

import { SensitiveScreenGuard } from '../useSensitiveScreen';

jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(async () => undefined),
  allowScreenCaptureAsync: jest.fn(async () => undefined),
}));

describe('useSensitiveScreen', () => {
  const platform = Platform as { OS: string };
  const prevent = ScreenCapture.preventScreenCaptureAsync as jest.Mock;
  const allow = ScreenCapture.allowScreenCaptureAsync as jest.Mock;

  beforeEach(() => {
    platform.OS = 'ios';
    prevent.mockClear();
    allow.mockClear();
  });

  afterEach(() => {
    platform.OS = 'ios';
  });

  it('gives every protected screen its own capture key', async () => {
    await render(
      <>
        <SensitiveScreenGuard />
        <SensitiveScreenGuard />
      </>,
    );
    await waitFor(() => expect(prevent).toHaveBeenCalledTimes(2));
    const keys = prevent.mock.calls.map((call) => call[0] as string);
    expect(new Set(keys).size).toBe(2);
    keys.forEach((key) => expect(key).toMatch(/^palpeer-sensitive-/));
  });

  it('skips native screen capture on web', async () => {
    platform.OS = 'web';
    await render(<SensitiveScreenGuard />);
    expect(prevent).not.toHaveBeenCalled();
  });
});
