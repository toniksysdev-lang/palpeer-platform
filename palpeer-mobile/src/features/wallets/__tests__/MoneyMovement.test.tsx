import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { RefreshControlProps } from 'react-native';

import { enterPin, PIN_STATUS } from '@/features/security/__tests__/helpers';
import { sessionManager } from '@/services/auth/session';
import { interacAddressesStorage } from '@/services/storage/interacAddressesStorage';
import { secureStorage } from '@/services/storage/secureStorage';
import type { AppStore } from '@/store';
import { sessionStarted } from '@/store/slices/sessionSlice';
import { fail, installFetchMock, ok, type RecordedCall } from '@/tests/fetchMock';
import { router, setSearchParams } from '@/tests/mocks/expoRouter';
import { typeIntoNumberField } from '@/tests/numberPad';
import { renderWithProviders } from '@/tests/render';

import { FundingStatusScreen } from '../screens/FundingStatusScreen';
import { FundWalletScreen } from '../screens/FundWalletScreen';
import { WithdrawalStatusScreen } from '../screens/WithdrawalStatusScreen';
import { WithdrawScreen } from '../screens/WithdrawScreen';
import { CURRENCIES, funding, ngnFunding, wallet, withdrawal } from './fixtures';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

const posts = (calls: RecordedCall[], path: string) =>
  calls.filter((call) => call.method === 'POST' && call.path === path);

type TreeNode = { props: Record<string, unknown>; children: (TreeNode | string)[] };

function findRefreshControl(node: TreeNode): RefreshControlProps | undefined {
  const control = node.props.refreshControl as { props: RefreshControlProps } | undefined;
  if (control) return control.props;
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    const found = findRefreshControl(child);
    if (found) return found;
  }
  return undefined;
}

async function pullToRefresh() {
  const control = findRefreshControl(screen.root as unknown as TreeNode);
  await act(async () => {
    control?.onRefresh?.();
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await secureStorage.clearAll();
  await sessionManager.start(
    { userId: 'u-1', accessToken: 'access-0', refreshToken: 'refresh-0', tokenType: 'Bearer' },
    'ada@example.com',
  );
});

describe('FundWalletScreen', () => {
  it('sends CAD Instant Interac with payer details and one idempotency key', async () => {
    setSearchParams({ id: 'w-cad' });
    let attempt = 0;
    const { calls } = installFetchMock({
      'GET /wallets/w-cad': ok(wallet('w-cad', 'CAD')),
      'GET /currencies': CURRENCIES,
      'POST /funding': () => {
        attempt += 1;
        if (attempt === 1) throw new TypeError('Network request failed');
        return { status: 201, body: { success: true, data: funding(), timestamp: '' } };
      },
    });
    await renderWithProviders(<FundWalletScreen />, {
      prepareStore: (store) => {
        store.dispatch(sessionStarted({ userId: 'u-1', email: 'ada@example.com' }));
      },
    });

    await typeIntoNumberField('fund-amount', '12345678901234567.89');
    await fireEvent.press(screen.getByTestId('fund-continue'));
    expect(await screen.findByTestId('fund-pay-with')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('fund-add-interac'));
    await fireEvent.changeText(screen.getByTestId('fund-interac-first'), 'Oluwasesan');
    await fireEvent.changeText(screen.getByTestId('fund-interac-last'), 'Afolabi');
    await fireEvent.changeText(screen.getByTestId('fund-interac-email'), 'sesanelect@yahoo.com');
    await fireEvent.press(screen.getByTestId('fund-interac-continue'));

    expect(await screen.findByTestId('fund-review-amount')).toHaveTextContent(
      /12,345,678,901,234,567\.89 CAD/,
    );
    expect(screen.getByTestId('fund-review-interac')).toHaveTextContent(/sesanelect@yahoo.com/);

    await fireEvent.press(screen.getByTestId('fund-confirm'));
    expect(await screen.findByTestId('fund-error')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('fund-confirm'));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/wallet/funding/[fundingId]',
        params: { fundingId: 'f-1' },
      }),
    );

    const [first, second] = posts(calls, '/funding');
    expect(first?.rawBody).toContain('"walletId":"w-cad"');
    expect(first?.rawBody).toContain('"amount":12345678901234567.89');
    expect(first?.rawBody).toContain('"interacEmail":"sesanelect@yahoo.com"');
    expect(first?.rawBody).toContain('"interacFirstName":"Oluwasesan"');
    expect(first?.rawBody).toContain('"interacLastName":"Afolabi"');
    expect(first?.headers['Idempotency-Key']).toEqual(expect.any(String));
    expect(second?.headers['Idempotency-Key']).toBe(first?.headers['Idempotency-Key']);
  });

  it('blocks funding for a currency without a payment rail', async () => {
    setSearchParams({ id: 'w-usd' });
    installFetchMock({
      'GET /wallets/w-usd': ok(wallet('w-usd', 'USD')),
      'GET /currencies': CURRENCIES,
    });
    await renderWithProviders(<FundWalletScreen />);

    expect(await screen.findByTestId('fund-no-rail')).toBeTruthy();
    expect(screen.queryByTestId('fund-amount')).toBeNull();
  });
});

