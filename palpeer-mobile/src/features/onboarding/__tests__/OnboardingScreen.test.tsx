import { fireEvent, screen } from '@testing-library/react-native';

import { pendingNavigation } from '@/services/navigation/pendingNavigation';
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

beforeEach(() => {
  jest.clearAllMocks();
  pendingNavigation.clear();
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
