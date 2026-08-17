import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  IconSearch,
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconReceipt,
  IconArmchair,
  IconShoppingBag,
  IconClock,
  IconUser,
  IconAlertCircle,
  IconCash,
  IconPrinter,
} from '@tabler/icons-react'
import { Drawer } from './ui/drawer'
import { AppSelect, type SelectOption } from './ui/select'
import { Button, SecondaryButton } from './ui/button'
import { Input } from './ui/input'
import { Field } from './ui/field'
import { DateRangePicker } from './ui/date-picker'
import { Skeleton, SkeletonList, SkeletonTable } from './ui/skeleton'
import { ReceiptModal } from './receipt-modal'
import type { ReceiptOrderData } from './receipt-document'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/lib/use-mobile'

type OrderStatus = 'draft' | 'paid' | 'cancelled'
type OrderRow = {
  id: string
  orderCode: string
  displayNumber?: number
  source: 'counter' | 'takeaway' | 'table'
  tableName: string | null
  status: OrderStatus
  subtotal: number
  discountAmount: number
  total: number
  note: string
  createdAt: number
  updatedAt: number
  paidAt: number | null
  cashier: string
  version?: number
}
type OrderLine = {
  id: string
  name: string
  variant: string
  quantity: number
  unitPrice: number
  lineTotal: number
  lineStatus: 'active' | 'cancelled' | 'transferred'
  replacedLineId: string | null
  cancelReason: string | null
  cancelledAt: number | null
  cancelledByName: string | null
  approvedByName: string | null
  modifiers: Array<{ name: string; priceDelta: number }>
}
type OrderDetail = OrderRow & {
  lines: OrderLine[]
  discounts: Array<{ type: string; value: number; amount: number; reason: string; createdAt: number }>
  payment: { method: string; amount: number; receivedAmount: number; changeAmount: number; createdAt: number } | null
  refund: { amount: number; reason: string; actorId: string | null; approvedById: string | null; createdAt: number } | null
  cancelledByName: string | null
  approvedByName: string | null
  cancelReason: string | null
  cancelledAt: number | null
  mergedIntoOrderId: string | null
}
type CancelMutation = { mutate: () => void; isPending: boolean; isError: boolean; error: Error | null }

