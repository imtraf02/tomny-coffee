import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { getCurrentUser, requirePermission } from '../../server/auth'
import { writeAudit } from '../../server/audit'

const tableStatus = z.enum(['trong', 'dang_phuc_vu', 'dat_truoc', 'can_don'])
const entityId = z.string().trim().min(1).max(120)
const tableUpdateSchema = z.object({
  id: entityId,
  name: z.string().trim().min(1).max(40).optional(),
  zoneId: entityId.nullable().optional(),
  shape: z.enum(['square', 'round']).optional(),
  status: tableStatus.optional(),
  statusOverride: z.enum(['dat_truoc', 'can_don']).nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  note: z.string().trim().max(300).optional(),
}).refine((update) => Object.keys(update).length > 1, 'Cần có dữ liệu để cập nhật.')
const zoneUpdateSchema = z.object({ id: entityId, name: z.string().trim().min(1).max(60).optional(), sortOrder: z.number().int().min(0).max(999).optional() }).refine((update) => Object.keys(update).length > 1, 'Cần có dữ liệu để cập nhật.')
const updateSchema = z.object({ tables: z.array(tableUpdateSchema).max(100).default([]), zones: z.array(zoneUpdateSchema).max(50).default([]) }).refine((input) => input.tables.length + input.zones.length > 0, 'Cần có dữ liệu để cập nhật.')
const createSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('createZone'), name: z.string().trim().min(1).max(60) }),
  z.object({ action: z.literal('createTable'), zoneId: entityId, name: z.string().trim().min(1).max(40), shape: z.enum(['square', 'round']).default('square'), note: z.string().trim().max(300).default('') }),
  z.object({ action: z.literal('archiveZone'), id: entityId }),
  z.object({ action: z.literal('archiveTable'), id: entityId }),
])

export const Route = createFileRoute('/api/floor-plan')({ server: { handlers: { GET: listTables, POST: mutateTables, PUT: updateTables } } })

async function listTables({ request }: { request: Request }) {
  requirePermission(await getCurrentUser(request), 'floor_plan.read')
  const [zones, rawTables, occupiedRows] = await Promise.all([
    env.DB.prepare('SELECT id, name, sort_order AS sortOrder FROM zones WHERE active = 1 ORDER BY sort_order, name').all(),
    env.DB.prepare(`
      SELECT t.id, t.zone_id AS zoneId, z.name AS zoneName, t.name, t.shape, t.note, t.sort_order AS sortOrder,
             t.status AS storedStatus, t.status_override AS statusOverride
      FROM "tables" t
      LEFT JOIN zones z ON z.id = t.zone_id
      WHERE t.active = 1 AND (t.zone_id IS NULL OR z.active = 1)
      ORDER BY COALESCE(z.sort_order, 999), t.sort_order, t.name
    `).all<{ id: string; zoneId: string | null; zoneName: string | null; name: string; shape: string; note: string; sortOrder: number; storedStatus: string; statusOverride: string | null }>(),
    env.DB.prepare(`
      SELECT ot.table_id AS tableId, o.id AS activeOrderId
      FROM order_tables ot
      JOIN orders o ON o.id = ot.order_id
      JOIN order_lines l ON l.order_id = o.id
      WHERE o.status = 'draft' AND l.line_status = 'active'
      GROUP BY ot.table_id
    `).all<{ tableId: string; activeOrderId: string }>(),
  ])

  const occupiedMap = new Map<string, string>()
  for (const row of occupiedRows.results) {
    occupiedMap.set(row.tableId, row.activeOrderId)
  }

  const tables = rawTables.results.map((t) => {
    const activeOrderId = occupiedMap.get(t.id) ?? null
    let status = 'trong'
    if (t.statusOverride === 'dat_truoc' || t.statusOverride === 'can_don') {
      status = t.statusOverride
    } else if (activeOrderId) {
      status = 'dang_phuc_vu'
    }
    return {
      id: t.id,
      zoneId: t.zoneId,
      zoneName: t.zoneName,
      name: t.name,
      shape: t.shape,
      note: t.note,
      sortOrder: t.sortOrder,
      storedStatus: t.storedStatus,
      status,
      activeOrderId,
    }
  })

  return Response.json({ zones: zones.results, tables })
}

