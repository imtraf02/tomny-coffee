import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { createSession, digest, sessionCookie, verifyPassword } from '../../../server/auth'
import { writeAudit } from '../../../server/audit'

export const Route = createFileRoute('/api/auth/login')({
  server: { handlers: { POST: login } },
})

async function login({ request }: { request: Request }) {
  const body = await request.json().catch(() => null) as { username?: string; email?: string; password?: string } | null
  const identifier = (body?.username || body?.email || '').trim().toLowerCase()
  if (!identifier || !body?.password) return Response.json({ message: 'Nhập tên đăng nhập và mật khẩu để tiếp tục.' }, { status: 400 })
  const address = request.headers.get('CF-Connecting-IP') ?? 'local'
  const identityKey = await digest(`${identifier}|${address}`)
  const windowStart = Date.now() - 15 * 60_000
  const attempts = await env.DB.prepare('SELECT COUNT(*) AS count FROM login_attempts WHERE identity_key = ? AND succeeded = 0 AND created_at >= ?').bind(identityKey, windowStart).first<{ count: number }>()
  if ((attempts?.count ?? 0) >= 10) return Response.json({ message: 'Có quá nhiều lần thử. Đợi 15 phút rồi đăng nhập lại.' }, { status: 429 })
  const user = await env.DB.prepare('SELECT id, username, email, display_name AS displayName, password_hash AS passwordHash FROM users WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND active = 1').bind(identifier, identifier).first<{ id: string; username?: string; email?: string; displayName: string; passwordHash: string }>()
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    await env.DB.prepare('INSERT INTO login_attempts (id, identity_key, succeeded, created_at) VALUES (?, ?, 0, ?)').bind(crypto.randomUUID(), identityKey, Date.now()).run()
    return Response.json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.' }, { status: 401 })
  }
  await env.DB.prepare('INSERT INTO login_attempts (id, identity_key, succeeded, created_at) VALUES (?, ?, 1, ?)').bind(crypto.randomUUID(), identityKey, Date.now()).run()
  const session = await createSession(user.id)
  const username = user.username || (user.email ? user.email.split('@')[0] : 'user')
  await writeAudit(env.DB, user.id, 'session', session.token.slice(0, 12), 'login', { username })
  return Response.json({ user: { id: user.id, username, displayName: user.displayName } }, { headers: { 'set-cookie': sessionCookie(session.token, session.expiresAt, request) } })
}
