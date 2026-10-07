import { render } from '@testing-library/react-native';

import { usePreventScreenCapture } from '@/tests/mocks/media';

import { SensitiveScreenGuard } from '../useSensitiveScreen';

describe('useSensitiveScreen', () => {
  beforeEach(() => usePreventScreenCapture.mockClear());

  it('gives every protected screen its own capture key', async () => {
    await render(
      <>
        <SensitiveScreenGuard />
        <SensitiveScreenGuard />
      </>,
    );
    const keys = usePreventScreenCapture.mock.calls.map((call: unknown[]) => call[0]);
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
    keys.forEach((key: unknown) => expect(key).toMatch(/^palpeer-sensitive-/));
  });
});
