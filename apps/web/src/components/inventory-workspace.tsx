import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import {
  IconPlus,
  IconSearch,
  IconX,
  IconPencil,
  IconHistory,
  IconAlertTriangle,
  IconPackage,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconChevronLeft,
  IconChevronRight,
  IconCalendar,
  IconScale,
} from '@tabler/icons-react'
import { Dialog } from './ui/dialog'
import { Drawer } from './ui/drawer'
import { AppSelect, type SelectOption } from './ui/select'
import { Button, PrimaryButton, SecondaryButton } from './ui/button'
import { Input } from './ui/input'
import { Field } from './ui/field'
import { Checkbox } from './ui/checkbox'
import { SkeletonList, SkeletonTable } from './ui/skeleton'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/lib/use-mobile'

const UNIT_CHIPS = ['kg', 'g', 'lít', 'ml', 'gói', 'hộp', 'chai', 'lon']
const RECEIPT_REASONS = ['Nhập định kỳ', 'Tạp hóa gần quán', 'Chợ đầu mối', 'Bổ sung gấp', 'Hàng khuyến mãi']
const ADJUST_REASONS = ['Xuất dùng pha chế', 'Hao hụt / Đổ vỡ', 'Hết hạn / Hư hỏng', 'Xuất dùng nội bộ']
const STOCKTAKE_REASONS = ['Kiểm kê cuối ngày', 'Kiểm kê cuối tuần', 'Cân đối kho thực tế', 'Điều chỉnh sai lệch']

type Ingredient = {
  id: string
  name: string
  unit: string
  currentQuantity: number
  reorderPoint: number
  active: boolean
  lowStock: boolean
  monthlyReceivedQuantity?: number
  monthlyReceivedCost?: number
  monthlyUsedQuantity?: number
}

type Movement = {
  id: string
  ingredientId: string
  ingredientName: string
  unit?: string
  type: string
  quantityDelta: number
  unitCost?: number
  reason: string
  createdAt: number
  actorName: string
}

type MonthlySummary = {
  totalCost: number
  receiptCount: number
  totalQuantity: number
}

