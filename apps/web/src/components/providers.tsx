import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { ToastProvider, Toaster } from '@/components/ui/toast'
import { TRPCProvider, trpcClient } from '../client/trpc'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1 } } })
  )
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <ToastProvider>
          {children}
          <Toaster />
        </ToastProvider>
      </TRPCProvider>
    </QueryClientProvider>
  )
}