const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}₫`
const statusLabel: Record<OrderStatus, string> = {
  draft: 'Chưa thanh toán',
  paid: 'Đã thanh toán',
  cancelled: 'Đã hủy',
}

function formatTableSource(source: 'counter' | 'takeaway' | 'table', tableName: string | null) {
  if (source === 'takeaway') return 'Mang đi'
  if (source === 'counter') return 'Tại quầy'
  if (!tableName) return 'Tại bàn'
  const trimmed = tableName.trim()
  return trimmed.toLowerCase().startsWith('bàn') ? trimmed : `Bàn ${trimmed}`
}

const PAGE_SIZE_OPTIONS: SelectOption[] = [
  { value: '10', label: '10 đơn / trang' },
  { value: '20', label: '20 đơn / trang' },
  { value: '50', label: '50 đơn / trang' },
]

export function OrdersManager({ canManage = false }: { canManage?: boolean }) {
  const isMobile = useIsMobile()
  const client = useQueryClient()
  const [status, setStatus] = useState<'all' | OrderStatus>('all')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [managerUsername, setManagerUsername] = useState('')
  const [managerPassword, setManagerPassword] = useState('')
  const [receiptToPrint, setReceiptToPrint] = useState<ReceiptOrderData | null>(null)

  const ordersQuery = useQuery({
    queryKey: ['orders-history', status, search, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ status, search })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const response = await fetch(`/api/orders/history?${params}`)
      const body = await response.json().catch(() => ({})) as { message?: string; orders?: OrderRow[] }
      if (!response.ok) throw new Error(body.message ?? 'Không tải được lịch sử đơn hàng.')
      return { orders: body.orders ?? [] }
    },
  })

  const detailQuery = useQuery({
    queryKey: ['order-detail', selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const response = await fetch(`/api/orders/history?id=${selectedId}`)
      const body = await response.json().catch(() => ({})) as { message?: string; order?: OrderDetail }
      if (!response.ok || !body.order) throw new Error(body.message ?? 'Không tải được chi tiết đơn.')
      return body.order
    },
  })

  const cancel = useMutation({
    mutationFn: async () => {
      if (!selectedId || !detailQuery.data) throw new Error('Chưa chọn đơn.')
      const response = await fetch('/api/orders/history', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          orderId: selectedId,
          expectedVersion: detailQuery.data.version,
          reason: cancelReason,
          manager: detailQuery.data.status === 'paid' ? { username: managerUsername, password: managerPassword } : undefined,
        }),
      })
      const body = await response.json().catch(() => ({})) as { message?: string }
      if (!response.ok) throw new Error(body.message ?? 'Không thể hủy đơn.')
    },
    onSuccess: async () => {
      setCancelReason('')
      setManagerUsername('')
      setManagerPassword('')
      setSelectedId(null)
      await client.invalidateQueries({ queryKey: ['orders-history'] })
    },
  })

  const rows = ordersQuery.data?.orders ?? []
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const visibleRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [page, pageSize, rows])
  const setFilter = (next: typeof status) => {
    setStatus(next)
    setPage(1)
  }

  const counts = useMemo(() => ({
    all: rows.length,
    paid: rows.filter((r) => r.status === 'paid').length,
    draft: rows.filter((r) => r.status === 'draft').length,
    cancelled: rows.filter((r) => r.status === 'cancelled').length,
  }), [rows])

  return (
    <section className="orders-workspace grid gap-4 sm:gap-5 w-full pb-8">
      {/* Search & Date Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-[#ede6de] shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8c8177] pointer-events-none" aria-hidden="true">
              <IconSearch size={16} stroke={1.75} />
            </span>
            <input
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              placeholder="Tìm mã đơn, tên bàn, thu ngân..."
              className="w-full h-10 pl-9 pr-8 text-xs sm:text-sm rounded-xl border border-[#ded6cc] bg-[#fdfcf9] text-[var(--char)] placeholder:text-[#a09488] focus:outline-none focus:border-[var(--char)] focus:ring-1 focus:ring-[var(--char)] transition-all"
              aria-label="Tìm kiếm đơn hàng"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8c8177] hover:text-[var(--char)] p-1 rounded-md"
                aria-label="Xóa tìm kiếm"
              >
                <IconX size={14} stroke={2} />
              </button>
            )}
          </div>

          <DateRangePicker
            size="sm"
            value={{ from, to }}
            onValueChange={({ from: nextFrom, to: nextTo }) => {
              setFrom(nextFrom ?? '')
              setTo(nextTo ?? '')
              setPage(1)
            }}
            placeholder="Khoảng ngày…"
            clearable
            className="w-full sm:w-auto sm:min-w-[210px] bg-[#fdfcf9]"
          />

          {(search || from || to || status !== 'all') && (
            <SecondaryButton size="sm" onClick={() => { setSearch(''); setFrom(''); setTo(''); setFilter('all') }} className="self-start sm:self-auto shrink-0">
              Đặt lại
            </SecondaryButton>
          )}
        </div>
      </div>

      {/* Status Filter Chips Bar (Scrollable on mobile) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none" role="tablist" aria-label="Lọc trạng thái đơn">
        {([
          ['all', 'Tất cả', counts.all],
          ['paid', 'Đã thanh toán', counts.paid],
          ['draft', 'Chưa thanh toán', counts.draft],
          ['cancelled', 'Đã hủy', counts.cancelled],
        ] as const).map(([val, label, count]) => (
          <button
            key={val}
            type="button"
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 cursor-pointer border',
              status === val
                ? 'bg-[var(--espresso)] text-[var(--crema)] border-[var(--espresso)] shadow-xs'
                : 'bg-white text-[#61574f] border-[#ded6cc] hover:bg-[#f7f2eb]'
            )}
            onClick={() => setFilter(val)}
          >
            <span>{label}</span>
            <span className={cn(
              'px-1.5 py-0.5 rounded-full text-[10px] font-extrabold',
              status === val ? 'bg-white/20 text-white' : 'bg-[#ede6de] text-[#61574f]'
            )}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {ordersQuery.isLoading && (
        <SkeletonTable
          columns={[
            { width: '20%' },
            { width: '18%' },
            { width: '18%' },
            { width: '16%', align: 'right' },
            { width: '14%', align: 'center', cellClassName: 'w-20' },
            { width: '14%', align: 'right', cellClassName: 'w-28' },
          ]}
          rows={6}
          label="Đang tải danh sách đơn hàng…"
        />
      )}
      {ordersQuery.isError && <p className="floor-feedback is-error">{ordersQuery.error.message}</p>}

      {!ordersQuery.isLoading && !rows.length && (
        <div className="catalog-empty p-8 text-center bg-white rounded-2xl border border-[#ede6de]">
          <IconReceipt size={36} stroke={1.5} className="mx-auto text-[#c5bcaf] mb-2" />
          <p className="font-bold text-sm text-[var(--char)]">Không tìm thấy đơn hàng nào.</p>
          <span className="text-xs text-[#8c8177] mt-1 block">Thử thay đổi bộ lọc hoặc tạo đơn mới từ màn hình Bán Hàng POS.</span>
        </div>
      )}

      {/* Orders List for Mobile ONLY (< 768px) */}
      {!!rows.length && (
        <div className="mobile-only-list grid grid-cols-1 gap-3">
          {visibleRows.map((row) => {
            const isPaid = row.status === 'paid'
            const isCancelled = row.status === 'cancelled'
            return (
              <div
                key={row.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(row.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedId(row.id) }}
                className={cn(
                  'rounded-2xl p-4 liquid-glass liquid-glass-interactive cursor-pointer border transition-all duration-200 flex flex-col gap-3',
                  selectedId === row.id ? 'border-[var(--char)] shadow-md' : 'border-white/80 shadow-xs'
                )}
              >
                {/* Card Top Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {row.displayNumber ? (
                      <span className="px-2 py-0.5 rounded-lg bg-[#f0e6d7] text-[#684838] font-bold text-xs font-data border border-[#ded6cd]">
                        #{String(row.displayNumber).padStart(3, '0')}
                      </span>
                    ) : null}
                    <span className="text-xs font-bold text-[var(--char)] font-data">
                      #{row.orderCode}
                    </span>
                  </div>

                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-[10.5px] font-extrabold flex items-center gap-1.5',
                    isPaid ? 'bg-[#e8f5e9] text-[#2e7d32]' : isCancelled ? 'bg-[#fbe9e7] text-[#c62828]' : 'bg-[#fff8e1] text-[#f57f17]'
                  )}>
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      isPaid ? 'bg-[#2e7d32]' : isCancelled ? 'bg-[#c62828]' : 'bg-[#f57f17]'
                    )} />
                    {statusLabel[row.status]}
                  </span>
                </div>

                {/* Card Middle Info */}
                <div className="flex items-center justify-between text-xs text-[#61574f]">
                  <div className="flex items-center gap-1.5">
                    {row.source === 'table' ? (
                      <>
                        <IconArmchair size={15} stroke={1.75} className="text-[#8c8177]" />
                        <span className="font-semibold text-[var(--char)]">
                          {formatTableSource(row.source, row.tableName)}
                        </span>
                      </>
                    ) : (
                      <>
                        <IconShoppingBag size={15} stroke={1.75} className="text-[#8c8177]" />
                        <span className="font-semibold text-[var(--char)]">
                          {formatTableSource(row.source, row.tableName)}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-[#8c8177]">
                    <IconUser size={13} stroke={1.75} />
                    <span>{row.cashier || 'Hệ thống'}</span>
                  </div>
                </div>

                {/* Card Bottom Row: Total Amount & Timestamp */}
                <div className="flex items-center justify-between pt-2.5 border-t border-[#ede6de]/80">
                  <div className="flex items-center gap-1 text-[11px] text-[#8c8177]">
                    <IconClock size={13} stroke={1.75} />
                    <span>
                      {new Date(row.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {new Date(row.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  <strong className={cn(
                    'text-base font-extrabold font-data tabular-nums',
                    isPaid ? 'text-[var(--ember)]' : isCancelled ? 'text-[#8c8177] line-through' : 'text-[var(--char)]'
                  )}>
                    {money(row.total)}
                  </strong>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Orders Table for Desktop ONLY (>= 768px / md) */}
      {!!rows.length && (
        <div className="desktop-only-table rounded-2xl bg-white border border-[#ede6de] overflow-hidden shadow-2xs">
          <table className="product-mockup-table w-full">
            <thead>
              <tr>
                <th style={{ width: '20%' }}>MÃ ĐƠN</th>
                <th style={{ width: '18%' }}>NGUỒN / BÀN</th>
                <th style={{ width: '18%' }}>THU NGÂN</th>
                <th style={{ width: '16%' }} className="text-right">TỔNG TIỀN</th>
                <th style={{ width: '14%' }} className="text-center">TRẠNG THÁI</th>
                <th style={{ width: '14%' }} className="text-right">THỜI GIAN</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const isPaid = row.status === 'paid'
                const isCancelled = row.status === 'cancelled'
                return (
                  <tr
                    key={row.id}
                    className={cn('cursor-pointer transition-colors hover:bg-[#faf6f0]', selectedId === row.id && 'bg-[#f5ede3]')}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <td>
                      <div className="flex items-center gap-2">
                        {row.displayNumber ? (
                          <span className="w-8 h-8 rounded-lg bg-[#f0e6d7] text-[#684838] font-bold text-xs flex items-center justify-center border border-[#ded6cd] font-data shrink-0">
                            #{String(row.displayNumber).padStart(3, '0')}
                          </span>
                        ) : null}
                        <div>
                          <strong className="text-xs font-data text-[var(--char)] block font-bold">
                            #{row.orderCode}
                          </strong>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs text-[#61574f]">
                      {formatTableSource(row.source, row.tableName)}
                    </td>
                    <td className="text-xs text-[#61574f]">{row.cashier || 'Hệ thống'}</td>
                    <td className="text-right font-data font-bold text-xs tabular-nums text-[var(--char)]">
                      <strong className={cn(isPaid && 'text-[var(--ember)]')}>
                        {money(row.total)}
                      </strong>
                    </td>
                    <td className="text-center">
                      <span className={cn('catalog-status-pill', isPaid ? 'is-active' : isCancelled ? 'is-inactive' : 'text-[var(--amber)]')}>
                        <span className={cn('catalog-status-dot', isPaid ? 'dot-active' : isCancelled ? 'dot-inactive' : 'bg-[var(--amber)]')} />
                        {statusLabel[row.status]}
                      </span>
                    </td>
                    <td className="text-right font-data text-xs text-[#8c8177]">
                      {new Date(row.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {new Date(row.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Bar (Both Mobile & Desktop) */}
      {!!rows.length && (
        <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 bg-white rounded-2xl border border-[#ede6de] text-xs text-[#8c8177] gap-3">
          <span>
            Hiển thị <strong>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, rows.length)}</strong> / <strong>{rows.length}</strong> đơn
          </span>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))} className="flex items-center gap-1">
              <IconChevronLeft size={14} stroke={2} />
              <span>Trước</span>
            </Button>
            <span className="font-data px-2 font-bold text-[var(--char)]">Trang {page} / {pageCount}</span>
            <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => setPage((v) => Math.min(pageCount, v + 1))} className="flex items-center gap-1">
              <span>Sau</span>
              <IconChevronRight size={14} stroke={2} />
            </Button>
            <AppSelect
              size="sm"
              items={PAGE_SIZE_OPTIONS}
              value={String(pageSize)}
              onValueChange={(val) => { setPageSize(Number(val)); setPage(1) }}
              aria-label="Số dòng mỗi trang"
              triggerClassName="min-w-28 bg-[#fdfcf9]"
            />
          </div>
        </div>
      )}

      {/* Order Detail Drawer */}
      <Drawer.Root open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) { setSelectedId(null); setCancelReason(''); setManagerUsername(''); setManagerPassword('') } }} swipeDirection={isMobile ? 'down' : 'right'}>
        <Drawer.Content direction={isMobile ? 'bottom' : 'right'} className={cn(isMobile ? 'w-full max-h-[92dvh] p-0' : 'admin-detail-drawer max-w-lg w-full')}>
          <Drawer.Header className="px-5 pt-3 pb-3 border-b border-[#ede6de]">
            <div>
              <p className="eyebrow text-xs text-[#8c8177] uppercase font-bold tracking-wider">CHI TIẾT ĐƠN HÀNG</p>
              <Drawer.Title className="text-xl font-bold font-display text-[var(--char)] mt-0.5">
                {detailQuery.data ? (detailQuery.data.displayNumber ? `Đơn #${String(detailQuery.data.displayNumber).padStart(3, '0')}` : `Đơn #${detailQuery.data.orderCode}`) : 'Đơn hàng'}
              </Drawer.Title>
            </div>
          </Drawer.Header>

          {detailQuery.isLoading && (
            <div className="px-5 py-4 grid gap-3" role="status" aria-busy="true">
              <span className="sr-only">Đang tải chi tiết…</span>
              <div className="p-3.5 bg-[#fffdfa] border border-[#ede6de] rounded-xl flex justify-between items-center" aria-hidden="true">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-14" />
                </div>
              </div>
              <Skeleton className="h-3 w-28" />
              <SkeletonList rows={3} label="" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          )}
          {detailQuery.isError && <p className="floor-feedback is-error px-5 py-4">{detailQuery.error.message}</p>}

          {detailQuery.data && (
            <Drawer.Body className="px-5 py-4">
              <OrderDetailComponent
                order={detailQuery.data}
                canManage={canManage}
                cancelReason={cancelReason}
                setCancelReason={setCancelReason}
                managerUsername={managerUsername}
                setManagerUsername={setManagerUsername}
                managerPassword={managerPassword}
                setManagerPassword={setManagerPassword}
                cancel={{ mutate: () => cancel.mutate(), isPending: cancel.isPending, isError: cancel.isError, error: cancel.error instanceof Error ? cancel.error : null }}
                onPrintReceipt={() => {
                  const detail = detailQuery.data
                  if (!detail) return
                  setReceiptToPrint({
                    orderCode: detail.orderCode,
                    tableName: detail.tableName,
                    source: detail.source,
                    cashier: detail.cashier,
                    createdAt: detail.createdAt,
                    items: detail.lines.map((l) => ({
                      id: l.id,
                      name: l.name,
                      variantName: l.variant,
                      quantity: l.quantity,
                      unitPrice: l.unitPrice,
                      totalPrice: l.lineTotal,
                      modifiers: l.modifiers,
                    })),
                    subtotal: detail.subtotal,
                    discountAmount: detail.discountAmount,
                    total: detail.total,
                    paymentMethod: detail.payment ? 'Tiền mặt' : undefined,
                    receivedAmount: detail.payment?.receivedAmount,
                    changeAmount: detail.payment?.changeAmount,
                  })
                }}
              />
            </Drawer.Body>
          )}
        </Drawer.Content>
      </Drawer.Root>

      {/* Printable Receipt Modal */}
      <ReceiptModal
        open={Boolean(receiptToPrint)}
        onOpenChange={(open) => { if (!open) setReceiptToPrint(null) }}
        order={receiptToPrint}
        title="Hóa đơn thanh toán"
        description="In lại biên lai 80mm hoặc xuất ảnh/PDF."
      />
    </section>
  )
}

