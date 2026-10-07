import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { AppRouter } from '@/app/router/AppRouter';
import { persistSession } from '@/features/auth/session';
import { mockLogin } from '@/mocks/auth';
import { renderWithProviders } from '@/test/render';

describe('p2p module integration', () => {
  beforeEach(() => {
    persistSession(mockLogin({ email: 'ops@palpeer.local', password: 'admin' }), false);
  });

  it('lists p2p requests and orders', async () => {
    renderWithProviders(<AppRouter />, { route: '/admin/p2p' });

    const main = await screen.findByRole('main');
    await waitFor(() => {
      expect(within(main).getByRole('heading', { name: /^p2p$/i })).toBeInTheDocument();
    });

    // Mock fixture: BUY NGN/CAD (side + base/quote)
    expect(await within(main).findByText(/BUY\s+NGN\/CAD/i)).toBeInTheDocument();
    expect(within(main).getByText('req-1')).toBeInTheDocument();
  });
});
