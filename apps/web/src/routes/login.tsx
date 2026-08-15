import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { readSession } from '../server/session'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ next: z.string().optional() }),
  beforeLoad: async () => {
    if (await readSession()) throw redirect({ to: '/pos' })
  },
  component: Login,
})

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { next } = Route.useSearch()
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setMessage('')
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const body = await response.json() as { message?: string }
      if (!response.ok) { setMessage(body.message ?? 'Không thể đăng nhập.'); return }
      window.location.assign(next && next.startsWith('/') && !next.startsWith('//') ? next : '/pos')
    } catch { setMessage('Không thể kết nối máy chủ. Kiểm tra lại mạng rồi thử lại.') }
    finally { setSubmitting(false) }
  }
  return <main className="login-shell"><form className="login-card" onSubmit={submit}><p className="eyebrow">TOMNY COFFEE · NỘI BỘ</p><h1>Đăng nhập ca làm</h1><p>Chỉ nhân viên được cấp tài khoản mới có thể tiếp tục.</p><label>Email<input required autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Mật khẩu<input required autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{message && <p className="form-message" role="alert">{message}</p>}<button className="ember-button" disabled={submitting}>{submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}</button></form></main>
}