describe('FundingStatusScreen', () => {
  it('shows Instant Interac payment details while pending and only reports success once settled', async () => {
    setSearchParams({ fundingId: 'f-1' });
    const { calls } = installFetchMock({
      'GET /funding/f-1': [
        ok(funding()),
        ok(
          funding({
            status: 'SUCCESS',
            fundingInstructions: null,
            paymentDetails: null,
            ledgerEntryId: 'l-9',
          }),
        ),
      ],
      'GET /currencies': CURRENCIES,
    });
    await renderWithProviders(<FundingStatusScreen />);

    expect(await screen.findByText('Waiting for Instant Interac')).toBeTruthy();
    expect(screen.getByTestId('funding-payment-details')).toBeTruthy();
    expect(screen.getByTestId('funding-interac-payee')).toHaveTextContent(
      'Palpeer Global Holding Inc',
    );
    expect(screen.getByTestId('funding-interac-ref')).toHaveTextContent('APY-1');
    expect(screen.queryByTestId('funding-instructions')).toBeNull();
    expect(screen.getByTestId('movement-amount')).toHaveTextContent('250.00 CAD');
    expect(screen.queryByText('Funds added')).toBeNull();

    await pullToRefresh();
    expect(await screen.findByText('Funds added')).toBeTruthy();
    expect(screen.queryByTestId('funding-payment-details')).toBeNull();
    expect(calls.filter((call) => call.path === '/funding/f-1').length).toBe(2);
  });

  it('explains a funding that no payment rail can complete', async () => {
    setSearchParams({ fundingId: 'f-2' });
    installFetchMock({
      'GET /funding/f-2': ok(
        funding({
          id: 'f-2',
          status: 'INITIATED',
          providerName: null,
          providerReference: null,
          fundingInstructions: null,
        }),
      ),
      'GET /currencies': CURRENCIES,
    });
    await renderWithProviders(<FundingStatusScreen />);

    expect(await screen.findByText("Funding isn't available for CAD yet")).toBeTruthy();
    expect(screen.queryByTestId('funding-instructions')).toBeNull();
    await fireEvent.press(screen.getByTestId('funding-back'));
    expect(router.dismissTo).toHaveBeenCalledWith({
      pathname: '/wallet/[id]',
      params: { id: 'w-cad' },
    });
  });

  it('shows Kuda virtual-account payment details while NGN funding is pending', async () => {
    setSearchParams({ fundingId: 'f-ngn-1' });
    installFetchMock({
      'GET /funding/f-ngn-1': ok(ngnFunding()),
      'GET /currencies': CURRENCIES,
    });
    await renderWithProviders(<FundingStatusScreen />);

    expect(await screen.findByText('Transfer to your virtual account')).toBeTruthy();
    expect(screen.getByTestId('funding-payment-details')).toBeTruthy();
    expect(screen.getByTestId('funding-va-number')).toHaveTextContent('3001234567');
    expect(screen.getByTestId('funding-va-name')).toHaveTextContent('PALPEER USER');
    expect(screen.getByTestId('funding-va-bank')).toHaveTextContent('Kuda');
    expect(screen.queryByTestId('funding-instructions')).toBeNull();
    expect(screen.queryByText('Funds added')).toBeNull();
  });
});