function OrderDetailComponent({
  order,
  canManage,
  cancelReason,
  setCancelReason,
  managerUsername,
  setManagerUsername,
  managerPassword,
  setManagerPassword,
  cancel,
  onPrintReceipt,
}: {
  order: OrderDetail
  canManage: boolean
  cancelReason: string
  setCancelReason: (value: string) => void
  managerUsername: string
  setManagerUsername: (value: string) => void
  managerPassword: string
  setManagerPassword: (value: string) => void
  cancel: CancelMutation
  onPrintReceipt?: () => void
}) {
  return (
    <div className="grid gap-4">
      {/* Meta Card */}
      <div className="p-3.5 bg-[#fffdfa] border border-[#ede6de] rounded-xl flex justify-between items-center text-xs">
        <div>
          <strong className="text-[var(--char)] text-sm block">
            {formatTableSource(order.source, order.tableName)}
          </strong>
          <span className="text-[#8c8177] mt-0.5 block">Thu ngân: {order.cashier}</span>
        </div>
        <div className="text-right">
          <span className="font-data text-[var(--char)] font-bold block">{new Date(order.createdAt).toLocaleTimeString('vi-VN')}</span>
          <span className="font-data text-[10.5px] text-[#8c8177]">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</span>
        </div>
      </div>

      {/* Action: Print Receipt */}
      {onPrintReceipt && (
        <Button
          size="sm"
          variant="outline"
          onClick={onPrintReceipt}
          className="w-full flex items-center justify-center gap-1.5 font-bold"
        >
          <IconPrinter size={16} stroke={1.75} />
          <span>In hóa đơn / Lưu ảnh (80mm)</span>
        </Button>
      )}

      {/* Items Breakdown */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8c8177] mb-2">Món đã gọi</h3>
        <div className="grid gap-2">
          {order.lines.map((line) => (
            <div
              key={line.id}
              className={cn('p-3 rounded-xl border border-[#ede6de] bg-white flex justify-between items-start text-xs', line.lineStatus !== 'active' && 'opacity-60 bg-[#f9f9f9]')}
            >
              <div>
                <strong className="text-[var(--char)] text-sm block">{line.name}</strong>
                <small className="text-[#8c8177] block mt-0.5">
                  {line.variant || 'Tiêu chuẩn'}
                  {line.modifiers.length ? ` · ${line.modifiers.map((m) => m.name).join(', ')}` : ''}
                </small>
                {line.lineStatus === 'cancelled' && (
                  <span className="text-[var(--ember)] text-[11px] font-semibold block mt-1">
                    Đã hủy{line.cancelReason ? `: ${line.cancelReason}` : ''}
                  </span>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className="font-data font-bold text-[var(--char)] block">
                  {line.quantity} × {money(line.unitPrice)}
                </span>
                <span className="font-data text-xs text-[#8c8177] block">{money(line.lineTotal)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="p-4 bg-[#fffdfa] border border-[#ede6de] rounded-xl grid gap-2 text-xs">
        <div className="flex justify-between text-[#8c8177]">
          <span>Tạm tính</span>
          <span className="font-data font-semibold text-[var(--char)]">{money(order.subtotal)}</span>
        </div>
        {order.discountAmount > 0 && (
          <div className="flex justify-between text-[var(--ember)] font-medium">
            <span>Giảm giá</span>
            <span className="font-data">-{money(order.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold text-[var(--char)] pt-2 border-t border-[#ede6de]">
          <span>Tổng tiền thanh toán</span>
          <span className="font-data text-[var(--ember)] text-base">{money(order.total)}</span>
        </div>
      </div>

      {/* Payment Details */}
      {order.payment && (
        <div className="p-3.5 bg-white border border-[#ede6de] rounded-xl text-xs text-[#61574f]">
          <div className="flex items-center gap-1.5 text-[var(--char)] font-bold mb-1">
            <IconCash size={15} stroke={1.75} />
            <span>Thông tin thanh toán</span>
          </div>
          <p>Phương thức: <strong>Tiền mặt</strong> · Tiền nhận: {money(order.payment.receivedAmount)} · Tiền trả lại: {money(order.payment.changeAmount)}</p>
        </div>
      )}

      {/* Refund Details */}
      {order.refund && (
        <div className="p-3.5 bg-[#fff5f5] border border-[#fcdada] rounded-xl text-xs text-[#85311f]">
          <strong>Đã hoàn tiền: {money(order.refund.amount)}</strong>
          <p className="mt-0.5">{order.refund.reason}</p>
        </div>
      )}

      {/* Cancellation / Refund Management Flow */}
      {canManage && (order.status === 'draft' || order.status === 'paid') && (
        <div className="p-4 bg-[#fff9f8] border border-[#fbdcd0] rounded-xl grid gap-3 mt-2">
          <div>
            <h4 className="text-xs font-bold text-[var(--ember)] uppercase tracking-wider">Hủy đơn & Hoàn tiền</h4>
            <p className="text-[11px] text-[#8c8177] mt-0.5">
              {order.status === 'paid' ? 'Đơn đã thanh toán yêu cầu xác thực tên đăng nhập và mật khẩu của Quản lý để duyệt hoàn tiền.' : 'Hủy đơn hàng chưa thanh toán.'}
            </p>
          </div>

          <Field.Root>
            <Field.Label className="text-xs font-semibold text-[var(--char)]">Lý do hủy đơn *</Field.Label>
            <Input
              size="sm"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="VD: Khách đổi ý không lấy món"
              className="bg-white mt-1"
            />
          </Field.Root>

          {order.status === 'paid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Field.Root>
                <Field.Label className="text-xs font-semibold text-[var(--char)]">Tên đăng nhập Quản lý</Field.Label>
                <Input
                  size="sm"
                  value={managerUsername}
                  onChange={(e) => setManagerUsername(e.target.value)}
                  placeholder="VD: admin"
                  className="bg-white mt-1"
                />
              </Field.Root>
              <Field.Root>
                <Field.Label className="text-xs font-semibold text-[var(--char)]">Mật khẩu Quản lý</Field.Label>
                <Input
                  size="sm"
                  type="password"
                  value={managerPassword}
                  onChange={(e) => setManagerPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-white mt-1"
                />
              </Field.Root>
            </div>
          )}

          {cancel.isError && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-[#fdf2f2] text-xs text-[#9c1c1c]">
              <IconAlertCircle size={15} stroke={1.75} className="shrink-0" />
              <span>{cancel.error?.message ?? 'Không thể hủy đơn.'}</span>
            </div>
          )}

          <Button
            variant="danger"
            size="md"
            disabled={cancel.isPending || cancelReason.trim().length < 3 || (order.status === 'paid' && (!managerUsername.trim() || !managerPassword))}
            onClick={() => cancel.mutate()}
            className="w-full mt-1 font-bold text-xs"
          >
            {cancel.isPending ? 'Đang xử lý…' : (order.status === 'paid' ? 'Xác nhận hủy & hoàn tiền' : 'Xác nhận hủy đơn')}
          </Button>
        </div>
      )}
    </div>
  )
}