import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { useState } from 'react'
import {
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconCopy,
  IconCheck,
  IconPlayerPlay,
  IconPlayerStop,
  IconX,
  IconUserPlus,
  IconChevronLeft,
} from '@tabler/icons-react'
import { Dialog } from '@/components/ui/dialog'
import { PrimaryButton, SecondaryButton } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { DateRangePicker } from '@/components/ui/date-picker'
import { cn } from '@/lib/utils'
import { StaffPermissionEditor } from '../components/StaffPermissionEditor'
import { requireAdminAccess } from '../server/admin-access'

export const Route = createFileRoute('/admin')({
  beforeLoad: ({ location }) => requireAdminAccess(location),
  component: () => <Outlet />,
})

export type TableStatus = 'trong' | 'dang_phuc_vu' | 'dat_truoc' | 'can_don'
export type FloorPlan = { zones: { id: string; name: string }[]; tables: Array<{ id: string; zoneId: string | null; name: string; shape: 'square' | 'round'; status: TableStatus; storedStatus: TableStatus }> }
export type ReportData = { from: string; to: string; summary: { orderCount: number; revenue: number; discounts: number; cogs: number; grossMargin: number; averageOrder: number }; topItems: Array<{ name: string; variant: string; quantity: number; revenue: number }>; orders: Array<Record<string, unknown>>; inventory: Array<{ id: string; name: string; currentQuantity: number; reorderPoint: number; active: number | boolean }>; timeEntries: Array<Record<string, unknown>>; hourly: Array<{ hour: string; orderCount: number; revenue: number }> }

export async function getFloorPlan(): Promise<FloorPlan> {
  const response = await fetch('/api/floor-plan')
  const body = await response.json().catch(() => ({})) as FloorPlan & { message?: string }
  if (!response.ok) throw new Error(body.message ?? 'Không tải được danh sách bàn.')
  return body
}