describe('WithdrawScreen', () => {
  const routes = (pinSet: boolean, extra: Record<string, unknown> = {}) => ({
    'GET /wallets/w-cad': ok(wallet('w-cad', 'CAD', '500.000000000000')),
    'GET /currencies': CURRENCIES,
    'GET /security/pin': ok(PIN_STATUS(pinSet)),
    ...extra,
  });

  const withSession = {
    prepareStore: (store: AppStore) => {
      store.dispatch(sessionStarted({ userId: 'u-1', email: 'ada@example.com' }));
    },
  };

  async function fillInterac(amount: string) {
    await typeIntoNumberField('withdraw-amount', amount);
    await fireEvent.press(screen.getByTestId('withdraw-continue'));
  }

  it('stops amounts above the available balance before calling the API', async () => {
    setSearchParams({ id: 'w-cad' });
    await interacAddressesStorage.save('u-1', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    });
    const { calls } = installFetchMock(routes(false));
    await renderWithProviders(<WithdrawScreen />, withSession);

    expect(await screen.findByTestId('withdraw-available')).toHaveTextContent(
      'Available 500.00 CAD',
    );
    await fillInterac('500.01');

    expect(await screen.findByText('You can withdraw up to 500.00 CAD.')).toBeTruthy();
    expect(screen.queryByTestId('withdraw-review-amount')).toBeNull();
    expect(posts(calls, '/withdrawals')).toHaveLength(0);
  });

  it('asks for the PIN, then sends the Interac email and opens the status', async () => {
    setSearchParams({ id: 'w-cad' });
    await interacAddressesStorage.save('u-1', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    });
    const { calls } = installFetchMock(
      routes(true, {
        'POST /security/pin/verify': ok(),
        'POST /withdrawals': {
          status: 201,
          body: { success: true, data: withdrawal(), timestamp: '' },
        },
      }),
    );
    await renderWithProviders(<WithdrawScreen />, withSession);

    await fillInterac('100');
    expect(await screen.findByTestId('withdraw-review-destination')).toHaveTextContent(
      /ada@example.com/,
    );
    await fireEvent.press(screen.getByTestId('withdraw-confirm'));
    await enterPin('pin-prompt-entry', '1234');

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/wallet/withdrawal/[withdrawalId]',
        params: { withdrawalId: 'wd-1' },
      }),
    );
    const [post] = posts(calls, '/withdrawals');
    expect(post?.rawBody).toBe(
      '{"walletId":"w-cad","amount":100,"destinationReference":"ada@example.com"}',
    );
    expect(post?.headers['Idempotency-Key']).toEqual(expect.any(String));
    expect(posts(calls, '/security/pin/verify')).toHaveLength(1);
  });

  it('loads Interac emails saved from CAD funding and sends that destination', async () => {
    setSearchParams({ id: 'w-cad' });
    const saved = await interacAddressesStorage.save('u-1', {
      firstName: 'Oluwasesan',
      lastName: 'Afolabi',
      email: 'sesanelect@yahoo.com',
    });
    const { calls } = installFetchMock(
      routes(true, {
        'POST /security/pin/verify': ok(),
        'POST /withdrawals': {
          status: 201,
          body: { success: true, data: withdrawal(), timestamp: '' },
        },
      }),
    );
    await renderWithProviders(<WithdrawScreen />, withSession);

    expect(await screen.findByTestId(`withdraw-interac-${saved.id}`)).toHaveTextContent(
      /sesanelect@yahoo.com/,
    );
    await typeIntoNumberField('withdraw-amount', '50');
    await fireEvent.press(screen.getByTestId('withdraw-continue'));
    expect(await screen.findByTestId('withdraw-review-destination')).toHaveTextContent(
      /sesanelect@yahoo.com/,
    );
    await fireEvent.press(screen.getByTestId('withdraw-confirm'));
    await enterPin('pin-prompt-entry', '1234');

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/wallet/withdrawal/[withdrawalId]',
        params: { withdrawalId: 'wd-1' },
      }),
    );
    expect(posts(calls, '/withdrawals')[0]?.rawBody).toBe(
      '{"walletId":"w-cad","amount":50,"destinationReference":"sesanelect@yahoo.com"}',
    );
  });

  it('adds a new Interac address on withdraw and reuses the shared store', async () => {
    setSearchParams({ id: 'w-cad' });
    installFetchMock(routes(false));
    await renderWithProviders(<WithdrawScreen />, withSession);

    await fireEvent.press(await screen.findByTestId('withdraw-add-interac'));
    await fireEvent.changeText(screen.getByTestId('withdraw-interac-first'), 'Ada');
    await fireEvent.changeText(screen.getByTestId('withdraw-interac-last'), 'Lovelace');
    await fireEvent.changeText(
      screen.getByTestId('withdraw-interac-email'),
      'ada@example.com',
    );
    await fireEvent.press(screen.getByTestId('withdraw-interac-continue'));

    expect(await screen.findByTestId('withdraw-interac-picker')).toHaveTextContent(/ada@example.com/);
    const listed = await interacAddressesStorage.list('u-1');
    expect(listed.some((item) => item.email === 'ada@example.com')).toBe(true);
  });

  it('sends nothing when the PIN prompt is cancelled', async () => {
    setSearchParams({ id: 'w-cad' });
    await interacAddressesStorage.save('u-1', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    });
    const { calls } = installFetchMock(routes(true));
    await renderWithProviders(<WithdrawScreen />, withSession);

    await fillInterac('100');
    await fireEvent.press(await screen.findByTestId('withdraw-confirm'));
    await fireEvent.press(await screen.findByTestId('pin-prompt-cancel'));

    await waitFor(() => expect(screen.queryByTestId('pin-prompt-entry')).toBeNull());
    expect(posts(calls, '/withdrawals')).toHaveLength(0);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('shows the backend decision when the balance changed in the meantime', async () => {
    setSearchParams({ id: 'w-cad' });
    await interacAddressesStorage.save('u-1', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    });
    installFetchMock(
      routes(true, {
        'POST /security/pin/verify': ok(),
        'POST /withdrawals': fail(422, 'INSUFFICIENT_AVAILABLE_BALANCE'),
      }),
    );
    await renderWithProviders(<WithdrawScreen />, withSession);

    await fillInterac('100');
    await fireEvent.press(screen.getByTestId('withdraw-confirm'));
    await enterPin('pin-prompt-entry', '1234');

    expect(
      await screen.findByText("You don't have enough available balance for this withdrawal."),
    ).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('builds the NGN bank reference from the banks dropdown', async () => {
    setSearchParams({ id: 'w-ngn' });
    const { calls } = installFetchMock({
      'GET /wallets/w-ngn': ok(wallet('w-ngn', 'NGN', '90000.00')),
      'GET /currencies': CURRENCIES,
      'GET /security/pin': ok(PIN_STATUS(true)),
      'GET /withdrawals/banks': ok([
        { code: '090267', name: 'Kuda Bank', slug: 'kuda-bank' },
        { code: '058', name: 'Guaranty Trust Bank', slug: 'gtbank' },
      ]),
      'POST /security/pin/verify': ok(),
      'POST /withdrawals': {
        status: 201,
        body: {
          success: true,
          data: withdrawal({ walletId: 'w-ngn', currencyCode: 'NGN' }),
          timestamp: '',
        },
      },
    });
    await renderWithProviders(<WithdrawScreen />);

    await typeIntoNumberField('withdraw-amount', '2500.50');
    await fireEvent.press(await screen.findByTestId('withdraw-bank'));
    await fireEvent.press(await screen.findByTestId('withdraw-bank-sheet-option-090267'));
    await typeIntoNumberField('withdraw-account-number', '0123456789');
    await fireEvent.press(screen.getByTestId('withdraw-continue'));
    expect(await screen.findByTestId('withdraw-review-destination')).toHaveTextContent(
      /Kuda Bank · account ending 6789/,
    );
    await fireEvent.press(await screen.findByTestId('withdraw-confirm'));
    await enterPin('pin-prompt-entry', '1234');

    await waitFor(() => expect(posts(calls, '/withdrawals')).toHaveLength(1));
    expect(posts(calls, '/withdrawals')[0]?.body).toEqual({
      walletId: 'w-ngn',
      amount: 2500.5,
      destinationReference: '090267:0123456789',
    });
  });

  it('blocks withdrawals for a currency without a payment rail', async () => {
    setSearchParams({ id: 'w-usd' });
    installFetchMock({
      'GET /wallets/w-usd': ok(wallet('w-usd', 'USD', '10.00')),
      'GET /currencies': CURRENCIES,
      'GET /security/pin': ok(PIN_STATUS(false)),
    });
    await renderWithProviders(<WithdrawScreen />);

    expect(await screen.findByTestId('withdraw-no-rail')).toBeTruthy();
  });
});

