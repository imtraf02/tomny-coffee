import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCContext } from '@trpc/tanstack-react-query'
import type { AppRouter } from '../server/trpc'

export const trpcClient = createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: '/api/trpc' })] })
export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>()
