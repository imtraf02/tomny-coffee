import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { getCurrentUser, requirePermission } from '../../server/auth'

const inputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('clockIn'), note: z.string().trim().max(250).default('') }),
  z.object({ action: z.literal('clockOut'), note: z.string().trim().max(250).default('') }),
  z.object({ action: z.literal('edit'), entryId: z.string().uuid(), checkInAt: z.number().int().positive(), checkOutAt: z.number().int().positive().nullable(), note: z.string().trim().max(250).default('') }),
  z.object({ action: z.literal('approve'), entryId: z.string().uuid() }),
])

export const Route = createFileRoute('/api/timeclock')({ server: { handlers: { GET: getTimeclock, POST: mutateTimeclock } } })

async function getTimeclock({ request }: { request: Request }) {
  const actor = requirePermission(await getCurrentUser(request), 'timeclock.use')
  const canManage = actor.permissions.includes('timeclock.manage')
  const [current, entries] = await Promise.all([
    env.DB.prepare('SELECT id, check_in_at AS checkInAt, check_out_at AS checkOutAt, note FROM time_entries WHERE user_id = ? AND check_out_at IS NULL ORDER BY check_in_at DESC LIMIT 1').bind(actor.id).first(),
    canManage ? env.DB.prepare(`SELECT t.id, t.user_id AS userId, u.display_name AS userName, t.check_in_at AS checkInAt, t.check_out_at AS checkOutAt, t.approved_at AS approvedAt, t.note FROM time_entries t JOIN users u ON u.id = t.user_id ORDER BY t.check_in_at DESC LIMIT 500`).all() : env.DB.prepare(`SELECT id, user_id AS userId, check_in_at AS checkInAt, check_out_at AS checkOutAt, approved_at AS approvedAt, note FROM time_entries WHERE user_id = ? ORDER BY check_in_at DESC LIMIT 100`).bind(actor.id).all(),
  ])
  return Response.json({ current, entries: entries.results, canManage })
}

async function mutateTimeclock({ request }: { request: Request }) {
  const actor = requirePermission(await getCurrentUser(request), 'timeclock.use')
  const input = inputSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return Response.json({ message: 'Dữ liệu chấm công không hợp lệ.' }, { status: 400 })
  const now = Date.now()
  if (input.data.action === 'clockIn') {
    const open = await env.DB.prepare('SELECT id FROM time_entries WHERE user_id = ? AND check_out_at IS NULL').bind(actor.id).first()
    if (open) return Response.json({ message: 'Bạn đang có một ca chưa kết thúc.' }, { status: 409 })
    const id = crypto.randomUUID()
    await env.DB.prepare('INSERT INTO time_entries (id, user_id, check_in_at, check_out_at, note) VALUES (?, ?, ?, NULL, ?)').bind(id, actor.id, now, input.data.note).run()
    return Response.json({ id, checkInAt: now })
  }
  if (input.data.action === 'clockOut') {
    const result = await env.DB.prepare('UPDATE time_entries SET check_out_at = ?, note = CASE WHEN ? = \'\' THEN note ELSE ? END WHERE user_id = ? AND check_out_at IS NULL').bind(now, input.data.note, input.data.note, actor.id).run()
    if (!result.meta.changes) return Response.json({ message: 'Bạn chưa có ca đang mở.' }, { status: 409 })
    return Response.json({ checkOutAt: now })
  }
  requirePermission(actor, 'timeclock.manage')
  if (input.data.action === 'approve') {
    await env.DB.prepare('UPDATE time_entries SET approved_by = ?, approved_at = ? WHERE id = ?').bind(actor.id, now, input.data.entryId).run()
    return Response.json({ ok: true })
  }
  if (input.data.checkOutAt !== null && input.data.checkOutAt <= input.data.checkInAt) return Response.json({ message: 'Giờ ra phải sau giờ vào.' }, { status: 400 })
  await env.DB.prepare('UPDATE time_entries SET check_in_at = ?, check_out_at = ?, note = ?, approved_by = ?, approved_at = ? WHERE id = ?').bind(input.data.checkInAt, input.data.checkOutAt, input.data.note, actor.id, now, input.data.entryId).run()
  return Response.json({ ok: true })
}
