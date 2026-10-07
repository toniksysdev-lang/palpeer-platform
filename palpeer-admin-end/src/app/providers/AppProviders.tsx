import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { ToastProvider } from '@/app/providers/ToastProvider';
import { ToastViewport } from '@/components/feedback/ToastViewport';
import { AuthProvider } from '@/features/auth/AuthProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            {children}
            <ToastViewport />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
