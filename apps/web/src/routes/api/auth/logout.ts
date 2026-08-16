import { createFileRoute } from '@tanstack/react-router'
import { destroySession, expiredSessionCookie } from '../../../server/auth'

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await destroySession(request)
        return Response.json({ ok: true }, { headers: { 'set-cookie': expiredSessionCookie(request) } })
      },
    },
  },
})
