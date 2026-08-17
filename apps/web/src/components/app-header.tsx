import { Link } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import {
  IconUser,
  IconChevronDown,
  IconKey,
  IconLogout,
} from '@tabler/icons-react'
import { Dialog } from './ui/dialog'
import { Drawer } from './ui/drawer'
import { Menu } from './ui/menu'
import { Tooltip } from './ui/tooltip'
import { Field } from './ui/field'
import { PrimaryButton } from './ui/button'
import { useIsMobile } from '@/lib/use-mobile'

export function AppHeader({ area: _area, permissions }: { area?: 'POS' | 'KDS' | 'Quản trị'; permissions?: string[] }) {
  const isMobile = useIsMobile()
  const [online, setOnline] = useState(true)
  const [accountOpen, setAccountOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.assign('/login')
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordMessage('')
    setPasswordError('')
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp.')
      return
    }
    const response = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const body = (await response.json().catch(() => ({}))) as { message?: string }
    if (!response.ok) {
      setPasswordError(body.message ?? 'Không thể đổi mật khẩu.')
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordMessage('Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.')
  }

  const canPos = !permissions || permissions.includes('pos.read')
  const canKds = !permissions || permissions.includes('kds.read')
  const canAdmin =
    !permissions ||
    ['reports.read', 'menu.read', 'inventory.read', 'floor_plan.read', 'orders.read', 'staff.read', 'audit.read'].some(
      (permission) => permissions.includes(permission)
    )

  return (
    <header className="app-header">
      <Link to="/" className="wordmark" aria-label="Tomny Coffee, trang chủ">
        TOMNY <span>COFFEE</span>
      </Link>
      <nav aria-label="Khu vực vận hành" className="flex items-center gap-1 shrink-0 whitespace-nowrap">
        {canPos && (
          <Link to="/pos" activeProps={{ className: 'nav-item is-active' }} className="nav-item whitespace-nowrap">
            POS
          </Link>
        )}
        {canKds && (
          <Link to="/kds" activeProps={{ className: 'nav-item is-active' }} className="nav-item whitespace-nowrap">
            KDS
          </Link>
        )}
        {canAdmin && (
          <Link to="/admin" activeProps={{ className: 'nav-item is-active' }} className="nav-item whitespace-nowrap">
            Quản trị
          </Link>
        )}
      </nav>
      <div className="header-meta">
        <Tooltip.Root>
          <Tooltip.Trigger aria-label={online ? 'Kết nối máy chủ đang hoạt động' : 'Mất kết nối máy chủ'}>
            <span className={online ? 'online-dot' : 'offline-dot'} />
          </Tooltip.Trigger>
          <Tooltip.Content>
            {online ? 'Đang online' : 'Đang offline — các thao tác sẽ được xếp hàng'}
          </Tooltip.Content>
        </Tooltip.Root>
        <span className="header-online-text">{online ? 'Online' : 'Offline'}</span>
        <Menu.Root>
          <Menu.Trigger className="header-account flex items-center gap-1.5">
            <IconUser size={15} stroke={1.75} />
            <span className="header-account-label">Tài khoản</span>
            <IconChevronDown size={13} stroke={2} className="header-chevron" />
          </Menu.Trigger>
          <Menu.Content positionerProps={{ align: 'end' }}>
            <Menu.Item
              onClick={() => {
                setPasswordError('')
                setPasswordMessage('')
                setAccountOpen(true)
              }}
              className="flex items-center gap-2"
            >
              <IconKey size={15} stroke={1.75} />
              <span>Đổi mật khẩu</span>
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item onClick={() => void logout()} className="flex items-center gap-2 text-[var(--ember)]">
              <IconLogout size={15} stroke={1.75} />
              <span>Đăng xuất</span>
            </Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </div>

      {/* Account Password Dialog / Drawer */}
      {accountOpen && (
        isMobile ? (
          <Drawer.Root open={accountOpen} onOpenChange={setAccountOpen}>
            <Drawer.Content direction="bottom" className="w-full max-h-[85dvh] p-0">
              <Drawer.Header className="px-5 pt-3 pb-3 border-b border-[#ede6de]">
                <div>
                  <Drawer.Title className="text-lg font-bold text-[var(--char)]">Tài khoản</Drawer.Title>
                  <Drawer.Description className="text-xs text-[#8c8177] mt-0.5">
                    Đổi mật khẩu định kỳ để bảo vệ ca bán hàng.
                  </Drawer.Description>
                </div>
              </Drawer.Header>
              <Drawer.Body className="px-5 py-4">
                <form onSubmit={(event) => void changePassword(event)}>
                  <Field.Root>
                    <Field.Label>Mật khẩu hiện tại</Field.Label>
                    <Field.Control
                      size="md"
                      required
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                    />
                  </Field.Root>
                  <Field.Root className="mt-3">
                    <Field.Label>Mật khẩu mới</Field.Label>
                    <Field.Control
                      size="md"
                      required
                      minLength={10}
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                  </Field.Root>
                  <Field.Root className="mt-3">
                    <Field.Label>Nhập lại mật khẩu mới</Field.Label>
                    <Field.Control
                      size="md"
                      required
                      minLength={10}
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                  </Field.Root>
                  {passwordError && <p className="form-message mt-2">{passwordError}</p>}
                  {passwordMessage && <p className="form-message success-message mt-2">{passwordMessage}</p>}
                  <div className="dialog-actions mt-4 flex gap-2">
                    <Drawer.Close className="h-10 px-4 rounded-xl border border-[#ded6cc] bg-white text-[var(--char)] font-bold text-xs shadow-2xs hover:bg-[#faf7f3] active:scale-[0.98] transition-all cursor-pointer flex-1 flex items-center justify-center">Đóng</Drawer.Close>
                    <PrimaryButton type="submit" className="flex-1">Đổi mật khẩu</PrimaryButton>
                  </div>
                </form>
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Root>
        ) : (
          <Dialog.Root open={accountOpen} onOpenChange={setAccountOpen}>
            <Dialog.Portal>
              <Dialog.Backdrop className="dialog-backdrop" />
              <Dialog.Viewport className="dialog-viewport">
                <Dialog.Popup className="editor-dialog">
                  <Dialog.Title>Tài khoản</Dialog.Title>
                  <Dialog.Description>Đổi mật khẩu định kỳ để bảo vệ ca bán hàng.</Dialog.Description>
                  <form onSubmit={(event) => void changePassword(event)}>
                    <Field.Root>
                      <Field.Label>Mật khẩu hiện tại</Field.Label>
                      <Field.Control
                        size="md"
                        required
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                      />
                    </Field.Root>
                    <Field.Root className="mt-3">
                      <Field.Label>Mật khẩu mới</Field.Label>
                      <Field.Control
                        size="md"
                        required
                        minLength={10}
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                      />
                    </Field.Root>
                    <Field.Root className="mt-3">
                      <Field.Label>Nhập lại mật khẩu mới</Field.Label>
                      <Field.Control
                        size="md"
                        required
                        minLength={10}
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                      />
                    </Field.Root>
                    {passwordError && <p className="form-message mt-2">{passwordError}</p>}
                    {passwordMessage && <p className="form-message success-message mt-2">{passwordMessage}</p>}
                    <div className="dialog-actions mt-4">
                      <Dialog.Close className="h-8.5 px-4 text-xs font-bold rounded-xl border border-[#ded6cc] bg-white text-[var(--char)] shadow-2xs hover:bg-[#faf7f3] hover:border-[#c5bcaf] active:scale-[0.98] transition-all cursor-pointer inline-flex items-center justify-center">Đóng</Dialog.Close>
                      <PrimaryButton type="submit">Đổi mật khẩu</PrimaryButton>
                    </div>
                  </form>
                </Dialog.Popup>
              </Dialog.Viewport>
            </Dialog.Portal>
          </Dialog.Root>
        )
      )}
    </header>
  )
}
