import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRouter } from '@/app/router/AppRouter';
import { persistSession } from '@/features/auth/session';
import { mockLogin } from '@/mocks/auth';
import { renderWithProviders } from '@/test/render';

function seedAdminSession() {
  const tokens = mockLogin({ email: 'ops@palpeer.local', password: 'admin' });
  persistSession(tokens, false);
}

describe('users module integration', () => {
  beforeEach(() => {
    seedAdminSession();
  });

  it('lists users and opens detail', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRouter />, { route: '/admin/users' });

    const main = await screen.findByRole('main');
    await waitFor(() => {
      expect(within(main).getByRole('heading', { name: /^app users$/i })).toBeInTheDocument();
    });

    expect(await within(main).findByText(/operator@palpeer.local/i)).toBeInTheDocument();

    const operatorRow = within(main).getByText(/operator@palpeer.local/i).closest('tr');
    expect(operatorRow).toBeTruthy();
    await user.click(within(operatorRow as HTMLElement).getByRole('button', { name: /open/i }));

    const detailMain = await screen.findByRole('main');
    expect(
      await within(detailMain).findByRole('heading', { name: /operator@palpeer.local/i }),
    ).toBeInTheDocument();
  });
});
