import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { appConfig, type SupportConfig } from '@/config/env';
import { PrivacyScreen } from '@/features/settings/screens/PrivacyScreen';
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';
import { router } from '@/tests/mocks/expoRouter';
import { renderWithProviders } from '@/tests/render';

import { FAQ_SECTIONS, searchFaq } from '../faq';
import { HelpCenterScreen } from '../screens/HelpCenterScreen';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

const NONE: SupportConfig = { email: null, phone: null, privacyPolicyUrl: null, termsUrl: null };
const CONFIGURED: SupportConfig = {
  email: 'help@palpeer.example',
  phone: '+44 20 7946 0000',
  privacyPolicyUrl: 'https://palpeer.example/privacy',
  termsUrl: 'https://palpeer.example/terms',
};

function setSupport(value: SupportConfig) {
  appConfig.support = { ...value };
}

describe('searchFaq', () => {
  it('returns everything for an empty query', () => {
    expect(searchFaq('  ')).toHaveLength(FAQ_SECTIONS.length);
  });

  it('matches every word across questions and answers, ignoring case', () => {
    const result = searchFaq('forgot PIN');
    const ids = result.flatMap((section) => section.items.map((item) => item.id));
    expect(ids).toContain('forgot-pin');
    expect(ids).not.toContain('forgot-password');
    expect(searchFaq('zebra crossing')).toEqual([]);
  });
});

describe('HelpCenterScreen', () => {
  let openURL: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  afterEach(() => {
    openURL.mockRestore();
    setSupport(NONE);
  });

  it('expands an answer on tap and filters by search', async () => {
    setSupport(NONE);
    await renderWithProviders(<HelpCenterScreen />);

    expect(screen.queryByTestId('faq-forgot-pin-answer')).toBeNull();
    await fireEvent.press(screen.getByTestId('faq-forgot-pin'));
    expect(screen.getByTestId('faq-forgot-pin-answer')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('faq-forgot-pin'));
    expect(screen.queryByTestId('faq-forgot-pin-answer')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('help-search'), 'bonus');
    expect(screen.getByTestId('faq-bonus-pending-answer')).toBeTruthy();
    expect(screen.queryByTestId('faq-forgot-pin')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('help-search'), 'zebra');
    expect(screen.getByText('No matching answers')).toBeTruthy();
  });

  it('shows support@palpeer.com and omits phone when unset', async () => {
    setSupport(NONE);
    await renderWithProviders(<HelpCenterScreen />);

    expect(screen.getByTestId('support-email')).toBeTruthy();
    expect(screen.getByText('support@palpeer.com')).toBeTruthy();
    expect(screen.queryByTestId('support-phone')).toBeNull();
    expect(screen.queryByTestId('support-unavailable')).toBeNull();
  });

  it('opens a support email with app details but no account data', async () => {
    setSupport(CONFIGURED);
    await renderWithProviders(<HelpCenterScreen />);

    await fireEvent.press(screen.getByTestId('support-email'));
    const url = openURL.mock.calls[0]?.[0] as string;
    expect(url.startsWith('mailto:help@palpeer.example?subject=PALPEER%20support%20request')).toBe(
      true,
    );
    const body = decodeURIComponent(url.split('&body=')[1] ?? '');
    expect(body).toContain('App: PALPEER');
    expect(body).not.toMatch(/ada@example\.com|refresh-|access-/);

    await fireEvent.press(screen.getByTestId('support-phone'));
    expect(openURL).toHaveBeenLastCalledWith('tel:+442079460000');
  });

  it('shows the address when no email app can open it', async () => {
    setSupport(CONFIGURED);
    openURL.mockRejectedValue(new Error('no handler'));
    await renderWithProviders(<HelpCenterScreen />);

    await fireEvent.press(screen.getByTestId('support-email'));
    expect(
      await screen.findByText('No email app found. Write to help@palpeer.example.'),
    ).toBeTruthy();
  });
});

describe('PrivacyScreen', () => {
  let openURL: jest.SpyInstance;
  let openSettings: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
  });

  afterEach(() => {
    openURL.mockRestore();
    openSettings.mockRestore();
    setSupport(NONE);
  });

  it('explains missing policies and account deletion without a working action', async () => {
    setSupport(NONE);
    await renderWithProviders(<PrivacyScreen />);

    expect(screen.getByTestId('privacy-policies-unavailable')).toBeTruthy();
    expect(screen.getByText(/Contact support to request it/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('privacy-delete-account'));
    expect(openURL).not.toHaveBeenCalled();
  });

  it('opens policies in the browser and requests deletion by email', async () => {
    setSupport(CONFIGURED);
    await renderWithProviders(<PrivacyScreen />);

    await fireEvent.press(screen.getByTestId('privacy-policy'));
    expect(openURL).toHaveBeenLastCalledWith('https://palpeer.example/privacy');
    await fireEvent.press(screen.getByTestId('privacy-terms'));
    expect(openURL).toHaveBeenLastCalledWith('https://palpeer.example/terms');

    await fireEvent.press(screen.getByTestId('privacy-delete-account'));
    expect(openURL.mock.calls.at(-1)?.[0]).toMatch(
      /^mailto:help@palpeer\.example\?subject=Account%20deletion%20request/,
    );
  });

  it('sends permission changes to the phone settings and never requests them', async () => {
    setSupport(NONE);
    await renderWithProviders(<PrivacyScreen />);

    await fireEvent.press(screen.getByTestId('privacy-open-settings'));
    await waitFor(() => expect(openSettings).toHaveBeenCalledTimes(1));
    await fireEvent.press(screen.getByTestId('privacy-notifications'));
    expect(router.push).toHaveBeenCalledWith('/notifications/settings');
  });
});

describe('SettingsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps light appearance and links to the other settings', async () => {
    const { store } = await renderWithProviders(<SettingsScreen />);

    expect(screen.getByText('Light')).toBeTruthy();
    expect(store.getState().preferences.appearance).toBe('light');

    expect(screen.getByTestId('settings-version')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('settings-privacy'));
    expect(router.push).toHaveBeenCalledWith('/settings/privacy');
    await fireEvent.press(screen.getByTestId('settings-security'));
    expect(router.push).toHaveBeenCalledWith('/security');
    await fireEvent.press(screen.getByTestId('settings-notifications'));
    expect(router.push).toHaveBeenCalledWith('/notifications/settings');
    await fireEvent.press(screen.getByTestId('settings-support'));
    expect(router.push).toHaveBeenCalledWith('/support');
  });
});
