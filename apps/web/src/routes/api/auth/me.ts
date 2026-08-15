import { createFileRoute } from '@tanstack/react-router'
import { getCurrentUser } from '../../../server/auth'

export const Route = createFileRoute('/api/auth/me')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getCurrentUser(request)
        return user ? Response.json({ user }) : Response.json({ user: null }, { status: 401 })
      },
    },
  },
})
