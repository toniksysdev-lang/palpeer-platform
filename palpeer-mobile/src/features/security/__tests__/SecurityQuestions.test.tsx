import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { AppText } from '@/components/ui/AppText';
import { sessionManager } from '@/services/auth/session';
import { secureStorage } from '@/services/storage/secureStorage';
import { fail, installFetchMock, ok } from '@/tests/fetchMock';
import { renderWithProviders } from '@/tests/render';

import { usePinPrompt } from '../PinPromptProvider';
import { SecurityQuestionsScreen } from '../screens/SecurityQuestionsScreen';
import { enterPin, PIN_STATUS, QUESTIONS } from './helpers';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

async function fillQuestions() {
  await fireEvent.press(await screen.findByTestId('questions-pick-0'));
  await fireEvent.press(await screen.findByTestId('questions-option-FIRST_PET'));
  await fireEvent.press(screen.getByTestId('questions-pick-1'));
  await fireEvent.press(await screen.findByTestId('questions-option-BIRTH_TOWN'));
  await fireEvent.changeText(screen.getByTestId('questions-answer-0'), ' Rex ');
  await fireEvent.changeText(screen.getByTestId('questions-answer-1'), 'Lagos');
}

describe('security questions and PIN prompt', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await secureStorage.clearAll();
    await sessionManager.start(
      { userId: 'u-1', accessToken: 'access-0', refreshToken: 'refresh-0', tokenType: 'Bearer' },
      'ada@example.com',
    );
  });

  it('saves two questions without a PIN when none is set', async () => {
    const { calls } = installFetchMock({
      'GET /security/questions': [ok([]), ok(QUESTIONS)],
      'GET /security/pin': ok(PIN_STATUS(false)),
      'PUT /security/questions': ok(QUESTIONS),
    });
    const { store } = await renderWithProviders(<SecurityQuestionsScreen />);

    await fillQuestions();
    await fireEvent.press(screen.getByTestId('questions-save'));

    expect(await screen.findByTestId('questions-configured')).toBeTruthy();
    const save = calls.find((call) => call.method === 'PUT');
    expect(save?.body).toEqual({
      questions: [
        { questionKey: 'FIRST_PET', questionText: expect.any(String), answer: 'Rex' },
        { questionKey: 'BIRTH_TOWN', questionText: expect.any(String), answer: 'Lagos' },
      ],
    });
    expect(calls.some((call) => call.path === '/security/pin/verify')).toBe(false);
    expect(JSON.stringify(store.getState())).not.toContain('Lagos');
  });

  it('asks for the PIN before replacing questions when a PIN is set', async () => {
    const { calls } = installFetchMock({
      'GET /security/questions': ok(QUESTIONS),
      'GET /security/pin': ok(PIN_STATUS(true)),
      'POST /security/pin/verify': [fail(401, 'PIN_INVALID'), ok()],
      'PUT /security/questions': ok(QUESTIONS),
    });
    await renderWithProviders(<SecurityQuestionsScreen />);

    await fireEvent.press(await screen.findByTestId('questions-change'));
    expect(screen.getByTestId('questions-replace-note')).toBeTruthy();
    await fillQuestions();
    await fireEvent.press(screen.getByTestId('questions-save'));

    await enterPin('pin-prompt-entry', '0000');
    expect(await screen.findByText('Wrong PIN, try again.')).toBeTruthy();
    expect(calls.some((call) => call.method === 'PUT')).toBe(false);

    await enterPin('pin-prompt-entry', '1234');
    await waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true));
  });

  it('does not save when the PIN prompt is cancelled', async () => {
    const { calls } = installFetchMock({
      'GET /security/questions': ok(QUESTIONS),
      'GET /security/pin': ok(PIN_STATUS(true)),
    });
    await renderWithProviders(<SecurityQuestionsScreen />);

    await fireEvent.press(await screen.findByTestId('questions-change'));
    await fillQuestions();
    await fireEvent.press(screen.getByTestId('questions-save'));
    await fireEvent.press(await screen.findByTestId('pin-prompt-cancel'));

    await waitFor(() => expect(screen.queryByTestId('pin-prompt-entry')).toBeNull());
    expect(calls.some((call) => call.method === 'PUT')).toBe(false);
  });

  describe('PinPromptProvider', () => {
    function Probe() {
      const { requestPin } = usePinPrompt();
      const [result, setResult] = useState('none');
      return (
        <>
          <Button
            label="Ask"
            onPress={() => void requestPin().then((ok) => setResult(String(ok)))}
            testID="ask"
          />
          <AppText testID="result">{result}</AppText>
        </>
      );
    }

    it('resolves true after the backend verifies the PIN', async () => {
      installFetchMock({ 'POST /security/pin/verify': ok() });
      await renderWithProviders(<Probe />);

      await fireEvent.press(screen.getByTestId('ask'));
      await enterPin('pin-prompt-entry', '1234');

      await waitFor(() => expect(screen.getByTestId('result').props.children).toBe('true'));
    });

    it('blocks further attempts once the PIN is locked', async () => {
      installFetchMock({ 'POST /security/pin/verify': fail(423, 'PIN_LOCKED') });
      await renderWithProviders(<Probe />);

      await fireEvent.press(screen.getByTestId('ask'));
      await enterPin('pin-prompt-entry', '1234');

      expect(await screen.findByTestId('pin-prompt-entry-error')).toBeTruthy();
      expect(screen.getByTestId('pin-prompt-cancel')).toBeTruthy();
      await fireEvent.press(screen.getByTestId('pin-prompt-cancel'));
      await waitFor(() => expect(screen.getByTestId('result').props.children).toBe('false'));
    });
  });
});
