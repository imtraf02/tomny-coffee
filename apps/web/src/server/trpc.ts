import { initTRPC, TRPCError } from '@trpc/server'
import { getCurrentUser } from './auth'

export async function createContext(request: Request) {
  return { request, user: await getCurrentUser(request) }
}

const t = initTRPC.context<Awaited<ReturnType<typeof createContext>>>().create()
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, user: ctx.user } })
})

export const appRouter = t.router({
  health: t.procedure.query(() => ({ ok: true, now: new Date().toISOString() })),
  auth: t.router({ me: protectedProcedure.query(({ ctx }) => ctx.user) }),
})

export type AppRouter = typeof appRouter
