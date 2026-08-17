import { Dialog } from '@/components/ui/dialog'
import { Drawer } from '@/components/ui/drawer'
import { NumberField } from '@/components/ui/number-field'
import { AppSelect, type SelectOption } from '@/components/ui/select'
import { PrimaryButton } from '@/components/ui/button'
import { useIsMobile } from '@/lib/use-mobile'
import { useEffect, useMemo, useState } from 'react'
import {
  IconArrowsExchange,
  IconArrowsJoin,
  IconArrowsMove,
  IconCut,
  IconGitMerge,
  IconX,
  IconAlertCircle,
  IconInfoCircle,
  IconArrowRight,
  IconReceipt,
  IconPlus,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'

type DraftLine = { id: string; name: string; variant: string; quantity: number; unitPrice: number; modifiers: { id: string }[] }
export type DraftToolOrder = {
  id: string
  orderCode: string
  version: number
  tableId: string | null
  tableIds?: string[]
  tableNames?: string[]
  total: number
  lines: DraftLine[]
}
export type DraftToolTable = { id: string; name: string; status: string; activeOrderId?: string | null }

type Props = {
  order: DraftToolOrder
  table: DraftToolTable
  tables: DraftToolTable[]
  onReload: (tableId: string) => Promise<void>
  onMoved: (tableId: string) => Promise<void>
  onTableLinked?: (tableIds: string[], tableNames: string[]) => void
  onTableUnlinked?: (tableIds: string[], tableNames: string[]) => void
}

const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)}₫`

export function DraftTools({ order, table, tables, onReload, onMoved, onTableLinked, onTableUnlinked }: Props) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'group' | 'move' | 'split' | 'merge'>('group')
  const [currentOrder, setCurrentOrder] = useState<DraftToolOrder>(order)
  const [targetTableId, setTargetTableId] = useState('')
  const [splitQuantities, setSplitQuantities] = useState<Record<string, number>>({})
  const [otherDrafts, setOtherDrafts] = useState<DraftToolOrder[]>([])
  const [mergeSourceId, setMergeSourceId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  // Sync prop changes
  useEffect(() => {
    setCurrentOrder(order)
  }, [order])

  // Format table name cleanly to avoid "bàn Bàn 5"
  const formattedTableName = table.name.toLowerCase().startsWith('bàn') ? table.name : `Bàn ${table.name}`

  // Current tables in this order (always live from currentOrder)
  const currentTableIds = currentOrder.tableIds ?? (currentOrder.tableId ? [currentOrder.tableId] : [])
  const currentTableNames = currentOrder.tableNames ?? (table ? [table.name] : [])
  const isGrouped = currentTableIds.length > 1
  const totalItemCount = currentOrder.lines.reduce((s, l) => s + l.quantity, 0)

  const moveTargets = useMemo(() => tables.filter((candidate) => candidate.id !== table.id && candidate.status !== 'dat_truoc'), [table.id, tables])

  // Linkable tables: empty (trong), not already in this order
  const linkableTargets = useMemo(() =>
    tables.filter((t) => !currentTableIds.includes(t.id) && t.status === 'trong'),
    [tables, currentTableIds]
  )

  const mergeDraftOptions: SelectOption[] = useMemo(() => [
    { value: '', label: 'Chọn ticket nguồn…' },
    ...otherDrafts.map((draft) => ({ value: draft.id, label: `#${draft.orderCode} · ${money(draft.total)}` })),
  ], [otherDrafts])

  // On modal open: fetch fresh draft from server to get latest version & active lines
  useEffect(() => {
    if (!open) return
    setTargetTableId(moveTargets[0]?.id ?? '')
    setSplitQuantities({})
    setMergeSourceId('')
    setMessage('')
    void fetch(`/api/orders/drafts?tableId=${encodeURIComponent(table.id)}`)
      .then(async (response) => response.ok ? response.json() as Promise<{ orders: DraftToolOrder[] }> : { orders: [] })
      .then((body) => {
        const found = body.orders.find((o) => o.id === order.id)
        if (found) {
          setCurrentOrder(found)
        }
        setOtherDrafts(body.orders.filter((draft) => draft.id !== order.id))
      })
  }, [open, order.id, table.id, moveTargets])

  async function mutate(body: unknown) {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/orders/drafts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json().catch(() => ({})) as { message?: string }
      if (!response.ok) throw new Error(result.message ?? 'Không thể cập nhật ticket.')
      return result
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể cập nhật ticket.')
      throw error
    } finally {
      setBusy(false)
    }
  }

  async function move() {
    if (!targetTableId) return
    await mutate({ action: 'move', orderId: currentOrder.id, expectedVersion: currentOrder.version, tableId: targetTableId })
    setOpen(false)
    await onMoved(targetTableId)
  }

  async function merge() {
    const source = otherDrafts.find((draft) => draft.id === mergeSourceId)
    if (!source) return
    await mutate({ action: 'merge', sourceOrderId: source.id, sourceVersion: source.version, targetOrderId: currentOrder.id, targetVersion: currentOrder.version })
    await onReload(table.id)
    setOpen(false)
  }

  async function split() {
    const lines = currentOrder.lines.map((line) => ({ lineId: line.id, quantity: splitQuantities[line.id] ?? 0 })).filter((line) => line.quantity > 0)
    if (!lines.length) { setMessage('Chọn ít nhất một món để tách.'); return }
    await mutate({ action: 'split', orderId: currentOrder.id, expectedVersion: currentOrder.version, newIdempotencyKey: crypto.randomUUID(), lines })
    await onReload(table.id)
    setOpen(false)
  }

  async function linkTable(tableIdToLink: string) {
    if (!tableIdToLink) return
    try {
      const result = await mutate({ action: 'linkTable', orderId: currentOrder.id, expectedVersion: currentOrder.version, tableId: tableIdToLink }) as { version?: number; tableIds?: string[]; tableNames?: string[] }
      if (result.version) {
        setCurrentOrder((prev) => ({
          ...prev,
          version: result.version!,
          tableIds: result.tableIds ?? prev.tableIds,
          tableNames: result.tableNames ?? prev.tableNames,
        }))
      }
      if (result.tableIds && result.tableNames) onTableLinked?.(result.tableIds, result.tableNames)
    } catch {}
  }

  async function unlinkTable(tableId: string) {
    try {
      const result = await mutate({ action: 'unlinkTable', orderId: currentOrder.id, expectedVersion: currentOrder.version, tableId }) as { version?: number; tableIds?: string[]; tableNames?: string[] }
      if (result.version) {
        setCurrentOrder((prev) => ({
          ...prev,
          version: result.version!,
          tableIds: result.tableIds ?? prev.tableIds,
          tableNames: result.tableNames ?? prev.tableNames,
        }))
      }
      if (result.tableIds && result.tableNames) onTableUnlinked?.(result.tableIds, result.tableNames)
    } catch {}
  }

  // Count items being split
  const totalSplitCount = Object.values(splitQuantities).reduce((acc, v) => acc + (v || 0), 0)
  const totalSplitAmount = currentOrder.lines.reduce((acc, line) => {
    const qty = splitQuantities[line.id] || 0
    return acc + qty * line.unitPrice
  }, 0)

  const toolContent = (
    <div className="flex flex-col gap-4">
      {/* Segmented Navigation Tab Bar - Icon on top, text below, centered */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-[#ede4d8] rounded-xl">
        <button
          type="button"
          onClick={() => setActiveTab('group')}
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-2 px-1 text-center rounded-lg transition-all cursor-pointer select-none relative',
            activeTab === 'group'
              ? 'bg-white text-[var(--char)] shadow-xs font-extrabold'
              : 'text-[#6b5d52] hover:text-[var(--char)] font-bold'
          )}
        >
          <div className="relative flex items-center justify-center">
            <IconArrowsJoin size={18} stroke={2.2} />
            {isGrouped && (
              <span className="absolute -top-1 -right-3 size-3.5 rounded-full bg-amber-500 text-white text-[8.5px] font-black flex items-center justify-center">
                {currentTableIds.length}
              </span>
            )}
          </div>
          <span className="text-[11px] sm:text-xs leading-tight whitespace-nowrap">Gộp bàn</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('move')}
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-2 px-1 text-center rounded-lg transition-all cursor-pointer select-none',
            activeTab === 'move'
              ? 'bg-white text-[var(--char)] shadow-xs font-extrabold'
              : 'text-[#6b5d52] hover:text-[var(--char)] font-bold'
          )}
        >
          <IconArrowsMove size={18} stroke={2.2} />
          <span className="text-[11px] sm:text-xs leading-tight whitespace-nowrap">Chuyển bàn</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('split')}
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-2 px-1 text-center rounded-lg transition-all cursor-pointer select-none',
            activeTab === 'split'
              ? 'bg-white text-[var(--char)] shadow-xs font-extrabold'
              : 'text-[#6b5d52] hover:text-[var(--char)] font-bold'
          )}
        >
          <IconCut size={18} stroke={2.2} />
          <span className="text-[11px] sm:text-xs leading-tight whitespace-nowrap">Tách đơn</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('merge')}
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-2 px-1 text-center rounded-lg transition-all cursor-pointer select-none relative',
            activeTab === 'merge'
              ? 'bg-white text-[var(--char)] shadow-xs font-extrabold'
              : 'text-[#6b5d52] hover:text-[var(--char)] font-bold'
          )}
        >
          <div className="relative flex items-center justify-center">
            <IconGitMerge size={18} stroke={2.2} />
            {otherDrafts.length > 0 && (
              <span className="absolute -top-1 -right-3 size-3.5 rounded-full bg-[var(--ember)] text-white text-[8.5px] font-black flex items-center justify-center">
                {otherDrafts.length}
              </span>
            )}
          </div>
          <span className="text-[11px] sm:text-xs leading-tight whitespace-nowrap">Gộp đơn</span>
        </button>
      </div>

      {/* Tab 1: Gộp bàn (Table Grouping) */}
      {activeTab === 'group' && (
        <div className="flex flex-col gap-4 animate-in fade-in-50 duration-150">
          {/* Active Tables in this order */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[var(--char)] whitespace-nowrap">
                Bàn đang gắn vào đơn ({currentTableIds.length})
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 whitespace-nowrap">
                1 đơn dùng chung
              </span>
            </div>

            <div className="flex flex-wrap gap-2 p-3 bg-white rounded-xl border border-[#e5ddd3]">
              {currentTableIds.map((id, idx) => {
                const name = currentTableNames[idx] ?? id
                const isPrimary = idx === 0
                return (
                  <div
                    key={id}
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap transition-all',
                      isPrimary
                        ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-2xs'
                        : 'bg-[#faf7f2] border-[#ded4c8] text-[var(--char)]'
                    )}
                  >
                    <span>{name}</span>
                    {isPrimary ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-200 text-amber-900 whitespace-nowrap">
                        Chính
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void unlinkTable(id)}
                        className="size-4.5 rounded-full bg-[#e8dfd4] hover:bg-rose-100 hover:text-rose-700 text-[#7a6f64] flex items-center justify-center transition-colors cursor-pointer"
                        title={`Bớt bàn ${name} khỏi đơn`}
                      >
                        <IconX size={11} stroke={2.5} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick-add Empty Tables */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-[var(--char)] flex items-center gap-1.5 whitespace-nowrap">
              <IconPlus size={13} stroke={2.5} className="text-emerald-600 shrink-0" />
              Thêm bàn trống vào nhóm
            </span>

            {linkableTargets.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {linkableTargets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void linkTable(t.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-900 border border-[#ded5cb] text-xs font-bold text-[var(--char)] shadow-2xs whitespace-nowrap transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <IconPlus size={13} stroke={2.5} className="text-emerald-600 shrink-0" />
                    <span>{t.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#8c8177] italic p-3 bg-white rounded-xl border border-[#ede5db] text-center">
                Không còn bàn trống nào khác để gộp thêm.
              </p>
            )}
          </div>

          <p className="text-[11.5px] text-[#8c8177] leading-relaxed flex items-start gap-1.5 pt-2 border-t border-[#f0e8dc]">
            <IconInfoCircle size={14} className="shrink-0 text-amber-600 mt-0.5" />
            <span>
              {isGrouped
                ? 'Khách ngồi nhiều bàn dùng chung 1 hóa đơn tính tiền. Bấm ✕ để bớt bàn phụ.'
                : 'Bấm chọn một bàn trống phía trên để ghép chung vào đơn này.'}
            </span>
          </p>
        </div>
      )}

      {/* Tab 2: Chuyển bàn (Move Table) */}
      {activeTab === 'move' && (
        <div className="flex flex-col gap-4 animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-[#e5ddd3] shadow-2xs">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-[#8c8177] whitespace-nowrap">Bàn hiện tại</span>
              <span className="text-sm font-bold text-[var(--char)] whitespace-nowrap">{formattedTableName}</span>
            </div>
            <IconArrowRight size={18} className="text-[#a19588] shrink-0" stroke={2} />
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase font-bold text-[#8c8177] whitespace-nowrap">Bàn đích đến</span>
              <span className="text-sm font-bold text-amber-800 whitespace-nowrap">
                {moveTargets.find((t) => t.id === targetTableId)?.name || 'Chưa chọn'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-[var(--char)] whitespace-nowrap">Chọn bàn chuyển đến:</span>
            <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto p-1">
              {moveTargets.map((t) => {
                const isSelected = targetTableId === t.id
                const isEmpty = t.status === 'trong'
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTargetTableId(t.id)}
                    className={cn(
                      'px-3.5 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition-all cursor-pointer text-left flex items-center gap-2',
                      isSelected
                        ? 'bg-[var(--espresso)] text-[var(--crema)] border-[var(--espresso)] shadow-xs scale-[1.02]'
                        : isEmpty
                        ? 'bg-white hover:bg-[#faf7f2] border-[#ded5cb] text-[var(--char)]'
                        : 'bg-[#faf6f0] border-[#e8dfd5] text-[#8c8177]'
                    )}
                  >
                    <span>{t.name}</span>
                    <span className={cn(
                      'text-[9.5px] px-1.5 py-0.2 rounded font-semibold whitespace-nowrap',
                      isSelected
                        ? 'bg-white/20 text-white'
                        : isEmpty
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    )}>
                      {isEmpty ? 'Trống' : 'Có khách'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <PrimaryButton
            size="md"
            disabled={busy || !targetTableId || targetTableId === table.id}
            onClick={() => void move()}
            className="w-full flex items-center justify-center gap-2 mt-1"
          >
            <IconArrowsMove size={15} stroke={2.2} className="shrink-0" />
            <span className="whitespace-nowrap">Xác nhận chuyển sang {moveTargets.find((t) => t.id === targetTableId)?.name || 'bàn mới'}</span>
          </PrimaryButton>
        </div>
      )}

      {/* Tab 3: Tách ticket (Split Ticket) */}
      {activeTab === 'split' && (
        <div className="flex flex-col gap-3 animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[var(--char)] whitespace-nowrap">
              Chọn số lượng món cần tách:
            </span>
            {currentOrder.lines.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const next: Record<string, number> = {}
                  currentOrder.lines.forEach((l) => { next[l.id] = l.quantity })
                  setSplitQuantities(next)
                }}
                className="text-xs font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer whitespace-nowrap"
              >
                Tách tất cả
              </button>
            )}
          </div>

          <div className="divide-y divide-[#f0e8dc] max-h-[220px] overflow-y-auto bg-white rounded-xl border border-[#e5ddd3] p-1 px-3">
            {currentOrder.lines.map((line) => {
              const qty = splitQuantities[line.id] ?? 0
              return (
                <div key={line.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-[var(--char)] truncate">{line.name}</span>
                    <span className="text-[11px] text-[#8c8177] whitespace-nowrap">
                      {line.variant} · {money(line.unitPrice)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <NumberField.Root
                      min={0}
                      max={line.quantity}
                      value={qty}
                      onValueChange={(val) => setSplitQuantities((prev) => ({ ...prev, [line.id]: Math.min(line.quantity, Math.max(0, val ?? 0)) }))}
                    >
                      <NumberField.Group className="min-h-7.5 h-7.5 border-[#d9d0c8] bg-[#faf7f2] rounded-lg">
                        <NumberField.Decrement className="min-w-7 px-1.5 text-xs" />
                        <NumberField.Input className="w-8 text-center font-mono font-bold text-xs p-0" aria-label={`Số lượng tách ${line.name}`} />
                        <NumberField.Increment className="min-w-7 px-1.5 text-xs" />
                      </NumberField.Group>
                    </NumberField.Root>
                    <span className="text-[11px] font-mono text-[#8c8177] w-10 text-right whitespace-nowrap">
                      / {line.quantity}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Split Summary Bar */}
          <div className="p-3 rounded-xl bg-[#faf7f2] border border-[#ede5db] flex items-center justify-between text-xs">
            <span className="text-[#7a6f64] whitespace-nowrap">
              Tách: <strong className="text-[var(--char)]">{totalSplitCount}</strong> món
            </span>
            <span className="font-mono font-bold text-[var(--ember)] whitespace-nowrap">
              {money(totalSplitAmount)}
            </span>
          </div>

          <PrimaryButton
            size="md"
            disabled={busy || totalSplitCount === 0}
            onClick={() => void split()}
            className="w-full flex items-center justify-center gap-2"
          >
            <IconCut size={15} stroke={2.2} className="shrink-0" />
            <span className="whitespace-nowrap">Tạo ticket mới ({totalSplitCount} món)</span>
          </PrimaryButton>
        </div>
      )}

      {/* Tab 4: Gộp ticket (Merge Tickets) */}
      {activeTab === 'merge' && (
        <div className="flex flex-col gap-4 animate-in fade-in-50 duration-150">
          {otherDrafts.length > 0 ? (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-[var(--char)] whitespace-nowrap">
                  Chọn ticket cùng bàn để gộp vào ticket này:
                </span>
                <AppSelect
                  size="md"
                  items={mergeDraftOptions}
                  value={mergeSourceId}
                  onValueChange={(val) => setMergeSourceId(val)}
                  placeholder="Chọn ticket nguồn…"
                  triggerClassName="bg-white"
                />
              </div>

              <p className="text-xs text-[#8c8177] leading-relaxed">
                Tất cả các món từ ticket nguồn sẽ được dồn vào ticket hiện tại và ticket nguồn sẽ tự động đóng lại.
              </p>

              <PrimaryButton
                size="md"
                disabled={busy || !mergeSourceId}
                onClick={() => void merge()}
                className="w-full flex items-center justify-center gap-2"
              >
                <IconGitMerge size={15} stroke={2.2} className="shrink-0" />
                <span className="whitespace-nowrap">Xác nhận gộp ticket</span>
              </PrimaryButton>
            </>
          ) : (
            <div className="py-8 px-4 text-center flex flex-col items-center gap-2 bg-white rounded-xl border border-[#e5ddd3]">
              <div className="size-11 rounded-full bg-[#f5ede1] flex items-center justify-center text-[#9c8e7e]">
                <IconReceipt size={22} stroke={1.8} />
              </div>
              <strong className="text-xs font-bold text-[var(--char)] whitespace-nowrap">Không có ticket khác cùng bàn</strong>
              <p className="text-[11.5px] text-[#8c8177] max-w-xs leading-relaxed">
                Bàn này hiện chỉ có 1 ticket đang mở.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error / Alert message */}
      {message && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 animate-in fade-in duration-150" role="alert">
          <IconAlertCircle size={15} className="shrink-0 text-rose-600" />
          <span>{message}</span>
        </div>
      )}
    </div>
  )

  return (
    <>
      <button
        className="ticket-tools-button inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#ded6cc] bg-white hover:bg-[#faf7f2] hover:border-[#c5bcaf] text-xs font-bold text-[var(--char)] shadow-2xs whitespace-nowrap transition-all cursor-pointer"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        <IconArrowsExchange size={14} stroke={2.2} className="text-[#8c8177] shrink-0" />
        <span className="whitespace-nowrap">Quản lý bàn</span>
      </button>

      {open && (
        isMobile ? (
          <Drawer.Root open={open} onOpenChange={setOpen}>
            <Drawer.Content direction="bottom" className="w-full max-h-[92dvh] p-0 bg-[#fffdfa] rounded-t-3xl border-t border-[#ded1c0]">
              {/* Centered Clean Header - 2 lines, no wrapping conflict */}
              <Drawer.Header className="px-5 pt-4 pb-3 border-b border-[#ede6de] text-center">
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <Drawer.Title className="text-lg font-bold text-[var(--char)] font-[var(--font-display)] tracking-tight">
                    Quản lý {formattedTableName}
                  </Drawer.Title>
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#f5ede2] border border-[#e6dbc9] text-xs font-medium text-[#6b5d52] whitespace-nowrap">
                    <span className="font-mono font-bold text-[var(--char)]">#{currentOrder.orderCode}</span>
                    <span>·</span>
                    <span className="font-mono font-bold text-[var(--ember)]">{money(currentOrder.total)}</span>
                    <span>·</span>
                    <span>{totalItemCount} món</span>
                  </div>
                </div>
              </Drawer.Header>
              <Drawer.Body className="px-5 py-4 overflow-y-auto">
                {toolContent}
              </Drawer.Body>
              <Drawer.Footer className="px-5 pt-2 pb-5 border-t border-[#ede6de] bg-[#fcfaf7]">
                <Drawer.Close className="w-full py-2.5 rounded-xl border border-[#d9d0c8] bg-white font-bold text-xs text-[var(--char)] shadow-2xs cursor-pointer hover:bg-[#f7f2eb] whitespace-nowrap">
                  Đóng
                </Drawer.Close>
              </Drawer.Footer>
            </Drawer.Content>
          </Drawer.Root>
        ) : (
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Portal>
              <Dialog.Backdrop className="fixed inset-0 z-50 bg-[#1c1512]/60 backdrop-blur-xs transition-opacity" />
              <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
                <Dialog.Popup className="relative w-full max-w-md rounded-2xl bg-[#fffdfa] p-5 sm:p-6 text-[var(--char)] shadow-2xl border border-[#ded1c0] outline-hidden animate-in fade-in-0 zoom-in-95 duration-150">
                  {/* Centered Clean Header - 2 lines, no wrapping conflict */}
                  <div className="flex flex-col items-center justify-center text-center mb-4 gap-1.5">
                    <Dialog.Title className="text-xl font-extrabold text-[var(--char)] font-[var(--font-display)] tracking-tight">
                      Quản lý {formattedTableName}
                    </Dialog.Title>
                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#f5ede2] border border-[#e6dbc9] text-xs font-medium text-[#6b5d52] whitespace-nowrap">
                      <span className="font-mono font-bold text-[var(--char)]">#{currentOrder.orderCode}</span>
                      <span>·</span>
                      <span className="font-mono font-bold text-[var(--ember)]">{money(currentOrder.total)}</span>
                      <span>·</span>
                      <span>{totalItemCount} món</span>
                    </div>
                  </div>

                  {toolContent}

                  {/* Centered Close Button at bottom */}
                  <div className="flex items-center justify-center mt-4 pt-3 border-t border-[#ede6de]">
                    <Dialog.Close className="w-full py-2.5 rounded-xl border border-[#ded6cc] bg-white hover:bg-[#f7f2eb] text-xs font-bold text-[var(--char)] shadow-2xs transition-all cursor-pointer text-center whitespace-nowrap">
                      Đóng
                    </Dialog.Close>
                  </div>
                </Dialog.Popup>
              </Dialog.Viewport>
            </Dialog.Portal>
          </Dialog.Root>
        )
      )}
    </>
  )
}
