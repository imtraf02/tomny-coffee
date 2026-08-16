import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Field, Input, PrimaryButton } from '@/components/ui'

export const Route = createFileRoute('/invite/$token')({ component: AcceptInvite })

function AcceptInvite() {
  const { token } = Route.useParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    if (password !== confirm) {
      setMessage('Hai mật khẩu chưa giống nhau.')
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const body = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) {
        setMessage(body.message ?? 'Link mời không còn hiệu lực.')
        return
      }
      window.location.assign('/pos')
    } catch {
      setMessage('Không thể kết nối máy chủ. Thử lại khi có mạng.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <p className="eyebrow">TOMNY COFFEE · THAM GIA</p>
        <h1>Đặt mật khẩu</h1>
        <p>Link mời chỉ dùng một lần. Mật khẩu cần dài tối thiểu 10 ký tự.</p>

        <Field.Root className="login-field">
          <Field.Label>Mật khẩu mới</Field.Label>
          <Input
            size="md"
            required
            minLength={10}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field.Root>

        <Field.Root className="login-field">
          <Field.Label>Nhập lại mật khẩu</Field.Label>
          <Input
            size="md"
            required
            minLength={10}
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </Field.Root>

        {message && <p className="form-message" role="alert">{message}</p>}

        <PrimaryButton size="lg" disabled={submitting} type="submit" className="w-full mt-2">
          {submitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
        </PrimaryButton>
      </form>
    </main>
  )
}
