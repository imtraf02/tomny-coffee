import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import {
  IconUser,
  IconShieldCheck,
  IconKey,
  IconLogout,
  IconPlayerPlay,
  IconPlayerStop,
  IconClock,
  IconCircleCheck,
  IconAlertCircle,
  IconChevronLeft,
  IconDeviceDesktop,
  IconCoffee,
  IconCheck,
} from '@tabler/icons-react'
import { Dialog } from '@/components/ui/dialog'
import { Drawer } from '@/components/ui/drawer'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PrimaryButton, SecondaryButton } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/lib/use-mobile'
import { readSession } from '../server/session'

export const Route = createFileRoute('/account')({
  beforeLoad: async ({ location }) => {
    const user = await readSession()
    if (!user) throw redirect({ to: '/login', search: { next: location.pathname } })
    return { user }
  },
  component: AccountPage,
})

const permissionLabels: Record<string, string> = {
  'pos.read': 'Truy cập POS',
  'pos.checkout': 'Thanh toán đơn hàng',
  'pos.cash': 'Quản lý tiền mặt',
  'pos.discount': 'Áp dụng chiết khấu',
  'pos.cancel': 'Hủy đơn hàng',
  'pos.reprint': 'In lại hóa đơn',
  'floor_plan.read': 'Xem sơ đồ bàn',
  'floor_plan.manage': 'Chỉnh sửa sơ đồ bàn',
  'tables.operate': 'Thao tác mở/chuyển bàn',
  'menu.read': 'Xem danh mục món',
  'menu.manage': 'Quản lý thực đơn & giá',
  'inventory.read': 'Xem tồn kho & định mức',
  'inventory.manage': 'Nhập/xuất & kiểm kho',
  'inventory.stocktake': 'Kiểm kê kho',
  'orders.read': 'Xem lịch sử hóa đơn',
  'orders.manage': 'Xử lý hoàn trả đơn',
  'orders.cancel.paid.approve': 'Duyệt hủy & hoàn tiền đơn đã thanh toán',
  'staff.read': 'Xem danh sách nhân sự',
  'staff.manage': 'Phân quyền & mời nhân viên',
  'payroll.manage': 'Chốt lương nhân viên',
  'reports.read': 'Xem báo cáo tài chính',
  'reports.export': 'Xuất báo cáo Excel/PDF',
  'settings.manage': 'Quản trị hệ thống',
  'kds.read': 'Xem màn hình pha chế (KDS)',
  'kds.manage': 'Cập nhật trạng thái pha chế',
  'timeclock.use': 'Chấm công ca làm',
  'timeclock.manage': 'Duyệt chấm công',
  'audit.read': 'Xem nhật ký hoạt động',
}

