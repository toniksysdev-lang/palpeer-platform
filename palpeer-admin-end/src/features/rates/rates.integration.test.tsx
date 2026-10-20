import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { AppRouter } from '@/app/router/AppRouter';
import { persistSession } from '@/features/auth/session';
import { mockLogin } from '@/mocks/auth';
import { renderWithProviders } from '@/test/render';

describe('rates module integration', () => {
  beforeEach(() => {
    persistSession(mockLogin({ email: 'ops@palpeer.local', password: 'admin' }), false);
  });

  it('loads the rates workspace', async () => {
    renderWithProviders(<AppRouter />, { route: '/admin/rates' });

    const main = await screen.findByRole('main');
    await waitFor(() => {
      expect(within(main).getByRole('heading', { name: /rates & currencies/i })).toBeInTheDocument();
    });

    expect((await within(main).findAllByText('USD')).length).toBeGreaterThan(0);
    expect(within(main).getAllByText('NGN').length).toBeGreaterThan(0);
  });
});
