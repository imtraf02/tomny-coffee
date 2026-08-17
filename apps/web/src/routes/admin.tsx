import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import {
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconCheck,
  IconPlayerPlay,
  IconPlayerStop,
  IconX,
  IconUserPlus,
  IconChevronLeft,
  IconTrendingUp,
  IconCoffee,
  IconCash,
  IconUsers,
  IconFlame,
  IconPackage,
  IconSearch,
  IconRefresh,
  IconHistory,
  IconCopy,
} from '@tabler/icons-react'
import { Dialog } from '@/components/ui/dialog'
import { Drawer } from '@/components/ui/drawer'
import { PrimaryButton, SecondaryButton } from '@/components/ui/button'
import { formatMoney } from '@/lib/money'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Checkbox } from '@/components/ui/checkbox'
import { DateRangePicker } from '@/components/ui/date-picker'
import { SkeletonMetricGrid, SkeletonTable } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/lib/use-mobile'
import { StaffPermissionEditor, GROUP_TITLES } from '../components/staff-permission-editor'
import { requireAdminAccess } from '../server/admin-access'

export const Route = createFileRoute('/admin')({
  beforeLoad: ({ location }) => requireAdminAccess(location),
  component: () => <Outlet />,
})

export type TableStatus = 'trong' | 'dang_phuc_vu' | 'dat_truoc' | 'can_don'
export type FloorPlan = {
  zones: { id: string; name: string }[]
  tables: Array<{
    id: string
    zoneId: string | null
    name: string
    shape: 'square' | 'round'
    status: TableStatus
    storedStatus: TableStatus
  }>
}
export type ReportData = {
  from: string
  to: string
  summary: {
    orderCount: number
    revenue: number
    discounts: number
    cogs: number
    grossMargin: number
    averageOrder: number
    totalPurchasingCost?: number
    receiptCount?: number
  }
  topItems: Array<{
    name: string
    variant: string
    quantity: number
    revenue: number
    categoryName?: string
  }>
  dailyTrend?: Array<{
    date: string
    orderCount: number
    revenue: number
    cogs: number
    grossMargin: number
    discounts: number
  }>
  categoryBreakdown?: Array<{
    categoryName: string
    quantity: number
    revenue: number
    percentage: number
  }>
  sourcesBreakdown?: Array<{
    source: string
    count: number
    revenue: number
    percentage: number
  }>
  cashierSummary?: Array<{
    cashier: string
    orderCount: number
    revenue: number
    discounts: number
  }>
  purchasing?: {
    totalCost: number
    receiptCount: number
    byIngredient: Array<{
      ingredientName: string
      unit: string
      quantity: number
      totalCost: number
      avgUnitCost: number
    }>
    movements: Array<{
      id: string
      ingredientName: string
      unit: string
      quantity: number
      unitCost: number
      totalCost: number
      reason: string
      actorName: string
      createdAt: number
    }>
  }
  orders: Array<Record<string, unknown>>
  inventory: Array<{
    id: string
    name: string
    currentQuantity: number
    reorderPoint: number
    active: number | boolean
  }>
  timeEntries: Array<Record<string, unknown>>
  hourly: Array<{
    hour: string
    orderCount: number
    revenue: number
  }>
}

