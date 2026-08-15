import { createFileRoute, redirect } from '@tanstack/react-router'
import { readSession } from '../server/session'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    throw redirect({ to: await readSession() ? '/pos' : '/login' })
  },
})
