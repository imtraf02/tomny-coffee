import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { Field, Input, PrimaryButton } from '@/components/ui'
import { readSession } from '../server/session'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ next: z.string().optional() }),
  beforeLoad: async () => {
    const user = await readSession()
    if (user) throw redirect({ to: user.permissions.includes('pos.read') ? '/pos' : '/admin' })
  },
  component: Login,
})

function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { next } = Route.useSearch()

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const body = (await response.json()) as { message?: string }
      if (!response.ok) {
        setMessage(body.message ?? 'Không thể đăng nhập.')
        return
      }
      window.location.assign(next && next.startsWith('/') && !next.startsWith('//') ? next : '/pos')
    } catch {
      setMessage('Không thể kết nối máy chủ. Kiểm tra lại mạng rồi thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <p className="eyebrow">TOMNY COFFEE · NỘI BỘ</p>
        <h1>Đăng nhập ca làm</h1>
        <p>Chỉ nhân viên được cấp tài khoản mới có thể tiếp tục.</p>

        <Field.Root className="login-field">
          <Field.Label>Tên đăng nhập</Field.Label>
          <Input
            size="md"
            required
            autoComplete="username"
            type="text"
            placeholder="VD: admin, cashier..."
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </Field.Root>

        <Field.Root className="login-field">
          <Field.Label>Mật khẩu</Field.Label>
          <Input
            size="md"
            required
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field.Root>

        {message && <p className="form-message" role="alert">{message}</p>}

        <PrimaryButton size="lg" disabled={submitting} type="submit" className="w-full mt-2">
          {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </PrimaryButton>
      </form>
    </main>
  )
}
