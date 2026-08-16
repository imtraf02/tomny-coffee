import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { digest, getCurrentUser, requirePermission } from '../../server/auth'

const permissionCodes = z.array(z.string().regex(/^[a-z]+(?:\.[a-z]+)+$/)).min(1).max(40)
const inputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('invite'), email: z.string().email().max(160), displayName: z.string().trim().min(1).max(100), permissions: permissionCodes }),
  z.object({ action: z.literal('updateUser'), userId: z.string().uuid(), active: z.boolean().optional(), permissions: permissionCodes.optional() }),
])

export const Route = createFileRoute('/api/staff')({ server: { handlers: { GET: listStaff, POST: mutateStaff } } })

async function listStaff({ request }: { request: Request }) {
  const actor = requirePermission(await getCurrentUser(request), 'staff.read')
  const [users, permissions, invites] = await Promise.all([
    env.DB.prepare('SELECT id, email, display_name AS displayName, active, created_at AS createdAt FROM users ORDER BY active DESC, display_name').all(),
    env.DB.prepare('SELECT id, code, label FROM permissions ORDER BY code').all(),
    actor.permissions.includes('staff.manage') ? env.DB.prepare('SELECT id, email, display_name AS displayName, expires_at AS expiresAt, accepted_at AS acceptedAt FROM invites WHERE accepted_at IS NULL AND expires_at > ? ORDER BY expires_at').bind(Date.now()).all() : Promise.resolve({ results: [] }),
  ])
  const userPermissions = await env.DB.prepare('SELECT user_id AS userId, permissions.code FROM user_permissions JOIN permissions ON permissions.id = user_permissions.permission_id').all<{ userId: string; code: string }>()
  const permissionsByUser = new Map<string, string[]>()
  for (const row of userPermissions.results) permissionsByUser.set(row.userId, [...(permissionsByUser.get(row.userId) ?? []), row.code])
  return Response.json({ users: users.results.map((user) => ({ ...user, active: Boolean((user as { active: number }).active), permissions: permissionsByUser.get((user as { id: string }).id) ?? [] })), permissions: permissions.results, invites: invites.results })
}

async function mutateStaff({ request }: { request: Request }) {
  const actor = requirePermission(await getCurrentUser(request), 'staff.manage')
  const input = inputSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return Response.json({ message: 'Dữ liệu nhân viên không hợp lệ.', issues: input.error.issues }, { status: 400 })
  const requestedPermissions = [...new Set(input.data.permissions ?? [])]
  const known = await env.DB.prepare(`SELECT id, code FROM permissions WHERE code IN (${requestedPermissions.map(() => '?').join(',') || "''"})`).bind(...requestedPermissions).all<{ id: string; code: string }>()
  if (known.results.length !== requestedPermissions.length) return Response.json({ message: 'Có permission không tồn tại.' }, { status: 400 })
  const now = Date.now()
  try {
    if (input.data.action === 'invite') {
      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`
      const id = crypto.randomUUID()
      const expiresAt = now + 48 * 60 * 60_000
      await env.DB.batch([
        env.DB.prepare('INSERT INTO invites (id, email, display_name, token_hash, permissions_json, expires_at, accepted_at, created_by) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)').bind(id, input.data.email.trim().toLowerCase(), input.data.displayName, await digest(token), JSON.stringify(requestedPermissions), expiresAt, actor.id),
        env.DB.prepare('INSERT INTO audit_logs (id, actor_id, entity_type, entity_id, action, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), actor.id, 'invite', id, 'created', JSON.stringify({ email: input.data.email, permissions: requestedPermissions, expiresAt }), now),
      ])
      return Response.json({ id, token, expiresAt })
    }
    const user = await env.DB.prepare('SELECT id, email FROM users WHERE id = ?').bind(input.data.userId).first<{ id: string; email: string }>()
    if (!user) return Response.json({ message: 'Nhân viên không tồn tại.' }, { status: 404 })
    if (user.id === actor.id && input.data.active === false) return Response.json({ message: 'Không thể tự vô hiệu hóa tài khoản đang đăng nhập.' }, { status: 400 })
    if (user.id === actor.id && input.data.permissions && !requestedPermissions.includes('settings.manage')) return Response.json({ message: 'Không thể tự thu hồi quyền quản trị.' }, { status: 400 })
    const statements: D1PreparedStatement[] = []
    if (input.data.active !== undefined) statements.push(env.DB.prepare('UPDATE users SET active = ?, updated_at = ? WHERE id = ?').bind(Number(input.data.active), now, user.id))
    if (input.data.permissions) {
      statements.push(env.DB.prepare('DELETE FROM user_permissions WHERE user_id = ?').bind(user.id))
      for (const permission of known.results) statements.push(env.DB.prepare('INSERT INTO user_permissions (user_id, permission_id, granted_at) VALUES (?, ?, ?)').bind(user.id, permission.id, now))
    }
    statements.push(env.DB.prepare('INSERT INTO audit_logs (id, actor_id, entity_type, entity_id, action, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), actor.id, 'user', user.id, 'updated', JSON.stringify({ active: input.data.active, permissions: requestedPermissions }), now))
    await env.DB.batch(statements)
    return Response.json({ id: user.id })
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : 'Không thể lưu nhân viên.' }, { status: 409 })
  }
}
