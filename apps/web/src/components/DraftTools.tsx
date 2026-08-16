import { Dialog } from '@/components/ui/dialog'
import { NumberField } from '@/components/ui/number-field'
import { AppSelect, type SelectOption } from '@/components/ui/select'
import { SecondaryButton } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { useEffect, useMemo, useState } from 'react'
import {
  IconArrowsExchange,
  IconArrowsMove,
  IconCut,
  IconGitMerge,
} from '@tabler/icons-react'

type DraftLine = { id: string; name: string; variant: string; quantity: number; unitPrice: number; modifiers: { id: string }[] }
export type DraftToolOrder = { id: string; orderCode: string; version: number; tableId: string | null; total: number; lines: DraftLine[] }
export type DraftToolTable = { id: string; name: string; status: string }

type Props = {
  order: DraftToolOrder
  table: DraftToolTable
  tables: DraftToolTable[]
  onReload: (tableId: string) => Promise<void>
  onMoved: (tableId: string) => Promise<void>
}

const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)}₫`

export function DraftTools({ order, table, tables, onReload, onMoved }: Props) {
  const [open, setOpen] = useState(false)
  const [targetTableId, setTargetTableId] = useState('')
  const [splitQuantities, setSplitQuantities] = useState<Record<string, number>>({})
  const [otherDrafts, setOtherDrafts] = useState<DraftToolOrder[]>([])
  const [mergeSourceId, setMergeSourceId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const moveTargets = useMemo(() => tables.filter((candidate) => candidate.id !== table.id && candidate.status !== 'dat_truoc'), [table.id, tables])
  const moveTargetOptions: SelectOption[] = useMemo(() => [
    { value: '', label: 'Chọn bàn…' },
    ...moveTargets.map((candidate) => ({ value: candidate.id, label: candidate.name })),
  ], [moveTargets])

  const mergeDraftOptions: SelectOption[] = useMemo(() => [
    { value: '', label: 'Chọn ticket…' },
    ...otherDrafts.map((draft) => ({ value: draft.id, label: `${draft.orderCode} · ${money(draft.total)}` })),
  ], [otherDrafts])

  useEffect(() => {
    if (!open) return
    setTargetTableId(moveTargets[0]?.id ?? '')
    setSplitQuantities({})
    setMergeSourceId('')
    setMessage('')
    void fetch(`/api/orders/drafts?tableId=${encodeURIComponent(table.id)}`)
      .then(async (response) => response.ok ? response.json() as Promise<{ orders: DraftToolOrder[] }> : { orders: [] })
      .then((body) => setOtherDrafts(body.orders.filter((draft) => draft.id !== order.id)))
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
    await mutate({ action: 'move', orderId: order.id, expectedVersion: order.version, tableId: targetTableId })
    setOpen(false)
    await onMoved(targetTableId)
  }

  async function merge() {
    const source = otherDrafts.find((draft) => draft.id === mergeSourceId)
    if (!source) return
    await mutate({ action: 'merge', sourceOrderId: source.id, sourceVersion: source.version, targetOrderId: order.id, targetVersion: order.version })
    await onReload(table.id)
    setOpen(false)
  }

  async function split() {
    const lines = order.lines.map((line) => ({ lineId: line.id, quantity: splitQuantities[line.id] ?? 0 })).filter((line) => line.quantity > 0)
    if (!lines.length) { setMessage('Chọn ít nhất một món để tách.'); return }
    await mutate({ action: 'split', orderId: order.id, expectedVersion: order.version, newIdempotencyKey: crypto.randomUUID(), lines })
    await onReload(table.id)
    setOpen(false)
  }

  return (
    <>
      <button className="ticket-tools-button flex items-center gap-1" disabled={busy} onClick={() => setOpen(true)}>
        <IconArrowsExchange size={14} stroke={2} />
        <span>Quản lý ticket</span>
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="dialog-backdrop" />
          <Dialog.Viewport className="dialog-viewport">
            <Dialog.Popup className="editor-dialog draft-tools-dialog">
              <Dialog.Title>Quản lý bàn {table.name}</Dialog.Title>
              <Dialog.Description>Di chuyển, tách hoặc gộp ticket đang mở. Mọi thao tác đều được ghi audit.</Dialog.Description>

              <section className="draft-tool-section">
                <h3>Di chuyển ticket</h3>
                <Field.Root>
                  <Field.Label>Bàn đích</Field.Label>
                  <AppSelect
                    size="md"
                    items={moveTargetOptions}
                    value={targetTableId}
                    onValueChange={(val) => setTargetTableId(val)}
                    placeholder="Chọn bàn…"
                  />
                </Field.Root>
                <SecondaryButton size="sm" disabled={busy || !targetTableId} onClick={() => void move()} className="flex items-center gap-1.5">
                  <IconArrowsMove size={14} stroke={2} />
                  <span>Di chuyển sang bàn</span>
                </SecondaryButton>
              </section>

              <section className="draft-tool-section">
                <h3>Tách ticket</h3>
                <p className="draft-tool-help">Nhập số lượng muốn chuyển sang ticket mới. Giá topping được giữ nguyên.</p>
                {order.lines.map((line) => (
                  <label className="draft-line-select" key={line.id}>
                    <span>
                      {line.name} · {line.variant}{line.modifiers.length ? ` · ${line.modifiers.length} topping` : ''}
                      <small>{money(line.unitPrice)} / món · tối đa {line.quantity}</small>
                    </span>
                    <NumberField.Root
                      min={0}
                      max={line.quantity}
                      value={splitQuantities[line.id] ?? null}
                      onValueChange={(value) => setSplitQuantities((current) => ({ ...current, [line.id]: Math.min(line.quantity, Math.max(0, value ?? 0)) }))}
                    >
                      <NumberField.Group>
                        <NumberField.Decrement />
                        <NumberField.Input aria-label={`Số lượng tách ${line.name}`} />
                        <NumberField.Increment />
                      </NumberField.Group>
                    </NumberField.Root>
                  </label>
                ))}
                <SecondaryButton size="sm" disabled={busy || !order.lines.length} onClick={() => void split()} className="flex items-center gap-1.5">
                  <IconCut size={14} stroke={2} />
                  <span>Tách ticket mới</span>
                </SecondaryButton>
              </section>

              <section className="draft-tool-section">
                <h3>Gộp ticket cùng bàn</h3>
                {otherDrafts.length ? (
                  <>
                    <Field.Root>
                      <Field.Label>Ticket nguồn</Field.Label>
                      <AppSelect
                        size="md"
                        items={mergeDraftOptions}
                        value={mergeSourceId}
                        onValueChange={(val) => setMergeSourceId(val)}
                        placeholder="Chọn ticket…"
                      />
                    </Field.Root>
                    <SecondaryButton size="sm" disabled={busy || !mergeSourceId} onClick={() => void merge()} className="flex items-center gap-1.5">
                      <IconGitMerge size={14} stroke={2} />
                      <span>Gộp vào ticket này</span>
                    </SecondaryButton>
                  </>
                ) : (
                  <p className="draft-tool-help">Bàn này không có ticket khác để gộp.</p>
                )}
              </section>

              {message && <p className="form-message" role="alert">{message}</p>}

              <div className="dialog-actions">
                <Dialog.Close className="print-button">Đóng</Dialog.Close>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