export function AdminPageShell({
  title,
  subtitle,
  backTo = '/admin',
  backLabel = 'Quản trị',
  actions,
  children,
}: {
  title: string
  subtitle?: string
  backTo?: string
  backLabel?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="admin-screen w-full min-w-0 max-w-full overflow-x-hidden">
      <main className="admin-main max-w-7xl mx-auto w-full min-w-0 max-w-full px-3 sm:px-6 pt-3 sm:pt-6 pb-28 sm:pb-24 overflow-x-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6 min-w-0 max-w-full">
          <div className="min-w-0 max-w-full overflow-hidden">
            {backTo && (
              <Link
                to={backTo}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#8c8177] hover:text-[var(--char)] transition-colors mb-1 text-decoration-none"
              >
                <IconChevronLeft size={15} stroke={2} />
                <span>{backLabel}</span>
              </Link>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--char)] tracking-tight truncate">{title}</h1>
            {subtitle && <p className="text-xs text-[#8c8177] mt-0.5 truncate">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
        </div>
        <div className="w-full min-w-0 max-w-full overflow-x-hidden">{children}</div>
      </main>
    </div>
  )
}

export function StaffWorkspace({ canManage = true }: { canManage?: boolean }) {
  const [staffDialog, setStaffDialog] = useState(false)
  const [inviteDraft, setInviteDraft] = useState({ email: '', displayName: '', permissions: ['pos.read', 'pos.checkout', 'floor_plan.read', 'tables.operate', 'timeclock.use'] })
  const [inviteLink, setInviteLink] = useState('')
  const queryClient = useQueryClient()

  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const response = await fetch('/api/staff')
      const body = await response.json().catch(() => ({})) as { message?: string }
      if (!response.ok) throw new Error(body.message ?? 'Không tải được nhân viên.')
      return body as {
        users: Array<{ id: string; email: string; displayName: string; active: boolean; permissions: string[] }>
        permissions: Array<{ id: string; code: string; label: string }>
        invites: Array<{ id: string; email: string; displayName: string; expiresAt: number }>
      }
    },
  })

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

  const staffMutation = useMutation({
    mutationFn: async (body: unknown) => {
      const response = await fetch('/api/staff', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json().catch(() => ({})) as { message?: string; token?: string }
      if (!response.ok) throw new Error(result.message ?? 'Không thể lưu nhân viên.')
      return result
    },
    onSuccess: async (result) => {
      if (result.token) setInviteLink(`${window.location.origin}/invite/${result.token}`)
      await queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })

  const timeclockMutation = useMutation({
    mutationFn: async (body: unknown) => {
      const response = await fetch('/api/timeclock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json().catch(() => ({})) as { message?: string }
      if (!response.ok) throw new Error(result.message ?? 'Không thể cập nhật chấm công.')
      return result
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['timeclock'] })
    },
  })

  const data = staffQuery.data
  const time = timeclockQuery.data
  const staffError = staffQuery.error instanceof Error ? staffQuery.error.message : 'Không tải được nhân viên.'
  const timeError = timeclockQuery.error instanceof Error ? timeclockQuery.error.message : 'Không tải được chấm công.'
  const mutationError = staffMutation.error instanceof Error ? staffMutation.error.message : 'Không thể lưu nhân viên.'

  const activeCount = data?.users?.filter((u) => u.active).length ?? 0
  const pendingCount = data?.invites?.length ?? 0

  return (
    <div className="staff-workspace grid gap-6">
      {/* Employee List Section */}
      <section className="admin-table-section">
        <div className="section-title">
          <div>
            <h2>Nhân viên & Phân quyền</h2>
            <p>Quản lý tài khoản, gán quyền chi tiết theo khu vực và tạo link mời tham gia.</p>
          </div>
          <PrimaryButton size="md" disabled={!canManage} onClick={() => { setInviteLink(''); setStaffDialog(true) }} className="flex items-center gap-1.5">
            <IconUserPlus size={16} stroke={1.75} />
            <span>Mời nhân viên</span>
          </PrimaryButton>
        </div>

        {staffQuery.isLoading && <p className="floor-feedback">Đang tải nhân viên…</p>}
        {staffQuery.isError && <p className="floor-feedback is-error">{staffError}</p>}

        {data && (
          <>
            {/* KPI Cards */}
            <div className="catalog-metrics-grid my-4">
              <article className="catalog-metric-card">
                <span className="metric-label">Đang hoạt động</span>
                <strong className="metric-value tabular-nums text-[var(--moss)]">{activeCount}</strong>
                <small className="metric-hint">Tài khoản nhân viên</small>
              </article>
              <article className="catalog-metric-card">
                <span className="metric-label">Đang chờ mời</span>
                <strong className="metric-value tabular-nums text-[var(--amber)]">{pendingCount}</strong>
                <small className="metric-hint">Link còn hiệu lực</small>
              </article>
              <article className="catalog-metric-card">
                <span className="metric-label">Quyền hệ thống</span>
                <strong className="metric-value tabular-nums">{data.permissions?.length ?? 0}</strong>
                <small className="metric-hint">Quyền phân cấp</small>
              </article>
              <article className="catalog-metric-card">
                <span className="metric-label">Tổng nhân sự</span>
                <strong className="metric-value tabular-nums">{data.users?.length ?? 0}</strong>
                <small className="metric-hint">Tất cả tài khoản</small>
              </article>
            </div>

            {/* Staff Table */}
            <div className="catalog-table-wrap">
              <table className="product-mockup-table">
                <thead>
                  <tr>
                    <th>NHÂN VIÊN</th>
                    <th>EMAIL</th>
                    <th>QUYỀN HẠN</th>
                    <th>TRẠNG THÁI</th>
                    <th className="text-right">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.users ?? []).map((staff) => (
                    <tr key={staff.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#f0e6d7] text-[#684838] font-bold text-xs flex items-center justify-center border border-[#ded6cd]">
                            {staff.displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <strong className="block text-sm text-[var(--char)]">{staff.displayName}</strong>
                          </div>
                        </div>
                      </td>
                      <td className="text-xs text-[#61574f]">{staff.email}</td>
                      <td>
                        <span className="variant-tag-chip">
                          <span className="variant-tag-name">{staff.permissions.length} quyền</span>
                        </span>
                      </td>
                      <td>
                        <span className={cn('catalog-status-pill', staff.active ? 'is-active' : 'is-inactive')}>
                          <span className={cn('catalog-status-dot', staff.active ? 'dot-active' : 'dot-inactive')} />
                          {staff.active ? 'Đang hoạt động' : 'Đã khóa'}
                        </span>
                      </td>
                      <td className="text-right">
                        <StaffPermissionEditor
                          user={staff}
                          permissions={data.permissions ?? []}
                          canManage={canManage}
                          onSave={(input) => staffMutation.mutate(input)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pending Invites List */}
            {data.invites?.length ? (
              <div className="pending-invites mt-4 p-4 border border-[#e5ddd6] rounded-xl bg-[#fffdfa]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8c8177] mb-3">Link mời đang chờ kích hoạt</h3>
                <div className="grid gap-2">
                  {data.invites.map((invite) => (
                    <div key={invite.id} className="flex flex-wrap justify-between items-center py-2 px-3 bg-white border border-[#ede6de] rounded-lg text-xs">
                      <div>
                        <strong className="text-[var(--char)] mr-2">{invite.displayName}</strong>
                        <span className="text-[#8c8177]">{invite.email}</span>
                      </div>
                      <small className="text-[#8c8177]">Hết hạn lúc {new Date(invite.expiresAt).toLocaleString('vi-VN')}</small>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* Timeclock Section */}
      <section className="admin-table-section">
        <div className="section-title">
          <div>
            <h2>Chấm công & Ca làm việc</h2>
            <p>{time?.current ? `Đang trong ca làm từ ${new Date(time.current.checkInAt).toLocaleTimeString('vi-VN')}` : 'Chưa mở ca làm việc hiện tại.'}</p>
          </div>
          <PrimaryButton
            size="md"
            disabled={timeclockMutation.isPending}
            onClick={() => timeclockMutation.mutate({ action: time?.current ? 'clockOut' : 'clockIn', note: '' })}
            className={cn('flex items-center gap-1.5', time?.current && 'bg-[#b3381e] hover:bg-[#9c301a]')}
          >
            {time?.current ? <IconPlayerStop size={16} stroke={1.75} /> : <IconPlayerPlay size={16} stroke={1.75} />}
            <span>{time?.current ? 'Kết thúc ca làm' : 'Bắt đầu ca làm'}</span>
          </PrimaryButton>
        </div>

        {timeclockQuery.isError && <p className="floor-feedback is-error">{timeError}</p>}

        {time && (
          <div className="catalog-table-wrap mt-4">
            <table className="product-mockup-table">
              <thead>
                <tr>
                  <th>NHÂN VIÊN</th>
                  <th>VÀO CA</th>
                  <th>RA CA</th>
                  <th className="text-center">TRẠNG THÁI</th>
                  {time.canManage && <th className="text-right">DUYỆT</th>}
                </tr>
              </thead>
              <tbody>
                {!time.entries?.length ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-[#8c8177]">Chưa có lượt chấm công nào.</td>
                  </tr>
                ) : (
                  time.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <strong className="text-sm text-[var(--char)]">{entry.userName ?? 'Tôi'}</strong>
                      </td>
                      <td className="text-xs font-data">{new Date(entry.checkInAt).toLocaleString('vi-VN')}</td>
                      <td className="text-xs font-data">
                        {entry.checkOutAt ? new Date(entry.checkOutAt).toLocaleString('vi-VN') : (
                          <span className="text-[var(--moss)] font-bold">● Đang làm việc</span>
                        )}
                      </td>
                      <td className="text-center">
                        {entry.approvedAt ? (
                          <span className="catalog-status-pill is-active">
                            <span className="catalog-status-dot dot-active" />
                            Đã duyệt
                          </span>
                        ) : (
                          <span className="catalog-status-pill is-inactive">
                            <span className="catalog-status-dot dot-inactive" />
                            Chờ duyệt
                          </span>
                        )}
                      </td>
                      {time.canManage && (
                        <td className="text-right">
                          {!entry.approvedAt && (
                            <SecondaryButton
                              size="sm"
                              onClick={() => timeclockMutation.mutate({ action: 'approve', entryId: entry.id })}
                              className="flex items-center gap-1"
                            >
                              <IconCheck size={14} stroke={2} />
                              <span>Duyệt ca</span>
                            </SecondaryButton>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Invite Dialog */}
      {staffDialog && (
        <Dialog.Root open onOpenChange={(open) => { if (!open) setStaffDialog(false) }}>
          <Dialog.Portal>
            <Dialog.Backdrop className="dialog-backdrop" />
            <Dialog.Viewport className="dialog-viewport">
              <Dialog.Popup className="product-mockup-dialog" style={{ maxWidth: '520px' }}>
                <div className="product-mockup-form">
                  <div className="flex items-start justify-between pb-4 border-b border-[#ede6de]">
                    <div>
                      <Dialog.Title className="product-mockup-heading">Mời nhân viên</Dialog.Title>
                      <Dialog.Description className="text-xs text-[#8c8177] mt-1">
                        Link chỉ dùng một lần và tự động hết hạn sau 48 giờ.
                      </Dialog.Description>
                    </div>
                    <Dialog.Close aria-label="Đóng" className="dialog-close-btn">
                      <IconX size={18} stroke={1.75} />
                    </Dialog.Close>
                  </div>

                  {inviteLink ? (
                    <div className="grid gap-3 mt-4">
                      <Field.Root>
                        <Field.Label>Link mời nhân viên</Field.Label>
                        <Input size="md" readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} className="product-mockup-input font-data text-xs" />
                      </Field.Root>
                      <p className="form-message success-message">Đã tạo link mời. Sao chép và gửi trực tiếp cho nhân viên.</p>
                      <div className="flex justify-end gap-2 mt-2">
                        <PrimaryButton onClick={() => void navigator.clipboard?.writeText(inviteLink)} className="flex items-center gap-1.5">
                          <IconCopy size={16} stroke={1.75} />
                          <span>Sao chép link</span>
                        </PrimaryButton>
                        <Dialog.Close className="product-mockup-cancel-btn">Đóng</Dialog.Close>
                      </div>
                    </div>
                  ) : (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault()
                        staffMutation.mutate({ action: 'invite', email: inviteDraft.email, displayName: inviteDraft.displayName, permissions: inviteDraft.permissions })
                      }}
                      className="grid gap-4 mt-4"
                    >
                      <Field.Root>
                        <Field.Label>Tên hiển thị *</Field.Label>
                        <Input size="md" required value={inviteDraft.displayName} onChange={(event) => setInviteDraft({ ...inviteDraft, displayName: event.target.value })} placeholder="VD: Nguyễn Văn A" className="product-mockup-input" />
                      </Field.Root>
                      <Field.Root>
                        <Field.Label>Email đăng nhập *</Field.Label>
                        <Input size="md" required type="email" value={inviteDraft.email} onChange={(event) => setInviteDraft({ ...inviteDraft, email: event.target.value })} placeholder="staff@tomny.coffee" className="product-mockup-input" />
                      </Field.Root>
                      <Field.Root>
                        <Field.Label>Quyền ban đầu</Field.Label>
                        <Input size="md" value={inviteDraft.permissions.join(', ')} onChange={(event) => setInviteDraft({ ...inviteDraft, permissions: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} className="product-mockup-input text-xs font-data" />
                        <small className="text-[11px] text-[#8c8177] mt-1">Mặc định: Thu ngân POS, thao tác bàn, chấm công.</small>
                      </Field.Root>
                      {staffMutation.isError && <p className="form-message mt-2">{mutationError}</p>}
                      <div className="product-mockup-footer mt-2">
                        <div className="flex items-center justify-end gap-2 w-full">
                          <Dialog.Close className="product-mockup-cancel-btn">Hủy</Dialog.Close>
                          <PrimaryButton disabled={staffMutation.isPending} type="submit">
                            {staffMutation.isPending ? 'Đang tạo…' : 'Tạo link mời'}
                          </PrimaryButton>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              </Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  )
}

export function ReportsWorkspace({
  onExportExcel,
  onExportPdf,
}: {
  onExportExcel?: (data: ReportData) => void
  onExportPdf?: (data: ReportData) => void
}) {
  const [reportFrom, setReportFrom] = useState(new Date().toISOString().slice(0, 10))
  const [reportTo, setReportTo] = useState(new Date().toISOString().slice(0, 10))

  const reportQuery = useQuery({
    queryKey: ['reports', reportFrom, reportTo],
    queryFn: async () => {
      const response = await fetch(`/api/reports?from=${reportFrom}&to=${reportTo}`)
      const body = await response.json().catch(() => ({})) as { message?: string }
      if (!response.ok) throw new Error(body.message ?? 'Không tải được báo cáo.')
      return body as ReportData
    },
  })

  const data = reportQuery.data
  const reportError = reportQuery.error instanceof Error ? reportQuery.error.message : 'Không tải được báo cáo.'

  return (
    <div className="reports-workspace grid gap-5">
      <section className="admin-table-section">
        <div className="section-title flex-wrap gap-4">
          <div>
            <h2>Báo cáo & Phân tích Doanh thu</h2>
            <p>Doanh thu tổng hợp, chi phí nguyên liệu COGS, lợi nhuận gộp và cơ cấu món bán chạy.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker
              size="sm"
              value={{ from: reportFrom, to: reportTo }}
              onValueChange={({ from, to }) => {
                setReportFrom(from ?? '')
                setReportTo(to ?? '')
              }}
              placeholder="Chọn khoảng ngày báo cáo…"
              className="w-full sm:w-auto sm:min-w-[240px] bg-white"
            />
            {data && (
              <div className="flex items-center gap-2">
                <SecondaryButton size="sm" onClick={() => onExportExcel ? onExportExcel(data) : null} className="flex items-center gap-1.5">
                  <IconFileSpreadsheet size={15} stroke={1.75} />
                  <span>Xuất Excel</span>
                </SecondaryButton>
                <PrimaryButton size="sm" onClick={() => onExportPdf ? onExportPdf(data) : null} className="flex items-center gap-1.5">
                  <IconFileTypePdf size={15} stroke={1.75} />
                  <span>Xuất PDF</span>
                </PrimaryButton>
              </div>
            )}
          </div>
        </div>

        {reportQuery.isLoading && <p className="floor-feedback">Đang tải số liệu báo cáo…</p>}
        {reportQuery.isError && <p className="floor-feedback is-error">{reportError}</p>}

        {data && (
          <>
            {/* Financial Metrics */}
            <div className="catalog-metrics-grid my-4">
              <article className="catalog-metric-card">
                <span className="metric-label">Tổng Doanh Thu</span>
                <strong className="metric-value tabular-nums text-[var(--ember)]">{data.summary.revenue.toLocaleString('vi-VN')}₫</strong>
                <small className="metric-hint">{data.summary.orderCount} đơn hàng</small>
              </article>
              <article className="catalog-metric-card">
                <span className="metric-label">Chi Phí COGS</span>
                <strong className="metric-value tabular-nums">{data.summary.cogs.toLocaleString('vi-VN')}₫</strong>
                <small className="metric-hint">Giá vốn nguyên liệu</small>
              </article>
              <article className="catalog-metric-card">
                <span className="metric-label">Lợi Nhuận Gộp</span>
                <strong className="metric-value tabular-nums text-[var(--moss)]">{data.summary.grossMargin.toLocaleString('vi-VN')}₫</strong>
                <small className="metric-hint">Biên gộp {data.summary.revenue ? Math.round((data.summary.grossMargin / data.summary.revenue) * 100) : 0}%</small>
              </article>
              <article className="catalog-metric-card">
                <span className="metric-label">Giá Trị TB / Đơn</span>
                <strong className="metric-value tabular-nums">{data.summary.averageOrder.toLocaleString('vi-VN')}₫</strong>
                <small className="metric-hint">Giảm giá {data.summary.discounts.toLocaleString('vi-VN')}₫</small>
              </article>
            </div>

            {/* Top Items Table */}
            <div className="mt-6">
              <h3 className="text-base font-bold text-[var(--char)] mb-3">Top món bán chạy trong kỳ</h3>
              <div className="catalog-table-wrap">
                <table className="product-mockup-table">
                  <thead>
                    <tr>
                      <th style={{ width: '8%' }}>HẠNG</th>
                      <th style={{ width: '42%' }}>TÊN MÓN</th>
                      <th style={{ width: '20%' }}>PHIÊN BẢN</th>
                      <th style={{ width: '15%' }} className="text-right">SỐ LƯỢNG</th>
                      <th style={{ width: '15%' }} className="text-right">DOANH THU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!data.topItems?.length ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-[#8c8177]">Chưa có món bán trong khoảng thời gian này.</td>
                      </tr>
                    ) : (
                      data.topItems.map((item, index) => (
                        <tr key={`${item.name}-${item.variant}`}>
                          <td>
                            <span className={cn('w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs', index === 0 ? 'bg-[#ffeaa7] text-[#76530e]' : index === 1 ? 'bg-[#dfe6e9] text-[#2d3436]' : index === 2 ? 'bg-[#fad390] text-[#684838]' : 'text-[#8c8177]')}>
                              #{index + 1}
                            </span>
                          </td>
                          <td>
                            <strong className="text-sm text-[var(--char)]">{item.name}</strong>
                          </td>
                          <td className="text-xs text-[#61574f]">{item.variant || 'Tiêu chuẩn'}</td>
                          <td className="text-right font-data font-bold text-xs">{item.quantity}</td>
                          <td className="text-right font-data font-bold text-xs text-[var(--ember)]">{item.revenue.toLocaleString('vi-VN')}₫</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export function AuditWorkspace() {
  const auditQuery = useQuery({
    queryKey: ['audit-log'],
    queryFn: async () => {
      const response = await fetch('/api/audit')
      const body = await response.json().catch(() => ({})) as { message?: string }
      if (!response.ok) throw new Error(body.message ?? 'Không tải được audit log.')
      return body as {
        rows: Array<{ id: string; actorEmail: string; entityType: string; entityId: string; action: string; detail: string; createdAt: number }>
      }
    },
  })

  const data = auditQuery.data
  const auditError = auditQuery.error instanceof Error ? auditQuery.error.message : 'Không tải được audit log.'

  return (
    <section className="admin-table-section">
      <div className="section-title">
        <div>
          <h2>Nhật ký hoạt động (Audit log)</h2>
          <p>Lưu vết toàn bộ thao tác sửa món, hủy đơn, giảm giá, đổi quyền và điều chỉnh kho.</p>
        </div>
      </div>

      {auditQuery.isLoading && <p className="floor-feedback">Đang tải nhật ký…</p>}
      {auditQuery.isError && <p className="floor-feedback is-error">{auditError}</p>}

      {data && !data.rows?.length && (
        <div className="catalog-empty"><p>Chưa có hoạt động nào được ghi nhận.</p></div>
      )}

      {data?.rows?.length ? (
        <div className="catalog-table-wrap">
          <table className="product-mockup-table">
            <thead>
              <tr>
                <th style={{ width: '18%' }}>THỜI GIAN</th>
                <th style={{ width: '22%' }}>NGƯỜI THAO TÁC</th>
                <th style={{ width: '18%' }}>ĐỐI TƯỢNG</th>
                <th style={{ width: '14%' }}>HÀNH ĐỘNG</th>
                <th style={{ width: '28%' }}>CHI TIẾT</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id}>
                  <td className="text-xs font-data text-[#8c8177]">
                    {new Date(row.createdAt).toLocaleString('vi-VN')}
                  </td>
                  <td>
                    <strong className="text-xs text-[var(--char)]">{row.actorEmail}</strong>
                  </td>
                  <td className="text-xs text-[#61574f]">
                    {row.entityType} <span className="font-data text-[#8c8177]">#{row.entityId.slice(0, 6)}</span>
                  </td>
                  <td>
                    <span className="variant-tag-chip">
                      <span className="variant-tag-name font-bold">{row.action}</span>
                    </span>
                  </td>
                  <td>
                    <code className="text-xs bg-[#f4ede4] px-2 py-1 rounded text-[#554b42] block truncate max-w-xs">{row.detail}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