export async function getFloorPlan(): Promise<FloorPlan> {
  const response = await fetch('/api/floor-plan')
  const body = (await response.json().catch(() => ({}))) as FloorPlan & { message?: string }
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
  const isMobile = useIsMobile()
  const [staffDialog, setStaffDialog] = useState(false)
  const [staffDraft, setStaffDraft] = useState({
    username: '',
    displayName: '',
    password: '',
    permissions: ['pos.read', 'pos.checkout', 'floor_plan.read', 'tables.operate', 'timeclock.use'],
  })
  const queryClient = useQueryClient()

  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const response = await fetch('/api/staff')
      const body = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) throw new Error(body.message ?? 'Không tải được nhân viên.')
      return body as {
        users: Array<{ id: string; username?: string; email?: string; displayName: string; active: boolean; permissions: string[] }>
        permissions: Array<{ id: string; code: string; label: string }>
        invites: Array<{ id: string; email: string; displayName: string; expiresAt: number }>
      }
    },
  })

  const timeclockQuery = useQuery({
    queryKey: ['timeclock'],
    queryFn: async () => {
      const response = await fetch('/api/timeclock')
      const body = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) throw new Error(body.message ?? 'Không tải được chấm công.')
      return body as {
        current: { id: string; checkInAt: number; checkOutAt: number | null; note: string } | null
        entries: Array<{
          id: string
          userName?: string
          checkInAt: number
          checkOutAt: number | null
          approvedAt: number | null
          note: string
        }>
        canManage: boolean
      }
    },
  })

  const staffMutation = useMutation({
    mutationFn: async (body: unknown) => {
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = (await response.json().catch(() => ({}))) as { message?: string; token?: string }
      if (!response.ok) throw new Error(result.message ?? 'Không thể lưu nhân viên.')
      return result
    },
    onSuccess: async () => {
      setStaffDialog(false)
      setStaffDraft({
        username: '',
        displayName: '',
        password: '',
        permissions: ['pos.read', 'pos.checkout', 'floor_plan.read', 'tables.operate', 'timeclock.use'],
      })
      await queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })

  const timeclockMutation = useMutation({
    mutationFn: async (body: unknown) => {
      const response = await fetch('/api/timeclock', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = (await response.json().catch(() => ({}))) as { message?: string }
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

  const invitePermissionGroups = useMemo(() => {
    const map = new Map<string, Array<{ code: string; label: string }>>()
    ;(data?.permissions ?? []).forEach((permission) => {
      const group = permission.code.split('.')[0] ?? 'khác'
      map.set(group, [...(map.get(group) ?? []), permission])
    })
    return [...map.entries()]
  }, [data?.permissions])

  const toggleStaffPermission = (code: string, checked: boolean) =>
    setStaffDraft((current) => ({
      ...current,
      permissions: checked
        ? [...new Set([...current.permissions, code])]
        : current.permissions.filter((item) => item !== code),
    }))

  return (
    <div className="staff-workspace grid gap-4 sm:gap-6 w-full min-w-0 max-w-full overflow-hidden">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#e5ddd6] bg-white shadow-2xs w-full min-w-0 max-w-full">
        <div className="min-w-0 flex-1">
          <span className="text-xs font-bold text-[var(--char)] uppercase tracking-wider block">
            Danh sách nhân sự
          </span>
          <span className="text-[11px] text-[#8c8177] block truncate">
            {data?.users?.length ?? 0} tài khoản ({activeCount} đang hoạt động)
          </span>
        </div>
        <PrimaryButton
          size="sm"
          disabled={!canManage}
          onClick={() => {
            setStaffDialog(true)
          }}
          className="flex items-center gap-1.5 text-xs h-9 shrink-0"
        >
          <IconUserPlus size={15} stroke={1.75} />
          <span>Thêm nhân viên</span>
        </PrimaryButton>
      </div>

      {staffQuery.isLoading && (
        <div className="grid gap-3.5 sm:gap-5" role="status" aria-busy="true">
          <SkeletonMetricGrid count={4} label="" />
          <SkeletonTable
            columns={[
              { cellClassName: 'w-44' },
              { cellClassName: 'w-40' },
              { cellClassName: 'w-32' },
              { cellClassName: 'w-20' },
              { align: 'right', cellClassName: 'w-16' },
            ]}
            rows={5}
            label=""
          />
        </div>
      )}
      {staffQuery.isError && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs">
          {staffError}
        </div>
      )}

      {data && (
        <>
          {/* KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 w-full min-w-0 max-w-full">
            <article className="p-3 sm:p-4 rounded-xl border border-[#e5ddd6] bg-white flex flex-col gap-0.5 shadow-2xs min-w-0 max-w-full overflow-hidden">
              <span className="text-[10.5px] sm:text-xs font-bold text-[#8c8177] uppercase tracking-wider truncate">
                Đang hoạt động
              </span>
              <strong className="text-base sm:text-2xl font-bold font-mono tabular-nums text-[var(--moss)] truncate">
                {activeCount}
              </strong>
              <small className="text-[10.5px] sm:text-xs text-[#8c8177] truncate">
                Tài khoản nhân viên
              </small>
            </article>

            <article className="p-3 sm:p-4 rounded-xl border border-[#e5ddd6] bg-white flex flex-col gap-0.5 shadow-2xs min-w-0 max-w-full overflow-hidden">
              <span className="text-[10.5px] sm:text-xs font-bold text-[#8c8177] uppercase tracking-wider truncate">
                Đang chờ mời
              </span>
              <strong className="text-base sm:text-2xl font-bold font-mono tabular-nums text-[var(--amber)] truncate">
                {pendingCount}
              </strong>
              <small className="text-[10.5px] sm:text-xs text-[#8c8177] truncate">
                Link còn hiệu lực
              </small>
            </article>

            <article className="p-3 sm:p-4 rounded-xl border border-[#e5ddd6] bg-white flex flex-col gap-0.5 shadow-2xs min-w-0 max-w-full overflow-hidden">
              <span className="text-[10.5px] sm:text-xs font-bold text-[#8c8177] uppercase tracking-wider truncate">
                Quyền hệ thống
              </span>
              <strong className="text-base sm:text-2xl font-bold font-mono tabular-nums text-[var(--char)] truncate">
                {data.permissions?.length ?? 0}
              </strong>
              <small className="text-[10.5px] sm:text-xs text-[#8c8177] truncate">
                Quyền phân cấp
              </small>
            </article>

            <article className="p-3 sm:p-4 rounded-xl border border-[#e5ddd6] bg-white flex flex-col gap-0.5 shadow-2xs min-w-0 max-w-full overflow-hidden">
              <span className="text-[10.5px] sm:text-xs font-bold text-[#8c8177] uppercase tracking-wider truncate">
                Tổng nhân sự
              </span>
              <strong className="text-base sm:text-2xl font-bold font-mono tabular-nums text-[var(--char)] truncate">
                {data.users?.length ?? 0}
              </strong>
              <small className="text-[10.5px] sm:text-xs text-[#8c8177] truncate">
                Tất cả tài khoản
              </small>
            </article>
          </div>

          {/* Staff List (Mobile Cards vs Desktop Table) */}
          <div className="grid gap-2.5 w-full min-w-0 max-w-full">
            {/* Mobile Cards (< 768px) */}
            <div className="mobile-only-list gap-2.5 w-full min-w-0 max-w-full">
              {(data.users ?? []).map((staff) => (
                <div
                  key={staff.id}
                  className="p-3.5 rounded-xl border border-[#e5ddd6] bg-white shadow-2xs flex flex-col gap-3 min-w-0 max-w-full"
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-full bg-[#f0e6d7] text-[#684838] font-bold text-xs flex items-center justify-center border border-[#ded6cd] shrink-0">
                        {staff.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <strong className="block text-sm font-bold text-[var(--char)] truncate">
                          {staff.displayName}
                        </strong>
                        <span className="block text-xs font-mono text-[#8c8177] truncate">@{staff.username || (staff.email ? staff.email.split('@')[0] : 'user')}</span>
                      </div>
                    </div>

                    <span
                      className={cn(
                        'shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 border whitespace-nowrap',
                        staff.active
                          ? 'bg-[#eefbf3] text-[#1e7e34] border-[#c3e6cb]'
                          : 'bg-[#fdf2f2] text-[#c92a2a] border-[#f5c6cb]',
                      )}
                    >
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          staff.active ? 'bg-[#28a745]' : 'bg-[#dc3545]',
                        )}
                      />
                      {staff.active ? 'Hoạt động' : 'Đã khóa'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-[#f0ebe4]">
                    <span className="text-xs text-[#61574f] font-medium">
                      {staff.permissions.length} quyền hạn
                    </span>
                    <StaffPermissionEditor
                      user={staff}
                      permissions={data.permissions ?? []}
                      canManage={canManage}
                      onSave={(input) => staffMutation.mutate(input)}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (>= 768px) */}
            <div className="desktop-only-table catalog-table-wrap">
              <table className="product-mockup-table w-full">
                <thead>
                  <tr>
                    <th>NHÂN VIÊN</th>
                    <th>TÊN ĐĂNG NHẬP</th>
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
                          <div className="w-9 h-9 rounded-full bg-[#f0e6d7] text-[#684838] font-bold text-xs flex items-center justify-center border border-[#ded6cd] shrink-0">
                            {staff.displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <strong className="block text-sm font-semibold text-[var(--char)]">
                              {staff.displayName}
                            </strong>
                          </div>
                        </div>
                      </td>
                      <td className="text-xs font-mono text-[#61574f]">@{staff.username || (staff.email ? staff.email.split('@')[0] : 'user')}</td>
                      <td>
                        <span className="variant-tag-chip">
                          <span className="variant-tag-name">{staff.permissions.length} quyền</span>
                        </span>
                      </td>
                      <td>
                        <span
                          className={cn(
                            'catalog-status-pill',
                            staff.active ? 'is-active' : 'is-inactive',
                          )}
                        >
                          <span
                            className={cn(
                              'catalog-status-dot',
                              staff.active ? 'dot-active' : 'dot-inactive',
                            )}
                          />
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
          </div>

          {/* Pending Invites List */}
          {data.invites?.length ? (
            <div className="p-4 border border-[#e5ddd6] rounded-xl bg-white shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8c8177] mb-2.5">
                Link mời đang chờ kích hoạt
              </h3>
              <div className="grid gap-2">
                {data.invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 px-3 bg-[#faf7f2] border border-[#ede6de] rounded-lg text-xs gap-1"
                  >
                    <div>
                      <strong className="text-[var(--char)] mr-2">{invite.displayName}</strong>
                      <span className="text-[#8c8177]">{invite.email}</span>
                    </div>
                    <small className="text-[#8c8177]">
                      Hết hạn: {new Date(invite.expiresAt).toLocaleString('vi-VN')}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Timeclock Section */}
      <div className="p-4 sm:p-5 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs grid gap-3.5 sm:gap-4 mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#f0ebe4]">
          <div>
            <h3 className="text-base font-bold text-[var(--char)] m-0">Chấm công & Ca làm việc</h3>
            <p className="text-xs text-[#8c8177] mt-0.5">
              {time?.current
                ? `Đang trong ca làm từ ${new Date(time.current.checkInAt).toLocaleTimeString('vi-VN')}`
                : 'Chưa mở ca làm việc hiện tại.'}
            </p>
          </div>
          <PrimaryButton
            size="sm"
            disabled={timeclockMutation.isPending}
            onClick={() =>
              timeclockMutation.mutate({
                action: time?.current ? 'clockOut' : 'clockIn',
                note: '',
              })
            }
            className={cn(
              'flex items-center justify-center gap-1.5 text-xs h-9 shrink-0',
              time?.current && 'bg-[#b3381e] hover:bg-[#9c301a]',
            )}
          >
            {time?.current ? (
              <IconPlayerStop size={15} stroke={1.75} />
            ) : (
              <IconPlayerPlay size={15} stroke={1.75} />
            )}
            <span>{time?.current ? 'Kết thúc ca làm' : 'Bắt đầu ca làm'}</span>
          </PrimaryButton>
        </div>

        {timeclockQuery.isError && (
          <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs">
            {timeError}
          </div>
        )}

        {time && (
          <div>
            {!time.entries?.length ? (
              <div className="p-6 text-center text-[#8c8177] text-xs">
                Chưa có lượt chấm công nào.
              </div>
            ) : (
              <>
                {/* Mobile Timeclock Cards */}
                <div className="mobile-only-list gap-2.5 w-full min-w-0 max-w-full">
                  {time.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3 rounded-xl border border-[#ede6de] bg-[#faf7f2] flex flex-col gap-2 min-w-0 max-w-full"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-sm font-bold text-[var(--char)] truncate">
                          {entry.userName ?? 'Tôi'}
                        </strong>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[10.5px] font-bold inline-flex items-center gap-1 border whitespace-nowrap',
                            entry.approvedAt
                              ? 'bg-[#eefbf3] text-[#1e7e34] border-[#c3e6cb]'
                              : 'bg-[#fff8e6] text-[#856404] border-[#ffeeba]',
                          )}
                        >
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              entry.approvedAt ? 'bg-[#28a745]' : 'bg-[#e0a800]',
                            )}
                          />
                          {entry.approvedAt ? 'Đã duyệt' : 'Chờ duyệt'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-white p-2 rounded-lg border border-[#ede6de]">
                        <div>
                          <span className="text-[10px] text-[#8c8177] block uppercase font-bold">
                            Vào ca
                          </span>
                          <span className="font-mono text-[#3c2f27] font-semibold text-[11px]">
                            {new Date(entry.checkInAt).toLocaleTimeString('vi-VN')}{' '}
                            <span className="text-[#8c8177] text-[10px]">
                              {new Date(entry.checkInAt).toLocaleDateString('vi-VN')}
                            </span>
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#8c8177] block uppercase font-bold">
                            Ra ca
                          </span>
                          <span className="font-mono text-[#3c2f27] font-semibold text-[11px]">
                            {entry.checkOutAt ? (
                              <>
                                {new Date(entry.checkOutAt).toLocaleTimeString('vi-VN')}{' '}
                                <span className="text-[#8c8177] text-[10px]">
                                  {new Date(entry.checkOutAt).toLocaleDateString('vi-VN')}
                                </span>
                              </>
                            ) : (
                              <span className="text-[var(--moss)] font-bold">● Đang làm việc</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {time.canManage && !entry.approvedAt && (
                        <div className="pt-1 flex justify-end">
                          <SecondaryButton
                            size="sm"
                            onClick={() =>
                              timeclockMutation.mutate({ action: 'approve', entryId: entry.id })
                            }
                            className="flex items-center gap-1 text-xs h-7.5"
                          >
                            <IconCheck size={13} stroke={2} />
                            <span>Duyệt ca làm</span>
                          </SecondaryButton>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop Timeclock Table */}
                <div className="desktop-only-table catalog-table-wrap">
                  <table className="product-mockup-table w-full">
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
                      {time.entries.map((entry) => (
                        <tr key={entry.id}>
                          <td>
                            <strong className="text-sm text-[var(--char)]">
                              {entry.userName ?? 'Tôi'}
                            </strong>
                          </td>
                          <td className="text-xs font-mono">
                            {new Date(entry.checkInAt).toLocaleString('vi-VN')}
                          </td>
                          <td className="text-xs font-mono">
                            {entry.checkOutAt ? (
                              new Date(entry.checkOutAt).toLocaleString('vi-VN')
                            ) : (
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
                                  onClick={() =>
                                    timeclockMutation.mutate({
                                      action: 'approve',
                                      entryId: entry.id,
                                    })
                                  }
                                  className="flex items-center gap-1"
                                >
                                  <IconCheck size={14} stroke={2} />
                                  <span>Duyệt ca</span>
                                </SecondaryButton>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Staff Creation Dialog / Drawer */}
      {staffDialog &&
        (isMobile ? (
          <Drawer.Root
            open
            onOpenChange={(open) => {
              if (!open) setStaffDialog(false)
            }}
          >
            <Drawer.Content
              direction="bottom"
              className="w-full max-h-[92dvh] p-0 bg-[#fffdf9] rounded-t-3xl border-t border-[#ded1c0] shadow-2xl flex flex-col"
            >
              <div className="px-6 pt-5 pb-4 border-b border-[#ede6de] flex items-center justify-between gap-3 shrink-0">
                <div>
                  <Drawer.Title className="text-base font-bold font-display text-[var(--char)] m-0">
                    Thêm nhân viên mới
                  </Drawer.Title>
                  <Drawer.Description className="text-xs text-[#8c8177] mt-0.5 truncate">
                    Tạo tài khoản và phân quyền trực tiếp cho nhân viên.
                  </Drawer.Description>
                </div>
                <Drawer.Close aria-label="Đóng" className="size-8 rounded-lg border border-[#ded6cc] bg-white text-[#716559] hover:text-[var(--char)] flex items-center justify-center shrink-0 cursor-pointer shadow-2xs hover:bg-[#faf7f3]">
                  <IconX size={17} stroke={2} />
                </Drawer.Close>
              </div>

              <Drawer.Body className="px-6 py-5 overflow-y-auto flex-1">
                <form
                  id="staff-form-mobile"
                  onSubmit={(event) => {
                    event.preventDefault()
                    staffMutation.mutate({
                      action: 'create',
                      username: staffDraft.username,
                      displayName: staffDraft.displayName,
                      password: staffDraft.password,
                      permissions: staffDraft.permissions,
                    })
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 gap-3.5">
                    <Field.Root>
                      <Field.Label>Tên đăng nhập (Username) *</Field.Label>
                      <Input
                        size="md"
                        required
                        autoComplete="username"
                        value={staffDraft.username}
                        onChange={(event) =>
                          setStaffDraft({ ...staffDraft, username: event.target.value })
                        }
                        placeholder="VD: thungan1, barista2"
                        className="product-mockup-input font-mono"
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Tên hiển thị (Họ và tên) *</Field.Label>
                      <Input
                        size="md"
                        required
                        value={staffDraft.displayName}
                        onChange={(event) =>
                          setStaffDraft({ ...staffDraft, displayName: event.target.value })
                        }
                        placeholder="VD: Nguyễn Văn A"
                        className="product-mockup-input"
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Mật khẩu ban đầu *</Field.Label>
                      <Input
                        size="md"
                        required
                        type="password"
                        autoComplete="new-password"
                        value={staffDraft.password}
                        onChange={(event) =>
                          setStaffDraft({ ...staffDraft, password: event.target.value })
                        }
                        placeholder="Tối thiểu 6 ký tự"
                        className="product-mockup-input font-mono"
                      />
                    </Field.Root>
                  </div>

                  {/* Permissions section */}
                  <div className="pt-3 border-t border-[#ede6de] space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="m-0 text-xs font-bold text-[#61574f]">QUYỀN BAN ĐẦU</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setStaffDraft(d => ({ ...d, permissions: ['pos.read', 'pos.checkout', 'floor_plan.read', 'tables.operate', 'timeclock.use'] }))}
                          className="px-2.5 py-1 rounded-md text-[10.5px] font-bold bg-[#f5ede4] hover:bg-[var(--espresso)] hover:text-white text-[#61574f] border border-[#ded6cc] transition-colors"
                        >
                          Thu ngân
                        </button>
                        <button
                          type="button"
                          onClick={() => setStaffDraft(d => ({ ...d, permissions: ['kds.read', 'kds.manage', 'floor_plan.read', 'timeclock.use'] }))}
                          className="px-2.5 py-1 rounded-md text-[10.5px] font-bold bg-[#f5ede4] hover:bg-[var(--espresso)] hover:text-white text-[#61574f] border border-[#ded6cc] transition-colors"
                        >
                          Pha chế
                        </button>
                        <button
                          type="button"
                          onClick={() => setStaffDraft(d => ({ ...d, permissions: (data?.permissions ?? []).map(p => p.code) }))}
                          className="px-2.5 py-1 rounded-md text-[10.5px] font-bold bg-[#f5ede4] hover:bg-[var(--espresso)] hover:text-white text-[#61574f] border border-[#ded6cc] transition-colors"
                        >
                          Toàn quyền
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                      {invitePermissionGroups.map(([group, items]) => {
                        const selectedInGroup = items.filter(p => staffDraft.permissions.includes(p.code)).length
                        return (
                          <div
                            key={group}
                            className="border border-[#e5ddd6] rounded-xl p-3 bg-white shadow-2xs space-y-2"
                          >
                            <div className="flex items-center justify-between pb-1.5 border-b border-[#f5ede4]">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-[#716559]">
                                {GROUP_TITLES[group] ?? group}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-[#8c8177]">
                                {selectedInGroup}/{items.length}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 gap-1.5">
                              {items.map((permission) => {
                                const isChecked = staffDraft.permissions.includes(permission.code)
                                return (
                                  <label
                                    key={permission.code}
                                    className={cn(
                                      'flex items-center gap-2.5 cursor-pointer p-2 rounded-lg border transition-all select-none',
                                      isChecked
                                        ? 'bg-amber-50/70 border-amber-200/90 text-[var(--char)]'
                                        : 'bg-[#faf7f2]/60 border-transparent hover:border-[#ded6cc] text-[#554a40]'
                                    )}
                                  >
                                    <Checkbox
                                      checked={isChecked}
                                      onCheckedChange={(checked) =>
                                        toggleStaffPermission(permission.code, checked === true)
                                      }
                                    />
                                    <span className="text-xs font-semibold leading-tight min-w-0">
                                      {permission.label}
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {staffMutation.isError && (
                    <p className="p-2.5 rounded-lg bg-red-50 text-red-700 text-xs">{mutationError}</p>
                  )}
                </form>
              </Drawer.Body>

              <div className="p-5 border-t border-[#ede6de] bg-[#fffdfa] flex gap-3 shrink-0">
                <Drawer.Close className="h-10 px-4 rounded-xl border border-[#ded6cc] bg-white text-[var(--char)] font-bold text-xs shadow-2xs hover:bg-[#faf7f3] active:scale-[0.98] transition-all cursor-pointer flex-1 flex items-center justify-center">
                  Hủy
                </Drawer.Close>
                <PrimaryButton
                  disabled={staffMutation.isPending}
                  type="submit"
                  form="staff-form-mobile"
                  className="flex-1 h-10 text-xs font-bold"
                >
                  {staffMutation.isPending ? 'Đang tạo…' : 'Tạo tài khoản'}
                </PrimaryButton>
              </div>
            </Drawer.Content>
          </Drawer.Root>
        ) : (
          <Dialog.Root
            open
            onOpenChange={(open) => {
              if (!open) setStaffDialog(false)
            }}
          >
            <Dialog.Portal>
              <Dialog.Backdrop className="dialog-backdrop" />
              <Dialog.Viewport className="dialog-viewport">
                <Dialog.Popup className="product-mockup-dialog flex flex-col max-h-[90vh]" style={{ maxWidth: '580px' }}>
                  {/* Header */}
                  <div className="product-mockup-header px-7 pt-6 pb-4 border-b border-[#ede6de] shrink-0">
                    <div>
                      <Dialog.Title className="product-mockup-heading">
                        Thêm nhân viên mới
                      </Dialog.Title>
                      <Dialog.Description className="product-mockup-sub mt-0.5">
                        Tạo tài khoản và phân quyền trực tiếp cho nhân viên.
                      </Dialog.Description>
                    </div>
                    <Dialog.Close aria-label="Đóng" className="product-mockup-close-btn">
                      <IconX size={18} stroke={1.75} />
                    </Dialog.Close>
                  </div>

                  {/* Form Body - Scrollable */}
                  <form
                    id="staff-form-desktop"
                    onSubmit={(event) => {
                      event.preventDefault()
                      staffMutation.mutate({
                        action: 'create',
                        username: staffDraft.username,
                        displayName: staffDraft.displayName,
                        password: staffDraft.password,
                        permissions: staffDraft.permissions,
                      })
                    }}
                    className="overflow-y-auto space-y-4 px-7 py-5 flex-1 scrollbar-thin"
                  >
                    <div className="grid grid-cols-2 gap-3.5">
                      <Field.Root>
                        <Field.Label>Tên đăng nhập (Username) *</Field.Label>
                        <Input
                          size="md"
                          required
                          autoComplete="username"
                          value={staffDraft.username}
                          onChange={(event) =>
                            setStaffDraft({ ...staffDraft, username: event.target.value })
                          }
                          placeholder="VD: thungan1, barista2"
                          className="product-mockup-input font-mono"
                        />
                      </Field.Root>
                      <Field.Root>
                        <Field.Label>Tên hiển thị (Họ và tên) *</Field.Label>
                        <Input
                          size="md"
                          required
                          value={staffDraft.displayName}
                          onChange={(event) =>
                            setStaffDraft({ ...staffDraft, displayName: event.target.value })
                          }
                          placeholder="VD: Nguyễn Văn A"
                          className="product-mockup-input"
                        />
                      </Field.Root>
                    </div>

                    <Field.Root>
                      <Field.Label>Mật khẩu ban đầu *</Field.Label>
                      <Input
                        size="md"
                        required
                        type="password"
                        autoComplete="new-password"
                        value={staffDraft.password}
                        onChange={(event) =>
                          setStaffDraft({ ...staffDraft, password: event.target.value })
                        }
                        placeholder="Tối thiểu 6 ký tự"
                        className="product-mockup-input font-mono"
                      />
                    </Field.Root>

                    {/* Permissions Section */}
                    <div className="pt-3 border-t border-[#ede6de] space-y-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="m-0 text-xs font-bold text-[#61574f]">QUYỀN BAN ĐẦU</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setStaffDraft(d => ({ ...d, permissions: ['pos.read', 'pos.checkout', 'floor_plan.read', 'tables.operate', 'timeclock.use'] }))}
                            className="px-2.5 py-1 rounded-md text-[10.5px] font-bold bg-[#f5ede4] hover:bg-[var(--espresso)] hover:text-white text-[#61574f] border border-[#ded6cc] transition-colors cursor-pointer"
                          >
                            Thu ngân
                          </button>
                          <button
                            type="button"
                            onClick={() => setStaffDraft(d => ({ ...d, permissions: ['kds.read', 'kds.manage', 'floor_plan.read', 'timeclock.use'] }))}
                            className="px-2.5 py-1 rounded-md text-[10.5px] font-bold bg-[#f5ede4] hover:bg-[var(--espresso)] hover:text-white text-[#61574f] border border-[#ded6cc] transition-colors cursor-pointer"
                          >
                            Pha chế
                          </button>
                          <button
                            type="button"
                            onClick={() => setStaffDraft(d => ({ ...d, permissions: (data?.permissions ?? []).map(p => p.code) }))}
                            className="px-2.5 py-1 rounded-md text-[10.5px] font-bold bg-[#f5ede4] hover:bg-[var(--espresso)] hover:text-white text-[#61574f] border border-[#ded6cc] transition-colors cursor-pointer"
                          >
                            Toàn quyền
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2.5 border border-[#e5ddd6] rounded-xl p-3.5 bg-[#fbf9f6] max-h-60 overflow-y-auto scrollbar-thin">
                        {invitePermissionGroups.map(([group, items]) => {
                          const selectedInGroup = items.filter(p => staffDraft.permissions.includes(p.code)).length
                          return (
                            <div
                              key={group}
                              className="border border-[#ede6de] rounded-lg p-3 bg-white shadow-2xs space-y-2"
                            >
                              <div className="flex items-center justify-between pb-1.5 border-b border-[#f5ede4]">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[#716559]">
                                  {GROUP_TITLES[group] ?? group}
                                </span>
                                <span className="text-[10px] font-mono font-bold text-[#8c8177]">
                                  {selectedInGroup}/{items.length}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {items.map((permission) => {
                                  const isChecked = staffDraft.permissions.includes(permission.code)
                                  return (
                                    <label
                                      key={permission.code}
                                      className={cn(
                                        'flex items-center gap-2.5 cursor-pointer p-2 rounded-lg border transition-all select-none',
                                        isChecked
                                          ? 'bg-amber-50/70 border-amber-200/90 text-[var(--char)]'
                                          : 'bg-[#faf7f2]/60 border-transparent hover:border-[#ded6cc] text-[#554a40]'
                                      )}
                                    >
                                      <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={(checked) =>
                                          toggleStaffPermission(permission.code, checked === true)
                                        }
                                      />
                                      <span className="text-xs font-semibold leading-tight min-w-0">
                                        {permission.label}
                                      </span>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {staffMutation.isError && (
                      <p className="p-2.5 rounded-lg bg-red-50 text-red-700 text-xs">
                        {mutationError}
                      </p>
                    )}
                  </form>

                  {/* Footer - Fixed at bottom */}
                  <div className="product-mockup-footer px-7 py-4 border-t border-[#ede6de] bg-[#fffdfa] shrink-0 mt-auto">
                    <div className="flex items-center justify-end gap-2.5 w-full">
                      <Dialog.Close className="h-10 px-5 rounded-xl border border-[#ded6cc] bg-white text-[var(--char)] font-bold text-xs shadow-2xs hover:bg-[#faf7f3] hover:border-[#c5bcaf] active:scale-[0.98] transition-all cursor-pointer inline-flex items-center justify-center">
                        Hủy
                      </Dialog.Close>
                      <PrimaryButton
                        disabled={staffMutation.isPending}
                        type="submit"
                        form="staff-form-desktop"
                        className="h-10 px-6 text-xs font-bold"
                      >
                        {staffMutation.isPending ? 'Đang tạo…' : 'Tạo tài khoản'}
                      </PrimaryButton>
                    </div>
                  </div>
                </Dialog.Popup>
              </Dialog.Viewport>
            </Dialog.Portal>
          </Dialog.Root>
        ))}
    </div>
  )
}

const getPresetRange = (preset: 'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'lastMonth') => {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  if (preset === 'today') {
    return { from: todayStr, to: todayStr }
  }
  if (preset === 'yesterday') {
    const y = new Date(now.getTime() - 86400000)
    const yStr = y.toISOString().slice(0, 10)
    return { from: yStr, to: yStr }
  }
  if (preset === '7days') {
    const d7 = new Date(now.getTime() - 6 * 86400000)
    return { from: d7.toISOString().slice(0, 10), to: todayStr }
  }
  if (preset === '30days') {
    const d30 = new Date(now.getTime() - 29 * 86400000)
    return { from: d30.toISOString().slice(0, 10), to: todayStr }
  }
  if (preset === 'thisMonth') {
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    return { from: `${y}-${m}-01`, to: todayStr }
  }
  if (preset === 'lastMonth') {
    const prevMonthLastDate = new Date(now.getFullYear(), now.getMonth(), 0)
    const y = prevMonthLastDate.getFullYear()
    const m = String(prevMonthLastDate.getMonth() + 1).padStart(2, '0')
    const lastDayNum = prevMonthLastDate.getDate()
    return {
      from: `${y}-${m}-01`,
      to: `${y}-${m}-${String(lastDayNum).padStart(2, '0')}`,
    }
  }
  return { from: todayStr, to: todayStr }
}

export function ReportsWorkspace({
  onExportExcel,
  onExportPdf,
}: {
  onExportExcel?: (data: ReportData) => void
  onExportPdf?: (data: ReportData) => void
}) {
  const [activePreset, setActivePreset] = useState<'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'lastMonth' | 'custom'>('today')
  const [reportFrom, setReportFrom] = useState(new Date().toISOString().slice(0, 10))
  const [reportTo, setReportTo] = useState(new Date().toISOString().slice(0, 10))
  const [activeTab, setActiveTab] = useState<'trends' | 'products' | 'purchasing' | 'channels' | 'cashier'>('trends')

  const reportQuery = useQuery({
    queryKey: ['reports', reportFrom, reportTo],
    queryFn: async () => {
      const response = await fetch(`/api/reports?from=${reportFrom}&to=${reportTo}`)
      const body = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) throw new Error(body.message ?? 'Không tải được báo cáo.')
      return body as ReportData
    },
  })

  const data = reportQuery.data
  const reportError =
    reportQuery.error instanceof Error ? reportQuery.error.message : 'Không tải được báo cáo.'

  const handleSelectPreset = (preset: 'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'lastMonth') => {
    setActivePreset(preset)
    const { from, to } = getPresetRange(preset)
    setReportFrom(from)
    setReportTo(to)
  }

  // Analytics derivations
  // Analytics derivations
  const dailyList = data?.dailyTrend ?? []
  const maxDailyRevenue = Math.max(1, ...dailyList.map((d) => d.revenue))
  const bestDay = dailyList.reduce((prev, curr) => (curr.revenue > prev.revenue ? curr : prev), dailyList[0])
  const avgDailyRevenue = dailyList.length > 0 ? Math.round((data?.summary.revenue || 0) / dailyList.length) : 0

  const revenueTotal = data?.summary.revenue || 0
  const purchasingTotal = data?.purchasing?.totalCost || 0
  const realProfit = revenueTotal - purchasingTotal
  const profitMarginPercent = revenueTotal > 0 ? Math.round((realProfit / revenueTotal) * 100) : 0
  const purchasingPercent = revenueTotal > 0 ? Math.min(100, Math.round((purchasingTotal / revenueTotal) * 100)) : 0
  const purchasingReceiptCount = data?.purchasing?.receiptCount || 0

  return (
    <div className="reports-workspace grid gap-4 sm:gap-6 w-full min-w-0 max-w-full overflow-hidden pb-12">
      {/* Top Filter Bar with Quick Presets & Export Actions */}
      <div className="flex flex-col gap-3 p-3.5 sm:p-4.5 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs w-full min-w-0 max-w-full">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Quick Preset Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -webkit-overflow-scrolling-touch scrollbar-none">
            {[
              { id: 'today' as const, label: 'Hôm nay' },
              { id: 'yesterday' as const, label: 'Hôm qua' },
              { id: '7days' as const, label: '7 ngày qua' },
              { id: '30days' as const, label: '30 ngày qua' },
              { id: 'thisMonth' as const, label: 'Tháng này' },
              { id: 'lastMonth' as const, label: 'Tháng trước' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p.id)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0',
                  activePreset === p.id
                    ? 'bg-[#1c1512] text-white shadow-xs'
                    : 'bg-[#f4efe8] text-[#61574f] hover:bg-[#eae1d5]',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Export Buttons */}
          {data && (
            <div className="flex items-center gap-2 shrink-0 self-end lg:self-auto">
              <SecondaryButton
                onClick={() => (onExportExcel ? onExportExcel(data) : null)}
                className="flex items-center justify-center gap-1.5 text-xs h-10 px-3.5 font-bold"
              >
                <IconFileSpreadsheet size={16} stroke={1.75} />
                <span>Xuất Excel</span>
              </SecondaryButton>
              <PrimaryButton
                onClick={() => (onExportPdf ? onExportPdf(data) : null)}
                className="flex items-center justify-center gap-1.5 text-xs h-10 px-3.5 font-bold"
              >
                <IconFileTypePdf size={16} stroke={1.75} />
                <span>Xuất PDF</span>
              </PrimaryButton>
            </div>
          )}
        </div>

        {/* Custom Date Range Picker */}
        <div className="pt-3 border-t border-[#f0ebe4] flex items-center gap-2">
          <span className="text-xs font-bold text-[#8c8177] shrink-0">Khoảng ngày:</span>
          <DateRangePicker
            size="sm"
            value={{ from: reportFrom, to: reportTo }}
            onValueChange={({ from, to }) => {
              setActivePreset('custom')
              setReportFrom(from ?? '')
              setReportTo(to ?? '')
            }}
            placeholder="Chọn khoảng ngày tùy chỉnh…"
            className="w-full sm:w-auto sm:min-w-[280px] bg-white text-xs"
          />
        </div>
      </div>

      {reportQuery.isLoading && (
        <div className="grid gap-4" role="status" aria-busy="true">
          <SkeletonMetricGrid count={4} label="" />
          <SkeletonTable
            columns={[
              { width: '10%', cellClassName: 'w-10' },
              { width: '36%', cellClassName: 'w-40' },
              { width: '18%', cellClassName: 'w-20' },
              { width: '16%', align: 'right', cellClassName: 'w-14' },
              { width: '20%', align: 'right', cellClassName: 'w-20' },
            ]}
            rows={6}
            label=""
          />
        </div>
      )}

      {reportQuery.isError && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs">
          {reportError}
        </div>
      )}

      {data && (
        <>
          {/* Financial KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 w-full min-w-0 max-w-full">
            <article className="p-4 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs min-w-0 max-w-full overflow-hidden flex flex-col justify-between hover:border-[#ded1c0] transition-colors">
              <div>
                <span className="text-[10.5px] sm:text-xs font-bold text-[#8c8177] uppercase tracking-wider block truncate">
                  Tổng Thu Bán Hàng
                </span>
                <strong className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-[var(--ember)] block truncate mt-1">
                  {revenueTotal.toLocaleString('vi-VN')}₫
                </strong>
              </div>
              <div className="mt-2.5 pt-2 border-t border-[#f4efe8] flex items-center justify-between text-[11px] text-[#8c8177]">
                <span>Tổng số đơn:</span>
                <span className="font-semibold font-mono text-[var(--char)]">{data.summary.orderCount} đơn</span>
              </div>
            </article>

            <article className="p-4 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs min-w-0 max-w-full overflow-hidden flex flex-col justify-between hover:border-[#ded1c0] transition-colors">
              <div>
                <span className="text-[10.5px] sm:text-xs font-bold text-[#8c8177] uppercase tracking-wider block truncate">
                  Chi Tiền Mua Hàng
                </span>
                <strong className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-amber-900 block truncate mt-1">
                  {purchasingTotal.toLocaleString('vi-VN')}₫
                </strong>
              </div>
              <div className="mt-2.5 pt-2 border-t border-[#f4efe8] flex items-center justify-between text-[11px] text-[#8c8177]">
                <span>Số phiếu nhập:</span>
                <span className="font-semibold font-mono text-amber-900">{purchasingReceiptCount} phiếu</span>
              </div>
            </article>

            <article className="p-4 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs min-w-0 max-w-full overflow-hidden flex flex-col justify-between hover:border-[#ded1c0] transition-colors">
              <div>
                <span className="text-[10.5px] sm:text-xs font-bold text-[#8c8177] uppercase tracking-wider block truncate">
                  Tiền Lời (Thu - Chi)
                </span>
                <strong className={cn("text-lg sm:text-2xl font-bold font-mono tabular-nums block truncate mt-1", realProfit >= 0 ? "text-[var(--moss)]" : "text-red-700")}>
                  {realProfit.toLocaleString('vi-VN')}₫
                </strong>
              </div>
              <div className="mt-2.5 pt-2 border-t border-[#f4efe8] flex items-center justify-between text-[11px] text-[#8c8177]">
                <span>Tỷ suất tiền lời:</span>
                <span className="font-bold font-mono text-emerald-800">{profitMarginPercent}%</span>
              </div>
            </article>

            <article className="p-4 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs min-w-0 max-w-full overflow-hidden flex flex-col justify-between hover:border-[#ded1c0] transition-colors">
              <div>
                <span className="text-[10.5px] sm:text-xs font-bold text-[#8c8177] uppercase tracking-wider block truncate">
                  Giá Trị TB / Đơn (AOV)
                </span>
                <strong className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-[var(--char)] block truncate mt-1">
                  {data.summary.averageOrder.toLocaleString('vi-VN')}₫
                </strong>
              </div>
              <div className="mt-2.5 pt-2 border-t border-[#f4efe8] flex items-center justify-between text-[11px] text-[#8c8177]">
                <span>Trung bình mỗi khách:</span>
                <span className="font-semibold font-mono text-[var(--char)]">{data.summary.averageOrder.toLocaleString('vi-VN')}₫</span>
              </div>
            </article>
          </div>

          {/* Revenue Breakdown Composition Bar */}
          {revenueTotal > 0 && (
            <div className="p-4 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[var(--char)]">Dòng tiền thu - chi trong kỳ</span>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="flex items-center gap-1.5 text-amber-900">
                    <span className="size-2.5 rounded-full bg-amber-600" />
                    <span>Chi tiền mua hàng ({purchasingPercent}%)</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-800">
                    <span className="size-2.5 rounded-full bg-emerald-600" />
                    <span>Tiền lời thực tế ({Math.max(0, 100 - purchasingPercent)}%)</span>
                  </span>
                </div>
              </div>
              <div className="w-full h-3 rounded-full bg-[#f0ebe4] flex overflow-hidden">
                <div
                  className="h-full bg-amber-600 transition-all duration-300"
                  style={{ width: `${purchasingPercent}%` }}
                  title={`Chi tiền mua hàng: ${purchasingTotal.toLocaleString('vi-VN')}₫ (${purchasingPercent}%)`}
                />
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${Math.max(0, 100 - purchasingPercent)}%` }}
                  title={`Tiền lời thực tế: ${Math.max(0, realProfit).toLocaleString('vi-VN')}₫ (${Math.max(0, 100 - purchasingPercent)}%)`}
                />
              </div>
            </div>
          )}

          {/* Multi-Tab Navigation */}
          <div className="flex items-center gap-2 p-1.5 bg-[#ede6de]/80 rounded-2xl overflow-x-auto scrollbar-none w-full">
            {[
              { id: 'trends' as const, label: 'Xu hướng doanh thu', icon: IconTrendingUp },
              { id: 'products' as const, label: 'Sản phẩm & Danh mục', icon: IconCoffee },
              { id: 'purchasing' as const, label: 'Chi tiền hàng & Nhập kho', icon: IconPackage },
              { id: 'channels' as const, label: 'Kênh bán & Nguồn thu', icon: IconCash },
              { id: 'cashier' as const, label: 'Thu ngân & Nhân viên', icon: IconUsers },
            ].map((tab) => {
              const Icon = tab.icon
              const isSelected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex-1 min-w-[155px] py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap',
                    isSelected
                      ? 'bg-white text-[var(--char)] shadow-xs'
                      : 'text-[#61574f] hover:bg-white/50',
                  )}
                >
                  <Icon size={16} stroke={2} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Tab 1: Trends (Daily & Hourly) */}
          {activeTab === 'trends' && (
            <div className="grid gap-4 sm:gap-6">
              {/* Daily Trend Chart */}
              <section className="p-4 sm:p-5 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[var(--char)] m-0">
                      Biểu đồ doanh thu theo ngày ({dailyList.length} ngày)
                    </h3>
                    <p className="text-xs text-[#8c8177] m-0 mt-0.5">
                      Theo dõi biến động doanh thu và biên lợi nhuận từng ngày trong kỳ.
                    </p>
                  </div>
                  {bestDay && bestDay.revenue > 0 && (
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                      <IconFlame size={14} className="text-amber-600" />
                      Cao nhất: {bestDay.date} ({bestDay.revenue.toLocaleString('vi-VN')}₫)
                    </span>
                  )}
                </div>

                {dailyList.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#8c8177]">Chưa có dữ liệu bán hàng trong khoảng ngày này.</div>
                ) : (
                  <div className="w-full overflow-x-auto pb-2 scrollbar-none">
                    <div className="flex items-end gap-2 min-w-[500px] h-48 pt-4 px-2 border-b border-[#eee8e0]">
                      {dailyList.map((d) => {
                        const heightPercent = d.revenue > 0 ? Math.max(12, Math.round((d.revenue / maxDailyRevenue) * 100)) : 4
                        const isBest = bestDay && d.date === bestDay.date && d.revenue > 0
                        return (
                          <div
                            key={d.date}
                            className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer"
                            title={`${d.date}: ${d.revenue.toLocaleString('vi-VN')}₫ (${d.orderCount} đơn, Lợi nhuận: ${d.grossMargin.toLocaleString('vi-VN')}₫)`}
                          >
                            <div className="w-full max-w-10 h-36 flex items-end relative">
                              <div
                                className={cn(
                                  'w-full rounded-t-md transition-all duration-300',
                                  isBest
                                    ? 'bg-gradient-to-t from-amber-600 to-amber-500 shadow-xs'
                                    : d.revenue > 0
                                      ? 'bg-[var(--ember)] opacity-85 group-hover:opacity-100'
                                      : 'bg-[#e5ddd6] opacity-35',
                                )}
                                style={{ height: `${heightPercent}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono tabular-nums text-[#8c8177] truncate w-full text-center">
                              {d.date.slice(5)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Daily Averages */}
                {dailyList.length > 1 && (
                  <div className="mt-4 pt-3 border-t border-[#f0ebe4] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[#8c8177] block text-[11px]">Doanh thu TB / ngày:</span>
                      <strong className="font-mono font-bold text-[var(--char)]">{avgDailyRevenue.toLocaleString('vi-VN')}₫</strong>
                    </div>
                    <div>
                      <span className="text-[#8c8177] block text-[11px]">Số ngày hoạt động:</span>
                      <strong className="font-mono font-bold text-[var(--char)]">{dailyList.length} ngày</strong>
                    </div>
                    <div>
                      <span className="text-[#8c8177] block text-[11px]">Đơn TB / ngày:</span>
                      <strong className="font-mono font-bold text-[var(--char)]">
                        {Math.round((data.summary.orderCount || 0) / dailyList.length)} đơn
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#8c8177] block text-[11px]">Ngày doanh thu đỉnh:</span>
                      <strong className="font-mono font-bold text-amber-900">{bestDay?.date ?? '—'}</strong>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Tab 2: Products & Categories */}
          {activeTab === 'products' && (
            <div className="grid gap-4 sm:gap-6">
              {/* Category Distribution Grid */}
              {(data.categoryBreakdown ?? []).length > 0 && (
                <section className="p-4 sm:p-5 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm sm:text-base font-bold text-[var(--char)] m-0">
                      Cơ cấu theo nhóm thực đơn
                    </h3>
                    <span className="text-xs text-[#8c8177] font-mono font-semibold">
                      {(data.categoryBreakdown ?? []).length} nhóm món
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {(data.categoryBreakdown ?? []).map((cat) => (
                      <div
                        key={cat.categoryName}
                        className="p-3 rounded-xl border border-[#ede6de] bg-[#fbf9f6] flex flex-col justify-between gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-xs font-bold text-[var(--char)] truncate">{cat.categoryName}</strong>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1c1512] text-white">
                            {cat.percentage}%
                          </span>
                        </div>
                        <div>
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-xs font-bold font-mono text-[var(--ember)]">
                              {cat.revenue.toLocaleString('vi-VN')}₫
                            </span>
                            <span className="text-[11px] font-mono text-[#8c8177]">{cat.quantity} ly</span>
                          </div>
                          <div className="w-full h-1.5 bg-[#ede6de] rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--ember)] rounded-full" style={{ width: `${cat.percentage}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Top Selling Products List */}
              <section className="p-4 sm:p-5 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm sm:text-base font-bold text-[var(--char)] m-0">
                    Bảng xếp hạng món bán chạy ({data.topItems?.length ?? 0} món)
                  </h3>
                  <span className="text-xs text-[#8c8177]">Sắp xếp theo số lượng và doanh thu</span>
                </div>

                {!data.topItems?.length ? (
                  <div className="py-10 text-center text-xs text-[#8c8177]">Chưa có món bán trong kỳ.</div>
                ) : (
                  <div className="catalog-table-wrap">
                    <table className="product-mockup-table w-full">
                      <thead>
                        <tr>
                          <th style={{ width: '8%' }}>HẠNG</th>
                          <th style={{ width: '34%' }}>TÊN MÓN</th>
                          <th style={{ width: '16%' }}>DANH MỤC</th>
                          <th style={{ width: '14%' }}>SIZE</th>
                          <th style={{ width: '12%' }} className="text-right">
                            SỐ LƯỢNG
                          </th>
                          <th style={{ width: '16%' }} className="text-right">
                            DOANH THU
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topItems.map((item, index) => {
                          const percent = data.summary.revenue
                            ? Math.round((item.revenue / data.summary.revenue) * 100)
                            : 0
                          return (
                            <tr key={`${item.name}-${item.variant}`}>
                              <td>
                                <span
                                  className={cn(
                                    'w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs font-mono',
                                    index === 0
                                      ? 'bg-[#ffeaa7] text-[#76530e]'
                                      : index === 1
                                        ? 'bg-[#dfe6e9] text-[#2d3436]'
                                        : index === 2
                                          ? 'bg-[#fad390] text-[#684838]'
                                          : 'text-[#8c8177]',
                                  )}
                                >
                                  #{index + 1}
                                </span>
                              </td>
                              <td>
                                <strong className="text-sm font-bold text-[var(--char)] block">
                                  {item.name}
                                </strong>
                              </td>
                              <td className="text-xs text-[#61574f]">
                                <span className="px-2 py-0.5 rounded-md bg-[#f4efe8] font-medium text-[11px]">
                                  {item.categoryName || 'Khác'}
                                </span>
                              </td>
                              <td className="text-xs text-[#61574f]">
                                {item.variant || 'Tiêu chuẩn'}
                              </td>
                              <td className="text-right font-mono font-bold text-xs tabular-nums">
                                {item.quantity} ly
                              </td>
                              <td className="text-right font-mono font-bold text-xs text-[var(--ember)] tabular-nums">
                                {item.revenue.toLocaleString('vi-VN')}₫
                                <span className="text-[10px] text-[#8c8177] font-normal block font-sans">
                                  ({percent}%)
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Tab 3: Purchasing & Goods Spending */}
          {activeTab === 'purchasing' && (
            <div className="grid gap-4 sm:gap-6">
              {/* Purchasing Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <article className="p-4 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs">
                  <span className="text-xs font-bold text-[#8c8177] uppercase tracking-wider block">
                    Tổng chi tiền nhập hàng
                  </span>
                  <strong className="text-xl font-bold font-mono text-amber-900 block mt-1">
                    {purchasingTotal.toLocaleString('vi-VN')}₫
                  </strong>
                  <span className="text-xs text-[#8c8177] block mt-1 font-medium">
                    {purchasingReceiptCount} phiếu nhập kho trong kỳ
                  </span>
                </article>

                <article className="p-4 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs">
                  <span className="text-xs font-bold text-[#8c8177] uppercase tracking-wider block">
                    Tổng lượng hàng đã nhập
                  </span>
                  <strong className="text-xl font-bold font-mono text-[var(--char)] block mt-1">
                    +{(data.purchasing?.byIngredient ?? []).reduce((s, i) => s + i.quantity, 0).toLocaleString('vi-VN')} <span className="text-xs font-normal text-[#8c8177]">đơn vị</span>
                  </strong>
                  <span className="text-xs text-[#8c8177] block mt-1 font-medium">
                    Tổng số lượng bổ sung vào kho
                  </span>
                </article>

                <article className="p-4 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs">
                  <span className="text-xs font-bold text-[#8c8177] uppercase tracking-wider block">
                    Số loại nguyên liệu nhập
                  </span>
                  <strong className="text-xl font-bold font-mono text-emerald-800 block mt-1">
                    {(data.purchasing?.byIngredient || []).length} loại
                  </strong>
                  <span className="text-xs text-[#8c8177] block mt-1 font-medium">
                    Các mặt hàng đã nhập trong kỳ
                  </span>
                </article>
              </div>

              {/* Purchasing by Ingredient Table */}
              <section className="p-4 sm:p-5 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[var(--char)] m-0">
                      Cơ cấu chi tiền theo nguyên vật liệu
                    </h3>
                    <p className="text-xs text-[#8c8177] m-0 mt-0.5">
                      Xếp hạng nguyên liệu tiêu tốn chi phí mua vào nhiều nhất trong kỳ.
                    </p>
                  </div>
                  <span className="text-xs text-[#8c8177] font-mono font-semibold">
                    {(data.purchasing?.byIngredient ?? []).length} loại hàng
                  </span>
                </div>

                {!(data.purchasing?.byIngredient ?? []).length ? (
                  <div className="py-10 text-center text-xs text-[#8c8177]">Chưa có phiếu nhập hàng nào trong khoảng ngày này.</div>
                ) : (
                  <div className="catalog-table-wrap">
                    <table className="product-mockup-table w-full">
                      <thead>
                        <tr>
                          <th style={{ width: '8%' }}>STT</th>
                          <th style={{ width: '32%' }}>NGUYÊN VẬT LIỆU</th>
                          <th style={{ width: '15%' }}>ĐƠN VỊ</th>
                          <th style={{ width: '15%' }} className="text-right">
                            SỐ LƯỢNG NHẬP
                          </th>
                          <th style={{ width: '15%' }} className="text-right">
                            ĐƠN GIÁ TB
                          </th>
                          <th style={{ width: '15%' }} className="text-right">
                            TỔNG CHI
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.purchasing?.byIngredient ?? []).map((ing, index) => {
                          const percent = purchasingTotal > 0 ? Math.round((ing.totalCost / purchasingTotal) * 100) : 0
                          return (
                            <tr key={ing.ingredientName}>
                              <td>
                                <span className="font-mono text-xs font-bold text-[#8c8177]">
                                  #{index + 1}
                                </span>
                              </td>
                              <td>
                                <strong className="text-sm font-bold text-[var(--char)] block">
                                  {ing.ingredientName}
                                </strong>
                              </td>
                              <td className="text-xs text-[#61574f] font-medium">{ing.unit}</td>
                              <td className="text-right font-mono font-bold text-xs tabular-nums">
                                {ing.quantity.toLocaleString('vi-VN')} {ing.unit}
                              </td>
                              <td className="text-right font-mono text-xs tabular-nums text-[#61574f]">
                                {ing.avgUnitCost.toLocaleString('vi-VN')}₫
                              </td>
                              <td className="text-right font-mono font-bold text-xs text-amber-900 tabular-nums">
                                {ing.totalCost.toLocaleString('vi-VN')}₫
                                <span className="text-[10px] text-[#8c8177] font-normal block font-sans">
                                  ({percent}%)
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Goods Receipts Log Table */}
              <section className="p-4 sm:p-5 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[var(--char)] m-0">
                      Nhật ký phiếu nhập kho chi tiết
                    </h3>
                    <p className="text-xs text-[#8c8177] m-0 mt-0.5">
                      Lưu vết các giao dịch nhập hàng vào kho trong kỳ.
                    </p>
                  </div>
                  <span className="text-xs text-[#8c8177] font-mono font-semibold">
                    {(data.purchasing?.movements ?? []).length} giao dịch
                  </span>
                </div>

                {!(data.purchasing?.movements ?? []).length ? (
                  <div className="py-10 text-center text-xs text-[#8c8177]">Không có giao dịch nhập kho trong kỳ.</div>
                ) : (
                  <div className="catalog-table-wrap">
                    <table className="product-mockup-table w-full">
                      <thead>
                        <tr>
                          <th style={{ width: '16%' }}>THỜI GIAN</th>
                          <th style={{ width: '22%' }}>NGUYÊN LIỆU</th>
                          <th style={{ width: '14%' }} className="text-right">
                            SỐ LƯỢNG
                          </th>
                          <th style={{ width: '14%' }} className="text-right">
                            ĐƠN GIÁ
                          </th>
                          <th style={{ width: '16%' }} className="text-right">
                            THÀNH TIỀN
                          </th>
                          <th style={{ width: '18%' }}>LÝ DO / GHI CHÚ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.purchasing?.movements ?? []).map((m) => (
                          <tr key={m.id}>
                            <td className="text-xs font-mono text-[#8c8177]">
                              {new Date(m.createdAt).toLocaleString('vi-VN')}
                            </td>
                            <td>
                              <strong className="text-xs font-bold text-[var(--char)] block">
                                {m.ingredientName}
                              </strong>
                              <span className="text-[10.5px] text-[#8c8177]">Bởi {m.actorName}</span>
                            </td>
                            <td className="text-right font-mono font-bold text-xs tabular-nums">
                              +{m.quantity.toLocaleString('vi-VN')} {m.unit}
                            </td>
                            <td className="text-right font-mono text-xs tabular-nums text-[#61574f]">
                              {m.unitCost.toLocaleString('vi-VN')}₫
                            </td>
                            <td className="text-right font-mono font-bold text-xs text-amber-900 tabular-nums">
                              {m.totalCost.toLocaleString('vi-VN')}₫
                            </td>
                            <td className="text-xs text-[#61574f] truncate max-w-[180px]" title={m.reason}>
                              {m.reason || 'Nhập kho định kỳ'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Tab 4: Sales Channels & Sources */}
          {activeTab === 'channels' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Order Sources (Dine-in vs Takeaway) */}
              <section className="p-4 sm:p-5 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs">
                <div className="mb-3">
                  <h3 className="text-sm sm:text-base font-bold text-[var(--char)] m-0">Hình thức phục vụ</h3>
                  <p className="text-xs text-[#8c8177] m-0 mt-0.5">Tỷ trọng đơn tại quán và mang đi.</p>
                </div>

                <div className="space-y-3">
                  {(data.sourcesBreakdown ?? []).map((src) => {
                    const label =
                      src.source === 'table' ? 'Phục vụ tại bàn' : src.source === 'takeaway' ? 'Mang đi (Takeaway)' : 'Tại quầy (Counter)'
                    return (
                      <div key={src.source} className="p-3 rounded-xl border border-[#ede6de] bg-[#fbf9f6] space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <strong className="font-bold text-[var(--char)]">{label}</strong>
                          <span className="font-mono font-bold text-[var(--ember)]">
                            {src.revenue.toLocaleString('vi-VN')}₫ ({src.percentage}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#ede6de] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--ember)] rounded-full" style={{ width: `${src.percentage}%` }} />
                        </div>
                        <span className="text-[11px] text-[#8c8177] block font-mono">{src.count} đơn hàng</span>
                      </div>
                    )
                  })}
                  {!(data.sourcesBreakdown ?? []).length && (
                    <div className="py-8 text-center text-xs text-[#8c8177]">Chưa có dữ liệu hình thức phục vụ.</div>
                  )}
                </div>
              </section>

              {/* Payment Methods */}
              <section className="p-4 sm:p-5 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs">
                <div className="mb-3">
                  <h3 className="text-sm sm:text-base font-bold text-[var(--char)] m-0">Phương thức thanh toán</h3>
                  <p className="text-xs text-[#8c8177] m-0 mt-0.5">Cơ cấu hình thức thu tiền.</p>
                </div>

                <div className="p-3.5 rounded-xl border border-[#ede6de] bg-[#fbf9f6] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-bold text-[var(--char)]">
                      <IconCash size={18} stroke={1.75} className="text-[var(--ember)]" />
                      <span>Tiền mặt (POS Cash)</span>
                    </span>
                    <span className="font-mono font-bold text-[var(--ember)]">
                      {data.summary.revenue.toLocaleString('vi-VN')}₫ (100%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#ede6de] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--ember)] rounded-full" style={{ width: '100%' }} />
                  </div>
                  <span className="text-[11px] text-[#8c8177] block font-mono">{data.summary.orderCount} giao dịch tiền mặt</span>
                </div>
              </section>
            </div>
          )}

          {/* Tab 5: Cashier & Staff */}
          {activeTab === 'cashier' && (
            <section className="p-4 sm:p-5 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--char)] m-0">Hiệu suất thu ngân & ca làm</h3>
                  <p className="text-xs text-[#8c8177] m-0 mt-0.5">Thống kê số lượng đơn và doanh số theo nhân sự.</p>
                </div>
                <span className="text-xs text-[#8c8177] font-mono font-semibold">
                  {(data.cashierSummary ?? []).length} nhân sự
                </span>
              </div>

              {!(data.cashierSummary ?? []).length ? (
                <div className="py-10 text-center text-xs text-[#8c8177]">Chưa có dữ liệu thu ngân.</div>
              ) : (
                <div className="catalog-table-wrap">
                  <table className="product-mockup-table w-full">
                    <thead>
                      <tr>
                        <th style={{ width: '30%' }}>NHÂN VIÊN THU NGÂN</th>
                        <th style={{ width: '20%' }} className="text-right">
                          SỐ ĐƠN LẬP
                        </th>
                        <th style={{ width: '25%' }} className="text-right">
                          TỔNG DOANH THU
                        </th>
                        <th style={{ width: '25%' }} className="text-right">
                          CHIẾT KHẤU ĐÃ DUYỆT
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.cashierSummary ?? []).map((c) => (
                        <tr key={c.cashier}>
                          <td>
                            <strong className="text-sm font-bold text-[var(--char)] block">
                              {c.cashier}
                            </strong>
                          </td>
                          <td className="text-right font-mono font-bold text-xs tabular-nums">
                            {c.orderCount} đơn
                          </td>
                          <td className="text-right font-mono font-bold text-xs text-[var(--ember)] tabular-nums">
                            {c.revenue.toLocaleString('vi-VN')}₫
                          </td>
                          <td className="text-right font-mono font-bold text-xs text-[#8c8177] tabular-nums">
                            {c.discounts.toLocaleString('vi-VN')}₫
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}

function getActionBadge(action: string) {
  switch (action) {
    case 'kds_status_changed':
      return { label: 'KDS: Đổi trạng thái', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    case 'cash_checkout':
      return { label: 'TT Tiền mặt', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    case 'transfer_checkout':
      return { label: 'TT Chuyển khoản', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' }
    case 'card_checkout':
      return { label: 'TT Thẻ', color: 'bg-blue-50 text-blue-800 border-blue-200' }
    case 'table_linked':
      return { label: 'Gán bàn', color: 'bg-sky-50 text-sky-800 border-sky-200' }
    case 'table_unlinked':
      return { label: 'Rời bàn', color: 'bg-stone-100 text-stone-700 border-stone-200' }
    case 'draft_created':
      return { label: 'Tạo đơn nháp', color: 'bg-amber-50 text-amber-800 border-amber-200' }
    case 'line_added':
      return { label: 'Thêm món', color: 'bg-amber-50 text-amber-800 border-amber-200' }
    case 'line_removed':
      return { label: 'Hủy món', color: 'bg-rose-50 text-rose-800 border-rose-200' }
    case 'discount_applied':
      return { label: 'Giảm giá', color: 'bg-purple-50 text-purple-800 border-purple-200' }
    case 'created':
      return { label: 'Tạo mới', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    case 'updated':
      return { label: 'Cập nhật', color: 'bg-blue-50 text-blue-800 border-blue-200' }
    case 'deleted':
      return { label: 'Xóa', color: 'bg-red-50 text-red-800 border-red-200' }
    default:
      return { label: action, color: 'bg-gray-100 text-gray-700 border-gray-200' }
  }
}

function getEntityBadge(entityType: string) {
  switch (entityType) {
    case 'order':
      return { label: 'Đơn hàng', color: 'bg-blue-50 text-blue-800 border-blue-200' }
    case 'menu_item':
    case 'product':
      return { label: 'Món thực đơn', color: 'bg-amber-50 text-amber-800 border-amber-200' }
    case 'modifier_group':
      return { label: 'Nhóm Topping', color: 'bg-purple-50 text-purple-800 border-purple-200' }
    case 'modifier':
      return { label: 'Topping', color: 'bg-purple-50 text-purple-800 border-purple-200' }
    case 'category':
      return { label: 'Danh mục', color: 'bg-amber-50 text-amber-800 border-amber-200' }
    case 'table':
    case 'floor_plan':
      return { label: 'Bàn & Sơ đồ', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    case 'staff':
    case 'user':
      return { label: 'Nhân sự', color: 'bg-teal-50 text-teal-800 border-teal-200' }
    case 'inventory':
      return { label: 'Kho hàng', color: 'bg-stone-100 text-stone-800 border-stone-200' }
    default:
      return { label: entityType, color: 'bg-gray-100 text-gray-800 border-gray-200' }
  }
}

function parseAuditDetail(detail: string) {
  try {
    const obj = JSON.parse(detail) as Record<string, any>
    if (typeof obj !== 'object' || obj === null) return { summary: detail, raw: detail, parsed: null }

    if (obj.from !== undefined && obj.to !== undefined) {
      const code = obj.orderCode ? `[${obj.orderCode}] ` : ''
      return {
        summary: `${code}Trạng thái: ${obj.from} → ${obj.to}`,
        raw: detail,
        parsed: obj,
      }
    }
    if (obj.orderCode && (obj.totalAmount !== undefined || obj.total !== undefined || obj.amount !== undefined)) {
      const amt = obj.totalAmount ?? obj.total ?? obj.amount
      return {
        summary: `Đơn ${obj.orderCode} · ${typeof amt === 'number' ? formatMoney(amt) : amt}`,
        raw: detail,
        parsed: obj,
      }
    }
    if (obj.orderCode) {
      return {
        summary: `Đơn hàng #${obj.orderCode}`,
        raw: detail,
        parsed: obj,
      }
    }
    if (obj.name) {
      return {
        summary: `Tên: "${obj.name}"`,
        raw: detail,
        parsed: obj,
      }
    }
    if (obj.tableName) {
      return {
        summary: `Bàn "${obj.tableName}"`,
        raw: detail,
        parsed: obj,
      }
    }

    const keys = Object.keys(obj).slice(0, 3).join(', ')
    return {
      summary: keys ? `Cập nhật: ${keys}` : 'Chi tiết payload',
      raw: detail,
      parsed: obj,
    }
  } catch {
    return { summary: detail, raw: detail, parsed: null }
  }
}

export function AuditWorkspace() {
  const isMobile = useIsMobile()
  const [searchQuery, setSearchQuery] = useState('')
  const [entityFilter, setEntityFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [selectedRow, setSelectedRow] = useState<{
    id: string
    actorEmail: string
    entityType: string
    entityId: string
    action: string
    detail: string
    createdAt: number
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const auditQuery = useQuery({
    queryKey: ['audit-log'],
    queryFn: async () => {
      const response = await fetch('/api/audit')
      const body = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) throw new Error(body.message ?? 'Không tải được audit log.')
      return body as {
        rows: Array<{
          id: string
          actorEmail: string
          entityType: string
          entityId: string
          action: string
          detail: string
          createdAt: number
        }>
      }
    },
  })

  const rows = auditQuery.data?.rows ?? []
  const auditError = auditQuery.error instanceof Error ? auditQuery.error.message : 'Không tải được audit log.'

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (entityFilter !== 'all' && row.entityType !== entityFilter) return false
      if (actionFilter !== 'all') {
        if (actionFilter === 'kds' && !row.action.startsWith('kds_')) return false
        if (actionFilter === 'checkout' && !row.action.includes('checkout')) return false
        if (actionFilter === 'table' && !row.action.includes('table')) return false
        if (actionFilter === 'line' && !row.action.includes('line')) return false
        if (actionFilter === 'crud' && !['created', 'updated', 'deleted'].includes(row.action)) return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchActor = row.actorEmail.toLowerCase().includes(q)
        const matchEntityId = row.entityId.toLowerCase().includes(q)
        const matchAction = row.action.toLowerCase().includes(q)
        const matchDetail = row.detail.toLowerCase().includes(q)
        if (!matchActor && !matchEntityId && !matchAction && !matchDetail) return false
      }
      return true
    })
  }, [rows, entityFilter, actionFilter, searchQuery])

  const copyPayload = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <section className="space-y-4 pb-20">
      {/* Controls & Filter Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#ded4c6] shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-[#716559]">Bộ lọc sự kiện</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#f5ede4] text-[#61574f] border border-[#e2d5c5]">
              {filteredRows.length} / {rows.length} bản ghi
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={auditQuery.isFetching}
              onClick={() => auditQuery.refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#ded4c6] bg-white text-xs font-bold text-[var(--char)] hover:bg-[#faf6f0] active:scale-95 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <IconRefresh size={14} className={cn(auditQuery.isFetching && 'animate-spin')} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#f0e8dc]">
          {/* Search box */}
          <div className="relative">
            <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8c8177]" />
            <input
              type="text"
              placeholder="Tìm người dùng, mã đơn, nội dung..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#ded4c6] bg-[#fcfaf7] text-xs font-medium text-[var(--char)] placeholder-[#9c9187] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--espresso)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8c8177] hover:text-[var(--char)]"
              >
                <IconX size={13} />
              </button>
            )}
          </div>

          {/* Entity Type Filter */}
          <div>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-[#ded4c6] bg-[#fcfaf7] text-xs font-medium text-[var(--char)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--espresso)] cursor-pointer"
            >
              <option value="all">Tất cả đối tượng</option>
              <option value="order">Đơn hàng (Order)</option>
              <option value="menu_item">Món thực đơn (Product)</option>
              <option value="modifier_group">Nhóm Topping</option>
              <option value="table">Bàn & Sơ đồ</option>
              <option value="staff">Tài khoản & Nhân sự</option>
              <option value="inventory">Kho hàng</option>
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-[#ded4c6] bg-[#fcfaf7] text-xs font-medium text-[var(--char)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--espresso)] cursor-pointer"
            >
              <option value="all">Tất cả hành động</option>
              <option value="kds">KDS pha chế</option>
              <option value="checkout">Thanh toán & Thu ngân</option>
              <option value="table">Gán / Rời bàn</option>
              <option value="line">Thêm / Hủy món</option>
              <option value="crud">Tạo mới / Sửa / Xóa</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {auditQuery.isLoading && (
        <SkeletonTable
          columns={[
            { width: '18%', cellClassName: 'w-24' },
            { width: '22%', cellClassName: 'w-32' },
            { width: '18%', cellClassName: 'w-24' },
            { width: '14%', cellClassName: 'w-20' },
            { width: '28%', cellClassName: 'w-full' },
          ]}
          rows={7}
          label="Đang tải nhật ký…"
        />
      )}

      {/* Error state */}
      {auditQuery.isError && <p className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs">{auditError}</p>}

      {/* Empty filtered state */}
      {!auditQuery.isLoading && !auditQuery.isError && filteredRows.length === 0 && (
        <div className="bg-white p-8 rounded-2xl border border-dashed border-[#ded4c6] text-center flex flex-col items-center justify-center gap-2">
          <div className="size-12 rounded-full bg-[#f7f3eb] text-[var(--stone)] flex items-center justify-center">
            <IconHistory size={24} stroke={1.5} />
          </div>
          <h3 className="text-sm font-bold text-[var(--char)] m-0">Không tìm thấy nhật ký phù hợp</h3>
          <p className="text-xs text-[#8c8177] m-0 max-w-sm">
            Thử thay đổi từ khóa tìm kiếm hoặc đặt lại các bộ lọc bên trên.
          </p>
          {(searchQuery || entityFilter !== 'all' || actionFilter !== 'all') && (
            <SecondaryButton
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setEntityFilter('all')
                setActionFilter('all')
              }}
              className="mt-2 text-xs"
            >
              Đặt lại bộ lọc
            </SecondaryButton>
          )}
        </div>
      )}

      {/* DESKTOP TABLE VIEW */}
      {!auditQuery.isLoading && !auditQuery.isError && filteredRows.length > 0 && (
        <>
          <div className="hidden md:block bg-white rounded-2xl border border-[#ded4c6] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#ede6de] bg-[#fbf9f6] text-[11px] font-bold uppercase tracking-wider text-[#8c8177]">
                    <th className="py-3 px-4" style={{ width: '17%' }}>THỜI GIAN</th>
                    <th className="py-3 px-4" style={{ width: '20%' }}>NGƯỜI THAO TÁC</th>
                    <th className="py-3 px-4" style={{ width: '18%' }}>ĐỐI TƯỢNG</th>
                    <th className="py-3 px-4" style={{ width: '18%' }}>HÀNH ĐỘNG</th>
                    <th className="py-3 px-4" style={{ width: '27%' }}>CHI TIẾT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0e8dc] text-xs">
                  {filteredRows.map((row) => {
                    const parsed = parseAuditDetail(row.detail)
                    const actionInfo = getActionBadge(row.action)
                    const entityInfo = getEntityBadge(row.entityType)

                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedRow(row)}
                        className="hover:bg-[#faf7f2] cursor-pointer transition-colors group"
                      >
                        <td className="py-3 px-4 font-mono text-[11.5px] text-[#716559] whitespace-nowrap">
                          {new Date(row.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-4">
                          <strong className="text-xs font-bold text-[var(--char)] block truncate max-w-[160px]">
                            {row.actorEmail}
                          </strong>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn('px-2 py-0.5 rounded-md text-[10.5px] font-semibold border', entityInfo.color)}>
                              {entityInfo.label}
                            </span>
                            <span className="font-mono text-[11px] text-[#8c8177]">
                              #{row.entityId.slice(0, 6)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold border', actionInfo.color)}>
                            {actionInfo.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate max-w-[220px] text-[#4a4036] font-medium" title={parsed.summary}>
                              {parsed.summary}
                            </span>
                            <span className="text-[11px] text-[var(--ember)] opacity-0 group-hover:opacity-100 font-bold shrink-0 transition-opacity">
                              Chi tiết →
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE CARD LIST VIEW */}
          <div className="md:hidden space-y-2.5">
            {filteredRows.map((row) => {
              const parsed = parseAuditDetail(row.detail)
              const actionInfo = getActionBadge(row.action)
              const entityInfo = getEntityBadge(row.entityType)

              return (
                <div
                  key={row.id}
                  onClick={() => setSelectedRow(row)}
                  className="p-3.5 rounded-xl border border-[#ded4c6] bg-white shadow-2xs space-y-2 cursor-pointer active:bg-[#faf7f2] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', actionInfo.color)}>
                        {actionInfo.label}
                      </span>
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold border', entityInfo.color)}>
                        {entityInfo.label}
                      </span>
                    </div>
                    <span className="font-mono text-[10.5px] text-[#8c8177] shrink-0">
                      {new Date(row.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-[var(--char)]">
                    {parsed.summary}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#8c8177] pt-1.5 border-t border-[#f0e8dc]">
                    <span>Thực hiện: <b className="text-[var(--char)] font-bold">{row.actorEmail}</b></span>
                    <span className="font-mono text-[10px]">#{row.entityId.slice(0, 6)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* DETAIL DIALOG / DRAWER */}
      {selectedRow && (
        <Drawer.Root open={Boolean(selectedRow)} onOpenChange={(open) => { if (!open) setSelectedRow(null) }} swipeDirection={isMobile ? 'down' : 'right'}>
          <Drawer.Content direction={isMobile ? 'bottom' : 'right'} className={cn(isMobile ? 'w-full max-h-[92dvh] p-0' : 'w-full max-w-[500px] p-0 flex flex-col')}>
            {(() => {
              const actionInfo = getActionBadge(selectedRow.action)
              const entityInfo = getEntityBadge(selectedRow.entityType)
              const parsed = parseAuditDetail(selectedRow.detail)

              return (
                <>
                  <Drawer.Header className="px-5 pt-4 pb-3 border-b border-[#ede6de] flex items-start justify-between gap-3 text-left">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', actionInfo.color)}>
                          {actionInfo.label}
                        </span>
                        <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-semibold border', entityInfo.color)}>
                          {entityInfo.label}
                        </span>
                      </div>
                      <Drawer.Title className="text-lg font-bold font-display text-[var(--char)] m-0">
                        Chi tiết nhật ký hoạt động
                      </Drawer.Title>
                    </div>
                    <Drawer.Close
                      aria-label="Đóng"
                      className="size-8 rounded-lg border border-[#ded6cc] bg-white text-[#716559] hover:text-[var(--char)] flex items-center justify-center shrink-0 cursor-pointer shadow-2xs hover:bg-[#faf7f3] transition-all"
                    >
                      <IconX size={17} stroke={2} />
                    </Drawer.Close>
                  </Drawer.Header>

                  <Drawer.Body className="px-5 py-4 overflow-y-auto space-y-4 flex-1">
                    {/* Metadata Card */}
                    <div className="p-3.5 rounded-xl border border-[#ede6de] bg-[#fbf9f6] space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[#8c8177] font-medium">Thời gian:</span>
                        <strong className="font-mono text-[var(--char)]">
                          {new Date(selectedRow.createdAt).toLocaleString('vi-VN')}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between border-t border-[#ede6de] pt-2">
                        <span className="text-[#8c8177] font-medium">Người thực hiện:</span>
                        <strong className="text-[var(--char)]">{selectedRow.actorEmail}</strong>
                      </div>
                      <div className="flex items-center justify-between border-t border-[#ede6de] pt-2">
                        <span className="text-[#8c8177] font-medium">Đối tượng (Entity ID):</span>
                        <code className="bg-white px-1.5 py-0.5 rounded border border-[#ede6de] font-mono text-[11px] text-[var(--char)]">
                          {selectedRow.entityId}
                        </code>
                      </div>
                      <div className="flex items-center justify-between border-t border-[#ede6de] pt-2">
                        <span className="text-[#8c8177] font-medium">Hành động:</span>
                        <code className="bg-white px-1.5 py-0.5 rounded border border-[#ede6de] font-mono text-[11px] font-bold text-[var(--ember)]">
                          {selectedRow.action}
                        </code>
                      </div>
                    </div>

                    {/* Summary box */}
                    <div className="p-3 rounded-xl border border-[#e5ddd6] bg-white shadow-2xs">
                      <span className="text-[10.5px] uppercase font-bold text-[#8c8177] tracking-wider block mb-1">
                        Tóm tắt nội dung
                      </span>
                      <p className="text-xs font-semibold text-[var(--char)] m-0 leading-relaxed">
                        {parsed.summary}
                      </p>
                    </div>

                    {/* Payload JSON */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#63574c]">
                          Dữ liệu chi tiết (JSON Payload)
                        </span>
                        <button
                          type="button"
                          onClick={() => copyPayload(selectedRow.detail)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--ember)] hover:underline"
                        >
                          <IconCopy size={13} />
                          <span>{copied ? 'Đã sao chép!' : 'Sao chép JSON'}</span>
                        </button>
                      </div>

                      <pre className="p-3 rounded-xl border border-[#e2d8cd] bg-[#2b2520] text-[#f2ece4] text-[11.5px] font-mono leading-relaxed overflow-x-auto max-h-[260px] scrollbar-thin">
                        {parsed.parsed ? JSON.stringify(parsed.parsed, null, 2) : selectedRow.detail}
                      </pre>
                    </div>
                  </Drawer.Body>

                  <div className="p-4 border-t border-[#ede6de] bg-[#fffdfa] shrink-0">
                    <SecondaryButton
                      className="w-full font-bold"
                      onClick={() => setSelectedRow(null)}
                    >
                      Đóng lại
                    </SecondaryButton>
                  </div>
                </>
              )
            })()}
          </Drawer.Content>
        </Drawer.Root>
      )}
    </section>
  )
}
