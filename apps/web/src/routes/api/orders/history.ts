import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { getCurrentUser, requireAnyPermission, requirePermission } from '../../../server/auth'
import { cancelOrder, getOrderDetail } from '../../../server/order-service'

const querySchema = z.object({
  id: z.string().uuid().optional(),
  status: z.enum(['all', 'draft', 'paid', 'cancelled']).default('all'),
  search: z.string().trim().max(100).default(''),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const Route = createFileRoute('/api/orders/history')({ server: { handlers: { GET: listOrders, POST: orderAction } } })

async function listOrders({ request }: { request: Request }) {
  requirePermission(await getCurrentUser(request), 'orders.read')
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = querySchema.safeParse(params)
  if (!parsed.success) return Response.json({ message: 'Bộ lọc đơn hàng không hợp lệ.' }, { status: 400 })
  if (parsed.data.id) {
    try { return Response.json({ order: await getOrderDetail(env.DB, parsed.data.id) }) }
    catch (error) { if (error instanceof Response) return error; return Response.json({ message: 'Đơn không tồn tại.' }, { status: 404 }) }
  }
  const conditions = ['1 = 1']
  const values: unknown[] = []
  if (parsed.data.status !== 'all') { conditions.push('o.status = ?'); values.push(parsed.data.status) }
  if (parsed.data.search) { conditions.push('(o.order_code LIKE ? OR t.name LIKE ? OR u.display_name LIKE ?)'); const term = `%${parsed.data.search}%`; values.push(term, term, term) }
  if (parsed.data.from) { conditions.push('o.created_at >= ?'); values.push(new Date(`${parsed.data.from}T00:00:00+07:00`).getTime()) }
  if (parsed.data.to) { conditions.push('o.created_at < ?'); values.push(new Date(`${parsed.data.to}T00:00:00+07:00`).getTime() + 86_400_000) }
  const rows = await env.DB.prepare(`
    SELECT o.id, o.order_code AS orderCode, o.display_number AS displayNumber, o.business_date AS businessDate, o.source, o.table_id AS tableId, t.name AS tableName,
      o.status, o.subtotal, o.discount_amount AS discountAmount,
      o.total, o.note, o.created_at AS createdAt, o.updated_at AS updatedAt,
      o.paid_at AS paidAt, u.display_name AS cashier
    FROM orders o
    LEFT JOIN "tables" t ON t.id = o.table_id
    JOIN users u ON u.id = o.created_by
    WHERE ${conditions.join(' AND ')}
    ORDER BY o.created_at DESC LIMIT 500
  `).bind(...values).all()
  return Response.json({ orders: rows.results })
}

async function orderAction({ request }: { request: Request }) {
  const actor = requireAnyPermission(await getCurrentUser(request), ['orders.manage', 'pos.cancel'])
  const body = await request.json().catch(() => null) as { action?: string; orderId?: string; expectedVersion?: number; reason?: string; manager?: { email?: string; password?: string } } | null
  if (!body || body.action !== 'cancel' || !body.orderId || !z.string().uuid().safeParse(body.orderId).success || !body.reason || body.reason.trim().length < 3) return Response.json({ message: 'Cần mã đơn và lý do hủy hợp lệ.' }, { status: 400 })
  const manager = body.manager?.email && body.manager.password ? { email: body.manager.email, password: body.manager.password } : undefined
  try { return Response.json(await cancelOrder(env.DB, actor, { orderId: body.orderId, expectedVersion: body.expectedVersion, reason: body.reason, manager })) }
  catch (error) { if (error instanceof Response) return error; return Response.json({ message: 'Không thể hủy đơn.' }, { status: 500 }) }
}