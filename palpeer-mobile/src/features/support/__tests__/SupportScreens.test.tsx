import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { appConfig, type SupportConfig } from '@/config/env';
import { PrivacyScreen } from '@/features/settings/screens/PrivacyScreen';
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';
import { router } from '@/tests/mocks/expoRouter';
import { renderWithProviders } from '@/tests/render';

import { FAQ_SECTIONS, searchFaq } from '../faq';
import { CommonQuestionsScreen } from '../screens/CommonQuestionsScreen';
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

  async function openContactUs() {
    await renderWithProviders(<HelpCenterScreen />);
    await fireEvent.press(screen.getByTestId('support-contact-us'));
  }

  it('opens Get help choices matching the design sheets', async () => {
    setSupport(NONE);
    await renderWithProviders(<HelpCenterScreen />);

    expect(screen.getByText('Get help')).toBeTruthy();
    expect(screen.getByTestId('support-live-chat')).toBeTruthy();
    expect(screen.getByTestId('support-common-questions')).toBeTruthy();
    expect(screen.getByTestId('support-contact-us')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('support-live-chat'));
    expect(router.push).toHaveBeenCalledWith('/support/live-chat');
  });

  it('opens the Common questions design screen', async () => {
    setSupport(NONE);
    await renderWithProviders(<HelpCenterScreen />);
    await fireEvent.press(screen.getByTestId('support-common-questions'));
    expect(router.push).toHaveBeenCalledWith('/support/common-questions');
  });

  it('shows support@palpeer.com and omits phone when unset', async () => {
    setSupport(NONE);
    await openContactUs();

    expect(screen.getByText('Contact us')).toBeTruthy();
    expect(screen.getByTestId('support-email')).toBeTruthy();
    expect(screen.getByText('support@palpeer.com')).toBeTruthy();
    expect(screen.queryByTestId('support-phone')).toBeNull();
    expect(screen.queryByTestId('support-unavailable')).toBeNull();
  });

  it('opens a support email with app details but no account data', async () => {
    setSupport(CONFIGURED);
    await openContactUs();

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
    await openContactUs();

    await fireEvent.press(screen.getByTestId('support-email'));
    expect(
      await screen.findByText('No email app found. Write to help@palpeer.example.'),
    ).toBeTruthy();
  });
});

describe('CommonQuestionsScreen', () => {
  it('shows Getting started questions, expands answers, and opens Tonia chat', async () => {
    await renderWithProviders(<CommonQuestionsScreen />);

    expect(screen.getByTestId('common-questions-screen')).toBeTruthy();
    expect(screen.getByText('Common questions')).toBeTruthy();
    expect(screen.getByTestId('common-questions-search')).toBeTruthy();
    expect(screen.getByTestId('common-questions-cat-getting-started')).toBeTruthy();
    expect(screen.getByText('What is Palpeer?')).toBeTruthy();
    expect(screen.queryByTestId('faq-what-is-palpeer-answer')).toBeNull();

    await fireEvent.press(screen.getByTestId('faq-what-is-palpeer'));
    expect(screen.getByTestId('faq-what-is-palpeer-answer')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('common-questions-search'), 'business');
    expect(screen.getByTestId('faq-business-account')).toBeTruthy();
    expect(screen.queryByTestId('faq-what-is-palpeer')).toBeNull();

    await fireEvent.press(screen.getByTestId('common-questions-chat-tonia'));
    expect(router.push).toHaveBeenCalledWith('/support/live-chat');
  });

  it('filters by category chip', async () => {
    await renderWithProviders(<CommonQuestionsScreen />);
    await fireEvent.press(screen.getByTestId('common-questions-cat-add-money'));
    expect(screen.getByText('How do I add money?')).toBeTruthy();
    expect(screen.queryByText('What is Palpeer?')).toBeNull();
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

  it('defaults to light appearance and links to the other settings', async () => {
    const { store } = await renderWithProviders(<SettingsScreen />);

    expect(screen.getByText('System')).toBeTruthy();
    expect(screen.getByText('Light')).toBeTruthy();
    expect(screen.getByText('Dark')).toBeTruthy();
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
