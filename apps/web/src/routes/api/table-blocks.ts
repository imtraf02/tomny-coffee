import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { getCurrentUser, requirePermission } from '../../server/auth'
import { writeAudit } from '../../server/audit'

const kindSchema = z.enum(['reserved_hold', 'cleaning', 'maintenance'])
const entityId = z.string().trim().min(1).max(120)
const createSchema = z.object({ action: z.literal('create'), tableId: entityId, kind: kindSchema, reason: z.string().trim().max(250).default(''), startsAt: z.number().int().positive().optional(), endsAt: z.number().int().positive().nullable().default(null) }).refine((value) => value.endsAt === null || value.endsAt > (value.startsAt ?? Date.now()), { message: 'Thời gian kết thúc phải sau thời gian bắt đầu.', path: ['endsAt'] })
const resolveSchema = z.object({ action: z.literal('resolve'), id: z.string().uuid() })
const actionSchema = z.discriminatedUnion('action', [createSchema, resolveSchema])

type BlockRow = { id: string; tableId: string; tableName: string; kind: string; reason: string; startsAt: number; endsAt: number | null; createdBy: string; createdAt: number; resolvedAt: number | null }

export const Route = createFileRoute('/api/table-blocks')({ server: { handlers: { GET: listBlocks, POST: mutateBlocks } } })

async function listBlocks({ request }: { request: Request }) {
  requirePermission(await getCurrentUser(request), 'floor_plan.read')
  const tableId = new URL(request.url).searchParams.get('tableId')
  const values: unknown[] = []
  const condition = tableId ? 'WHERE b.table_id = ?' : ''
  if (tableId) values.push(tableId)
  const rows = await env.DB.prepare(`SELECT b.id, b.table_id AS tableId, t.name AS tableName, b.kind, b.reason, b.starts_at AS startsAt, b.ends_at AS endsAt, b.created_by AS createdBy, b.created_at AS createdAt, b.resolved_at AS resolvedAt FROM table_blocks b JOIN "tables" t ON t.id = b.table_id ${condition} ORDER BY b.resolved_at IS NOT NULL, b.starts_at DESC`).bind(...values).all<BlockRow>()
  return Response.json({ blocks: rows.results })
}

async function mutateBlocks({ request }: { request: Request }) {
  const actor = requirePermission(await getCurrentUser(request), 'tables.operate')
  const input = actionSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return Response.json({ message: 'Dữ liệu trạng thái bàn không hợp lệ.', issues: input.error.issues }, { status: 400 })
  if (input.data.action === 'resolve') return resolveBlock(input.data.id, actor.id)
  const table = await env.DB.prepare('SELECT id, name FROM "tables" WHERE id = ? AND active = 1').bind(input.data.tableId).first<{ id: string; name: string }>()
  if (!table) return Response.json({ message: 'Bàn không tồn tại hoặc đã ngừng hoạt động.' }, { status: 404 })
  if (input.data.kind === 'maintenance' || input.data.kind === 'cleaning') {
    const open = await env.DB.prepare("SELECT 1 FROM orders o JOIN order_lines l ON l.order_id = o.id WHERE o.table_id = ? AND o.status = 'draft' AND l.line_status = 'active' LIMIT 1").bind(input.data.tableId).first()
    if (open) return Response.json({ message: 'Không thể khóa bàn khi còn đơn mở.' }, { status: 409 })
  }
  const id = crypto.randomUUID()
  const now = Date.now()
  const startsAt = input.data.startsAt ?? now
  await env.DB.prepare('INSERT INTO table_blocks (id, table_id, kind, reason, starts_at, ends_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, input.data.tableId, input.data.kind, input.data.reason, startsAt, input.data.endsAt, actor.id, now).run()
  await writeAudit(env.DB, actor.id, 'table_block', id, 'created', { tableId: input.data.tableId, kind: input.data.kind, reason: input.data.reason, startsAt, endsAt: input.data.endsAt })
  return Response.json({ id, tableId: input.data.tableId, kind: input.data.kind }, { status: 201 })
}

async function resolveBlock(id: string, actorId: string) {
  const existing = await env.DB.prepare('SELECT id, table_id AS tableId, kind FROM table_blocks WHERE id = ? AND resolved_at IS NULL').bind(id).first<{ id: string; tableId: string; kind: string }>()
  if (!existing) return Response.json({ message: 'Trạng thái bàn đã được xử lý hoặc không tồn tại.' }, { status: 404 })
  const now = Date.now()
  await env.DB.batch([
    env.DB.prepare('UPDATE table_blocks SET resolved_by = ?, resolved_at = ?, ends_at = COALESCE(ends_at, ?) WHERE id = ?').bind(actorId, now, now, id),
    env.DB.prepare("UPDATE \"tables\" SET status_override = NULL, updated_at = ? WHERE id = ? AND status_override IN ('dat_truoc', 'can_don')").bind(now, existing.tableId),
  ])
  await writeAudit(env.DB, actorId, 'table_block', id, 'resolved', { tableId: existing.tableId, kind: existing.kind })
  return Response.json({ id, resolvedAt: now })
}