const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}₫`

export function InventoryWorkspace({ canManage = false }: { canManage?: boolean }) {
  const isMobile = useIsMobile()
  const client = useQueryClient()

  // Month navigation: default to current year-month
  const now = new Date()
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr)

  const [activeTab, setActiveTab] = useState<'inventory' | 'history'>('inventory')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'need_reorder' | 'good'>('all')
  const [selected, setSelected] = useState<Ingredient | null>(null)
  const [dialog, setDialog] = useState<'ingredient' | 'adjustment' | null>(null)

  const lastSelected = useRef<Ingredient | null>(selected)
  if (selected) lastSelected.current = selected
  const activeSelected = selected ?? lastSelected.current

  const lastDialog = useRef<'ingredient' | 'adjustment' | null>(dialog)
  if (dialog) lastDialog.current = dialog
  const activeDialog = dialog ?? lastDialog.current

  const [ingredientDraft, setIngredientDraft] = useState({
    id: '',
    name: '',
    unit: 'kg',
    reorderPoint: 0,
    active: true,
  })
  const [adjustmentDraft, setAdjustmentDraft] = useState({
    ingredientId: '',
    type: 'receipt' as 'receipt' | 'adjustment' | 'stocktake',
    quantityDelta: 0,
    reason: '',
    unitCost: 0,
    expiresAt: '',
  })

  const inventoryQuery = useQuery({
    queryKey: ['inventory-workspace', selectedMonth],
    queryFn: async () => {
      const response = await fetch(`/api/inventory?month=${selectedMonth}`)
      const body = (await response.json().catch(() => ({}))) as {
        message?: string
        month?: string
        monthlySummary?: MonthlySummary
        ingredients?: Ingredient[]
        movements?: Movement[]
        inventoryValue?: number
      }
      if (!response.ok) throw new Error(body.message ?? 'Không tải được kho.')
      return {
        month: body.month ?? selectedMonth,
        monthlySummary: body.monthlySummary ?? { totalCost: 0, receiptCount: 0, totalQuantity: 0 },
        ingredients: body.ingredients ?? [],
        movements: body.movements ?? [],
        inventoryValue: Number(body.inventoryValue ?? 0),
      }
    },
  })

  const detailQuery = useQuery({
    queryKey: ['inventory-detail', selected?.id],
    enabled: Boolean(selected?.id),
    queryFn: async () => {
      const response = await fetch(`/api/inventory?ingredientId=${selected?.id}`)
      const body = (await response.json().catch(() => ({}))) as {
        message?: string
        movements?: Movement[]
      }
      if (!response.ok) throw new Error(body.message ?? 'Không tải được lịch sử nhập xuất.')
      return body.movements ?? []
    },
  })

  const mutation = useMutation({
    mutationFn: async (body: unknown) => {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) throw new Error(result.message ?? 'Không thể lưu kho.')
      return result
    },
    onSuccess: async () => {
      setDialog(null)
      setIngredientDraft({ id: '', name: '', unit: 'kg', reorderPoint: 0, active: true })
      setAdjustmentDraft({
        ingredientId: '',
        type: 'receipt',
        quantityDelta: 0,
        reason: '',
        unitCost: 0,
        expiresAt: '',
      })
      await client.invalidateQueries({ queryKey: ['inventory-workspace'] })
    },
  })

  const ingredients = inventoryQuery.data?.ingredients ?? []
  const monthlySummary = inventoryQuery.data?.monthlySummary ?? { totalCost: 0, receiptCount: 0, totalQuantity: 0 }
  const movements = inventoryQuery.data?.movements ?? []

  const ingredientOptions: SelectOption[] = useMemo(
    () =>
      ingredients.map((item) => ({
        value: item.id,
        label: `${item.name} (Còn: ${Number(item.currentQuantity).toLocaleString('vi-VN')} ${item.unit})`,
      })),
    [ingredients],
  )

  const rows = useMemo(
    () =>
      ingredients.filter((item) => {
        const term = search.trim().toLocaleLowerCase('vi-VN')
        const matchesSearch = !term || `${item.name} ${item.unit}`.toLocaleLowerCase('vi-VN').includes(term)
        const matchesStatus =
          status === 'all' ||
          (status === 'need_reorder' && item.lowStock) ||
          (status === 'good' && !item.lowStock)
        return matchesSearch && matchesStatus
      }),
    [ingredients, search, status],
  )

  const needReorderCount = ingredients.filter((item) => item.lowStock).length
  const goodCount = ingredients.filter((item) => !item.lowStock).length

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [yStr, mStr] = selectedMonth.split('-')
    let y = parseInt(yStr, 10)
    let m = parseInt(mStr, 10) - 1
    if (m === 0) {
      m = 12
      y -= 1
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, '0')}`)
  }

  const handleNextMonth = () => {
    const [yStr, mStr] = selectedMonth.split('-')
    let y = parseInt(yStr, 10)
    let m = parseInt(mStr, 10) + 1
    if (m === 13) {
      m = 1
      y += 1
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, '0')}`)
  }

  const formattedMonthLabel = useMemo(() => {
    const [yStr, mStr] = selectedMonth.split('-')
    return `Tháng ${parseInt(mStr, 10)}/${yStr}`
  }, [selectedMonth])

  const openIngredient = (item?: Ingredient) => {
    setIngredientDraft(
      item
        ? {
            id: item.id,
            name: item.name,
            unit: item.unit,
            reorderPoint: item.reorderPoint,
            active: item.active,
          }
        : { id: '', name: '', unit: 'kg', reorderPoint: 0, active: true },
    )
    setDialog('ingredient')
  }

  const openStockIn = (item?: Ingredient) => {
    setAdjustmentDraft((current) => ({
      ...current,
      ingredientId: item?.id ?? current.ingredientId ?? ingredients[0]?.id ?? '',
      type: 'receipt',
      quantityDelta: 0,
      reason: 'Nhập định kỳ',
      unitCost: 0,
      expiresAt: '',
    }))
    setDialog('adjustment')
  }

  const openAdjustment = (item?: Ingredient, type: 'receipt' | 'adjustment' | 'stocktake' = 'adjustment') => {
    setAdjustmentDraft((current) => ({
      ...current,
      ingredientId: item?.id ?? current.ingredientId ?? ingredients[0]?.id ?? '',
      type,
      quantityDelta: 0,
      reason: type === 'stocktake' ? 'Kiểm kê thực tế' : type === 'adjustment' ? 'Xuất dùng pha chế' : 'Nhập định kỳ',
      unitCost: 0,
      expiresAt: '',
    }))
    setDialog('adjustment')
  }

  return (
    <div className="inventory-workspace grid gap-3 sm:gap-5 w-full min-w-0 max-w-full overflow-hidden pb-12">
      {/* Top Toolbar: Month Navigator & Quick Actions */}
      <div className="p-3 sm:p-4 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 w-full min-w-0 max-w-full">
        {/* Month Picker Controls */}
        <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
          <div className="flex items-center bg-[#f4efe8] rounded-xl p-1 border border-[#e5ddd6]">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#61574f] hover:bg-white hover:text-[var(--char)] transition-colors cursor-pointer"
              title="Tháng trước"
            >
              <IconChevronLeft size={16} stroke={2} />
            </button>
            <div className="px-2.5 sm:px-3 flex items-center gap-1.5 font-bold text-xs text-[var(--char)]">
              <IconCalendar size={15} className="text-[var(--ember)]" />
              <span>{formattedMonthLabel}</span>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#61574f] hover:bg-white hover:text-[var(--char)] transition-colors cursor-pointer"
              title="Tháng sau"
            >
              <IconChevronRight size={16} stroke={2} />
            </button>
          </div>

          {selectedMonth !== currentMonthStr && (
            <button
              type="button"
              onClick={() => setSelectedMonth(currentMonthStr)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[#ede6de] text-[var(--char)] hover:bg-[#e0d6cb] transition-colors cursor-pointer shrink-0"
            >
              Về tháng này
            </button>
          )}
        </div>

        {/* Action Buttons: 2 columns full-width on mobile */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <SecondaryButton
            size="md"
            disabled={!canManage}
            onClick={() => openIngredient()}
            className="flex items-center justify-center gap-1.5 text-xs h-10 px-2.5 sm:px-3.5 font-bold w-full sm:w-auto whitespace-nowrap"
          >
            <IconPlus size={15} stroke={2} />
            <span>Nguyên liệu</span>
          </SecondaryButton>
          <PrimaryButton
            size="md"
            disabled={!canManage || !ingredients.length}
            onClick={() => openStockIn()}
            className="flex items-center justify-center gap-1.5 text-xs h-10 px-2.5 sm:px-4 font-bold w-full sm:w-auto whitespace-nowrap"
          >
            <IconArrowDownLeft size={15} stroke={2.2} />
            <span>Nhập hàng</span>
          </PrimaryButton>
        </div>
      </div>

      {/* 3 Core Monthly Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 w-full min-w-0 max-w-full">
        {/* Metric 1: Monthly Purchasing Expenditure */}
        <article className="p-3.5 sm:p-4 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs min-w-0 max-w-full overflow-hidden flex flex-col justify-between hover:border-[#ded1c0] transition-colors">
          <div>
            <span className="text-[10.5px] sm:text-xs font-bold text-[#8c8177] uppercase tracking-wider block truncate">
              Tiền nhập hàng {formattedMonthLabel}
            </span>
            <strong className="text-xl sm:text-2xl font-bold tabular-nums text-amber-900 block truncate mt-1">
              {money(monthlySummary.totalCost)}
            </strong>
          </div>
          <div className="mt-2.5 pt-2 border-t border-[#f4efe8] flex items-center justify-between text-[11px] text-[#8c8177]">
            <span>Số phiếu nhập:</span>
            <strong className="font-semibold text-amber-900">{monthlySummary.receiptCount} phiếu</strong>
          </div>
        </article>

        {/* Metric 2: Monthly Import Volume */}
        <article className="p-3.5 sm:p-4 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs min-w-0 max-w-full overflow-hidden flex flex-col justify-between hover:border-[#ded1c0] transition-colors">
          <div>
            <span className="text-[10.5px] sm:text-xs font-bold text-[#8c8177] uppercase tracking-wider block truncate">
              Tổng lượng hàng đã nhập
            </span>
            <strong className="text-xl sm:text-2xl font-bold tabular-nums text-[var(--char)] block truncate mt-1">
              +{monthlySummary.totalQuantity.toLocaleString('vi-VN')} <span className="text-xs font-normal text-[#8c8177]">đơn vị</span>
            </strong>
          </div>
          <div className="mt-2.5 pt-2 border-t border-[#f4efe8] flex items-center justify-between text-[11px] text-[#8c8177]">
            <span>Tổng số mặt hàng:</span>
            <strong className="font-semibold text-[var(--char)]">{ingredients.length} loại</strong>
          </div>
        </article>

        {/* Metric 3: Low Stock Warning */}
        <article
          className={cn(
            'p-3.5 sm:p-4 rounded-2xl border bg-white shadow-2xs min-w-0 max-w-full overflow-hidden flex flex-col justify-between transition-colors',
            needReorderCount > 0 ? 'border-amber-200 bg-amber-50/30' : 'border-[#e5ddd6]',
          )}
        >
          <div>
            <span className="text-[10.5px] sm:text-xs font-bold text-[#8c8177] uppercase tracking-wider block truncate">
              Cảnh báo cần mua thêm
            </span>
            <strong
              className={cn(
                'text-xl sm:text-2xl font-bold tabular-nums block truncate mt-1',
                needReorderCount > 0 ? 'text-amber-700' : 'text-emerald-700',
              )}
            >
              {needReorderCount > 0 ? `${needReorderCount} món sắp hết` : 'Đủ hàng an toàn'}
            </strong>
          </div>
          <div className="mt-2.5 pt-2 border-t border-[#f4efe8] flex items-center justify-between text-[11px] text-[#8c8177]">
            <span>Tình trạng:</span>
            <strong className={cn('font-bold', needReorderCount > 0 ? 'text-amber-800' : 'text-emerald-800')}>
              {needReorderCount > 0 ? 'Cần bổ sung kho' : '100% đủ định mức'}
            </strong>
          </div>
        </article>
      </div>

      {/* Main Tab Navigation: [Tồn Kho] vs [Lịch Sử] */}
      <div className="flex items-center gap-1.5 p-1.5 bg-[#ede6de]/80 rounded-2xl w-full">
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={cn(
            'flex-1 py-2 px-2.5 sm:px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate',
            activeTab === 'inventory'
              ? 'bg-white text-[var(--char)] shadow-xs'
              : 'text-[#61574f] hover:bg-white/50',
          )}
        >
          <IconPackage size={15} stroke={2} className="shrink-0" />
          <span className="truncate">Tồn Kho ({ingredients.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={cn(
            'flex-1 py-2 px-2.5 sm:px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate',
            activeTab === 'history'
              ? 'bg-white text-[var(--char)] shadow-xs'
              : 'text-[#61574f] hover:bg-white/50',
          )}
        >
          <IconHistory size={15} stroke={2} className="shrink-0" />
          <span className="truncate">Lịch Sử Nhập / Xuất ({movements.length})</span>
        </button>
      </div>

      {/* TAB 1: INVENTORY & STOCK MANAGEMENT */}
      {activeTab === 'inventory' && (
        <div className="grid gap-3.5 sm:gap-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs w-full min-w-0 max-w-full">
            <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
              <div className="relative flex items-center min-w-0 flex-1">
                <span className="absolute left-3 text-[#8c8177] pointer-events-none" aria-hidden="true">
                  <IconSearch size={16} stroke={1.75} />
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm theo tên nguyên liệu..."
                  className="w-full h-10 pl-9 pr-8 rounded-xl border border-[#d9d0c8] bg-white text-xs text-[var(--char)] focus:border-[var(--ember)] focus:outline-none transition-colors"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 text-[#8c8177] hover:text-[var(--char)]"
                  >
                    <IconX size={15} stroke={2} />
                  </button>
                )}
              </div>

              {/* Quick Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                {[
                  { id: 'all' as const, label: 'Tất cả', count: ingredients.length },
                  { id: 'need_reorder' as const, label: 'Cần nhập thêm', count: needReorderCount },
                  { id: 'good' as const, label: 'Đủ hàng', count: goodCount },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatus(f.id)}
                    className={cn(
                      'px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border',
                      status === f.id
                        ? 'bg-[#1c1512] text-white border-[#1c1512] shadow-xs'
                        : 'bg-[#f4efe8] text-[#61574f] border-[#ede6de] hover:bg-[#eae1d5]',
                    )}
                  >
                    <span>{f.label}</span>
                    <span
                      className={cn(
                        'px-1.5 py-0.2 rounded-full text-[10px] font-mono',
                        status === f.id ? 'bg-[#3c2c25] text-white' : 'bg-[#e5ddd6] text-[#61574f]',
                      )}
                    >
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {inventoryQuery.isLoading && (
            <div className="grid gap-3.5 sm:gap-5" role="status" aria-busy="true">
              <SkeletonTable
                columns={[
                  { width: '30%', cellClassName: 'w-40' },
                  { width: '20%', align: 'right', cellClassName: 'w-20' },
                  { width: '20%', align: 'right', cellClassName: 'w-20' },
                  { width: '15%', align: 'right', cellClassName: 'w-20' },
                  { width: '15%', align: 'right', cellClassName: 'w-20' },
                ]}
                rows={6}
                label="Đang tải dữ liệu kho…"
              />
            </div>
          )}

          {inventoryQuery.isError && (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs flex items-center gap-2">
              <IconAlertTriangle size={16} stroke={2} className="shrink-0" />
              <span>{inventoryQuery.error.message}</span>
            </div>
          )}

          {!inventoryQuery.isLoading && !rows.length && (
            <div className="p-10 text-center rounded-2xl border border-dashed border-[#d9d0c8] bg-white text-[#8c8177]">
              <IconPackage size={40} stroke={1.5} className="mx-auto mb-2 text-[#b8ada1]" />
              <p className="text-sm font-bold text-[var(--char)]">Không tìm thấy nguyên liệu phù hợp</p>
              <p className="text-xs text-[#8c8177] mt-1">Thử thay đổi từ khóa tìm kiếm hoặc bấm nút "Thêm nguyên liệu" để tạo mới.</p>
            </div>
          )}

          {/* Desktop Table View */}
          {!!rows.length && (
            <div className="desktop-only-table catalog-table-wrap">
              <table className="product-mockup-table w-full">
                <colgroup>
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '21%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="text-left">NGUYÊN VẬT LIỆU</th>
                    <th className="text-right">TỒN HIỆN TẠI (CÒN LẠI)</th>
                    <th className="text-right">ĐÃ NHẬP ({formattedMonthLabel})</th>
                    <th className="text-right">CHI TIỀN ({formattedMonthLabel})</th>
                    <th className="text-right">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => {
                    const isOut = item.currentQuantity <= 0
                    const isLow = item.lowStock && !isOut
                    return (
                      <tr
                        key={item.id}
                        className="cursor-pointer hover:bg-[#fffbf8] transition-colors"
                        onClick={() => setSelected(item)}
                      >
                        <td>
                          <div>
                            <strong className="text-sm text-[var(--char)] block font-bold">{item.name}</strong>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-[#8c8177]">Đơn vị: <strong className="text-[#61574f] font-sans">{item.unit}</strong></span>
                              <span className="text-[11px] text-[#8c8177]">· Cảnh báo ≤ {item.reorderPoint} {item.unit}</span>
                            </div>
                          </div>
                        </td>

                        {/* Current Stock (Còn bao nhiêu) */}
                        <td className="text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-mono font-bold text-sm sm:text-base text-[var(--char)] tabular-nums">
                              {Number(item.currentQuantity).toLocaleString('vi-VN')} {item.unit}
                            </span>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full mt-0.5',
                                isOut
                                  ? 'bg-red-100 text-red-800'
                                  : isLow
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-emerald-100 text-emerald-900',
                              )}
                            >
                              <span
                                className={cn(
                                  'w-1.5 h-1.5 rounded-full',
                                  isOut ? 'bg-red-600' : isLow ? 'bg-amber-600' : 'bg-emerald-600',
                                )}
                              />
                              {isOut ? 'Hết hàng' : isLow ? 'Sắp hết' : 'Đủ hàng'}
                            </span>
                          </div>
                        </td>

                        {/* Monthly Received Quantity (Nhập bao nhiêu) */}
                        <td className="text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-mono font-bold text-xs sm:text-sm text-[var(--char)] tabular-nums">
                              {item.monthlyReceivedQuantity ? `+${item.monthlyReceivedQuantity.toLocaleString('vi-VN')}` : '0'}{' '}
                              <span className="text-xs font-normal text-[#8c8177]">{item.unit}</span>
                            </span>
                          </div>
                        </td>

                        {/* Monthly Cost (Chi hết bao nhiêu) */}
                        <td className="text-right">
                          <span className="font-mono font-bold text-xs sm:text-sm text-amber-900 tabular-nums block">
                            {money(item.monthlyReceivedCost || 0)}
                          </span>
                        </td>

                        {/* Quick Actions */}
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={!canManage}
                              onClick={() => openStockIn(item)}
                              className="h-8 px-2.5 text-xs font-bold flex items-center gap-1 bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
                              title="Nhập thêm hàng"
                            >
                              <IconPlus size={13} stroke={2.5} />
                              <span>Nhập</span>
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={!canManage}
                              onClick={() => openAdjustment(item, 'adjustment')}
                              className="h-8 px-2.5 text-xs font-bold flex items-center gap-1 bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
                              title="Xuất dùng hoặc kiểm kê trừ hao hụt"
                            >
                              <IconArrowUpRight size={13} stroke={2} />
                              <span>Xuất/Dùng</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!canManage}
                              onClick={() => openIngredient(item)}
                              className="h-8 px-2 text-xs font-semibold text-[#61574f] hover:text-[var(--char)]"
                              title="Sửa thông tin"
                            >
                              <IconPencil size={13} stroke={2} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile Card List View (< 768px) */}
          {!!rows.length && (
            <div className="mobile-only-list gap-2.5 w-full min-w-0 max-w-full">
              {rows.map((item) => {
                const isOut = item.currentQuantity <= 0
                const isLow = item.lowStock && !isOut
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs flex flex-col gap-2.5 min-w-0 max-w-full overflow-hidden transition-all active:scale-[0.99] cursor-pointer hover:border-[var(--stone)]"
                    onClick={() => setSelected(item)}
                  >
                    {/* Header: Name + Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-[var(--char)] truncate m-0">{item.name}</h4>
                        <span className="text-[11px] text-[#8c8177]">Đơn vị: {item.unit}</span>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5',
                          isOut
                            ? 'bg-red-100 text-red-800'
                            : isLow
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-emerald-100 text-emerald-900',
                        )}
                      >
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            isOut ? 'bg-red-600' : isLow ? 'bg-amber-600' : 'bg-emerald-600',
                          )}
                        />
                        {isOut ? 'Hết hàng' : isLow ? 'Sắp hết' : 'Đủ hàng'}
                      </span>
                    </div>

                    {/* 3 Metrics Box: Còn lại | Đã nhập | Tiền chi */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#faf7f2] border border-[#ede6de]/80 text-xs">
                      <div>
                        <span className="text-[10px] text-[#8c8177] block font-semibold uppercase">Còn lại</span>
                        <strong className="text-sm font-bold font-mono text-[var(--char)] tabular-nums block mt-0.5">
                          {Number(item.currentQuantity).toLocaleString('vi-VN')} {item.unit}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#8c8177] block font-semibold uppercase">Đã nhập</span>
                        <strong className="text-sm font-bold font-mono text-[var(--char)] tabular-nums block mt-0.5">
                          +{Number(item.monthlyReceivedQuantity || 0).toLocaleString('vi-VN')} {item.unit}
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[#8c8177] block font-semibold uppercase">Tiền chi</span>
                        <strong className="text-xs font-bold font-mono text-amber-900 tabular-nums block mt-0.5">
                          {money(item.monthlyReceivedCost || 0)}
                        </strong>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#ede6de]/60 text-xs" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openIngredient(item)}
                        className="text-xs font-semibold text-[#61574f] hover:text-[var(--char)] flex items-center gap-1 py-1"
                      >
                        <IconPencil size={13} stroke={2} />
                        <span>Sửa</span>
                      </button>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!canManage}
                          onClick={() => openAdjustment(item, 'adjustment')}
                          className="h-8 px-2.5 text-xs font-bold flex items-center gap-1 bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 rounded-xl"
                        >
                          <IconArrowUpRight size={13} stroke={2} />
                          <span>Xuất dùng</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!canManage}
                          onClick={() => openStockIn(item)}
                          className="h-8 px-2.5 text-xs font-bold flex items-center gap-1 bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100 rounded-xl"
                        >
                          <IconPlus size={13} stroke={2.5} />
                          <span>Nhập</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MOVEMENTS & RECEIPTS HISTORY */}
      {activeTab === 'history' && (
        <section className="p-4 sm:p-5 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[var(--char)] m-0">
                Nhật ký nhập / xuất kho ({movements.length} giao dịch gần nhất)
              </h3>
              <p className="text-xs text-[#8c8177] m-0 mt-0.5">
                Lưu vết các giao dịch nhập hàng, hao hụt pha chế và kiểm kê định kỳ.
              </p>
            </div>
          </div>

          {!movements.length ? (
            <div className="py-10 text-center text-xs text-[#8c8177]">Chưa có giao dịch nhập xuất nào trong kho.</div>
          ) : (
            <>
              {/* Desktop Table View (>= 768px) */}
              <div className="desktop-only-table catalog-table-wrap">
                <table className="product-mockup-table w-full">
                  <colgroup>
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '18%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="text-left">THỜI GIAN</th>
                      <th className="text-left">NGUYÊN LIỆU</th>
                      <th className="text-left">LOẠI PHIẾU</th>
                      <th className="text-right">SỐ LƯỢNG</th>
                      <th className="text-right">ĐƠN GIÁ / CHI PHÍ</th>
                      <th className="text-left">LÝ DO / NƠI MUA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => {
                      const isReceipt = m.type === 'receipt'
                      return (
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
                          <td>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-md text-[11px] font-bold',
                                isReceipt ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-rose-800',
                              )}
                            >
                              {isReceipt ? 'Nhập hàng' : 'Xuất / Hao hụt'}
                            </span>
                          </td>
                          <td className="text-right font-bold text-xs tabular-nums">
                            <span className={isReceipt ? 'text-amber-900' : 'text-rose-700'}>
                              {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta} {m.unit || ''}
                            </span>
                          </td>
                          <td className="text-right text-xs tabular-nums">
                            {m.unitCost ? (
                              <div>
                                <strong className="font-bold text-amber-900 block">{money(m.quantityDelta * m.unitCost)}</strong>
                                <span className="text-[10.5px] text-[#8c8177]">({money(m.unitCost)}/đv)</span>
                              </div>
                            ) : (
                              <span className="text-[#8c8177]">—</span>
                            )}
                          </td>
                          <td className="text-xs text-[#61574f] truncate max-w-[180px]" title={m.reason}>
                            {m.reason || 'Nhập kho định kỳ'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View (< 768px) */}
              <div className="mobile-only-list gap-2.5 w-full min-w-0 max-w-full">
                {movements.map((m) => {
                  const isReceipt = m.type === 'receipt'
                  const subtotal = m.unitCost ? m.quantityDelta * m.unitCost : 0
                  return (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs flex flex-col gap-2 min-w-0 max-w-full overflow-hidden"
                    >
                      {/* Header: Ingredient Name + Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <strong className="text-sm font-bold text-[var(--char)] truncate block">
                            {m.ingredientName}
                          </strong>
                          <span className="text-[11px] text-[#8c8177]">
                            {new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {new Date(m.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 px-2 py-0.5 rounded-md text-xs font-bold',
                            isReceipt ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-rose-800',
                          )}
                        >
                          {isReceipt ? 'Nhập hàng' : 'Xuất kho'}
                        </span>
                      </div>

                      {/* Stats Box: Quantity & Cost */}
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-[#faf7f2] border border-[#ede6de]/80 text-xs">
                        <div>
                          <span className="text-[10px] text-[#8c8177] block font-semibold uppercase">Số lượng</span>
                          <strong
                            className={cn(
                              'text-sm font-bold tabular-nums block mt-0.5',
                              isReceipt ? 'text-amber-900' : 'text-rose-700',
                            )}
                          >
                            {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta} {m.unit || ''}
                          </strong>
                        </div>
                        {m.unitCost ? (
                          <div className="text-right">
                            <span className="text-[10px] text-[#8c8177] block font-semibold uppercase">Thành tiền</span>
                            <strong className="text-sm font-bold tabular-nums text-amber-900 block mt-0.5">
                              {money(subtotal)}
                            </strong>
                            <span className="text-[10px] text-[#8c8177] block">({money(m.unitCost)}/{m.unit || 'đv'})</span>
                          </div>
                        ) : (
                          <div className="text-right">
                            <span className="text-[10px] text-[#8c8177] block font-semibold uppercase">Chi phí</span>
                            <span className="text-xs text-[#8c8177] mt-0.5 block">—</span>
                          </div>
                        )}
                      </div>

                      {/* Footer: Reason & Actor */}
                      <div className="flex items-center justify-between text-[11px] text-[#8c8177] pt-0.5 border-t border-[#ede6de]/60">
                        <span className="truncate max-w-[200px]" title={m.reason}>
                          Nơi mua/Lý do: <strong className="text-[#61574f] font-medium">{m.reason || 'Nhập định kỳ'}</strong>
                        </span>
                        <span className="shrink-0 font-medium">Bởi {m.actorName}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>
      )}

      {/* Single Ingredient Detail Drawer */}
      <Drawer.Root
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        swipeDirection={isMobile ? 'down' : 'right'}
      >
        <Drawer.Content
          direction={isMobile ? 'bottom' : 'right'}
          className={cn(
            isMobile
              ? 'w-full max-h-[90dvh] p-0 bg-[#fffdf9] rounded-t-3xl border-t border-[#ded1c0] shadow-2xl flex flex-col'
              : 'admin-detail-drawer max-w-md w-full p-0 bg-[#fffdf9] border-l border-[#ded1c0] shadow-2xl flex flex-col',
          )}
        >
          <Drawer.Header className="px-5 pt-3.5 pb-3 border-b border-[#ede6de] shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase font-bold tracking-wider text-[#8c8177]">CHI TIẾT NGUYÊN LIỆU</span>
                <Drawer.Title className="text-lg sm:text-xl font-bold font-display text-[var(--char)] m-0 mt-0.5">
                  {activeSelected?.name ?? 'Nguyên liệu'}
                </Drawer.Title>
              </div>
              {!isMobile && (
                <Drawer.Close className="p-1.5 rounded-lg text-[#8c8177] hover:text-[var(--char)] hover:bg-[#efe7dc] transition-colors cursor-pointer">
                  <IconX size={18} stroke={1.75} />
                </Drawer.Close>
              )}
            </div>
          </Drawer.Header>

          {activeSelected && (
            <>
              <Drawer.Body className="px-5 py-4 space-y-4 overflow-y-auto flex-1 min-h-0 -webkit-overflow-scrolling-touch">
                {/* Stat Highlight Card */}
                <div className="p-4 rounded-2xl border border-[#ede6de] bg-white shadow-2xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs text-[#8c8177] block font-medium">Tồn kho hiện tại (Còn lại)</span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <strong className="text-3xl font-mono font-bold text-[var(--char)] tabular-nums">
                          {Number(activeSelected.currentQuantity).toLocaleString('vi-VN')}
                        </strong>
                        <span className="text-sm font-bold text-[#8c8177]">{activeSelected.unit}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full',
                          activeSelected.currentQuantity <= 0
                            ? 'bg-red-100 text-red-800'
                            : activeSelected.lowStock
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-emerald-100 text-emerald-900',
                        )}
                      >
                        {activeSelected.currentQuantity <= 0 ? 'Hết hàng' : activeSelected.lowStock ? 'Sắp hết' : 'Đủ hàng'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#f4efe8] grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[#8c8177] block text-[11px]">Đã nhập trong tháng:</span>
                      <strong className="font-mono text-amber-900">
                        +{Number(activeSelected.monthlyReceivedQuantity || 0).toLocaleString('vi-VN')} {activeSelected.unit}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#8c8177] block text-[11px]">Tiền chi trong tháng:</span>
                      <strong className="font-mono text-amber-900">
                        {money(activeSelected.monthlyReceivedCost || 0)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* History section in drawer */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#8c8177] m-0">Lịch sử nhập / xuất món này</h4>
                  {detailQuery.isLoading && <SkeletonList rows={3} />}
                  {detailQuery.data && detailQuery.data.length === 0 && (
                    <div className="py-6 text-center text-xs text-[#8c8177]">Chưa có lịch sử giao dịch.</div>
                  )}
                  {detailQuery.data && (
                    <div className="space-y-2">
                      {detailQuery.data.map((m) => (
                        <div key={m.id} className="p-3 rounded-xl border border-[#ede6de] bg-white text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[var(--char)]">
                              {m.type === 'receipt' ? 'Nhập hàng' : 'Xuất kho'}
                            </span>
                            <span className={cn('font-mono font-bold', m.quantityDelta > 0 ? 'text-amber-900' : 'text-rose-700')}>
                              {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta} {activeSelected.unit}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[#8c8177]">
                            <span>{new Date(m.createdAt).toLocaleString('vi-VN')}</span>
                            <span>{m.reason}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Drawer.Body>

              <Drawer.Footer className="px-5 py-3 border-t border-[#ede6de] flex items-center gap-2 shrink-0 bg-white">
                <Button
                  size="md"
                  variant="ghost"
                  onClick={() => {
                    openIngredient(activeSelected)
                    setSelected(null)
                  }}
                  className="h-10 px-3 text-xs font-bold text-[#61574f]"
                  title="Sửa thông tin"
                >
                  <IconPencil size={15} stroke={2} className="mr-1" />
                  <span>Sửa</span>
                </Button>
                <Button
                  size="md"
                  variant="secondary"
                  onClick={() => {
                    openAdjustment(activeSelected, 'adjustment')
                    setSelected(null)
                  }}
                  className="flex-1 h-10 text-xs font-bold bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
                >
                  <IconArrowUpRight size={15} stroke={2} className="mr-1" />
                  <span>Xuất dùng</span>
                </Button>
                <PrimaryButton
                  size="md"
                  onClick={() => {
                    openStockIn(activeSelected)
                    setSelected(null)
                  }}
                  className="flex-1 h-10 text-xs font-bold"
                >
                  <IconPlus size={15} stroke={2.5} className="mr-1" />
                  <span>Nhập hàng</span>
                </PrimaryButton>
              </Drawer.Footer>
            </>
          )}
        </Drawer.Content>
      </Drawer.Root>

      {/* Ingredient Form Dialog (Desktop) / Drawer (Mobile) */}
      {isMobile ? (
        <Drawer.Root
          open={dialog === 'ingredient'}
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
          swipeDirection="down"
        >
          <Drawer.Content
            direction="bottom"
            className="w-full max-h-[92dvh] p-0 bg-[#fffdfa] rounded-t-3xl border-t border-[#ded1c0] shadow-2xl flex flex-col"
          >
            <Drawer.Header className="px-5 pt-3.5 pb-3 border-b border-[#ede6de] shrink-0">
              <Drawer.Title className="text-lg font-bold font-display text-[var(--char)] m-0">
                {activeDialog === 'ingredient' && ingredientDraft.id ? 'Sửa Nguyên Liệu' : 'Thêm Nguyên Liệu Mới'}
              </Drawer.Title>
            </Drawer.Header>
            <Drawer.Body className="px-5 py-4 overflow-y-auto flex-1 min-h-0 -webkit-overflow-scrolling-touch">
              <IngredientForm
                draft={ingredientDraft}
                setDraft={setIngredientDraft}
                onSubmit={(e) => {
                  e.preventDefault()
                  mutation.mutate({
                    action: 'saveIngredient',
                    id: ingredientDraft.id || undefined,
                    name: ingredientDraft.name,
                    unit: ingredientDraft.unit,
                    reorderPoint: Number(ingredientDraft.reorderPoint),
                    active: ingredientDraft.active,
                  })
                }}
                isPending={mutation.isPending}
                error={mutation.error instanceof Error ? mutation.error.message : undefined}
                isDialog={false}
                onClose={() => setDialog(null)}
              />
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Root>
      ) : (
        <Dialog.Root
          open={dialog === 'ingredient'}
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
        >
          <Dialog.Content className="max-w-md w-full p-6 bg-[#fffdfa] rounded-2xl border border-[#ded1c0] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#ede6de]">
              <Dialog.Title className="text-lg font-bold font-display text-[var(--char)] m-0">
                {activeDialog === 'ingredient' && ingredientDraft.id ? 'Sửa Nguyên Liệu' : 'Thêm Nguyên Liệu Mới'}
              </Dialog.Title>
              <Dialog.Close className="p-1.5 rounded-lg text-[#8c8177] hover:text-[var(--char)] hover:bg-[#efe7dc] transition-colors cursor-pointer">
                <IconX size={18} stroke={1.75} />
              </Dialog.Close>
            </div>
            <IngredientForm
              draft={ingredientDraft}
              setDraft={setIngredientDraft}
              onSubmit={(e) => {
                e.preventDefault()
                mutation.mutate({
                  action: 'saveIngredient',
                  id: ingredientDraft.id || undefined,
                  name: ingredientDraft.name,
                  unit: ingredientDraft.unit,
                  reorderPoint: Number(ingredientDraft.reorderPoint),
                  active: ingredientDraft.active,
                })
              }}
              isPending={mutation.isPending}
              error={mutation.error instanceof Error ? mutation.error.message : undefined}
              isDialog={true}
              onClose={() => setDialog(null)}
            />
          </Dialog.Content>
        </Dialog.Root>
      )}

      {/* Stock In / Adjustment Form Dialog (Desktop) / Drawer (Mobile) */}
      {isMobile ? (
        <Drawer.Root
          open={dialog === 'adjustment'}
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
          swipeDirection="down"
        >
          <Drawer.Content
            direction="bottom"
            className="w-full max-h-[92dvh] p-0 bg-[#fffdfa] rounded-t-3xl border-t border-[#ded1c0] shadow-2xl flex flex-col"
          >
            <Drawer.Header className="px-5 pt-3.5 pb-3 border-b border-[#ede6de] shrink-0">
              <Drawer.Title className="text-lg font-bold font-display text-[var(--char)] m-0">
                {adjustmentDraft.type === 'receipt' ? 'Nhập Hàng Vào Kho' : 'Điều Chỉnh / Xuất Kho'}
              </Drawer.Title>
            </Drawer.Header>
            <Drawer.Body className="px-5 py-4 overflow-y-auto flex-1 min-h-0 -webkit-overflow-scrolling-touch">
              <AdjustmentForm
                draft={adjustmentDraft}
                setDraft={setAdjustmentDraft}
                ingredientOptions={ingredientOptions}
                ingredients={ingredients}
                onSubmit={(e) => {
                  e.preventDefault()
                  mutation.mutate({
                    action: 'adjust',
                    ingredientId: adjustmentDraft.ingredientId,
                    type: adjustmentDraft.type,
                    quantityDelta: Number(adjustmentDraft.quantityDelta),
                    reason: adjustmentDraft.reason,
                    unitCost: Number(adjustmentDraft.unitCost || 0),
                    expiresAt: adjustmentDraft.expiresAt || undefined,
                  })
                }}
                isPending={mutation.isPending}
                error={mutation.error instanceof Error ? mutation.error.message : undefined}
                isDialog={false}
                onClose={() => setDialog(null)}
              />
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Root>
      ) : (
        <Dialog.Root
          open={dialog === 'adjustment'}
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
        >
          <Dialog.Content className="max-w-lg w-full p-6 bg-[#fffdfa] rounded-2xl border border-[#ded1c0] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#ede6de]">
              <Dialog.Title className="text-lg font-bold font-display text-[var(--char)] m-0">
                {adjustmentDraft.type === 'receipt' ? 'Nhập Hàng Vào Kho' : 'Điều Chỉnh / Xuất Kho'}
              </Dialog.Title>
              <Dialog.Close className="p-1.5 rounded-lg text-[#8c8177] hover:text-[var(--char)] hover:bg-[#efe7dc] transition-colors cursor-pointer">
                <IconX size={18} stroke={1.75} />
              </Dialog.Close>
            </div>
            <AdjustmentForm
              draft={adjustmentDraft}
              setDraft={setAdjustmentDraft}
              ingredientOptions={ingredientOptions}
              ingredients={ingredients}
              onSubmit={(e) => {
                e.preventDefault()
                mutation.mutate({
                  action: 'adjust',
                  ingredientId: adjustmentDraft.ingredientId,
                  type: adjustmentDraft.type,
                  quantityDelta: Number(adjustmentDraft.quantityDelta),
                  reason: adjustmentDraft.reason,
                  unitCost: Number(adjustmentDraft.unitCost || 0),
                  expiresAt: adjustmentDraft.expiresAt || undefined,
                })
              }}
              isPending={mutation.isPending}
              error={mutation.error instanceof Error ? mutation.error.message : undefined}
              isDialog={true}
              onClose={() => setDialog(null)}
            />
          </Dialog.Content>
        </Dialog.Root>
      )}
    </div>
  )
}

function IngredientForm({
  draft,
  setDraft,
  onSubmit,
  isPending,
  error,
  isDialog,
  onClose,
}: {
  draft: {
    id: string
    name: string
    unit: string
    reorderPoint: number
    active: boolean
  }
  setDraft: React.Dispatch<
    React.SetStateAction<{
      id: string
      name: string
      unit: string
      reorderPoint: number
      active: boolean
    }>
  >
  onSubmit: (e: React.FormEvent) => void
  isPending: boolean
  error?: string
  isDialog?: boolean
  onClose: () => void
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field.Root>
        <Field.Label className="text-xs font-bold text-[var(--char)]">Tên nguyên liệu *</Field.Label>
        <Input
          size="md"
          required
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="VD: Hạt Robusta, Sữa đặc Ngôi sao, Đường cát…"
          className="bg-white mt-1 text-sm font-semibold"
        />
      </Field.Root>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field.Root>
          <Field.Label className="text-xs font-bold text-[var(--char)]">Đơn vị tính *</Field.Label>
          <Input
            size="md"
            required
            value={draft.unit}
            onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
            placeholder="kg, lít, hộp…"
            className="bg-white mt-1 text-sm"
          />
          <div className="flex flex-wrap gap-1 mt-1.5">
            {UNIT_CHIPS.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setDraft({ ...draft, unit: u })}
                className={cn(
                  'px-2 py-0.5 text-[11px] rounded-md border font-medium transition-colors cursor-pointer',
                  draft.unit === u
                    ? 'bg-[#1c1512] text-white border-[#1c1512]'
                    : 'bg-[#f4efe8] text-[#61574f] border-[#ede6de] hover:bg-[#eae1d5]',
                )}
              >
                {u}
              </button>
            ))}
          </div>
        </Field.Root>

        <Field.Root>
          <Field.Label className="text-xs font-bold text-[var(--char)]">Mức báo sắp hết</Field.Label>
          <Input
            size="md"
            min="0"
            type="number"
            value={draft.reorderPoint}
            onChange={(e) => setDraft({ ...draft, reorderPoint: Number(e.target.value) })}
            className="bg-white mt-1 font-mono text-right text-sm"
          />
          <span className="text-[11px] text-[#8c8177] mt-1.5 block">
            Cảnh báo khi tồn kho ≤ <strong className="font-mono text-[#61574f]">{draft.reorderPoint || 0} {draft.unit}</strong>
          </span>
        </Field.Root>
      </div>

      <label className="p-3.5 rounded-xl border border-[#ede6de] bg-white flex items-center justify-between cursor-pointer select-none hover:border-[#ded1c0] transition-colors shadow-2xs">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={draft.active}
            onCheckedChange={(checked) => setDraft({ ...draft, active: checked === true })}
          />
          <div>
            <span className="text-xs font-bold text-[var(--char)] block">Nguyên liệu đang sử dụng</span>
            <span className="text-[11px] text-[#8c8177] block">
              Cho phép sử dụng trong công thức pha chế và nhập kho
            </span>
          </div>
        </div>
      </label>

      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <IconAlertTriangle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div
        className={cn(
          'pt-3 border-t border-[#ede6de] flex items-center gap-3 shrink-0',
          isDialog ? 'justify-end pb-0' : 'pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]',
        )}
      >
        <Button
          variant="secondary"
          size="md"
          type="button"
          onClick={onClose}
          className="flex-1 sm:flex-initial px-5 font-bold text-xs"
        >
          Hủy
        </Button>
        <PrimaryButton
          disabled={isPending}
          type="submit"
          className="flex-1 sm:flex-initial px-6 h-10 font-bold text-xs"
        >
          {isPending ? 'Đang lưu…' : draft.id ? 'Cập nhật nguyên liệu' : 'Lưu nguyên liệu'}
        </PrimaryButton>
      </div>
    </form>
  )
}

function AdjustmentForm({
  draft,
  setDraft,
  ingredientOptions,
  ingredients,
  onSubmit,
  isPending,
  error,
  isDialog,
  onClose,
}: {
  draft: {
    ingredientId: string
    type: 'receipt' | 'adjustment' | 'stocktake'
    quantityDelta: number
    reason: string
    unitCost: number
    expiresAt: string
  }
  setDraft: React.Dispatch<
    React.SetStateAction<{
      ingredientId: string
      type: 'receipt' | 'adjustment' | 'stocktake'
      quantityDelta: number
      reason: string
      unitCost: number
      expiresAt: string
    }>
  >
  ingredientOptions: SelectOption[]
  ingredients: Ingredient[]
  onSubmit: (e: React.FormEvent) => void
  isPending: boolean
  error?: string
  isDialog?: boolean
  onClose: () => void
}) {
  const selectedIng = ingredients.find((i) => i.id === draft.ingredientId)
  const unit = selectedIng?.unit ?? 'đơn vị'
  const currentStock = Number(selectedIng?.currentQuantity ?? 0)

  // Local state for stocktake actual count
  const [actualStockInput, setActualStockInput] = useState<string>(() =>
    draft.type === 'stocktake' ? String(Math.max(0, currentStock + draft.quantityDelta)) : String(currentStock),
  )

  const subtotal = draft.type === 'receipt' ? Math.max(0, draft.quantityDelta) * Math.max(0, draft.unitCost) : 0

  const handleTypeChange = (type: 'receipt' | 'adjustment' | 'stocktake') => {
    if (type === 'receipt') {
      setDraft((prev) => ({
        ...prev,
        type: 'receipt',
        quantityDelta: Math.abs(prev.quantityDelta || 1),
        reason: 'Nhập định kỳ',
      }))
    } else if (type === 'adjustment') {
      setDraft((prev) => ({
        ...prev,
        type: 'adjustment',
        quantityDelta: -Math.abs(prev.quantityDelta || 1),
        reason: 'Xuất dùng pha chế',
      }))
    } else {
      const actualVal = Number(actualStockInput || currentStock)
      setDraft((prev) => ({
        ...prev,
        type: 'stocktake',
        quantityDelta: actualVal - currentStock,
        reason: 'Kiểm kê thực tế',
      }))
    }
  }

  const stocktakeDiff = Number(actualStockInput || currentStock) - currentStock
  const remainingAfterAdjustment = currentStock - Math.abs(draft.quantityDelta || 0)

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {/* Transaction Type Segmented Toggle: 3 Modes */}
      <div>
        <label className="text-xs font-bold text-[var(--char)] block mb-1.5">Mục đích thực hiện *</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              type: 'receipt' as const,
              label: 'Nhập hàng',
              sub: '+ Mua thêm',
              icon: IconArrowDownLeft,
              activeClass: 'border-amber-600 bg-amber-50/80 text-amber-950 font-bold shadow-2xs',
            },
            {
              type: 'adjustment' as const,
              label: 'Xuất dùng',
              sub: '- Đã sử dụng',
              icon: IconArrowUpRight,
              activeClass: 'border-rose-600 bg-rose-50/80 text-rose-950 font-bold shadow-2xs',
            },
            {
              type: 'stocktake' as const,
              label: 'Kiểm kê',
              sub: '⚖️ Cân lại tồn',
              icon: IconScale,
              activeClass: 'border-blue-600 bg-blue-50/80 text-blue-950 font-bold shadow-2xs',
            },
          ].map((tab) => {
            const isSelected = draft.type === tab.type
            const Icon = tab.icon
            return (
              <button
                key={tab.type}
                type="button"
                onClick={() => handleTypeChange(tab.type)}
                className={cn(
                  'p-2 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2',
                  isSelected
                    ? tab.activeClass
                    : 'border-[#ede6de] bg-white text-[#61574f] hover:bg-[#faf7f2]',
                )}
              >
                <div className={cn('p-1.5 rounded-lg shrink-0 w-fit', isSelected ? 'bg-white shadow-2xs' : 'bg-[#f0ebe4]')}>
                  <Icon size={15} stroke={2.2} />
                </div>
                <div className="min-w-0">
                  <strong className="text-xs block leading-tight truncate">{tab.label}</strong>
                  <span className="text-[10px] text-[#8c8177] block truncate">{tab.sub}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Ingredient Picker */}
      <Field.Root>
        <div className="flex items-center justify-between">
          <Field.Label className="text-xs font-bold text-[var(--char)]">Nguyên liệu *</Field.Label>
          {selectedIng && (
            <span className="text-[11px] font-semibold text-[#8c8177]">
              Sổ sách đang ghi: <strong className="text-[var(--char)] font-mono">{currentStock.toLocaleString('vi-VN')} {selectedIng.unit}</strong>
            </span>
          )}
        </div>
        <AppSelect
          size="md"
          items={ingredientOptions}
          value={draft.ingredientId}
          onValueChange={(val) => {
            setDraft({ ...draft, ingredientId: val })
            const nextIng = ingredients.find((i) => i.id === val)
            if (nextIng) {
              setActualStockInput(String(nextIng.currentQuantity))
            }
          }}
          placeholder="Chọn nguyên liệu…"
          triggerClassName="bg-white text-xs mt-1"
        />
      </Field.Root>

      {/* MODE 1: STOCKTAKE (Kiểm kê cân thực tế) */}
      {draft.type === 'stocktake' && (
        <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-200/80 space-y-3">
          <Field.Root>
            <div className="flex items-center justify-between">
              <Field.Label className="text-xs font-bold text-blue-950">
                Số lượng thực tế đang có tại quán ({unit}) *
              </Field.Label>
              <span className="text-[10.5px] text-blue-800 font-medium">Đếm/cân còn bao nhiêu nhập bấy nhiêu</span>
            </div>
            <Input
              size="md"
              required
              type="number"
              step="0.001"
              min="0"
              value={actualStockInput}
              onChange={(e) => {
                const valStr = e.target.value
                setActualStockInput(valStr)
                const val = Number(valStr)
                setDraft({
                  ...draft,
                  quantityDelta: val - currentStock,
                })
              }}
              placeholder="Nhập số tồn thực tế…"
              className="bg-white mt-1 font-mono text-right text-base font-bold"
            />
          </Field.Root>

          {/* Real-time Diff Comparison */}
          <div className="p-2.5 rounded-xl bg-white border border-blue-100 flex items-center justify-between text-xs">
            <span className="text-[#61574f]">Chênh lệch điều chỉnh:</span>
            <strong
              className={cn(
                'tabular-nums font-bold text-sm',
                stocktakeDiff < 0
                  ? 'text-rose-700'
                  : stocktakeDiff > 0
                    ? 'text-emerald-700'
                    : 'text-[#8c8177]',
              )}
            >
              {stocktakeDiff > 0 ? `+${stocktakeDiff.toLocaleString('vi-VN')}` : stocktakeDiff.toLocaleString('vi-VN')} {unit}
              <span className="text-[11px] font-normal ml-1">
                {stocktakeDiff < 0 ? '(Đã dùng/Hụt)' : stocktakeDiff > 0 ? '(Thừa)' : '(Khớp)'}
              </span>
            </strong>
          </div>
        </div>
      )}

      {/* MODE 2: ADJUSTMENT (Xuất dùng / Hao hụt) */}
      {draft.type === 'adjustment' && (
        <div className="space-y-3">
          <Field.Root>
            <Field.Label className="text-xs font-bold text-[var(--char)]">
              Số lượng xuất dùng / hao hụt (- {unit}) *
            </Field.Label>
            <Input
              size="md"
              required
              type="number"
              step="0.001"
              min="0.001"
              value={Math.abs(draft.quantityDelta || 0) || ''}
              onChange={(e) => {
                const val = Number(e.target.value)
                setDraft({
                  ...draft,
                  quantityDelta: -Math.abs(val),
                })
              }}
              placeholder="VD: 2, 5, 0.5…"
              className="bg-white mt-1 font-mono text-right text-base font-bold text-rose-800"
            />
          </Field.Root>

          {/* Remaining Stock Preview */}
          <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200/80 flex items-center justify-between text-xs">
            <span className="text-[#61574f]">Tồn kho sau khi trừ:</span>
            <strong
              className={cn(
                'tabular-nums font-bold text-sm',
                remainingAfterAdjustment < 0 ? 'text-red-700' : 'text-[var(--char)]',
              )}
            >
              {remainingAfterAdjustment.toLocaleString('vi-VN')} {unit}
              {remainingAfterAdjustment < 0 && ' (Vượt tồn kho!)'}
            </strong>
          </div>
        </div>
      )}

      {/* MODE 3: RECEIPT (Nhập hàng mua) */}
      {draft.type === 'receipt' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field.Root>
              <Field.Label className="text-xs font-bold text-[var(--char)]">
                Số lượng nhập (+ {unit}) *
              </Field.Label>
              <Input
                size="md"
                required
                type="number"
                step="0.001"
                min="0.001"
                value={draft.quantityDelta || ''}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  setDraft({
                    ...draft,
                    quantityDelta: Math.abs(val),
                  })
                }}
                placeholder="VD: 10, 20…"
                className="bg-white mt-1 font-mono text-right text-sm font-bold text-amber-900"
              />
            </Field.Root>

            <Field.Root>
              <Field.Label className="text-xs font-bold text-[var(--char)]">
                Đơn giá mua / {unit} (₫) *
              </Field.Label>
              <Input
                size="md"
                required
                min="0"
                type="number"
                value={draft.unitCost || ''}
                onChange={(e) => setDraft({ ...draft, unitCost: Number(e.target.value) })}
                placeholder="VD: 150000"
                className="bg-white mt-1 font-mono text-right text-sm"
              />
            </Field.Root>
          </div>

          {/* Live Total Cost Highlight */}
          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-950">
              <IconPackage size={18} className="text-amber-700 shrink-0" />
              <span className="text-xs font-bold">Tổng tiền chi cho đợt nhập này:</span>
            </div>
            <strong className="text-base font-bold text-amber-900 tabular-nums">
              {money(subtotal)}
            </strong>
          </div>
        </>
      )}

      {/* Reason / Source with Quick Chips */}
      <Field.Root>
        <Field.Label className="text-xs font-bold text-[var(--char)]">
          {draft.type === 'receipt'
            ? 'Nơi mua / Lý do nhập *'
            : draft.type === 'stocktake'
              ? 'Mục đích kiểm kê *'
              : 'Lý do xuất kho *'}
        </Field.Label>
        <Input
          size="md"
          required
          value={draft.reason}
          onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
          placeholder="Nhập lý do hoặc chọn nhanh bên dưới…"
          className="bg-white mt-1 text-sm"
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {(draft.type === 'receipt'
            ? RECEIPT_REASONS
            : draft.type === 'stocktake'
              ? STOCKTAKE_REASONS
              : ADJUST_REASONS
          ).map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setDraft({ ...draft, reason: chip })}
              className={cn(
                'px-2.5 py-1 text-[11px] rounded-lg border font-medium transition-colors cursor-pointer',
                draft.reason === chip
                  ? 'bg-[#1c1512] text-white border-[#1c1512]'
                  : 'bg-[#f4efe8] text-[#61574f] border-[#ede6de] hover:bg-[#eae1d5]',
              )}
            >
              {chip}
            </button>
          ))}
        </div>
      </Field.Root>

      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <IconAlertTriangle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div
        className={cn(
          'pt-3 border-t border-[#ede6de] flex items-center gap-3 shrink-0',
          isDialog ? 'justify-end pb-0' : 'pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]',
        )}
      >
        <Button
          variant="secondary"
          size="md"
          type="button"
          onClick={onClose}
          className="flex-1 sm:flex-initial px-5 font-bold text-xs"
        >
          Hủy
        </Button>
        <PrimaryButton
          disabled={isPending}
          type="submit"
          className="flex-1 sm:flex-initial px-6 h-10 font-bold text-xs"
        >
          {isPending
            ? 'Đang lưu…'
            : draft.type === 'receipt'
              ? 'Lưu phiếu nhập hàng'
              : draft.type === 'stocktake'
                ? 'Lưu kết quả kiểm kê'
                : 'Lưu phiếu xuất kho'}
        </PrimaryButton>
      </div>
    </form>
  )
}
