import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { fail, installFetchMock, ok } from '@/tests/fetchMock';
import { router, setSearchParams } from '@/tests/mocks/expoRouter';
import { typeIntoNumberField, typeOnNumberPad } from '@/tests/numberPad';
import { renderWithProviders } from '@/tests/render';

import { EnterPhoneScreen } from '../screens/EnterPhoneScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { VerifyOtpScreen } from '../screens/VerifyOtpScreen';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

const REGISTERED = {
  userId: 'u-1',
  email: 'ada@example.com',
  phone: '+15062100661',
  status: 'PENDING_VERIFICATION',
  message: 'Registration successful. OTP verification required.',
};

const COUNTRIES = ok(['CA', 'NG']);

function signupStatus(nextStep: string, extra: Record<string, unknown> = {}) {
  return ok({
    nextStep,
    phone: '+15062100661',
    email: null,
    maskedEmail: null,
    emailVerified: false,
    phoneVerified: false,
    hasLoggedIn: false,
    status: null,
    ...extra,
  });
}

async function fillRegister(confirm = 'correct-horse') {
  await fireEvent.changeText(screen.getByTestId('register-email'), ' Ada@Example.com ');
  await fireEvent.changeText(screen.getByTestId('register-password'), 'correct-horse');
  await fireEvent.changeText(screen.getByTestId('register-confirm'), confirm);
  await fireEvent.press(screen.getByTestId('register-submit'));
}

describe('EnterPhoneScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    setSearchParams({});
    await AsyncStorage.clear();
  });

  it('requires a phone number before continuing', async () => {
    installFetchMock({ 'GET /public/registration-countries': COUNTRIES });
    await renderWithProviders(<EnterPhoneScreen />);
    await fireEvent.press(screen.getByTestId('enter-phone-continue'));
    expect(await screen.findByText('Enter a valid phone number')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('starts phone OTP when the number is new', async () => {
    const { calls } = installFetchMock({
      'GET /public/registration-countries': COUNTRIES,
      'POST /auth/signup/status': signupStatus('PHONE_OTP_REQUIRED'),
      'POST /auth/otp/phone/request': ok({ debugOtp: null }),
    });
    await renderWithProviders(<EnterPhoneScreen />);
    expect(screen.queryByTestId('number-pad-dock-grid')).toBeNull();
    await typeIntoNumberField('enter-phone-number', '5062100661');
    expect(screen.getByTestId('enter-phone-number')).toHaveTextContent('(506) 210-0661');
    await fireEvent.press(screen.getByTestId('enter-phone-continue'));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/verify-phone',
        params: { phone: '+15062100661', signup: '1', countryIso2: 'CA' },
      }),
    );
    expect(calls.some((c) => c.path === '/auth/signup/status')).toBe(true);
    expect(calls.some((c) => c.path === '/auth/otp/phone/request')).toBe(true);
  });

  it('still sends phone OTP when signup/status is forbidden on the API', async () => {
    const { calls } = installFetchMock({
      'GET /public/registration-countries': COUNTRIES,
      'POST /auth/signup/status': fail(403, 'FORBIDDEN'),
      'POST /auth/otp/phone/request': ok({ debugOtp: null }),
    });
    await renderWithProviders(<EnterPhoneScreen />);
    await typeIntoNumberField('enter-phone-number', '5062100661');
    await fireEvent.press(screen.getByTestId('enter-phone-continue'));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/verify-phone',
        params: { phone: '+15062100661', signup: '1', countryIso2: 'CA' },
      }),
    );
    expect(calls.some((c) => c.path === '/auth/otp/phone/request')).toBe(true);
  });

  it('resumes create-account when the phone is already pre-verified', async () => {
    installFetchMock({
      'GET /public/registration-countries': COUNTRIES,
      'POST /auth/signup/status': signupStatus('REGISTER_REQUIRED', { phoneVerified: true }),
    });
    await renderWithProviders(<EnterPhoneScreen />);
    await typeIntoNumberField('enter-phone-number', '5062100661');
    await fireEvent.press(screen.getByTestId('enter-phone-continue'));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/register',
        params: { phone: '+15062100661', countryIso2: 'CA' },
      }),
    );
  });

  it('resumes email OTP for an incomplete registration', async () => {
    installFetchMock({
      'GET /public/registration-countries': COUNTRIES,
      'POST /auth/signup/status': signupStatus('EMAIL_OTP_REQUIRED', {
        email: 'ada@example.com',
        maskedEmail: 'a***@example.com',
        phoneVerified: true,
        status: 'PENDING_VERIFICATION',
      }),
      'POST /auth/signup/resend-email-otp': ok({ debugOtp: null }),
    });
    await renderWithProviders(<EnterPhoneScreen />);
    await typeIntoNumberField('enter-phone-number', '5062100661');
    await fireEvent.press(screen.getByTestId('enter-phone-continue'));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/verify-email',
        params: { email: 'ada@example.com', phone: '+15062100661', resume: '1' },
      }),
    );
  });

  it('sends verified-but-never-logged-in users to login', async () => {
    installFetchMock({
      'GET /public/registration-countries': COUNTRIES,
      'POST /auth/signup/status': signupStatus('LOGIN_READY', {
        email: 'ada@example.com',
        maskedEmail: 'a***@example.com',
        emailVerified: true,
        phoneVerified: true,
        hasLoggedIn: false,
        status: 'ACTIVE',
      }),
    });
    await renderWithProviders(<EnterPhoneScreen />);
    await typeIntoNumberField('enter-phone-number', '5062100661');
    await fireEvent.press(screen.getByTestId('enter-phone-continue'));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/login',
        params: { email: 'ada@example.com', notice: 'verified' },
      }),
    );
  });

  it('sends fully registered users to login with exists notice', async () => {
    installFetchMock({
      'GET /public/registration-countries': COUNTRIES,
      'POST /auth/signup/status': signupStatus('LOGIN_READY', {
        email: 'ada@example.com',
        maskedEmail: 'a***@example.com',
        emailVerified: true,
        phoneVerified: true,
        hasLoggedIn: true,
        status: 'ACTIVE',
      }),
    });
    await renderWithProviders(<EnterPhoneScreen />);
    await typeIntoNumberField('enter-phone-number', '5062100661');
    await fireEvent.press(screen.getByTestId('enter-phone-continue'));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/login',
        params: { email: 'ada@example.com', notice: 'exists' },
      }),
    );
  });

  it('shows the custom 3×4 pad only after tapping the phone field', async () => {
    installFetchMock({ 'GET /public/registration-countries': COUNTRIES });
    await renderWithProviders(<EnterPhoneScreen />);
    expect(screen.queryByTestId('number-pad-dock-grid')).toBeNull();
    await fireEvent.press(screen.getByTestId('enter-phone-number'));
    expect(screen.getByTestId('number-pad-dock-grid')).toBeTruthy();
    for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '*', 'back']) {
      expect(screen.getByTestId(`number-pad-dock-key-${key}`)).toBeTruthy();
    }
    await typeOnNumberPad('12');
    expect(screen.getByTestId('enter-phone-number')).toHaveTextContent('12');
    await fireEvent.press(screen.getByTestId('number-pad-dock-key-back'));
    expect(screen.getByTestId('enter-phone-number')).toHaveTextContent('1');
  });
});

