import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { fail, installFetchMock, ok } from '@/tests/fetchMock';
import { router, setSearchParams } from '@/tests/mocks/expoRouter';
import { typeIntoNumberField } from '@/tests/numberPad';
import { renderWithProviders } from '@/tests/render';


import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

describe('ForgotPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setSearchParams({});
  });

  it('rejects an invalid email locally', async () => {
    const { calls } = installFetchMock({});
    await renderWithProviders(<ForgotPasswordScreen />);

    await fireEvent.changeText(screen.getByTestId('forgot-email'), 'not-an-email');
    await fireEvent.press(screen.getByTestId('forgot-submit'));
    expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('requests a reset code and continues to the reset screen', async () => {
    const { calls } = installFetchMock({ 'POST /auth/password-reset/request': ok() });
    await renderWithProviders(<ForgotPasswordScreen />);

    await fireEvent.changeText(screen.getByTestId('forgot-email'), 'ada@example.com');
    await fireEvent.press(screen.getByTestId('forgot-submit'));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/reset-password',
        params: { email: 'ada@example.com' },
      }),
    );
    expect(calls[0]?.body).toEqual({ email: 'ada@example.com' });
  });
});

describe('ResetPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setSearchParams({ email: 'ada@example.com' });
  });

  async function fill(code: string, password = 'new-password-1', confirm = password) {
    await typeIntoNumberField('reset-code-cells', code);
    await fireEvent.changeText(screen.getByTestId('reset-password'), password);
    await fireEvent.changeText(screen.getByTestId('reset-confirm'), confirm);
    await fireEvent.press(screen.getByTestId('reset-submit'));
  }

  it('shows the neutral delivery message', async () => {
    installFetchMock({});
    await renderWithProviders(<ResetPasswordScreen />);
    expect(screen.getByText(/If an account exists for ada@example.com/)).toBeTruthy();
  });

  it('confirms the reset and returns to sign in', async () => {
    const { calls } = installFetchMock({ 'POST /auth/password-reset/confirm': ok() });
    await renderWithProviders(<ResetPasswordScreen />);

    await fill('123456');
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/login',
        params: { email: 'ada@example.com', notice: 'reset' },
      }),
    );
    expect(calls[0]?.body).toEqual({
      email: 'ada@example.com',
      code: '123456',
      newPassword: 'new-password-1',
    });
  });

  it('enforces the backend password length locally', async () => {
    const { calls } = installFetchMock({});
    await renderWithProviders(<ResetPasswordScreen />);

    await fill('123456', 'short');
    expect(await screen.findByText('Password must be at least 8 characters')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('shows an expired code on the code field', async () => {
    installFetchMock({ 'POST /auth/password-reset/confirm': fail(400, 'OTP_EXPIRED') });
    await renderWithProviders(<ResetPasswordScreen />);

    await fill('123456');
    expect(await screen.findByText('This code has expired. Request a new one.')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
