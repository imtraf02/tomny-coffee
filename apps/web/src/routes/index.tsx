import { createFileRoute, redirect } from '@tanstack/react-router'
import { readSession } from '../server/session'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const user = await readSession()
    throw redirect({ to: user ? (user.permissions.includes('pos.read') ? '/pos' : user.permissions.includes('kds.read') ? '/kds' : '/admin') : '/login' })
  },
})
