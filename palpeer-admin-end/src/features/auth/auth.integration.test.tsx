import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRouter } from '@/app/router/AppRouter';
import { renderWithProviders } from '@/test/render';

async function signInAsAdmin() {
  const user = userEvent.setup();
  renderWithProviders(<AppRouter />, { route: '/sign-in' });

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  await user.type(screen.getByLabelText('Email'), 'ops@palpeer.local');
  await user.type(screen.getByLabelText('Password'), 'admin');
  await user.click(screen.getByRole('button', { name: /sign in/i }));

  await waitFor(() => {
    expect(screen.getByText(/palpeer control surface/i)).toBeInTheDocument();
  });

  return user;
}

describe('authentication integration', () => {
  it('signs in with mock credentials and reaches the dashboard', async () => {
    await signInAsAdmin();
    expect(screen.getAllByRole('link', { name: /^app users$/i }).length).toBeGreaterThan(0);
  });

  it('rejects invalid mock credentials', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRouter />, { route: '/sign-in' });

    await user.type(screen.getByLabelText('Email'), 'ops@palpeer.local');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });

  it('redirects unauthenticated users to sign-in', async () => {
    renderWithProviders(<AppRouter />, { route: '/admin/users' });
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });
});
