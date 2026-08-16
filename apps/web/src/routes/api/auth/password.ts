import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { digest, getCurrentUser, hashPassword, passwordPolicy, requireAnyPermission } from '../../../server/auth'
import { cookieValue } from '../../../server/auth'

const inputSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(10).max(128) })

export const Route = createFileRoute('/api/auth/password')({ server: { handlers: { POST: changePassword } } })

async function changePassword({ request }: { request: Request }) {
  const actor = requireAnyPermission(await getCurrentUser(request), ['pos.read', 'menu.read', 'inventory.read', 'floor_plan.read', 'staff.read', 'reports.read', 'audit.read'])
  const input = inputSchema.safeParse(await request.json().catch(() => null))
  if (!input.success || !passwordPolicy(input.data.newPassword)) return Response.json({ message: 'Mật khẩu mới phải dài từ 10 đến 128 ký tự.' }, { status: 400 })
  const row = await env.DB.prepare('SELECT password_hash AS passwordHash FROM users WHERE id = ?').bind(actor.id).first<{ passwordHash: string }>()
  const { verifyPassword } = await import('../../../server/auth')
  if (!row || !(await verifyPassword(input.data.currentPassword, row.passwordHash))) return Response.json({ message: 'Mật khẩu hiện tại không đúng.' }, { status: 400 })
  const now = Date.now()
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').bind(await hashPassword(input.data.newPassword), now, actor.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').bind(actor.id, await digest(cookieValue(request, 'tomny_session') ?? '')),
  ])
  return Response.json({ ok: true })
}
