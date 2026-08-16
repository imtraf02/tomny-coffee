import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { createFileRoute } from '@tanstack/react-router'
import { appRouter, createContext } from '../../../server/trpc'

export const Route = createFileRoute('/api/trpc/$path')({ server: { handlers: { GET: handle, POST: handle } } })

async function handle({ request }: { request: Request }) {
  return fetchRequestHandler({ endpoint: '/api/trpc', req: request, router: appRouter, createContext: ({ req }) => createContext(req) })
}
