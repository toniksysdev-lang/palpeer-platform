import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { pendingNavigation } from '@/services/navigation/pendingNavigation';
import { signupDraftStorage } from '@/services/storage/signupDraftStorage';
import { router } from '@/tests/mocks/expoRouter';
import { renderWithProviders } from '@/tests/render';
import { preferencesLoaded } from '@/store/slices/preferencesSlice';

import { OnboardingScreen } from '../OnboardingScreen';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

async function renderWelcome() {
  return renderWithProviders(<OnboardingScreen />, {
    prepareStore: (store) =>
      store.dispatch(
        preferencesLoaded({
          appearance: 'light',
          onboardingSeen: false,
          biometricUnlockPrompted: false,
        }),
      ),
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  pendingNavigation.clear();
  await AsyncStorage.clear();
});

describe('OnboardingScreen (welcome)', () => {
  it('shows the welcome copy and actions', async () => {
    await renderWelcome();

    expect(screen.getByLabelText('PALPEER')).toBeTruthy();
    expect(
      screen.getByText('Exchange currencies with ease and confidence, anytime, anywhere.'),
    ).toBeTruthy();

    expect(screen.getByText('View Best Rate Now')).toBeTruthy();
    expect(screen.getByText('Get started')).toBeTruthy();
    expect(screen.getByText('Already have an account?', { exact: false })).toBeTruthy();
  });

  it('Get started opens registration', async () => {
    await renderWelcome();

    await fireEvent.press(screen.getByTestId('welcome-get-started'));

    expect(router.push).toHaveBeenCalledWith('/enter-phone');
    expect(pendingNavigation.peek()).toBeNull();
  });

  it('Continue registration resumes from a saved email OTP draft', async () => {
    await signupDraftStorage.save({
      phone: '+15062100661',
      email: 'ada@example.com',
      step: 'EMAIL_OTP',
    });
    await renderWelcome();

    expect(await screen.findByTestId('welcome-continue-registration')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('welcome-continue-registration'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/verify-email',
      params: { email: 'ada@example.com', phone: '+15062100661' },
    });
  });

  it('Start over clears the draft and opens phone entry', async () => {
    await signupDraftStorage.save({
      phone: '+15062100661',
      step: 'REGISTER',
    });
    await renderWelcome();

    await fireEvent.press(await screen.findByTestId('welcome-start-over'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/enter-phone'));
    expect(await signupDraftStorage.load()).toBeNull();
  });

  it('Login opens the sign-in screen', async () => {
    await renderWelcome();

    await fireEvent.press(screen.getByTestId('welcome-login'));

    expect(router.push).toHaveBeenCalledWith('/login');
  });

  it('View Best Rate Now opens the public rates board', async () => {
    await renderWelcome();

    await fireEvent.press(screen.getByTestId('welcome-view-rates'));

    expect(router.push).toHaveBeenCalledWith('/view-rates');
    expect(pendingNavigation.peek()).toBeNull();
  });
});