function AccountPage() {
  const isMobile = useIsMobile()
  const { user } = Route.useRouteContext()
  const queryClient = useQueryClient()

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Timeclock Query
  const timeclockQuery = useQuery({
    queryKey: ['timeclock'],
    queryFn: async () => {
      const response = await fetch('/api/timeclock')
      const body = await response.json().catch(() => ({})) as { message?: string }
      if (!response.ok) throw new Error(body.message ?? 'Không tải được chấm công.')
      return body as {
        current: { id: string; checkInAt: number; checkOutAt: number | null; note: string } | null
        entries: Array<{ id: string; userName?: string; checkInAt: number; checkOutAt: number | null; approvedAt: number | null; note: string }>
        canManage: boolean
      }
    },
  })

  // Timeclock Mutation
  const timeclockMutation = useMutation({
    mutationFn: async (body: unknown) => {
      const response = await fetch('/api/timeclock', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json().catch(() => ({})) as { message?: string }
      if (!response.ok) throw new Error(result.message ?? 'Không thể cập nhật chấm công.')
      return result
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['timeclock'] })
    },
  })

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.assign('/login')
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordMessage('')
    setPasswordError('')
    if (newPassword.length < 10) {
      setPasswordError('Mật khẩu mới phải có ít nhất 10 ký tự.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp.')
      return
    }
    setIsChangingPassword(true)
    try {
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
      setPasswordMessage('Đã đổi mật khẩu thành công. Các phiên khác đã bị đăng xuất.')
    } catch {
      setPasswordError('Lỗi kết nối máy chủ.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const time = timeclockQuery.data
  const isClockedIn = Boolean(time?.current)
  const initial = user?.displayName ? user.displayName.trim().slice(0, 2).toUpperCase() : 'TC'

  return (
    <div className="account-screen min-h-screen bg-[#f7f2eb] py-6 px-3 sm:px-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-5">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8c8177] hover:text-[var(--char)] transition-colors text-decoration-none"
          >
            <IconChevronLeft size={16} stroke={2} />
            <span>Quay lại Quản trị</span>
          </Link>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ember)] bg-[#faece7] px-2.5 py-1 rounded-full border border-[#f4cfc5]">
            Tài khoản ca làm
          </span>
        </div>

        {/* Profile Card (Liquid Glass) */}
        <div className="relative overflow-hidden rounded-2xl liquid-glass p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#8c351e] to-[#b3381e] flex items-center justify-center text-white shadow-md font-extrabold text-lg tracking-wider shrink-0 border border-white/60">
              {initial}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-extrabold text-[var(--char)] leading-tight">
                  {user?.displayName || 'Nhân viên Tomny Coffee'}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase tracking-wider bg-[var(--espresso)] text-[var(--crema)]">
                  {user?.permissions.includes('staff.manage') ? 'Quản Lý Cửa Hàng' : 'Nhân Sự Vận Hành'}
                </span>
              </div>
              <p className="text-xs text-[#8c8177] mt-1 flex items-center gap-1.5 font-medium">
                <IconUser size={14} stroke={1.75} />
                <span>@{user?.username || (user?.email ? user.email.split('@')[0] : 'user')}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#ede6de]">
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[var(--ember)] hover:bg-[#faece7] bg-white border border-[#f4cfc5] transition-colors cursor-pointer shadow-2xs"
            >
              <IconLogout size={16} stroke={2} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>

        {/* Shift & Timeclock Widget */}
        <div className="relative overflow-hidden rounded-2xl liquid-glass p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-[#ede6de]">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shadow-2xs shrink-0',
                isClockedIn ? 'bg-[#f0f7f2] text-[#2d6a4f] border border-[#c6e6d1]' : 'bg-[#fff5eb] text-[#c25e00] border border-[#fcd8b8]'
              )}>
                <IconClock size={20} stroke={2} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-[var(--char)]">
                  {isClockedIn ? 'Đang trong ca làm việc' : 'Chưa bắt đầu ca làm việc'}
                </h2>
                <p className="text-xs text-[#8c8177] mt-0.5">
                  {isClockedIn && time?.current
                    ? `Vào ca lúc ${new Date(time.current.checkInAt).toLocaleTimeString('vi-VN')} (${new Date(time.current.checkInAt).toLocaleDateString('vi-VN')})`
                    : 'Ghi nhận giờ vào và ra ca làm để tính công chuẩn xác.'}
                </p>
              </div>
            </div>

            <PrimaryButton
              size="md"
              disabled={timeclockMutation.isPending}
              onClick={() => timeclockMutation.mutate({ action: isClockedIn ? 'clockOut' : 'clockIn', note: '' })}
              className={cn(
                'flex items-center gap-1.5 text-xs font-bold',
                isClockedIn ? 'bg-[#b3381e] hover:bg-[#9c301a]' : 'bg-[#2d6a4f] hover:bg-[#22533e]'
              )}
            >
              {isClockedIn ? <IconPlayerStop size={16} stroke={2} /> : <IconPlayerPlay size={16} stroke={2} />}
              <span>{isClockedIn ? 'Kết thúc ca làm' : 'Bắt đầu vào ca'}</span>
            </PrimaryButton>
          </div>

          {/* Timeclock history list preview */}
          {time?.entries?.length ? (
            <div className="mt-4">
              <h3 className="text-xs font-bold text-[#8c8177] uppercase tracking-wider mb-2.5">
                Lịch sử chấm công gần nhất
              </h3>
              <div className="grid gap-2">
                {time.entries.slice(0, 3).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/80 border border-[#ede6de] text-xs"
                  >
                    <div>
                      <strong className="text-[var(--char)] mr-2">{entry.userName || 'Tôi'}</strong>
                      <span className="text-[#8c8177]">
                        Vào {new Date(entry.checkInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {new Date(entry.checkInAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <div>
                      {entry.checkOutAt ? (
                        <span className="text-xs text-[#61574f]">
                          Ra {new Date(entry.checkOutAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-[var(--moss)] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--moss)] animate-pulse" />
                          Đang làm việc
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Security & Password Card */}
        <div className="relative overflow-hidden rounded-2xl liquid-glass p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#faece7] text-[#9c301a] border border-[#f4cfc5] flex items-center justify-center shadow-2xs shrink-0">
                <IconKey size={20} stroke={2} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-[var(--char)]">Bảo mật & Đổi mật khẩu</h2>
                <p className="text-xs text-[#8c8177] mt-0.5">
                  Cập nhật mật khẩu định kỳ để bảo vệ ca thu ngân và tài khoản vận hành.
                </p>
              </div>
            </div>

            <SecondaryButton
              size="md"
              onClick={() => {
                setPasswordError('')
                setPasswordMessage('')
                setPasswordDialogOpen(true)
              }}
              className="flex items-center gap-1.5 text-xs font-bold bg-white"
            >
              <IconKey size={15} stroke={1.75} />
              <span>Đổi mật khẩu</span>
            </SecondaryButton>
          </div>
        </div>

        {/* Permissions & Roles Matrix */}
        <div className="relative overflow-hidden rounded-2xl liquid-glass p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#f0f4ff] text-[#2563eb] border border-[#d6e4ff] flex items-center justify-center shadow-2xs shrink-0">
              <IconShieldCheck size={20} stroke={2} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[var(--char)]">Quyền hạn đã được cấp</h2>
              <p className="text-xs text-[#8c8177] mt-0.5">
                Các chức năng hệ thống tài khoản của bạn được phép truy cập.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(user?.permissions || []).map((perm) => (
              <div
                key={perm}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-white/80 border border-[#ede6de] text-xs font-medium text-[var(--char)]"
              >
                <div className="w-4 h-4 rounded-full bg-[#e8f5e9] text-[#2e7d32] flex items-center justify-center shrink-0">
                  <IconCheck size={11} stroke={3} />
                </div>
                <span className="truncate">{permissionLabels[perm] || perm}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System & Device Info */}
        <div className="relative overflow-hidden rounded-2xl liquid-glass p-5 text-xs text-[#8c8177] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconCoffee size={16} stroke={1.75} className="text-[var(--ember)]" />
            <strong className="text-[var(--char)]">Tomny Coffee POS System</strong>
            <span>· Phiên bản 1.0.0</span>
          </div>
          <div className="flex items-center gap-1.5">
            <IconDeviceDesktop size={14} stroke={1.75} />
            <span>Chế độ: <strong>Độc lập & Trực tuyến</strong></span>
          </div>
        </div>
      </div>

      {/* Change Password Dialog / Drawer */}
      {passwordDialogOpen && (
        isMobile ? (
          <Drawer.Root open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
            <Drawer.Content direction="bottom" className="w-full max-h-[85dvh] p-0">
              <Drawer.Header className="px-5 pt-3 pb-3 border-b border-[#ede6de]">
                <div>
                  <Drawer.Title className="text-lg font-bold text-[var(--char)]">Đổi mật khẩu tài khoản</Drawer.Title>
                  <Drawer.Description className="text-xs text-[#8c8177] mt-0.5">
                    Mật khẩu mới yêu cầu độ dài tối thiểu 10 ký tự.
                  </Drawer.Description>
                </div>
              </Drawer.Header>
              <Drawer.Body className="px-5 py-4">
                <form onSubmit={(event) => void handleChangePassword(event)} className="flex flex-col gap-3">
                  <Field.Root>
                    <Field.Label className="text-xs font-semibold text-[var(--char)]">Mật khẩu hiện tại</Field.Label>
                    <Input
                      size="md"
                      required
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      className="mt-1"
                    />
                  </Field.Root>

                  <Field.Root>
                    <Field.Label className="text-xs font-semibold text-[var(--char)]">Mật khẩu mới</Field.Label>
                    <Input
                      size="md"
                      required
                      minLength={10}
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="mt-1"
                    />
                  </Field.Root>

                  <Field.Root>
                    <Field.Label className="text-xs font-semibold text-[var(--char)]">Xác nhận mật khẩu mới</Field.Label>
                    <Input
                      size="md"
                      required
                      minLength={10}
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="mt-1"
                    />
                  </Field.Root>

                  {passwordError && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#fdf2f2] border border-[#f8b4b4] text-xs text-[#9c1c1c]">
                      <IconAlertCircle size={16} stroke={1.75} className="shrink-0" />
                      <span>{passwordError}</span>
                    </div>
                  )}
                  {passwordMessage && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#f4f9f4] border border-[#d2ead2] text-xs text-[#2d6a4f]">
                      <IconCircleCheck size={16} stroke={1.75} className="shrink-0" />
                      <span>{passwordMessage}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-[#ede6de]">
                    <Drawer.Close className="h-9 px-4 rounded-xl border border-[#ded6cc] bg-white text-[var(--char)] font-bold text-xs shadow-2xs hover:bg-[#faf7f3] hover:border-[#c5bcaf] active:scale-[0.98] transition-all cursor-pointer flex-1 flex items-center justify-center">Hủy</Drawer.Close>
                    <PrimaryButton size="sm" type="submit" disabled={isChangingPassword} className="flex-1 flex items-center justify-center gap-1.5 py-2.5">
                      <IconKey size={14} stroke={2} />
                      <span>{isChangingPassword ? 'Đang lưu…' : 'Lưu mật khẩu mới'}</span>
                    </PrimaryButton>
                  </div>
                </form>
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Root>
        ) : (
          <Dialog.Root open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
            <Dialog.Portal>
              <Dialog.Backdrop className="dialog-backdrop" />
              <Dialog.Viewport className="dialog-viewport">
                <Dialog.Popup className="editor-dialog" style={{ maxWidth: '440px' }}>
                  <div className="flex items-start justify-between pb-3 border-b border-[#ede6de]">
                    <div>
                      <Dialog.Title className="text-lg font-bold text-[var(--char)]">Đổi mật khẩu tài khoản</Dialog.Title>
                      <Dialog.Description className="text-xs text-[#8c8177] mt-0.5">
                        Mật khẩu mới yêu cầu độ dài tối thiểu 10 ký tự.
                      </Dialog.Description>
                    </div>
                    <Dialog.Close aria-label="Đóng" className="p-1 rounded-md text-[#8c8177] hover:text-[var(--char)] hover:bg-[#f0ebe4] transition-colors">
                      ✕
                    </Dialog.Close>
                  </div>

                  <form onSubmit={(event) => void handleChangePassword(event)} className="mt-4 flex flex-col gap-3">
                    <Field.Root>
                      <Field.Label className="text-xs font-semibold text-[var(--char)]">Mật khẩu hiện tại</Field.Label>
                      <Input
                        size="md"
                        required
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        className="mt-1"
                      />
                    </Field.Root>

                    <Field.Root>
                      <Field.Label className="text-xs font-semibold text-[var(--char)]">Mật khẩu mới</Field.Label>
                      <Input
                        size="md"
                        required
                        minLength={10}
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className="mt-1"
                      />
                    </Field.Root>

                    <Field.Root>
                      <Field.Label className="text-xs font-semibold text-[var(--char)]">Xác nhận mật khẩu mới</Field.Label>
                      <Input
                        size="md"
                        required
                        minLength={10}
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className="mt-1"
                      />
                    </Field.Root>

                    {passwordError && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#fdf2f2] border border-[#f8b4b4] text-xs text-[#9c1c1c]">
                        <IconAlertCircle size={16} stroke={1.75} className="shrink-0" />
                        <span>{passwordError}</span>
                      </div>
                    )}
                    {passwordMessage && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#f4f9f4] border border-[#d2ead2] text-xs text-[#2d6a4f]">
                        <IconCircleCheck size={16} stroke={1.75} className="shrink-0" />
                        <span>{passwordMessage}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-[#ede6de]">
                      <Dialog.Close className="h-8.5 px-3 sm:px-4 rounded-xl border border-[#ded6cc] bg-white text-[var(--char)] font-bold text-xs shadow-2xs hover:bg-[#faf7f3] hover:border-[#c5bcaf] active:scale-[0.98] transition-all cursor-pointer inline-flex items-center justify-center">Hủy</Dialog.Close>
                      <PrimaryButton size="sm" type="submit" disabled={isChangingPassword} className="flex items-center gap-1.5">
                        <IconKey size={14} stroke={2} />
                        <span>{isChangingPassword ? 'Đang lưu…' : 'Lưu mật khẩu mới'}</span>
                      </PrimaryButton>
                    </div>
                  </form>
                </Dialog.Popup>
              </Dialog.Viewport>
            </Dialog.Portal>
          </Dialog.Root>
        )
      )}
    </div>
  )
}
