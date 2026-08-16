import { AlertDialog } from '@/components/ui/alert-dialog'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Button, PrimaryButton, SecondaryButton } from '@/components/ui/button'
import { AppSelect, type SelectOption } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  IconPlus,
  IconSearch,
  IconX,
  IconLayoutGrid,
  IconList,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react'

type TableStatus = 'trong' | 'dang_phuc_vu' | 'dat_truoc' | 'can_don'
type Zone = { id: string; name: string; sortOrder: number }
type CafeTable = { id: string; zoneId: string | null; zoneName: string | null; name: string; note: string; sortOrder: number; status: TableStatus; storedStatus: TableStatus }
type TableData = { zones: Zone[]; tables: CafeTable[] }
type Editor = { kind: 'zone' | 'table'; item?: Zone | CafeTable }

const statusLabel: Record<TableStatus, string> = {
  trong: 'Trống',
  dang_phuc_vu: 'Đang phục vụ',
  dat_truoc: 'Đặt trước',
  can_don: 'Cần dọn',
}

const statusDotClass: Record<TableStatus, string> = {
  trong: 'bg-[#22c55e]',
  dang_phuc_vu: 'bg-[#ef4444]',
  dat_truoc: 'bg-[#f59e0b]',
  can_don: 'bg-[#9ca3af]',
}

const STATUS_FILTER_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Trạng thái: Tất cả' },
  { value: 'trong', label: 'Trống' },
  { value: 'dang_phuc_vu', label: 'Đang phục vụ' },
  { value: 'dat_truoc', label: 'Đặt trước' },
  { value: 'can_don', label: 'Cần dọn' },
]

const STATUS_OVERRIDE_OPTIONS: SelectOption[] = [
  { value: 'auto', label: 'Tự động theo đơn hàng POS' },
  { value: 'dat_truoc', label: 'Đặt trước' },
  { value: 'can_don', label: 'Cần dọn' },
]

async function getTables(): Promise<TableData> {
  const response = await fetch('/api/floor-plan')
  const body = await response.json().catch(() => ({})) as TableData & { message?: string }
  if (!response.ok) throw new Error(body.message ?? 'Không tải được danh sách bàn.')
  return body
}

