import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { getCurrentUser, requirePermission } from '../../server/auth'
import { writeAudit } from '../../server/audit'

const reservationStatus = z.enum(['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'])
const entityId = z.string().trim().min(1).max(120)
const createSchema = z.object({ action: z.literal('create'), tableIds: z.array(entityId).min(1).max(8), customerName: z.string().trim().min(1).max(100), customerPhone: z.string().trim().max(30).nullable().default(null), partySize: z.number().int().min(1).max(50).default(2), startsAt: z.number().int().positive(), endsAt: z.number().int().positive(), note: z.string().trim().max(500).default('') }).refine((value) => value.endsAt > value.startsAt, { message: 'Thời gian kết thúc phải sau thời gian bắt đầu.', path: ['endsAt'] })
const updateSchema = z.object({ action: z.literal('updateStatus'), id: z.string().uuid(), status: reservationStatus })
const cancelSchema = z.object({ action: z.literal('cancel'), id: z.string().uuid(), reason: z.string().trim().min(3).max(250) })
const actionSchema = z.discriminatedUnion('action', [createSchema, updateSchema, cancelSchema])

type ReservationRow = { id: string; customerName: string; customerPhone: string | null; partySize: number; startsAt: number; endsAt: number; status: string; note: string; createdBy: string; createdAt: number; updatedAt: number; tableId: string; tableName: string }

export const Route = createFileRoute('/api/reservations')({ server: { handlers: { GET: listReservations, POST: mutateReservations } } })

async function listReservations({ request }: { request: Request }) {
  requirePermission(await getCurrentUser(request), 'floor_plan.read')
  const url = new URL(request.url)
  const tableId = url.searchParams.get('tableId')
  const from = Number(url.searchParams.get('from') ?? Date.now() - 86_400_000)
  const to = Number(url.searchParams.get('to') ?? Date.now() + 7 * 86_400_000)
  const conditions = ['r.ends_at > ?', 'r.starts_at < ?']
  const values: unknown[] = [from, to]
  if (tableId) { conditions.push('rt.table_id = ?'); values.push(tableId) }
  const rows = await env.DB.prepare(`SELECT r.id, r.customer_name AS customerName, r.customer_phone AS customerPhone, r.party_size AS partySize, r.starts_at AS startsAt, r.ends_at AS endsAt, r.status, r.note, r.created_by AS createdBy, r.created_at AS createdAt, r.updated_at AS updatedAt, rt.table_id AS tableId, t.name AS tableName FROM reservations r JOIN reservation_tables rt ON rt.reservation_id = r.id JOIN "tables" t ON t.id = rt.table_id WHERE ${conditions.join(' AND ')} ORDER BY r.starts_at, r.customer_name`).bind(...values).all<ReservationRow>()
  const grouped = new Map<string, Record<string, unknown> & { tableIds: string[]; tableNames: string[] }>()
  for (const row of rows.results) {
    const reservation = grouped.get(row.id) ?? { id: row.id, customerName: row.customerName, customerPhone: row.customerPhone, partySize: row.partySize, startsAt: row.startsAt, endsAt: row.endsAt, status: row.status, note: row.note, createdBy: row.createdBy, createdAt: row.createdAt, updatedAt: row.updatedAt, tableIds: [], tableNames: [] }
    reservation.tableIds.push(row.tableId)
    reservation.tableNames.push(row.tableName)
    grouped.set(row.id, reservation)
  }
  return Response.json({ reservations: [...grouped.values()] })
}

async function mutateReservations({ request }: { request: Request }) {
  const actor = requirePermission(await getCurrentUser(request), 'tables.operate')
  const input = actionSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return Response.json({ message: 'Dữ liệu đặt bàn không hợp lệ.', issues: input.error.issues }, { status: 400 })
  if (input.data.action === 'create') return createReservation(input.data, actor.id)
  if (input.data.action === 'updateStatus') return updateStatus(input.data, actor.id)
  return cancelReservation(input.data, actor.id)
}

