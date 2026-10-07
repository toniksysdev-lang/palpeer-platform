import { type ReactElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { ToastProvider } from '@/app/providers/ToastProvider';
import { AuthProvider } from '@/features/auth/AuthProvider';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

type Options = Omit<RenderOptions, 'wrapper'> & {
  route?: string;
  routerProps?: MemoryRouterProps;
  withAuth?: boolean;
};

export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const { route = '/', routerProps, withAuth = true, ...renderOptions } = options;
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    const inner = withAuth ? <AuthProvider>{children}</AuthProvider> : children;
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={[route]} {...routerProps}>
              {inner}
            </MemoryRouter>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  return {
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}