describe('RegisterScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    setSearchParams({ phone: '+15062100661' });
    await AsyncStorage.clear();
  });

  it('blocks mismatched passwords on the client', async () => {
    const { calls } = installFetchMock({});
    await renderWithProviders(<RegisterScreen />);

    await fillRegister('different-pass');
    expect(await screen.findByText('Passwords do not match')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('registers with the phone from signup and moves to email verification', async () => {
    const { calls } = installFetchMock({
      'POST /auth/register': {
        status: 201,
        body: {
          success: true,
          data: { ...REGISTERED, debugOtp: '654321' },
          timestamp: '',
        },
      },
    });
    await renderWithProviders(<RegisterScreen />);

    await fillRegister();
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/verify-email',
        params: { email: 'ada@example.com', phone: '+15062100661' },
      }),
    );
    expect(calls[0]?.body).toEqual({
      email: 'Ada@Example.com',
      phone: '+15062100661',
      password: 'correct-horse',
    });
  });

  it('puts a duplicate email error on the email field', async () => {
    installFetchMock({ 'POST /auth/register': fail(409, 'EMAIL_ALREADY_REGISTERED') });
    await renderWithProviders(<RegisterScreen />);

    await fillRegister();
    expect(await screen.findByText('An account with this email already exists.')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('sends the user back to phone entry when phone is missing', async () => {
    setSearchParams({});
    await renderWithProviders(<RegisterScreen />);
    expect(screen.getByText(/Start with your phone number/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('register-go-phone'));
    expect(router.replace).toHaveBeenCalledWith('/enter-phone');
  });
});

describe('VerifyOtpScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('verifies a signup phone OTP then continues to create account', async () => {
    setSearchParams({ phone: '+15062100661', signup: '1' });
    const { calls } = installFetchMock({
      'POST /auth/otp/phone/verify': ok(undefined, 'Phone verified'),
    });
    await renderWithProviders(<VerifyOtpScreen purpose="PHONE_VERIFICATION" />);

    expect(screen.getByTestId('verify-code').props.accessibilityValue).toEqual({ text: '' });
    await typeIntoNumberField('verify-code-cells', '123456');
    await fireEvent.press(screen.getByTestId('verify-submit'));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/register',
        params: { phone: '+15062100661' },
      }),
    );
    expect(calls[0]?.body).toEqual({ phone: '+15062100661', code: '123456' });
  });

  it('lets the user skip signup phone verification', async () => {
    setSearchParams({ phone: '+15062100661', signup: '1' });
    await renderWithProviders(<VerifyOtpScreen purpose="PHONE_VERIFICATION" />);
    await fireEvent.press(screen.getByTestId('verify-skip'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/register',
      params: { phone: '+15062100661' },
    });
  });

  it('verifies the email OTP the user enters', async () => {
    setSearchParams({ email: 'ada@example.com' });
    const { calls } = installFetchMock({ 'POST /auth/otp/verify': ok(undefined, 'OTP verified') });
    await renderWithProviders(<VerifyOtpScreen purpose="EMAIL_VERIFICATION" />);

    expect(screen.getByTestId('verify-code').props.accessibilityValue).toEqual({ text: '' });
    await typeIntoNumberField('verify-code-cells', '654321');
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/login',
        params: { email: 'ada@example.com', notice: 'verified' },
      }),
    );
    expect(calls[0]?.body).toEqual({
      email: 'ada@example.com',
      purpose: 'EMAIL_VERIFICATION',
      channel: 'EMAIL',
      code: '654321',
    });
  });

  it('shows the code error and clears the input for a wrong code', async () => {
    setSearchParams({ email: 'ada@example.com' });
    installFetchMock({ 'POST /auth/otp/verify': fail(400, 'OTP_INVALID') });
    await renderWithProviders(<VerifyOtpScreen purpose="EMAIL_VERIFICATION" />);

    await typeIntoNumberField('verify-code-cells', '000000');
    expect(await screen.findByText('That code is incorrect. Check it and try again.')).toBeTruthy();
    expect(screen.getByTestId('verify-code').props.accessibilityValue).toEqual({ text: '' });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('holds resend behind a cooldown', async () => {
    setSearchParams({ email: 'ada@example.com' });
    installFetchMock({});
    await renderWithProviders(<VerifyOtpScreen purpose="EMAIL_VERIFICATION" />);

    expect(screen.getByText(/Resend code \(\d+s\)/)).toBeTruthy();
    expect(screen.getByTestId('verify-resend').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('lets the user change email during signup OTP and rejects a taken address', async () => {
    setSearchParams({ email: 'ada@example.com', phone: '+15062100661' });
    const { calls } = installFetchMock({
      'POST /auth/signup/change-email': fail(409, 'EMAIL_ALREADY_REGISTERED'),
    });
    await renderWithProviders(<VerifyOtpScreen purpose="EMAIL_VERIFICATION" />);

    await fireEvent.press(screen.getByTestId('verify-change-email-start'));
    await fireEvent.changeText(screen.getByTestId('verify-change-email'), 'taken@example.com');
    await fireEvent.press(screen.getByTestId('verify-change-email-submit'));

    expect(await screen.findByText('An account with this email already exists.')).toBeTruthy();
    expect(calls[0]?.body).toEqual({ phone: '+15062100661', email: 'taken@example.com' });
  });

  it('updates the email and sends a new OTP when change-email succeeds', async () => {
    setSearchParams({ email: 'ada@example.com', phone: '+15062100661' });
    const { calls } = installFetchMock({
      'POST /auth/signup/change-email': ok({ code: null }, 'Email updated'),
    });
    await renderWithProviders(<VerifyOtpScreen purpose="EMAIL_VERIFICATION" />);

    await fireEvent.press(screen.getByTestId('verify-change-email-start'));
    await fireEvent.changeText(screen.getByTestId('verify-change-email'), 'new@example.com');
    await fireEvent.press(screen.getByTestId('verify-change-email-submit'));

    await waitFor(() => expect(screen.getByTestId('verify-change-email-start')).toBeTruthy());
    expect(screen.getByText(/ne\*\*\*e\*+@example\.com/)).toBeTruthy();
    expect(calls[0]?.body).toEqual({ phone: '+15062100661', email: 'new@example.com' });
  });
});
