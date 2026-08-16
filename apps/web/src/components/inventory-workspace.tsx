import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  IconPlus,
  IconSearch,
  IconX,
  IconArrowsExchange,
} from '@tabler/icons-react'
import { Dialog } from './ui/dialog'
import { Drawer } from './ui/drawer'
import { AppSelect, type SelectOption } from './ui/select'
import { Button, PrimaryButton, SecondaryButton } from './ui/button'
import { Input } from './ui/input'
import { Field } from './ui/field'
import { Checkbox } from './ui/checkbox'
import { DatePicker } from './ui/date-picker'
import { cn } from '@/lib/utils'

type Ingredient = { id: string; name: string; unit: string; currentQuantity: number; reorderPoint: number; active: boolean; lowStock: boolean }
type Movement = { id: string; ingredientId: string; ingredientName: string; type: string; quantityDelta: number; reason: string; createdAt: number; actorName: string }
const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}₫`

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Trạng thái: Tất cả' },
  { value: 'good', label: 'Đủ hàng' },
  { value: 'low', label: 'Sắp hết' },
  { value: 'out', label: 'Hết hàng' },
]

const ADJUSTMENT_TYPE_OPTIONS: SelectOption[] = [
  { value: 'receipt', label: 'Nhập kho (Lô FIFO mới)' },
  { value: 'adjustment', label: 'Xuất kho / Điều chỉnh' },
  { value: 'stocktake', label: 'Kiểm kê chênh lệch thực tế' },
]

export function InventoryWorkspace({ canManage = false }: { canManage?: boolean }) {
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'good' | 'low' | 'out'>('all')
  const [selected, setSelected] = useState<Ingredient | null>(null)
  const [dialog, setDialog] = useState<'ingredient' | 'adjustment' | null>(null)
  const [ingredientDraft, setIngredientDraft] = useState({ id: '', name: '', unit: 'kg', reorderPoint: 0, active: true })
  const [adjustmentDraft, setAdjustmentDraft] = useState({ ingredientId: '', type: 'receipt' as 'receipt' | 'adjustment' | 'stocktake', quantityDelta: 0, reason: '', unitCost: 0, expiresAt: '' })

  const inventoryQuery = useQuery({
    queryKey: ['inventory-workspace'],
    queryFn: async () => {
      const response = await fetch('/api/inventory')
      const body = await response.json().catch(() => ({})) as { message?: string; ingredients?: Ingredient[]; movements?: Movement[]; inventoryValue?: number }
      if (!response.ok) throw new Error(body.message ?? 'Không tải được kho.')
      return { ingredients: body.ingredients ?? [], movements: body.movements ?? [], inventoryValue: Number(body.inventoryValue ?? 0) }
    },
  })

  const detailQuery = useQuery({
    queryKey: ['inventory-detail', selected?.id],
    enabled: Boolean(selected?.id),
    queryFn: async () => {
      const response = await fetch(`/api/inventory?ingredientId=${selected?.id}`)
      const body = await response.json().catch(() => ({})) as { message?: string; movements?: Movement[] }
      if (!response.ok) throw new Error(body.message ?? 'Không tải được lịch sử nhập xuất.')
      return body.movements ?? []
    },
  })

  const mutation = useMutation({
    mutationFn: async (body: unknown) => {
      const response = await fetch('/api/inventory', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json().catch(() => ({})) as { message?: string }
      if (!response.ok) throw new Error(result.message ?? 'Không thể lưu kho.')
      return result
    },
    onSuccess: async () => {
      setDialog(null)
      setIngredientDraft({ id: '', name: '', unit: 'kg', reorderPoint: 0, active: true })
      setAdjustmentDraft({ ingredientId: '', type: 'receipt', quantityDelta: 0, reason: '', unitCost: 0, expiresAt: '' })
      await client.invalidateQueries({ queryKey: ['inventory-workspace'] })
    },
  })

  const ingredients = inventoryQuery.data?.ingredients ?? []
  const ingredientOptions: SelectOption[] = useMemo(() => ingredients.map((item) => ({
    value: item.id,
    label: `${item.name} (Tồn: ${Number(item.currentQuantity).toLocaleString('vi-VN')} ${item.unit})`,
  })), [ingredients])

  const rows = useMemo(() => ingredients.filter((item) => {
    const term = search.trim().toLocaleLowerCase('vi-VN')
    const matchesSearch = !term || `${item.name} ${item.unit}`.toLocaleLowerCase('vi-VN').includes(term)
    const matchesStatus =
      status === 'all' ||
      (status === 'out' && item.currentQuantity <= 0) ||
      (status === 'low' && item.lowStock && item.currentQuantity > 0) ||
      (status === 'good' && !item.lowStock && item.currentQuantity > 0)
    return matchesSearch && matchesStatus
  }), [ingredients, search, status])

  const totalValue = inventoryQuery.data?.inventoryValue ?? 0
  const lowCount = ingredients.filter((item) => item.lowStock && item.currentQuantity > 0).length
  const outCount = ingredients.filter((item) => item.currentQuantity <= 0).length
  const goodCount = ingredients.filter((item) => !item.lowStock && item.currentQuantity > 0).length

  const openIngredient = (item?: Ingredient) => {
    setIngredientDraft(item ? { id: item.id, name: item.name, unit: item.unit, reorderPoint: item.reorderPoint, active: item.active } : { id: '', name: '', unit: 'kg', reorderPoint: 0, active: true })
    setDialog('ingredient')
  }

  const openAdjustment = (item?: Ingredient) => {
    setAdjustmentDraft((current) => ({
      ...current,
      ingredientId: item?.id ?? current.ingredientId ?? ingredients[0]?.id ?? '',
      quantityDelta: 0,
      reason: '',
      unitCost: 0,
      expiresAt: '',
    }))
    setDialog('adjustment')
  }

  return (
    <section className="inventory-workspace grid gap-5">
      {/* Header */}
      <div className="catalog-header-row">
        <div>
          <h2 className="catalog-main-title">Kho & Nguyên liệu</h2>
          <p className="catalog-main-sub">Quản lý tồn kho theo lô FIFO, theo dõi ngưỡng an toàn và lập phiếu nhập/xuất.</p>
        </div>
        <div className="flex items-center gap-2">
          <SecondaryButton size="md" disabled={!canManage} onClick={() => openIngredient()} className="flex items-center gap-1.5">
            <IconPlus size={16} stroke={2} />
            <span>Nguyên liệu</span>
          </SecondaryButton>
          <PrimaryButton size="md" disabled={!canManage || !ingredients.length} onClick={() => openAdjustment()} className="flex items-center gap-1.5">
            <IconArrowsExchange size={16} stroke={1.75} />
            <span>Nhập / Xuất kho</span>
          </PrimaryButton>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="catalog-metrics-grid">
        <article className="catalog-metric-card">
          <span className="metric-label">Tổng giá trị tồn kho</span>
          <strong className="metric-value tabular-nums text-[var(--ember)]">{money(totalValue)}</strong>
          <small className="metric-hint">Giá vốn lô hàng</small>
        </article>
        <article className="catalog-metric-card">
          <span className="metric-label">Đủ định mức</span>
          <strong className="metric-value tabular-nums text-[var(--moss)]">{goodCount}</strong>
          <small className="metric-hint">Tồn kho an toàn</small>
        </article>
        <article className="catalog-metric-card">
          <span className="metric-label">Sắp hết hàng</span>
          <strong className="metric-value tabular-nums text-[var(--amber)]">{lowCount}</strong>
          <small className="metric-hint">Cần đặt thêm</small>
        </article>
        <article className="catalog-metric-card">
          <span className="metric-label">Hết hàng</span>
          <strong className="metric-value tabular-nums text-[#8c8177]">{outCount}</strong>
          <small className="metric-hint">Cần nhập gấp</small>
        </article>
      </div>

      {/* Unified Toolbar */}
      <div className="catalog-unified-toolbar">
        <div className="toolbar-left">
          <div className="catalog-search-field">
            <span className="search-icon" aria-hidden="true">
              <IconSearch size={15} stroke={1.75} />
            </span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên nguyên liệu..."
              className="catalog-search-input"
              aria-label="Tìm nguyên liệu"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="search-clear-btn"
                aria-label="Xóa tìm kiếm"
              >
                <IconX size={15} stroke={2} />
              </button>
            )}
          </div>

          <AppSelect
            size="sm"
            items={STATUS_OPTIONS}
            value={status}
            onValueChange={(val) => setStatus(val as typeof status)}
            aria-label="Lọc trạng thái tồn kho"
            triggerClassName="min-w-36 bg-white"
          />

          {(search || status !== 'all') && (
            <SecondaryButton size="sm" onClick={() => { setSearch(''); setStatus('all') }}>
              Đặt lại
            </SecondaryButton>
          )}
        </div>

        <div className="toolbar-right text-xs text-[#8c8177]">
          Hiển thị <strong>{rows.length}</strong> / {ingredients.length} mặt hàng
        </div>
      </div>

      {inventoryQuery.isLoading && <p className="floor-feedback">Đang tải dữ liệu kho…</p>}
      {inventoryQuery.isError && <p className="floor-feedback is-error">{inventoryQuery.error.message}</p>}

      {!inventoryQuery.isLoading && !rows.length && (
        <div className="catalog-empty">
          <p>Không có nguyên liệu phù hợp với bộ lọc.</p>
          <span>Thử xoá bộ lọc hoặc thêm nguyên liệu mới vào hệ thống.</span>
        </div>
      )}

      {/* Inventory Table */}
      {!!rows.length && (
        <div className="catalog-table-wrap">
          <table className="product-mockup-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>NGUYÊN LIỆU</th>
                <th style={{ width: '12%' }}>ĐƠN VỊ</th>
                <th style={{ width: '22%' }} className="text-right">TỒN HIỆN TẠI</th>
                <th style={{ width: '14%' }} className="text-right">NGƯỠNG BÁO</th>
                <th style={{ width: '14%' }} className="text-center">TRẠNG THÁI</th>
                <th style={{ width: '8%' }} className="text-right">THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const isOut = item.currentQuantity <= 0
                const isLow = item.lowStock && !isOut
                return (
                  <tr key={item.id} className="cursor-pointer hover:bg-[#fffbf8]" onClick={() => setSelected(item)}>
                    <td>
                      <div>
                        <strong className="text-sm text-[var(--char)] block">{item.name}</strong>
                        <small className="text-[11px] text-[#8c8177] font-data">Mã: {item.id.slice(0, 8)}</small>
                      </div>
                    </td>
                    <td className="text-xs text-[#61574f] font-medium">{item.unit}</td>
                    <td className="text-right">
                      <span className="font-data font-bold text-sm text-[var(--char)] tabular-nums">
                        {Number(item.currentQuantity).toLocaleString('vi-VN')}
                      </span>
                    </td>
                    <td className="text-right font-data text-xs text-[#8c8177] tabular-nums">
                      {Number(item.reorderPoint).toLocaleString('vi-VN')}
                    </td>
                    <td className="text-center">
                      <span className={cn('catalog-status-pill', isOut ? 'is-inactive' : isLow ? 'text-[var(--amber)]' : 'is-active')}>
                        <span className={cn('catalog-status-dot', isOut ? 'dot-inactive' : isLow ? 'bg-[var(--amber)]' : 'dot-active')} />
                        {isOut ? 'Hết hàng' : isLow ? 'Sắp hết' : 'Đủ hàng'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!canManage}
                          onClick={() => openAdjustment(item)}
                          className="action-edit-btn"
                        >
                          Nhập/Xuất
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

      {/* Movement History Drawer */}
      <Drawer.Root open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <Drawer.Content className="admin-detail-drawer max-w-md">
          <div className="flex items-start justify-between pb-4 border-b border-[#ede6de]">
            <div>
              <p className="eyebrow">CHI TIẾT NGUYÊN LIỆU</p>
              <Drawer.Title className="text-xl font-bold font-display text-[var(--char)]">{selected?.name ?? 'Nguyên liệu'}</Drawer.Title>
            </div>
            <Drawer.Close aria-label="Đóng" className="dialog-close-btn">
              <IconX size={18} stroke={1.75} />
            </Drawer.Close>
          </div>

          {selected && (
            <div className="grid gap-5 mt-4">
              {/* Stat Highlight Card */}
              <div className="p-4 rounded-xl border border-[#e5ddd6] bg-[#fffdfa] flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#8c8177] block">Tồn kho hiện tại</span>
                  <strong className="text-3xl font-data text-[var(--char)]">
                    {Number(selected.currentQuantity).toLocaleString('vi-VN')}
                  </strong>
                  <span className="text-xs text-[#8c8177] ml-1 font-medium">{selected.unit}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#8c8177] block">Ngưỡng cảnh báo</span>
                  <strong className="text-sm font-data text-[#61574f]">
                    {selected.reorderPoint} {selected.unit}
                  </strong>
                </div>
              </div>

              {/* Movement History Feed */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8c8177] mb-3">Lịch sử xuất / nhập kho gần đây</h3>
                {detailQuery.isLoading && <p className="floor-feedback">Đang tải lịch sử…</p>}
                <div className="grid gap-2 max-h-72 overflow-y-auto pr-1">
                  {detailQuery.data?.slice(0, 12).map((movement) => (
                    <div className="flex justify-between items-center p-2.5 rounded-lg border border-[#ede6de] bg-white text-xs" key={movement.id}>
                      <div>
                        <strong className="text-[var(--char)] block">
                          {movement.type === 'receipt' ? 'Nhập kho' : movement.type === 'stocktake' ? 'Kiểm kê' : 'Điều chỉnh'}
                        </strong>
                        <small className="text-[#8c8177]">{movement.reason || 'Không ghi chú'}</small>
                      </div>
                      <div className="text-right">
                        <strong className={cn('font-data block', movement.quantityDelta < 0 ? 'text-[var(--ember)]' : 'text-[var(--moss)]')}>
                          {movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta} {selected.unit}
                        </strong>
                        <small className="text-[#8c8177] text-[10.5px]">
                          {new Date(movement.createdAt).toLocaleDateString('vi-VN')}
                        </small>
                      </div>
                    </div>
                  ))}
                  {!detailQuery.data?.length && !detailQuery.isLoading && (
                    <p className="text-xs text-center py-4 text-[#8c8177]">Chưa có lịch sử phiếu nào.</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ede6de]">
                <SecondaryButton disabled={!canManage} onClick={() => { openIngredient(selected); setSelected(null) }}>
                  Sửa thông tin
                </SecondaryButton>
                <PrimaryButton disabled={!canManage} onClick={() => { openAdjustment(selected); setSelected(null) }} className="flex items-center gap-1.5">
                  <IconArrowsExchange size={16} stroke={1.75} />
                  <span>Nhập / Xuất kho</span>
                </PrimaryButton>
              </div>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Root>

      {/* Ingredient / Adjustment Dialog */}
      <Dialog.Root open={dialog !== null} onOpenChange={(open) => { if (!open) setDialog(null) }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="dialog-backdrop" />
          <Dialog.Viewport className="dialog-viewport">
            <Dialog.Popup className="product-mockup-dialog" style={{ maxWidth: '540px' }}>
              <div className="product-mockup-form">
                <div className="flex items-start justify-between pb-4 border-b border-[#ede6de]">
                  <div>
                    <Dialog.Title className="product-mockup-heading">
                      {dialog === 'ingredient' ? (ingredientDraft.id ? 'Sửa nguyên liệu' : 'Thêm nguyên liệu') : 'Phiếu nhập / xuất kho'}
                    </Dialog.Title>
                    <Dialog.Description className="text-xs text-[#8c8177] mt-1">
                      {dialog === 'ingredient' ? 'Thiết lập tên, đơn vị tính và định mức tồn kho an toàn.' : 'Tạo lô FIFO mới khi nhập hàng hoặc điều chỉnh hao hụt thực tế.'}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close aria-label="Đóng" className="dialog-close-btn">
                    <IconX size={18} stroke={1.75} />
                  </Dialog.Close>
                </div>

                {dialog === 'ingredient' ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      mutation.mutate({ action: 'saveIngredient', ingredient: ingredientDraft })
                    }}
                    className="grid gap-4 mt-4"
                  >
                    <Field.Root>
                      <Field.Label>Tên nguyên liệu *</Field.Label>
                      <Input size="md" required value={ingredientDraft.name} onChange={(event) => setIngredientDraft({ ...ingredientDraft, name: event.target.value })} placeholder="VD: Hạt Robusta Buôn Ma Thuột" className="product-mockup-input" />
                    </Field.Root>
                    <div className="grid grid-cols-2 gap-3">
                      <Field.Root>
                        <Field.Label>Đơn vị tính *</Field.Label>
                        <Input size="md" required value={ingredientDraft.unit} onChange={(event) => setIngredientDraft({ ...ingredientDraft, unit: event.target.value })} placeholder="kg, lít, gói..." className="product-mockup-input" />
                      </Field.Root>
                      <Field.Root>
                        <Field.Label>Ngưỡng cảnh báo</Field.Label>
                        <Input size="md" min="0" type="number" value={ingredientDraft.reorderPoint} onChange={(event) => setIngredientDraft({ ...ingredientDraft, reorderPoint: Number(event.target.value) })} className="product-mockup-input font-data text-right" />
                      </Field.Root>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium select-none">
                      <Checkbox checked={ingredientDraft.active} onCheckedChange={(checked) => setIngredientDraft({ ...ingredientDraft, active: checked === true })} />
                      <span>Nguyên liệu đang sử dụng</span>
                    </label>
                    {mutation.isError && <p className="form-message">{mutation.error.message}</p>}
                    <div className="product-mockup-footer mt-2">
                      <div className="flex items-center justify-end gap-2 w-full">
                        <Dialog.Close className="product-mockup-cancel-btn">Hủy</Dialog.Close>
                        <PrimaryButton disabled={mutation.isPending} type="submit">
                          {mutation.isPending ? 'Đang lưu…' : 'Lưu nguyên liệu'}
                        </PrimaryButton>
                      </div>
                    </div>
                  </form>
                ) : (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      mutation.mutate({
                        action: 'adjust',
                        adjustment: {
                          ...adjustmentDraft,
                          unitCost: adjustmentDraft.type === 'receipt' ? adjustmentDraft.unitCost : undefined,
                          expiresAt: adjustmentDraft.type === 'receipt' ? adjustmentDraft.expiresAt || undefined : undefined,
                        },
                      })
                    }}
                    className="grid gap-4 mt-4"
                  >
                    <Field.Root>
                      <Field.Label>Nguyên liệu *</Field.Label>
                      <AppSelect
                        size="md"
                        items={ingredientOptions}
                        value={adjustmentDraft.ingredientId}
                        onValueChange={(val) => setAdjustmentDraft({ ...adjustmentDraft, ingredientId: val })}
                        placeholder="Chọn nguyên liệu…"
                        triggerClassName="bg-white"
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Loại giao dịch *</Field.Label>
                      <AppSelect
                        size="md"
                        items={ADJUSTMENT_TYPE_OPTIONS}
                        value={adjustmentDraft.type}
                        onValueChange={(val) => setAdjustmentDraft({ ...adjustmentDraft, type: val as typeof adjustmentDraft.type })}
                        triggerClassName="bg-white"
                      />
                    </Field.Root>
                    <div className="grid grid-cols-2 gap-3">
                      <Field.Root>
                        <Field.Label>Số lượng {adjustmentDraft.type === 'receipt' ? 'nhập (+)' : 'thay đổi'} *</Field.Label>
                        <Input size="md" required type="number" step="0.001" value={adjustmentDraft.quantityDelta} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, quantityDelta: Number(event.target.value) })} className="product-mockup-input font-data text-right" />
                      </Field.Root>
                      {adjustmentDraft.type === 'receipt' ? (
                        <Field.Root>
                          <Field.Label>Giá vốn / đơn vị (₫)</Field.Label>
                          <Input size="md" required min="0" type="number" value={adjustmentDraft.unitCost} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, unitCost: Number(event.target.value) })} className="product-mockup-input font-data text-right" />
                        </Field.Root>
                      ) : (
                        <div />
                      )}
                    </div>
                    {adjustmentDraft.type === 'receipt' && (
                      <Field.Root>
                        <Field.Label>Hạn sử dụng</Field.Label>
                        <DatePicker
                          size="md"
                          value={adjustmentDraft.expiresAt}
                          onValueChange={(val) => setAdjustmentDraft({ ...adjustmentDraft, expiresAt: val })}
                          placeholder="Chọn hạn sử dụng (tùy chọn)…"
                          clearable
                          className="bg-white"
                        />
                      </Field.Root>
                    )}
                    <Field.Root>
                      <Field.Label>Lý do giao dịch *</Field.Label>
                      <Input size="md" required value={adjustmentDraft.reason} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, reason: event.target.value })} placeholder="VD: Nhập lô hàng mới từ nhà cung cấp" className="product-mockup-input" />
                    </Field.Root>
                    {mutation.isError && <p className="form-message">{mutation.error.message}</p>}
                    <div className="product-mockup-footer mt-2">
                      <div className="flex items-center justify-end gap-2 w-full">
                        <Dialog.Close className="product-mockup-cancel-btn">Hủy</Dialog.Close>
                        <PrimaryButton disabled={mutation.isPending} type="submit">
                          {mutation.isPending ? 'Đang lưu…' : 'Lưu phiếu giao dịch'}
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
    </section>
  )
}
