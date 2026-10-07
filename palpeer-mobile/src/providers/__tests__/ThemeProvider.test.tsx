import { screen } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { Text } from 'react-native';

import { darkColors, lightColors, toneColors, buildTheme } from '@/theme';
import { renderWithProviders } from '@/tests/render';

import { useTheme } from '../ThemeProvider';

function Probe() {
  const theme = useTheme();
  return <Text testID="probe">{`${theme.scheme}:${theme.colors.background}`}</Text>;
}

describe('ThemeProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('applies an explicit dark preference', async () => {
    await renderWithProviders(<Probe />, { appearance: 'dark' });
    expect(screen.getByTestId('probe').props.children).toBe(`dark:${darkColors.background}`);
  });

  it('applies an explicit light preference even when the system is dark', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
    await renderWithProviders(<Probe />, { appearance: 'light' });
    expect(screen.getByTestId('probe').props.children).toBe(`light:${lightColors.background}`);
  });

  it('follows the system scheme when set to system', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
    await renderWithProviders(<Probe />, { appearance: 'system' });
    expect(screen.getByTestId('probe').props.children).toBe(`dark:${darkColors.background}`);
  });
});

describe('theme tokens', () => {
  it('provides distinct light and dark palettes for every colour key', () => {
    const keys = Object.keys(lightColors) as (keyof typeof lightColors)[];
    expect(Object.keys(darkColors).sort()).toEqual([...keys].sort());
    expect(lightColors.background).not.toBe(darkColors.background);
    expect(lightColors.textPrimary).not.toBe(darkColors.textPrimary);
  });

  it('resolves tone pairs per scheme', () => {
    expect(toneColors(buildTheme('light'), 'danger')).toEqual({
      fg: lightColors.danger,
      bg: lightColors.dangerSoft,
    });
    expect(toneColors(buildTheme('dark'), 'neutral')).toEqual({
      fg: darkColors.textSecondary,
      bg: darkColors.surfaceMuted,
    });
  });
});
