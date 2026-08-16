import { env } from 'cloudflare:workers'

const encoder = new TextEncoder()
const SESSION_COOKIE = 'tomny_session'
const SESSION_DAYS = 14

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function base64UrlToBytes(value: string) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
}

export async function digest(value: string) {
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))))
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const derived = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' }, key, 256)
  return `pbkdf2$310000$${bytesToBase64Url(salt)}$${bytesToBase64Url(new Uint8Array(derived))}`
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, rounds, salt, expected] = stored.split('$')
  if (algorithm !== 'pbkdf2' || !rounds || !salt || !expected) return false
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: base64UrlToBytes(salt), iterations: Number(rounds), hash: 'SHA-256' }, key, 256))
  const target = base64UrlToBytes(expected)
  if (actual.length !== target.length) return false
  return actual.reduce((same, byte, index) => same && byte === target[index], true)
}

export function cookieValue(request: Request, name: string) {
  return request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1)
}

export async function createSession(userId: string) {
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const id = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000)
  await env.DB.prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, userId, await digest(token), expiresAt.getTime(), Date.now()).run()
  return { token, expiresAt }
}

function secureAttribute(request?: Request) {
  if (!request) return 'Secure; '
  return new URL(request.url).protocol === 'https:' ? 'Secure; ' : ''
}

export function sessionCookie(token: string, expiresAt: Date, request?: Request) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; ${secureAttribute(request)}SameSite=Lax; Expires=${expiresAt.toUTCString()}`
}

export function expiredSessionCookie(request?: Request) { return `${SESSION_COOKIE}=; Path=/; HttpOnly; ${secureAttribute(request)}SameSite=Lax; Max-Age=0` }

export type CurrentUser = { id: string; email: string; displayName: string; permissions: string[] }

export async function getCurrentUser(request: Request): Promise<CurrentUser | null> {
  const token = cookieValue(request, SESSION_COOKIE)
  if (!token) return null
  const row = await env.DB.prepare(`SELECT users.id, users.email, users.display_name AS displayName FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.active = 1`).bind(await digest(token), Date.now()).first<{ id: string; email: string; displayName: string }>()
  if (!row) return null
  const permissionRows = await env.DB.prepare(`SELECT permissions.code FROM user_permissions JOIN permissions ON permissions.id = user_permissions.permission_id WHERE user_permissions.user_id = ?`).bind(row.id).all<{ code: string }>()
  return { ...row, permissions: permissionRows.results.map((permission) => permission.code) }
}

export async function destroySession(request: Request) {
  const token = cookieValue(request, SESSION_COOKIE)
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await digest(token)).run()
}

export function requirePermission(user: CurrentUser | null, permission: string) {
  if (!user || !user.permissions.includes(permission)) throw new Response('Bạn không có quyền thực hiện thao tác này.', { status: 403 })
  return user
}

export function hasPermission(user: CurrentUser | null, permission: string) {
  return Boolean(user?.permissions.includes(permission))
}

export function requireAnyPermission(user: CurrentUser | null, permissions: string[]) {
  if (!user || !permissions.some((permission) => user.permissions.includes(permission))) throw new Response('Bạn không có quyền truy cập khu vực này.', { status: 403 })
  return user
}

export function passwordPolicy(password: string) {
  return password.length >= 10 && password.length <= 128
}
