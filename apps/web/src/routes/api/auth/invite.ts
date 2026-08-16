import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { createSession, digest, hashPassword, passwordPolicy, sessionCookie } from '../../../server/auth'

const inputSchema = z.object({ token: z.string().min(30).max(100), password: z.string().min(10).max(128) })

export const Route = createFileRoute('/api/auth/invite')({ server: { handlers: { POST: acceptInvite } } })

async function acceptInvite({ request }: { request: Request }) {
  const input = inputSchema.safeParse(await request.json().catch(() => null))
  if (!input.success || !passwordPolicy(input.data.password)) return Response.json({ message: 'Mật khẩu phải dài từ 10 đến 128 ký tự.' }, { status: 400 })
  const invite = await env.DB.prepare('SELECT id, email, display_name AS displayName, permissions_json AS permissionsJson, expires_at AS expiresAt FROM invites WHERE token_hash = ? AND accepted_at IS NULL').bind(await digest(input.data.token)).first<{ id: string; email: string; displayName: string; permissionsJson: string; expiresAt: number }>()
  if (!invite || invite.expiresAt <= Date.now()) return Response.json({ message: 'Link mời không tồn tại hoặc đã hết hạn.' }, { status: 400 })
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(invite.email).first()
  if (existing) return Response.json({ message: 'Email này đã có tài khoản.' }, { status: 409 })
  const userId = crypto.randomUUID()
  const now = Date.now()
  const permissionCodes = JSON.parse(invite.permissionsJson) as string[]
  const permissions = await env.DB.prepare(`SELECT id, code FROM permissions WHERE code IN (${permissionCodes.map(() => '?').join(',') || "''"})`).bind(...permissionCodes).all<{ id: string; code: string }>()
  const statements: D1PreparedStatement[] = [
    env.DB.prepare('INSERT INTO users (id, email, display_name, password_hash, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)').bind(userId, invite.email, invite.displayName || invite.email, await hashPassword(input.data.password), now, now),
    env.DB.prepare('UPDATE invites SET accepted_at = ? WHERE id = ? AND accepted_at IS NULL').bind(now, invite.id),
  ]
  for (const permission of permissions.results) statements.push(env.DB.prepare('INSERT INTO user_permissions (user_id, permission_id, granted_at) VALUES (?, ?, ?)').bind(userId, permission.id, now))
  statements.push(env.DB.prepare('INSERT INTO audit_logs (id, actor_id, entity_type, entity_id, action, detail_json, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), 'user', userId, 'created_from_invite', JSON.stringify({ inviteId: invite.id, email: invite.email }), now))
  await env.DB.batch(statements)
  const session = await createSession(userId)
  return Response.json({ user: { id: userId, email: invite.email, displayName: invite.displayName } }, { headers: { 'set-cookie': sessionCookie(session.token, session.expiresAt, request) } })
}
