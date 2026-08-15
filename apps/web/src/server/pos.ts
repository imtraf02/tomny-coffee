import { env } from 'cloudflare:workers'
import { calculateTotal, type Discount } from '../core/money'
import { getCurrentUser, requirePermission } from './auth'
import { writeAudit } from './audit'

export type CheckoutLine = { id: string; name: string; variant: string; unitPrice: number; quantity: number; recipeSnapshot?: unknown }
export type CashCheckout = { idempotencyKey: string; orderCode: string; deviceId: string; source: 'counter' | 'takeaway' | 'table'; tableId?: string; note?: string; receivedAmount: number; lines: CheckoutLine[]; discount?: Discount & { reason: string } }

export async function checkoutCash(request: Request, input: CashCheckout) {
  const actor = requirePermission(await getCurrentUser(request), 'pos.checkout')
  const existing = await env.DB.prepare('SELECT id, order_code AS orderCode, status, total FROM orders WHERE idempotency_key = ?').bind(input.idempotencyKey).first<{ id: string; orderCode: string; status: string; total: number }>()
  if (existing) return { ...existing, duplicate: true }
  const subtotal = input.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
  const { discountAmount, total } = calculateTotal(subtotal, input.discount)
  if (!input.lines.length || input.receivedAmount < total) throw new Response('Số tiền nhận không đủ để thanh toán đơn này.', { status: 400 })
  if (input.source === 'table') {
    const table = await env.DB.prepare('SELECT id, status FROM "tables" WHERE id = ?').bind(input.tableId).first<{ id: string; status: string }>()
    if (!table) throw new Response('Bàn đã chọn không tồn tại.', { status: 400 })
    if (table.status === 'dat_truoc') throw new Response('Bàn này đang được đặt trước. Chọn bàn khác hoặc cập nhật trạng thái bàn.', { status: 409 })
  }
  const now = Date.now()
  const orderId = crypto.randomUUID()
  const statements: D1PreparedStatement[] = [
    env.DB.prepare('INSERT INTO orders (id, order_code, idempotency_key, source, table_id, note, status, subtotal, discount_amount, total, cogs, created_by, paid_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(orderId, input.orderCode, input.idempotencyKey, input.source, input.tableId ?? null, input.note ?? '', 'completed', subtotal, discountAmount, total, 0, actor.id, now, now, now),
    env.DB.prepare('INSERT INTO payments (id, order_id, method, amount, received_amount, change_amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), orderId, 'cash', total, input.receivedAmount, input.receivedAmount - total, now),
    env.DB.prepare('INSERT INTO offline_sync_records (idempotency_key, order_id, device_id, synced_at) VALUES (?, ?, ?, ?)').bind(input.idempotencyKey, orderId, input.deviceId, now),
  ]
  for (const line of input.lines) statements.push(env.DB.prepare('INSERT INTO order_lines (id, order_id, name_snapshot, variant_snapshot, recipe_snapshot, unit_price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), orderId, line.name, line.variant, JSON.stringify(line.recipeSnapshot ?? []), line.unitPrice, line.quantity, line.unitPrice * line.quantity))
  if (input.discount && discountAmount > 0) statements.push(env.DB.prepare('INSERT INTO order_discounts (id, order_id, type, value, amount, reason, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), orderId, input.discount.type, input.discount.value, discountAmount, input.discount.reason, actor.id, now))
  await env.DB.batch(statements)
  await writeAudit(actor.id, 'order', orderId, 'cash_checkout', { orderCode: input.orderCode, subtotal, discountAmount, total, idempotencyKey: input.idempotencyKey })
  return { id: orderId, orderCode: input.orderCode, status: 'completed', total, change: input.receivedAmount - total, duplicate: false }
}
