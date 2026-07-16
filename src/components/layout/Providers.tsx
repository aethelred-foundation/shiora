'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';
import { AppProvider } from '@/contexts/AppContext';
import { I18nProvider } from '@/contexts/I18nContext';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5000,
            refetchOnWindowFocus: false,
            // 401/403 mean "authenticate first" and 429 means "back off" —
            // retrying either just burns the client's rate-limit budget.
            retry: (failureCount, error) => {
              const status =
                error instanceof ApiError ? error.status : undefined;
              if (status === 401 || status === 403 || status === 429) {
                return false;
              }
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AppProvider>{children}</AppProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