async function sendTableUpdate(body: unknown) {
  const response = await fetch('/api/floor-plan', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json().catch(() => ({})) as { message?: string }
  if (!response.ok) throw new Error(result.message ?? 'Không thể lưu thay đổi.')
}

async function sendTableAction(body: unknown) {
  const response = await fetch('/api/floor-plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json().catch(() => ({})) as { message?: string }
  if (!response.ok) throw new Error(result.message ?? 'Không thể cập nhật bàn.')
}

export function TableManagementWorkspace({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['floor-plan'], queryFn: getTables })
  const [search, setSearch] = useState('')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<TableStatus | 'all'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Editor | null>(null)
  const [message, setMessage] = useState('')

  const zones = query.data?.zones ?? []
  const zoneFilterOptions: SelectOption[] = useMemo(() => [
    { value: 'all', label: 'Khu vực: Tất cả' },
    ...zones.map((z) => ({ value: z.id, label: z.name })),
  ], [zones])

  const tables = useMemo(() => (query.data?.tables ?? []).filter((table) => {
    const needle = search.trim().toLocaleLowerCase('vi-VN')
    return (!needle || `${table.name} ${table.zoneName ?? ''}`.toLocaleLowerCase('vi-VN').includes(needle))
      && (zoneFilter === 'all' || table.zoneId === zoneFilter)
      && (statusFilter === 'all' || table.status === statusFilter)
  }), [query.data?.tables, search, statusFilter, zoneFilter])

  const metrics = useMemo(() => ({
    total: query.data?.tables.length ?? 0,
    trong: query.data?.tables.filter((item) => item.status === 'trong').length ?? 0,
    dang_phuc_vu: query.data?.tables.filter((item) => item.status === 'dang_phuc_vu').length ?? 0,
    dat_truoc: query.data?.tables.filter((item) => item.status === 'dat_truoc').length ?? 0,
  }), [query.data?.tables])

  const refresh = async (success: string) => {
    await queryClient.invalidateQueries({ queryKey: ['floor-plan'] })
    setMessage(success)
  }

  async function archive() {
    if (!deleteTarget?.item) return
    try {
      await sendTableAction({ action: deleteTarget.kind === 'zone' ? 'archiveZone' : 'archiveTable', id: deleteTarget.item.id })
      setDeleteTarget(null)
      await refresh(deleteTarget.kind === 'zone' ? 'Đã xóa khu vực.' : 'Đã xóa bàn.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể xóa.')
    }
  }

  return (
    <section className="table-workspace grid gap-5">
      {/* Header */}
      <div className="catalog-header-row">
        <div>
          <h2 className="catalog-main-title">Sơ đồ & Danh sách bàn</h2>
          <p className="catalog-main-sub">Quản lý các khu vực ngồi, bố trí bàn và theo dõi trạng thái phục vụ thời gian thực.</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <SecondaryButton size="md" onClick={() => setEditor({ kind: 'zone' })} className="flex items-center gap-1.5">
              <IconPlus size={16} stroke={2} />
              <span>Khu vực</span>
            </SecondaryButton>
            <PrimaryButton size="md" onClick={() => setEditor({ kind: 'table' })} disabled={!zones.length} className="flex items-center gap-1.5">
              <IconPlus size={16} stroke={2} />
              <span>Thêm bàn</span>
            </PrimaryButton>
          </div>
        )}
      </div>

      {/* KPI Metrics */}
      <div className="catalog-metrics-grid">
        <article className="catalog-metric-card">
          <span className="metric-label">Tổng số bàn</span>
          <strong className="metric-value tabular-nums">{metrics.total}</strong>
          <small className="metric-hint">{zones.length} khu vực</small>
        </article>
        <article className="catalog-metric-card">
          <span className="metric-label">Bàn trống</span>
          <strong className="metric-value tabular-nums text-[var(--moss)]">{metrics.trong}</strong>
          <small className="metric-hint">Sẵn sàng nhận khách</small>
        </article>
        <article className="catalog-metric-card">
          <span className="metric-label">Đang phục vụ</span>
          <strong className="metric-value tabular-nums text-[var(--ember)]">{metrics.dang_phuc_vu}</strong>
          <small className="metric-hint">Có đơn đang mở</small>
        </article>
        <article className="catalog-metric-card">
          <span className="metric-label">Đặt trước / Cần dọn</span>
          <strong className="metric-value tabular-nums text-[var(--amber)]">{metrics.dat_truoc}</strong>
          <small className="metric-hint">Cần chuẩn bị</small>
        </article>
      </div>

      {message && <p className="form-message success-message" role="status">{message}</p>}

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
              placeholder="Tìm tên bàn hoặc khu vực..."
              className="catalog-search-input"
              aria-label="Tìm bàn"
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
            items={zoneFilterOptions}
            value={zoneFilter}
            onValueChange={(val) => setZoneFilter(val)}
            aria-label="Lọc theo khu vực"
            triggerClassName="min-w-36 bg-white"
          />

          <AppSelect
            size="sm"
            items={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val as TableStatus | 'all')}
            aria-label="Lọc theo trạng thái"
            triggerClassName="min-w-36 bg-white"
          />

          {(search || zoneFilter !== 'all' || statusFilter !== 'all') && (
            <SecondaryButton size="sm" onClick={() => { setSearch(''); setZoneFilter('all'); setStatusFilter('all') }}>
              Đặt lại
            </SecondaryButton>
          )}
        </div>

        {/* View Mode Switcher */}
        <div className="toolbar-right flex items-center gap-1 bg-[#ede6de] p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={cn('px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5', viewMode === 'grid' ? 'bg-white shadow-sm text-[var(--char)]' : 'text-[#8c8177] hover:text-[var(--char)]')}
          >
            <IconLayoutGrid size={14} stroke={1.75} />
            <span>Sơ đồ ô</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={cn('px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5', viewMode === 'table' ? 'bg-white shadow-sm text-[var(--char)]' : 'text-[#8c8177] hover:text-[var(--char)]')}
          >
            <IconList size={14} stroke={1.75} />
            <span>Danh sách</span>
          </button>
        </div>
      </div>

      {query.isLoading && <p className="floor-feedback">Đang tải danh sách bàn…</p>}
      {query.isError && <p className="floor-feedback is-error">{query.error.message}</p>}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid gap-6">
          {zones.map((zone) => {
            const zoneTables = tables.filter((t) => t.zoneId === zone.id)
            if (zoneFilter !== 'all' && zone.id !== zoneFilter) return null
            return (
              <div key={zone.id} className="p-4 border border-[#e5ddd6] rounded-xl bg-[#fffdfa]">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#ede6de]">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-[var(--char)]">{zone.name}</h3>
                    <span className="text-xs font-data text-[#8c8177]">({zoneTables.length} bàn)</span>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => setEditor({ kind: 'zone', item: zone })}>
                        Sửa khu vực
                      </Button>
                      <Button variant="secondary" size="sm" className="text-[var(--ember)]" onClick={() => setDeleteTarget({ kind: 'zone', item: zone })}>
                        Xóa
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {zoneTables.map((table) => (
                    <div
                      key={table.id}
                      className="p-3 bg-white border border-[#ede6de] rounded-xl flex flex-col justify-between min-h-24 hover:border-[var(--stone)] transition-all shadow-xs"
                    >
                      <div className="flex justify-between items-start">
                        <strong className="text-sm text-[var(--char)]">{table.name}</strong>
                        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0 mt-1', statusDotClass[table.status])} />
                      </div>
                      <div>
                        <span className="text-[11px] text-[#8c8177] block truncate">{table.note || statusLabel[table.status]}</span>
                        {canManage && (
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-[#f4ede6]">
                            <button
                              type="button"
                              onClick={() => setEditor({ kind: 'table', item: table })}
                              className="text-[11px] font-semibold text-[#61574f] hover:underline"
                            >
                              Sửa
                            </button>
                            <span className="text-[10px] text-[#ccc]">·</span>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ kind: 'table', item: table })}
                              className="text-[11px] font-semibold text-[var(--ember)] hover:underline"
                            >
                              Xóa
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {!zoneTables.length && (
                    <p className="col-span-full py-4 text-xs text-center text-[#8c8177]">Chưa có bàn nào trong khu vực này.</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="catalog-table-wrap">
          <table className="product-mockup-table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>TÊN BÀN</th>
                <th style={{ width: '20%' }}>KHU VỰC</th>
                <th style={{ width: '20%' }}>TRẠNG THÁI</th>
                <th style={{ width: '20%' }}>GHI CHÚ</th>
                {canManage && <th style={{ width: '15%' }} className="text-right">THAO TÁC</th>}
              </tr>
            </thead>
            <tbody>
              {!tables.length ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-[#8c8177]">Không có bàn nào phù hợp.</td>
                </tr>
              ) : (
                tables.map((table) => (
                  <tr key={table.id}>
                    <td>
                      <strong className="text-sm text-[var(--char)]">{table.name}</strong>
                    </td>
                    <td className="text-xs text-[#61574f]">{table.zoneName ?? 'Chưa phân khu'}</td>
                    <td>
                      <span className="catalog-status-pill">
                        <span className={cn('catalog-status-dot', statusDotClass[table.status])} />
                        {statusLabel[table.status]}
                      </span>
                    </td>
                    <td className="text-xs text-[#8c8177]">{table.note || '—'}</td>
                    {canManage && (
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="secondary" size="sm" onClick={() => setEditor({ kind: 'table', item: table })} className="action-edit-btn flex items-center gap-1">
                            <IconPencil size={13} stroke={2} />
                            <span>Sửa</span>
                          </Button>
                          <Button variant="secondary" size="sm" className="action-edit-btn text-[var(--ember)] flex items-center gap-1" onClick={() => setDeleteTarget({ kind: 'table', item: table })}>
                            <IconTrash size={13} stroke={2} />
                            <span>Xóa</span>
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Table & Zone Editor Dialog */}
      {editor && (
        <TableEditor
          editor={editor}
          zones={zones}
          onClose={() => setEditor(null)}
          onSave={async (body, success) => {
            try {
              if (editor.item) await sendTableUpdate(body)
              else await sendTableAction(body)
              setEditor(null)
              await refresh(success)
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Không thể lưu thay đổi.')
            }
          }}
        />
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog.Root open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="dialog-backdrop" />
          <AlertDialog.Viewport className="dialog-viewport">
            <AlertDialog.Popup className="product-mockup-dialog" style={{ maxWidth: '440px' }}>
              <div className="product-mockup-form">
                <AlertDialog.Title className="product-mockup-heading">
                  Xóa {deleteTarget?.kind === 'zone' ? 'khu vực' : 'bàn'}?
                </AlertDialog.Title>
                <AlertDialog.Description className="text-xs text-[#8c8177] mt-2">
                  {deleteTarget?.kind === 'zone'
                    ? 'Khu vực chỉ có thể xóa khi không còn bàn nào bên trong.'
                    : 'Thao tác này sẽ xóa bàn khỏi hệ thống. Bàn đang có đơn hàng mở sẽ không thể xóa.'}
                </AlertDialog.Description>
                <div className="flex items-center justify-end gap-2 mt-6">
                  <AlertDialog.Close className="product-mockup-cancel-btn">Hủy</AlertDialog.Close>
                  <Button variant="danger" size="md" onClick={() => void archive()}>
                    Xác nhận xóa
                  </Button>
                </div>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  )
}

function TableEditor({
  editor,
  zones,
  onClose,
  onSave,
}: {
  editor: Editor
  zones: Zone[]
  onClose: () => void
  onSave: (body: unknown, message: string) => Promise<void>
}) {
  const isZone = editor.kind === 'zone'
  const isEditing = Boolean(editor.item)
  const [zoneDraft, setZoneDraft] = useState({
    id: (editor.item as Zone | undefined)?.id ?? '',
    name: (editor.item as Zone | undefined)?.name ?? '',
    sortOrder: (editor.item as Zone | undefined)?.sortOrder ?? zones.length + 1,
  })
  const [tableDraft, setTableDraft] = useState({
    id: (editor.item as CafeTable | undefined)?.id ?? '',
    zoneId: (editor.item as CafeTable | undefined)?.zoneId ?? zones[0]?.id ?? '',
    name: (editor.item as CafeTable | undefined)?.name ?? '',
    note: (editor.item as CafeTable | undefined)?.note ?? '',
    sortOrder: (editor.item as CafeTable | undefined)?.sortOrder ?? 1,
    statusOverride: (editor.item as CafeTable | undefined)?.storedStatus === 'trong' ? 'auto' : (editor.item as CafeTable | undefined)?.storedStatus ?? 'auto',
  })
  const [saving, setSaving] = useState(false)

  const zoneSelectOptions: SelectOption[] = zones.map((z) => ({ value: z.id, label: z.name }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      if (isZone) {
        if (isEditing) {
          await onSave({ action: 'updateZone', ...zoneDraft }, 'Đã cập nhật khu vực.')
        } else {
          await onSave({ action: 'createZone', ...zoneDraft }, 'Đã tạo khu vực mới.')
        }
      } else {
        if (isEditing) {
          await onSave({ action: 'updateTable', ...tableDraft, status: tableDraft.statusOverride }, 'Đã cập nhật bàn.')
        } else {
          await onSave({ action: 'createTable', ...tableDraft, shape: 'square', status: tableDraft.statusOverride }, 'Đã tạo bàn mới.')
        }
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        <Dialog.Viewport className="dialog-viewport">
          <Dialog.Popup className="product-mockup-dialog" style={{ maxWidth: '480px' }}>
            <div className="product-mockup-form">
              <div className="flex items-start justify-between pb-4 border-b border-[#ede6de]">
                <div>
                  <Dialog.Title className="product-mockup-heading">
                    {isZone ? (isEditing ? 'Sửa khu vực' : 'Thêm khu vực mới') : (isEditing ? 'Sửa bàn' : 'Thêm bàn mới')}
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-[#8c8177] mt-1">
                    {isZone ? 'Thiết lập tên khu vực như Tầng 1, Tầng 2, Sân vườn...' : 'Gán bàn vào khu vực và thiết lập trạng thái ghi đè.'}
                  </Dialog.Description>
                </div>
                <Dialog.Close aria-label="Đóng" className="dialog-close-btn">
                  <IconX size={18} stroke={1.75} />
                </Dialog.Close>
              </div>

              <form onSubmit={(e) => void submit(e)} className="grid gap-4 mt-4">
                {isZone ? (
                  <>
                    <Field.Root>
                      <Field.Label>Tên khu vực *</Field.Label>
                      <Input size="md" required value={zoneDraft.name} onChange={(e) => setZoneDraft({ ...zoneDraft, name: e.target.value })} placeholder="VD: Sân vườn ngoài trời" className="product-mockup-input" />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Thứ tự hiển thị</Field.Label>
                      <Input size="md" type="number" value={zoneDraft.sortOrder} onChange={(e) => setZoneDraft({ ...zoneDraft, sortOrder: Number(e.target.value) })} className="product-mockup-input font-data" />
                    </Field.Root>
                  </>
                ) : (
                  <>
                    <Field.Root>
                      <Field.Label>Khu vực *</Field.Label>
                      <AppSelect
                        size="md"
                        items={zoneSelectOptions}
                        value={tableDraft.zoneId}
                        onValueChange={(val) => setTableDraft({ ...tableDraft, zoneId: val })}
                        triggerClassName="bg-white"
                      />
                    </Field.Root>
                    <div className="grid grid-cols-2 gap-3">
                      <Field.Root>
                        <Field.Label>Tên / Số bàn *</Field.Label>
                        <Input size="md" required value={tableDraft.name} onChange={(e) => setTableDraft({ ...tableDraft, name: e.target.value })} placeholder="VD: Bàn 01" className="product-mockup-input" />
                      </Field.Root>
                      <Field.Root>
                        <Field.Label>Thứ tự hiển thị</Field.Label>
                        <Input size="md" type="number" value={tableDraft.sortOrder} onChange={(e) => setTableDraft({ ...tableDraft, sortOrder: Number(e.target.value) })} className="product-mockup-input font-data" />
                      </Field.Root>
                    </div>
                    <Field.Root>
                      <Field.Label>Trạng thái khởi tạo</Field.Label>
                      <AppSelect
                        size="md"
                        items={STATUS_OVERRIDE_OPTIONS}
                        value={tableDraft.statusOverride}
                        onValueChange={(val) => setTableDraft({ ...tableDraft, statusOverride: val })}
                        triggerClassName="bg-white"
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Ghi chú bàn</Field.Label>
                      <Input size="md" value={tableDraft.note} onChange={(e) => setTableDraft({ ...tableDraft, note: e.target.value })} placeholder="VD: Gần cửa sổ, có ổ điện" className="product-mockup-input" />
                    </Field.Root>
                  </>
                )}

                <div className="product-mockup-footer mt-2">
                  <div className="flex items-center justify-end gap-2 w-full">
                    <Dialog.Close className="product-mockup-cancel-btn">Hủy</Dialog.Close>
                    <PrimaryButton disabled={saving} type="submit">
                      {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
                    </PrimaryButton>
                  </div>
                </div>
              </form>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