async function createReservation(input: z.infer<typeof createSchema>, actorId: string) {
  const placeholders = input.tableIds.map(() => '?').join(',')
  const tables = await env.DB.prepare(`SELECT id, name FROM "tables" WHERE active = 1 AND id IN (${placeholders})`).bind(...input.tableIds).all<{ id: string; name: string }>()
  if (tables.results.length !== new Set(input.tableIds).size) return Response.json({ message: 'Một hoặc nhiều bàn không còn hoạt động.' }, { status: 409 })
  for (const tableId of input.tableIds) {
    const conflict = await env.DB.prepare(`SELECT r.id, r.customer_name AS customerName FROM reservations r JOIN reservation_tables rt ON rt.reservation_id = r.id WHERE rt.table_id = ? AND r.status IN ('pending', 'confirmed') AND r.starts_at < ? AND r.ends_at > ? LIMIT 1`).bind(tableId, input.endsAt, input.startsAt).first<{ id: string; customerName: string }>()
    if (conflict) return Response.json({ message: `Bàn ${tables.results.find((table) => table.id === tableId)?.name ?? tableId} đã có đặt bàn trùng thời gian.` }, { status: 409 })
  }
  const id = crypto.randomUUID()
  const now = Date.now()
  const statements: D1PreparedStatement[] = [env.DB.prepare('INSERT INTO reservations (id, customer_name, customer_phone, party_size, starts_at, ends_at, status, note, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, \'confirmed\', ?, ?, ?, ?, ?)').bind(id, input.customerName, input.customerPhone, input.partySize, input.startsAt, input.endsAt, input.note, actorId, actorId, now, now)]
  for (const tableId of input.tableIds) statements.push(env.DB.prepare('INSERT INTO reservation_tables (reservation_id, table_id) VALUES (?, ?)').bind(id, tableId))
  await env.DB.batch(statements)
  await writeAudit(env.DB, actorId, 'reservation', id, 'created', { tableIds: input.tableIds, startsAt: input.startsAt, endsAt: input.endsAt, partySize: input.partySize })
  return Response.json({ id, status: 'confirmed' }, { status: 201 })
}

async function updateStatus(input: z.infer<typeof updateSchema>, actorId: string) {
  const existing = await env.DB.prepare('SELECT id, status FROM reservations WHERE id = ?').bind(input.id).first<{ id: string; status: string }>()
  if (!existing) return Response.json({ message: 'Phiếu đặt bàn không tồn tại.' }, { status: 404 })
  const allowed: Record<string, string[]> = { pending: ['confirmed', 'cancelled', 'no_show'], confirmed: ['seated', 'cancelled', 'no_show'], seated: ['completed', 'cancelled'], completed: [], cancelled: [], no_show: [] }
  if (!allowed[existing.status]?.includes(input.status)) return Response.json({ message: `Không thể chuyển trạng thái từ ${existing.status} sang ${input.status}.` }, { status: 409 })
  await env.DB.prepare('UPDATE reservations SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?').bind(input.status, actorId, Date.now(), input.id).run()
  await writeAudit(env.DB, actorId, 'reservation', input.id, 'status_updated', { from: existing.status, to: input.status })
  return Response.json({ id: input.id, status: input.status })
}

async function cancelReservation(input: z.infer<typeof cancelSchema>, actorId: string) {
  const existing = await env.DB.prepare('SELECT id, status FROM reservations WHERE id = ?').bind(input.id).first<{ id: string; status: string }>()
  if (!existing) return Response.json({ message: 'Phiếu đặt bàn không tồn tại.' }, { status: 404 })
  if (['completed', 'cancelled', 'no_show'].includes(existing.status)) return Response.json({ message: 'Phiếu đặt bàn đã kết thúc, không thể hủy lại.' }, { status: 409 })
  await env.DB.prepare('UPDATE reservations SET status = \'cancelled\', note = CASE WHEN note = \'\' THEN ? ELSE note || \' · \' || ? END, updated_by = ?, updated_at = ? WHERE id = ?').bind(input.reason, input.reason, actorId, Date.now(), input.id).run()
  await writeAudit(env.DB, actorId, 'reservation', input.id, 'cancelled', { reason: input.reason, previousStatus: existing.status })
  return Response.json({ id: input.id, status: 'cancelled' })
}