describe('WithdrawalStatusScreen', () => {
  it('describes a held withdrawal without claiming it was sent', async () => {
    setSearchParams({ withdrawalId: 'wd-1' });
    installFetchMock({ 'GET /withdrawals/wd-1': ok(withdrawal()), 'GET /currencies': CURRENCIES });
    await renderWithProviders(<WithdrawalStatusScreen />);

    expect(await screen.findByText('Withdrawal in progress')).toBeTruthy();
    expect(screen.queryByText('Withdrawal complete')).toBeNull();
    expect(screen.getByText('Bank transfer (EFT) · 001-12345 · account ending 6543')).toBeTruthy();
  });

  it('explains a failed withdrawal returned the held amount', async () => {
    setSearchParams({ withdrawalId: 'wd-1' });
    installFetchMock({
      'GET /withdrawals/wd-1': ok(
        withdrawal({ status: 'FAILED', failureReason: 'Provider rejected the payout.' }),
      ),
      'GET /currencies': CURRENCIES,
    });
    await renderWithProviders(<WithdrawalStatusScreen />);

    expect(await screen.findByText('Withdrawal failed')).toBeTruthy();
    expect(
      screen.getByText(
        'Provider rejected the payout. The held amount was returned to your available balance.',
      ),
    ).toBeTruthy();
  });
});
