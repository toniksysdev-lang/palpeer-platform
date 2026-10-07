import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';

import { PinPad } from '@/components/ui/PinPad';
import { sessionManager } from '@/services/auth/session';
import { secureStorage } from '@/services/storage/secureStorage';
import { fail, installFetchMock, ok } from '@/tests/fetchMock';
import { router } from '@/tests/mocks/expoRouter';
import { renderWithProviders } from '@/tests/render';

import { ChangePinScreen } from '../screens/ChangePinScreen';
import { ForgotPinScreen } from '../screens/ForgotPinScreen';
import { SetPinScreen } from '../screens/SetPinScreen';
import { enterPin, PIN_STATUS, QUESTIONS } from './helpers';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

describe('PinPad', () => {
  function Harness() {
    const [value, setValue] = useState('');
    return <PinPad value={value} onChange={setValue} maxLength={4} testID="pad" />;
  }

  it('accepts digits up to the max length, deletes, and shows only dots', async () => {
    await renderWithProviders(<Harness />);
    for (const key of ['1', '2', '3', '4', '5']) {
      await fireEvent.press(screen.getByTestId(`pad-key-${key}`));
    }
    const dots = screen.getByTestId('pad-dots');
    expect(dots.props.accessibilityLabel).toBe('4 of up to 4 digits entered');
    expect(screen.queryByText('1234')).toBeNull();

    await fireEvent.press(screen.getByTestId('pad-key-back'));
    expect(screen.getByTestId('pad-dots').props.accessibilityLabel).toBe(
      '3 of up to 4 digits entered',
    );
  });
});

describe('PIN screens', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await secureStorage.clearAll();
    await sessionManager.start(
      { userId: 'u-1', accessToken: 'access-0', refreshToken: 'refresh-0', tokenType: 'Bearer' },
      'ada@example.com',
    );
  });

  describe('SetPinScreen', () => {
    it('restarts when the confirmation does not match', async () => {
      const { calls } = installFetchMock({});
      await renderWithProviders(<SetPinScreen />);

      await enterPin('set-pin-enter', '1234');
      await enterPin('set-pin-confirm', '4321');

      expect(await screen.findByText("The PINs didn't match. Start again.")).toBeTruthy();
      expect(screen.getByTestId('set-pin-enter')).toBeTruthy();
      expect(calls).toHaveLength(0);
    });

    it('sets the PIN and never keeps it in the Redux store', async () => {
      const { calls } = installFetchMock({
        'POST /security/pin': { status: 201, body: undefined },
      });
      const { store } = await renderWithProviders(<SetPinScreen />);

      await enterPin('set-pin-enter', '482915');
      await enterPin('set-pin-confirm', '482915');

      await waitFor(() => expect(router.back).toHaveBeenCalled());
      expect(calls[0]).toMatchObject({ method: 'POST', body: { pin: '482915' } });
      expect(JSON.stringify(store.getState())).not.toContain('482915');
    });
  });

  describe('ChangePinScreen', () => {
    it('returns to the current-PIN step when the current PIN is wrong', async () => {
      installFetchMock({
        'GET /security/pin': ok(PIN_STATUS(true)),
        'PUT /security/pin': fail(401, 'PIN_INVALID', 'Invalid PIN'),
      });
      const { store } = await renderWithProviders(<ChangePinScreen />);

      await enterPin('change-pin-current', '1111');
      await enterPin('change-pin-new', '2222');
      await enterPin('change-pin-confirm', '2222');

      expect(await screen.findByText('Your current PIN is incorrect.')).toBeTruthy();
      expect(JSON.stringify(store.getState())).not.toMatch(/1111|2222/);
    });

    it('shows the lock state when the backend locks the PIN', async () => {
      installFetchMock({
        'GET /security/pin': [ok(PIN_STATUS(true)), ok(PIN_STATUS(true, '2026-09-28T12:15:00Z'))],
        'PUT /security/pin': fail(423, 'PIN_LOCKED', 'PIN locked'),
      });
      await renderWithProviders(<ChangePinScreen />);

      await enterPin('change-pin-current', '1111');
      await enterPin('change-pin-new', '2222');
      await enterPin('change-pin-confirm', '2222');

      expect(await screen.findByTestId('change-pin-locked')).toBeTruthy();
    });

    it('is locked straight away while the status says so', async () => {
      installFetchMock({ 'GET /security/pin': ok(PIN_STATUS(true, '2026-09-28T12:15:00Z')) });
      await renderWithProviders(<ChangePinScreen />);
      expect(await screen.findByTestId('change-pin-locked')).toBeTruthy();
    });
  });

  describe('ForgotPinScreen', () => {
    it('tells the user to contact support when no questions are set', async () => {
      installFetchMock({
        'GET /security/pin': ok(PIN_STATUS(true)),
        'GET /security/questions': ok([]),
      });
      await renderWithProviders(<ForgotPinScreen />);
      expect(await screen.findByTestId('forgot-no-questions')).toBeTruthy();
    });

    async function answerAndChoose(pin: string) {
      await fireEvent.changeText(await screen.findByTestId('forgot-answer-0'), '  Rex ');
      await fireEvent.changeText(screen.getByTestId('forgot-answer-1'), 'Lagos');
      await fireEvent.press(screen.getByTestId('forgot-answers-continue'));
      await enterPin('forgot-new', pin);
      await enterPin('forgot-confirm', pin);
    }

    it('goes back to the answers when an answer is wrong', async () => {
      installFetchMock({
        'GET /security/pin': ok(PIN_STATUS(true)),
        'GET /security/questions': ok(QUESTIONS),
        'POST /security/pin/reset': fail(401, 'SECURITY_ANSWER_INVALID'),
      });
      await renderWithProviders(<ForgotPinScreen />);

      await answerAndChoose('9876');

      expect(await screen.findByTestId('forgot-answers-error')).toBeTruthy();
      expect(screen.getByTestId('forgot-answer-0')).toBeTruthy();
    });

    it('resets the PIN with trimmed answers for every configured question', async () => {
      const { calls } = installFetchMock({
        'GET /security/pin': ok(PIN_STATUS(true)),
        'GET /security/questions': ok(QUESTIONS),
        'POST /security/pin/reset': ok(),
      });
      const { store } = await renderWithProviders(<ForgotPinScreen />);

      await answerAndChoose('9876');

      await waitFor(() => expect(router.back).toHaveBeenCalled());
      const reset = calls.find((call) => call.path === '/security/pin/reset');
      expect(reset?.body).toEqual({
        answers: [
          { questionKey: 'FIRST_PET', answer: 'Rex' },
          { questionKey: 'BIRTH_TOWN', answer: 'Lagos' },
        ],
        newPin: '9876',
      });
      expect(JSON.stringify(store.getState())).not.toMatch(/9876|Lagos/);
    });
  });
});
