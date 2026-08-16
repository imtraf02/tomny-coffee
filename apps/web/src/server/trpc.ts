import { initTRPC, TRPCError } from '@trpc/server'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { getCurrentUser } from './auth'

export async function createContext(request: Request) {
  return { request, user: await getCurrentUser(request) }
}

const t = initTRPC.context<Awaited<ReturnType<typeof createContext>>>().create()
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, user: ctx.user } })
})

const permissionProcedure = (permission: string) => protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.permissions.includes(permission)) throw new TRPCError({ code: 'FORBIDDEN', message: 'Bạn không có quyền thực hiện thao tác này.' })
  return next()
})

export const appRouter = t.router({
  health: t.procedure.query(() => ({ ok: true, now: new Date().toISOString() })),
  auth: t.router({ me: protectedProcedure.query(({ ctx }) => ctx.user) }),
  inventory: t.router({
    list: permissionProcedure('inventory.read').query(async () => {
      const [rows, movements, value] = await Promise.all([
        env.DB.prepare('SELECT id, name, unit, reorder_point AS reorderPoint, current_quantity AS currentQuantity, active FROM ingredients ORDER BY active DESC, name').all<{ id: string; name: string; unit: string; reorderPoint: number; currentQuantity: number; active: number }>(),
        env.DB.prepare('SELECT id, ingredient_id AS ingredientId, type, quantity_delta AS quantityDelta, reason, created_at AS createdAt FROM inventory_movements ORDER BY created_at DESC LIMIT 300').all(),
        env.DB.prepare('SELECT COALESCE(SUM(remaining_quantity * unit_cost), 0) AS value FROM inventory_lots WHERE remaining_quantity > 0').first<{ value: number }>(),
      ])
      return { ingredients: rows.results.map((row) => ({ ...row, active: Boolean(row.active), lowStock: row.currentQuantity <= row.reorderPoint })), movements: movements.results, inventoryValue: Number(value?.value ?? 0) }
    }),
  }),
  reports: t.router({
    summary: permissionProcedure('reports.read').input(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).query(async ({ input }) => {
      const start = new Date(`${input.from}T00:00:00+07:00`).getTime()
      const end = new Date(`${input.to}T00:00:00+07:00`).getTime() + 86_400_000
      const summary = await env.DB.prepare(`SELECT COUNT(*) AS orderCount, COALESCE(SUM(total), 0) AS revenue, COALESCE(SUM(discount_amount), 0) AS discounts, COALESCE(SUM(cogs), 0) AS cogs, COALESCE(SUM(total - cogs), 0) AS grossMargin, COALESCE(AVG(total), 0) AS averageOrder FROM orders WHERE status = 'paid' AND created_at >= ? AND created_at < ?`).bind(start, end).first<Record<string, number>>()
      return { from: input.from, to: input.to, summary: { orderCount: Number(summary?.orderCount ?? 0), revenue: Number(summary?.revenue ?? 0), discounts: Number(summary?.discounts ?? 0), cogs: Number(summary?.cogs ?? 0), grossMargin: Number(summary?.grossMargin ?? 0), averageOrder: Number(summary?.averageOrder ?? 0) } }
    }),
  }),
})

export type AppRouter = typeof appRouter
