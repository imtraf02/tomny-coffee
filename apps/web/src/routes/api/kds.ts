import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { writeAudit } from '../../server/audit'
import { getCurrentUser, requirePermission } from '../../server/auth'

const updateSchema = z.object({
  action: z.literal('setStatus'),
  orderId: z.string().uuid(),
  status: z.enum(['new', 'making', 'ready', 'served']),
  expectedUpdatedAt: z.number().int().nonnegative().nullable().optional(),
})

export const Route = createFileRoute('/api/kds')({
  server: { handlers: { GET: listKdsOrders, POST: updateKdsOrder } },
})

async function listKdsOrders({ request }: { request: Request }) {
  requirePermission(await getCurrentUser(request), 'kds.read')
  const zoneId = new URL(request.url).searchParams.get('zoneId')
  const showHistory = new URL(request.url).searchParams.get('history') === 'true'
  const rows = await env.DB.prepare(`
    SELECT o.id, o.order_code AS orderCode, o.source, o.table_id AS tableId,
      t.name AS tableName, z.name AS zoneName, o.status, o.kds_status AS kdsStatus,
      o.kds_updated_at AS kdsUpdatedAt, o.created_at AS createdAt, o.updated_at AS updatedAt,
      o.note, u.display_name AS cashier
    FROM orders o
    LEFT JOIN "tables" t ON t.id = o.table_id
    LEFT JOIN zones z ON z.id = t.zone_id
    JOIN users u ON u.id = o.created_by
    WHERE o.status IN ('draft', 'paid')
      AND ${showHistory ? "o.kds_status = 'served'" : "o.kds_status <> 'served'"}
      AND EXISTS (SELECT 1 FROM order_lines l WHERE l.order_id = o.id)
      ${zoneId ? 'AND t.zone_id = ?' : ''}
    ORDER BY ${showHistory ? 'o.kds_updated_at DESC' : "CASE o.kds_status WHEN 'new' THEN 0 WHEN 'making' THEN 1 WHEN 'ready' THEN 2 ELSE 3 END, o.created_at ASC"}
    ${showHistory ? 'LIMIT 30' : ''}
  `).bind(...(zoneId ? [zoneId] : [])).all()

  const orderRows = rows.results as Array<{ id: string; [key: string]: unknown }>
  const orderIds = orderRows.map((r) => r.id)
  const linesByOrder = new Map<string, Array<Record<string, unknown>>>()
  for (const id of orderIds) linesByOrder.set(id, [])

  if (orderIds.length > 0) {
    const placeholders = orderIds.map(() => '?').join(',')
    const allLines = await env.DB.prepare(`
      SELECT l.order_id AS orderId, l.id, l.name_snapshot AS name, l.variant_snapshot AS variant,
        l.quantity, l.unit_price AS unitPrice, l.line_total AS lineTotal,
        lm.id AS modifierLineId, lm.name_snapshot AS modifierName, lm.price_delta AS priceDelta
      FROM order_lines l
      LEFT JOIN order_line_modifiers lm ON lm.order_line_id = l.id
      WHERE l.order_id IN (${placeholders}) ORDER BY l.id
    `).bind(...orderIds).all()

    const rawLinesByOrder = new Map<string, Map<string, Record<string, unknown>>>()
    for (const id of orderIds) rawLinesByOrder.set(id, new Map())

    for (const row of allLines.results as Array<Record<string, unknown>>) {
      const orderId = String(row.orderId)
      const lineMap = rawLinesByOrder.get(orderId)
      if (!lineMap) continue
      const lineId = String(row.id)
      const line = lineMap.get(lineId) ?? {
        id: lineId,
        name: row.name,
        variant: row.variant,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        lineTotal: row.lineTotal,
        modifiers: [] as unknown[],
      }
      if (row.modifierLineId) (line.modifiers as unknown[]).push({ name: row.modifierName, priceDelta: row.priceDelta })
      lineMap.set(lineId, line)
    }

    for (const [orderId, lineMap] of rawLinesByOrder.entries()) {
      linesByOrder.set(orderId, [...lineMap.values()])
    }
  }

  const orders = orderRows.map((row) => ({
    ...row,
    lines: linesByOrder.get(row.id) ?? [],
  }))

  return Response.json({ orders, polledAt: Date.now() })
}

async function updateKdsOrder({ request }: { request: Request }) {
  const actor = requirePermission(await getCurrentUser(request), 'kds.manage')
  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ message: 'Trạng thái pha chế không hợp lệ.', issues: parsed.error.issues }, { status: 400 })

  const order = await env.DB.prepare('SELECT id, order_code AS orderCode, kds_status AS kdsStatus, kds_updated_at AS kdsUpdatedAt FROM orders WHERE id = ?').bind(parsed.data.orderId).first<{ id: string; orderCode: string; kdsStatus: string; kdsUpdatedAt: number | null }>()
  if (!order) return Response.json({ message: 'Đơn không tồn tại.' }, { status: 404 })
  if (parsed.data.expectedUpdatedAt !== undefined && parsed.data.expectedUpdatedAt !== order.kdsUpdatedAt) return Response.json({ message: 'Đơn vừa được cập nhật trên màn hình khác. Tải lại danh sách.' }, { status: 409 })

  const now = Date.now()
  const result = await env.DB.prepare('UPDATE orders SET kds_status = ?, kds_updated_at = ?, updated_at = ? WHERE id = ? AND (kds_updated_at IS ? OR kds_updated_at = ?)').bind(parsed.data.status, now, now, order.id, order.kdsUpdatedAt, order.kdsUpdatedAt).run()
  if (!result.success || result.meta.changes !== 1) return Response.json({ message: 'Đơn vừa được cập nhật trên màn hình khác. Tải lại danh sách.' }, { status: 409 })
  await writeAudit(env.DB, actor.id, 'order', order.id, 'kds_status_changed', { orderCode: order.orderCode, from: order.kdsStatus, to: parsed.data.status })
  return Response.json({ id: order.id, status: parsed.data.status, updatedAt: now })
}

