import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRouter } from '@/app/router/AppRouter';
import { persistSession } from '@/features/auth/session';
import { mockLogin } from '@/mocks/auth';
import { renderWithProviders } from '@/test/render';

function seedAdminSession() {
  persistSession(mockLogin({ email: 'ops@palpeer.local', password: 'admin' }), false);
}

describe('transactions module integration', () => {
  beforeEach(() => {
    seedAdminSession();
  });

  it('lists platform transactions and filters by user in mock mode', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRouter />, { route: '/admin/transactions' });

    const main = await screen.findByRole('main');
    await waitFor(() => {
      expect(within(main).getByRole('heading', { name: /^transactions$/i })).toBeInTheDocument();
    });

    const failedWithdrawal = '33333333-3333-4333-8333-333333333303';
    const exchange = '33333333-3333-4333-8333-333333333302';
    expect(await within(main).findByText(failedWithdrawal)).toBeInTheDocument();
    expect(within(main).getByText(exchange)).toBeInTheDocument();

    const userIdField = within(main).getByLabelText(/user id/i);
    await user.clear(userIdField);
    await user.type(userIdField, 'u-2');
    await user.click(within(main).getByRole('button', { name: /^search$/i }));

    await waitFor(() => {
      expect(within(main).queryByText(failedWithdrawal)).not.toBeInTheDocument();
    });
    expect(await within(main).findByText(exchange)).toBeInTheDocument();
  });
});
