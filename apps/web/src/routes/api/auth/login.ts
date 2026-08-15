import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { createSession, sessionCookie, verifyPassword } from '../../../server/auth'
import { writeAudit } from '../../../server/audit'

export const Route = createFileRoute('/api/auth/login')({
  server: { handlers: { POST: login } },
})

async function login({ request }: { request: Request }) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null
  if (!body?.email || !body.password) return Response.json({ message: 'Nhập email và mật khẩu để tiếp tục.' }, { status: 400 })
  const user = await env.DB.prepare('SELECT id, email, display_name AS displayName, password_hash AS passwordHash FROM users WHERE email = ? AND active = 1').bind(body.email.trim().toLowerCase()).first<{ id: string; email: string; displayName: string; passwordHash: string }>()
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) return Response.json({ message: 'Email hoặc mật khẩu không đúng.' }, { status: 401 })
  const session = await createSession(user.id)
  await writeAudit(user.id, 'session', session.token.slice(0, 12), 'login', { email: user.email })
  return Response.json({ user: { id: user.id, email: user.email, displayName: user.displayName } }, { headers: { 'set-cookie': sessionCookie(session.token, session.expiresAt) } })
}
