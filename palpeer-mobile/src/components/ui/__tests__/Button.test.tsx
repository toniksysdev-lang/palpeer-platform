import { fireEvent, screen } from '@testing-library/react-native';

import { lightColors } from '@/theme';
import { renderWithProviders } from '@/tests/render';

import { Button } from '../Button';

describe('Button', () => {
  it('fires onPress and exposes an accessible label', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Continue" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire while disabled', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Continue" onPress={onPress} disabled />);

    const button = screen.getByRole('button', { name: 'Continue' });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('shows a spinner with the label and blocks presses while loading', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Pay" onPress={onPress} loading testID="pay" />);

    expect(screen.getByTestId('pay-spinner')).toBeTruthy();
    expect(screen.getByText('Pay')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('pay'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('pay').props.accessibilityState).toMatchObject({ busy: true });
  });

  it('uses loadingLabel while busy', async () => {
    await renderWithProviders(
      <Button label="Login" loadingLabel="Signing in…" onPress={() => {}} loading testID="login" />,
    );

    expect(screen.getByTestId('login-spinner')).toBeTruthy();
    expect(screen.getByText('Signing in…')).toBeTruthy();
    expect(screen.queryByText('Login')).toBeNull();
  });

  it('uses the light theme primary colour', async () => {
    await renderWithProviders(<Button label="Go" onPress={() => {}} testID="go" />, {
      appearance: 'light',
    });

    const flat = [screen.getByTestId('go').props.style].flat(Infinity);
    expect(flat).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: lightColors.primary }),
      ]),
    );
  });
});
