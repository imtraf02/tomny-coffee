import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { getCurrentUser, requirePermission } from '../../server/auth'
import { writeAudit } from '../../server/audit'

const tableStatus = z.enum(['trong', 'dang_phuc_vu', 'dat_truoc', 'can_don'])
const tableUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(40).optional(),
  capacity: z.number().int().min(1).max(30).optional(),
  zoneId: z.string().uuid().nullable().optional(),
  shape: z.enum(['square', 'round']).optional(),
  status: tableStatus.optional(),
  posX: z.number().min(0).max(100).optional(),
  posY: z.number().min(0).max(100).optional(),
}).refine((update) => Object.keys(update).length > 1, 'Cần có dữ liệu để cập nhật.')
const createSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('createZone'), name: z.string().trim().min(1).max(60) }),
  z.object({ action: z.literal('createTable'), zoneId: z.string().uuid(), name: z.string().trim().min(1).max(40), capacity: z.number().int().min(1).max(30).default(4), shape: z.enum(['square', 'round']).default('square') }),
])

export const Route = createFileRoute('/api/floor-plan')({ server: { handlers: { GET: listFloorPlan, POST: createFloorPlanItem, PUT: updateTables } } })

async function listFloorPlan({ request }: { request: Request }) {
  requirePermission(await getCurrentUser(request), 'floor_plan.read')
  const [zones, tables] = await Promise.all([
    env.DB.prepare('SELECT id, name FROM zones ORDER BY name').all(),
    env.DB.prepare(`SELECT t.id, t.zone_id AS zoneId, t.name, t.capacity, t.pos_x AS posX, t.pos_y AS posY, t.shape, t.status AS storedStatus,
      CASE
        WHEN t.status IN ('dat_truoc', 'can_don') THEN t.status
        WHEN EXISTS (SELECT 1 FROM orders o WHERE o.table_id = t.id AND o.status IN ('draft', 'sync_pending')) THEN 'dang_phuc_vu'
        ELSE 'trong'
      END AS status
      FROM "tables" t ORDER BY t.name`).all(),
  ])
  return Response.json({ zones: zones.results, tables: tables.results })
}

async function updateTables({ request }: { request: Request }) {
  const actor = requirePermission(await getCurrentUser(request), 'floor_plan.manage')
  const input = z.object({ tables: z.array(tableUpdateSchema).min(1).max(100) }).safeParse(await request.json().catch(() => null))
  if (!input.success) return Response.json({ message: 'Dữ liệu bàn không hợp lệ.' }, { status: 400 })

  const statements = input.data.tables.map((table) => {
    const updates: string[] = []
    const values: unknown[] = []
    if (table.name !== undefined) { updates.push('name = ?'); values.push(table.name) }
    if (table.capacity !== undefined) { updates.push('capacity = ?'); values.push(table.capacity) }
    if (table.zoneId !== undefined) { updates.push('zone_id = ?'); values.push(table.zoneId) }
    if (table.shape !== undefined) { updates.push('shape = ?'); values.push(table.shape) }
    if (table.status !== undefined) { updates.push('status = ?'); values.push(table.status) }
    if (table.posX !== undefined) { updates.push('pos_x = ?'); values.push(table.posX) }
    if (table.posY !== undefined) { updates.push('pos_y = ?'); values.push(table.posY) }
    return env.DB.prepare(`UPDATE "tables" SET ${updates.join(', ')} WHERE id = ?`).bind(...values, table.id)
  })
  await env.DB.batch(statements)
  const revisionId = crypto.randomUUID()
  await writeAudit(actor.id, 'floor_plan', revisionId, 'tables_updated', input.data)
  return Response.json({ ok: true, revisionId })
}

async function createFloorPlanItem({ request }: { request: Request }) {
  const actor = requirePermission(await getCurrentUser(request), 'floor_plan.manage')
  const input = createSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return Response.json({ message: 'Dữ liệu tạo zone/bàn không hợp lệ.' }, { status: 400 })
  const id = crypto.randomUUID()
  try {
    if (input.data.action === 'createZone') {
      await env.DB.prepare('INSERT INTO zones (id, name) VALUES (?, ?)').bind(id, input.data.name).run()
      await writeAudit(actor.id, 'zone', id, 'created', input.data)
      return Response.json({ id, type: 'zone' }, { status: 201 })
    }
    await env.DB.prepare('INSERT INTO "tables" (id, zone_id, name, capacity, pos_x, pos_y, shape, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, input.data.zoneId, input.data.name, input.data.capacity, 50, 50, input.data.shape, 'trong').run()
    await writeAudit(actor.id, 'table', id, 'created', input.data)
    return Response.json({ id, type: 'table' }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error && error.message.includes('UNIQUE') ? 'Tên zone hoặc bàn đã tồn tại trong khu vực này.' : 'Không thể tạo dữ liệu sơ đồ.'
    return Response.json({ message }, { status: 409 })
  }
}
