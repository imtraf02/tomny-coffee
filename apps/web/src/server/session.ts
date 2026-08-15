import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getCurrentUser } from './auth'

/** Reads the user session for the current document/navigation request. */
export const readSession = createServerFn({ method: 'GET' }).handler(async () => {
  return getCurrentUser(getRequest())
})