async function updateTables({ request }: { request: Request }) {
  const actor = requirePermission(await getCurrentUser(request), 'floor_plan.manage')
  const input = updateSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return Response.json({ message: 'Dữ liệu bàn không hợp lệ.' }, { status: 400 })
  const now = Date.now()
  const statements = [
    ...input.data.zones.map((zone) => {
      const updates: string[] = []
      const values: unknown[] = []
      if (zone.name !== undefined) { updates.push('name = ?'); values.push(zone.name) }
      if (zone.sortOrder !== undefined) { updates.push('sort_order = ?'); values.push(zone.sortOrder) }
      return env.DB.prepare(`UPDATE zones SET ${updates.join(', ')} WHERE id = ? AND active = 1`).bind(...values, zone.id)
    }),
    ...input.data.tables.map((table) => {
      const updates: string[] = []
      const values: unknown[] = []
      if (table.name !== undefined) { updates.push('name = ?'); values.push(table.name) }
      if (table.zoneId !== undefined) { updates.push('zone_id = ?'); values.push(table.zoneId) }
      if (table.shape !== undefined) { updates.push('shape = ?'); values.push(table.shape) }
      if (table.note !== undefined) { updates.push('note = ?'); values.push(table.note) }
      if (table.status !== undefined) { updates.push('status_override = ?'); values.push(table.status === 'dat_truoc' || table.status === 'can_don' ? table.status : null) }
      if (table.statusOverride !== undefined && table.status === undefined) { updates.push('status_override = ?'); values.push(table.statusOverride) }
      if (table.sortOrder !== undefined) { updates.push('sort_order = ?'); values.push(table.sortOrder) }
      updates.push('updated_at = ?'); values.push(now)
      return env.DB.prepare(`UPDATE "tables" SET ${updates.join(', ')} WHERE id = ? AND active = 1`).bind(...values, table.id)
    }),
  ]
  await env.DB.batch(statements)
  const revisionId = crypto.randomUUID()
  await writeAudit(env.DB, actor.id, 'tables', revisionId, 'updated', input.data)
  return Response.json({ ok: true, revisionId })
}

async function mutateTables({ request }: { request: Request }) {
  const actor = requirePermission(await getCurrentUser(request), 'floor_plan.manage')
  const input = createSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return Response.json({ message: 'Dữ liệu bàn/khu vực không hợp lệ.' }, { status: 400 })

  if (input.data.action === 'archiveZone') {
    const activeTable = await env.DB.prepare('SELECT id FROM "tables" WHERE zone_id = ? AND active = 1 LIMIT 1').bind(input.data.id).first()
    if (activeTable) return Response.json({ message: 'Chuyển hoặc xóa các bàn trong khu vực trước khi xóa.' }, { status: 409 })
    await env.DB.prepare('UPDATE zones SET active = 0 WHERE id = ?').bind(input.data.id).run()
    await writeAudit(env.DB, actor.id, 'zone', input.data.id, 'archived', input.data)
    return Response.json({ ok: true })
  }

  if (input.data.action === 'archiveTable') {
    const openOrder = await env.DB.prepare("SELECT 1 FROM orders o JOIN order_lines l ON l.order_id = o.id WHERE o.table_id = ? AND o.status = 'draft' AND l.line_status = 'active' LIMIT 1").bind(input.data.id).first()
    if (openOrder) return Response.json({ message: 'Không thể xóa bàn đang có đơn mở.' }, { status: 409 })
    await env.DB.prepare('UPDATE "tables" SET active = 0, updated_at = ? WHERE id = ?').bind(Date.now(), input.data.id).run()
    await writeAudit(env.DB, actor.id, 'table', input.data.id, 'archived', input.data)
    return Response.json({ ok: true })
  }

  const id = crypto.randomUUID()
  try {
    if (input.data.action === 'createZone') {
      await env.DB.prepare('INSERT INTO zones (id, name, active, sort_order) VALUES (?, ?, 1, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM zones))').bind(id, input.data.name).run()
      await writeAudit(env.DB, actor.id, 'zone', id, 'created', input.data)
      return Response.json({ id, type: 'zone' }, { status: 201 })
    }
    const zone = await env.DB.prepare('SELECT id FROM zones WHERE id = ? AND active = 1').bind(input.data.zoneId).first()
    if (!zone) return Response.json({ message: 'Khu vực đã chọn không tồn tại hoặc đã bị xóa.' }, { status: 400 })
    const now = Date.now()
    await env.DB.prepare('INSERT INTO "tables" (id, zone_id, name, pos_x, pos_y, shape, status, active, sort_order, status_override, note, created_at, updated_at) VALUES (?, ?, ?, 0, 0, ?, ?, 1, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM "tables" WHERE zone_id = ?), NULL, ?, ?, ?)').bind(id, input.data.zoneId, input.data.name, input.data.shape, 'trong', input.data.zoneId, input.data.note, now, now).run()
    await writeAudit(env.DB, actor.id, 'table', id, 'created', input.data)
    return Response.json({ id, type: 'table' }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error && error.message.includes('UNIQUE') ? 'Tên khu vực hoặc bàn đã tồn tại.' : 'Không thể lưu dữ liệu bàn.'
    return Response.json({ message }, { status: 409 })
  }
}
