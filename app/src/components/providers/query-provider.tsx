'use client'

import { QueryClient, QueryClientProvider, type DefaultOptions } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
            // NOTE: `cacheTime` was renamed `gcTime` in React Query v5, so this option
            // is currently ignored at runtime; kept (behind a cast) to avoid changing behavior.
            cacheTime: 10 * 60 * 1000, // 10 minutes - cache retention
            retry: 2,
            refetchOnWindowFocus: false, // Don't refetch on window focus
            refetchOnReconnect: 'always', // Refetch on reconnect
          } as DefaultOptions['queries'],
          mutations: {
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}