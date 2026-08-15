import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCoreRowModel, useReactTable, flexRender, type ColumnDef } from '@tanstack/react-table'
import { Dialog } from '@/components/ui/dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectItemIndicator,
} from '@/components/ui/select'
import { useEffect, useMemo, useState } from 'react'
import { AppHeader } from '../components/AppHeader'
import { FloorCanvas, type FloorTableStatus } from '../components/FloorCanvas'
import { autoLayoutPositions, type FloorPosition } from '../core/floor-layout'
import { readSession } from '../server/session'

type InventoryRow = { ingredient: string; stock: string; status: 'Còn hàng' | 'Sắp hết'; lot: string }
type TableStatus = FloorTableStatus
type CafeTable = { id: string; zoneId: string | null; name: string; capacity: number; shape: 'square' | 'round'; status: TableStatus; storedStatus: TableStatus; posX: number; posY: number }
type FloorPlan = { zones: { id: string; name: string }[]; tables: CafeTable[] }
type TableUpdate = { id: string; status?: TableStatus; posX?: number; posY?: number }

const inventory: InventoryRow[] = [
  { ingredient: 'Cà phê hạt', stock: '8,5 kg', status: 'Còn hàng', lot: 'Lô 12 · 23/08' },
  { ingredient: 'Sữa tươi', stock: '14 hộp', status: 'Còn hàng', lot: 'Lô 08 · 19/08' },
  { ingredient: 'Đào vàng', stock: '2 hộp', status: 'Sắp hết', lot: 'Lô 04 · 17/08' },
]
const columns: ColumnDef<InventoryRow>[] = [
  { accessorKey: 'ingredient', header: 'Nguyên liệu' },
  { accessorKey: 'stock', header: 'Tồn hiện tại', cell: ({ getValue }) => <span className="data-cell">{String(getValue())}</span> },
  { accessorKey: 'lot', header: 'Lô FIFO tiếp theo' },
  { accessorKey: 'status', header: 'Trạng thái', cell: ({ getValue }) => <span className={`status-badge ${getValue() === 'Sắp hết' ? 'warning-badge' : 'success-badge'}`}>{String(getValue())}</span> },
]

async function getFloorPlan(): Promise<FloorPlan> {
  const response = await fetch('/api/floor-plan')
  if (!response.ok) throw new Error('Không tải được sơ đồ bàn.')
  return response.json() as Promise<FloorPlan>
}

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ location }) => {
    const user = await readSession()
    if (!user) throw redirect({ to: '/login', search: { next: location.pathname } })
    return { user }
  },
  component: Admin,
})

function Admin() {
  const [section, setSection] = useState<'overview' | 'inventory' | 'floor' | 'staff' | 'reports'>('overview')
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [editorDialog, setEditorDialog] = useState<'zone' | 'table' | null>(null)
  const [newName, setNewName] = useState('')
  const [newCapacity, setNewCapacity] = useState(4)
  const [newShape, setNewShape] = useState<'square' | 'round'>('square')
  const table = useReactTable({ data: inventory, columns, getCoreRowModel: getCoreRowModel() })
  const queryClient = useQueryClient()
  const floorPlan = useQuery({ queryKey: ['floor-plan'], queryFn: getFloorPlan, enabled: section === 'floor' })
  const updateTables = useMutation({
    mutationFn: async ({ tables }: { tables: TableUpdate[] }) => {
      const response = await fetch('/api/floor-plan', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tables }) })
      if (!response.ok) throw new Error('Không thể lưu sơ đồ bàn.')
    },
    onMutate: async ({ tables }) => {
      await queryClient.cancelQueries({ queryKey: ['floor-plan'] })
      const previous = queryClient.getQueryData<FloorPlan>(['floor-plan'])
      queryClient.setQueryData<FloorPlan>(['floor-plan'], (current) => current ? { ...current, tables: current.tables.map((table) => ({ ...table, ...(tables.find((update) => update.id === table.id) ?? {}) })) } : current)
      return { previous }
    },
    onError: (_error, _input, context) => { if (context?.previous) queryClient.setQueryData(['floor-plan'], context.previous) },
    onSettled: async () => { await queryClient.invalidateQueries({ queryKey: ['floor-plan'] }) },
  })
  const createItem = useMutation({
    mutationFn: async (body: unknown) => {
      const response = await fetch('/api/floor-plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error((await response.json().catch(() => ({ message: '' })) as { message?: string }).message || 'Không thể tạo dữ liệu sơ đồ.')
    },
    onSuccess: async () => { setEditorDialog(null); setNewName(''); await queryClient.invalidateQueries({ queryKey: ['floor-plan'] }) },
  })
  const selectedZone = selectedZoneId ?? floorPlan.data?.zones[0]?.id ?? null
  const zoneTables = useMemo(() => floorPlan.data?.tables.filter((item) => item.zoneId === selectedZone) ?? [], [floorPlan.data, selectedZone])
  const selectedTable = zoneTables.find((item) => item.id === selectedTableId) ?? zoneTables[0] ?? null

  useEffect(() => {
    if (!selectedTableId && zoneTables[0]) setSelectedTableId(zoneTables[0].id)
  }, [selectedTableId, zoneTables])

  return <div className="admin-screen"><AppHeader area="Quản trị" /><main className="admin-main">
    <div className="admin-title"><div><p className="eyebrow">QUẢN LÝ VẬN HÀNH</p><h1>{section === 'overview' ? 'Vận hành quán' : { inventory: 'Kho & nguyên liệu', floor: 'Editor sơ đồ bàn', staff: 'Nhân viên & lương', reports: 'Báo cáo' }[section]}</h1></div><button className="secondary-button">Xuất báo cáo</button></div>
    <div className="admin-tabs" role="tablist" aria-label="Khu vực quản trị">{([['overview', 'Tổng quan'], ['inventory', 'Kho'], ['floor', 'Bàn'], ['staff', 'Nhân viên'], ['reports', 'Báo cáo']] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={section === key} onClick={() => setSection(key)} className={section === key ? 'admin-tab is-active' : 'admin-tab'}>{label}</button>)}</div>
    {section === 'overview' && <section className="metric-grid"><article><span>Doanh thu</span><strong>4.860.000₫</strong><small>+8,4% so với hôm qua</small></article><article><span>Đơn đã bán</span><strong>116</strong><small>Giá trị TB 41.900₫</small></article><article><span>Biên gộp</span><strong>64,2%</strong><small>Trong ngưỡng mục tiêu</small></article></section>}
    {section === 'inventory' && <section className="admin-table-section"><div className="section-title"><div><h2>Tồn kho cần theo dõi</h2><p>FIFO được tính theo từng lô nhập</p></div><button className="ember-button">Nhập lô mới</button></div><table><thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table></section>}
    {section === 'floor' && <section className="admin-table-section floor-editor"><div className="section-title"><div><h2>Editor sơ đồ bàn</h2><p>Kéo bàn đến đúng vị trí mặt bằng. Vị trí tự lưu khi thả; POS sẽ dùng cùng sơ đồ này.</p></div><div className="editor-actions"><button className="secondary-button" onClick={() => setEditorDialog('zone')}>Thêm zone</button><button className="secondary-button" disabled={!zoneTables.length || updateTables.isPending} onClick={() => updateTables.mutate({ tables: zoneTables.map((item) => ({ id: item.id, ...autoLayoutPositions(zoneTables).get(item.id)! })) })}>Sắp xếp tự động</button><button className="ember-button" disabled={!floorPlan.data?.zones.length} onClick={() => setEditorDialog('table')}>Thêm bàn</button></div></div>
      {floorPlan.isLoading && <p className="floor-feedback">Đang tải dữ liệu bàn…</p>}
      {floorPlan.isError && <div className="floor-feedback is-error">Không tải được dữ liệu bàn. Kiểm tra quyền <span className="data-cell">floor_plan.read</span> rồi tải lại.</div>}
      {floorPlan.data && <div className="floor-editor-content"><div><div className="zone-tabs" aria-label="Chọn zone để chỉnh sửa">{floorPlan.data.zones.map((zone) => <button key={zone.id} className={selectedZone === zone.id ? 'zone-tab is-selected' : 'zone-tab'} onClick={() => { setSelectedZoneId(zone.id); setSelectedTableId(null) }}>{zone.name}</button>)}</div>
        {zoneTables.length ? <FloorCanvas tables={zoneTables} selectedTableId={selectedTable?.id} editable label="Sơ đồ bàn có thể chỉnh sửa" onSelect={(item) => setSelectedTableId(item.id)} onPositionChange={(item, position: FloorPosition) => updateTables.mutate({ tables: [{ id: item.id, ...position }] })} /> : <p className="floor-feedback">Zone này chưa có bàn. Thêm bàn để bắt đầu sắp xếp mặt bằng.</p>}
        {updateTables.isPending && <p className="floor-feedback">Đang lưu vị trí bàn…</p>}{updateTables.isError && <p className="floor-feedback is-error">Không thể lưu sơ đồ. Vị trí bàn đã được trả về trạng thái trước đó — kiểm tra kết nối rồi thử lại.</p>}</div>
        {selectedTable && <aside className="table-editor-panel"><p className="eyebrow">BÀN ĐANG CHỌN</p><h3>{selectedTable.name}</h3><p>{selectedTable.capacity} chỗ · {selectedTable.shape === 'round' ? 'Bàn tròn' : 'Bàn vuông'}</p><p className="table-coordinate">X {selectedTable.posX.toFixed(1)}% · Y {selectedTable.posY.toFixed(1)}%</p><small>Kéo thả theo ô lưới 5%; khi focus bàn, dùng mũi tên để dịch chuyển 5%, giữ Shift để dịch 10%.</small><label className="block text-xs font-bold uppercase tracking-wider text-[#8c8177] mt-5 mb-1.5">Trạng thái thủ công</label><Select value={selectedTable.storedStatus === 'dang_phuc_vu' ? 'trong' : selectedTable.storedStatus} disabled={updateTables.isPending} onValueChange={(val) => { if (val) updateTables.mutate({ tables: [{ id: selectedTable.id, status: val as TableStatus }] }) }}><SelectTrigger className="w-full bg-white"><SelectValue placeholder="Chọn trạng thái..." /><SelectIcon /></SelectTrigger><SelectContent><SelectItem value="trong"><SelectItemText>Theo đơn (tự động)</SelectItemText><SelectItemIndicator /></SelectItem><SelectItem value="dat_truoc"><SelectItemText>Đặt trước</SelectItemText><SelectItemIndicator /></SelectItem><SelectItem value="can_don"><SelectItemText>Cần dọn</SelectItemText><SelectItemIndicator /></SelectItem></SelectContent></Select><small className="block mt-2">“Đặt trước” và “Cần dọn” tạm ghi đè trạng thái tự động. Bỏ override để trạng thái theo đơn mở.</small>{updateTables.isError && <p className="form-message">Không thể lưu trạng thái. Kiểm tra kết nối rồi thử lại.</p>}</aside>}
      </div>}
      <Dialog.Root open={editorDialog !== null} onOpenChange={(open) => { if (!open) { setEditorDialog(null); setNewName('') } }}><Dialog.Portal><Dialog.Backdrop className="dialog-backdrop" /><Dialog.Viewport className="dialog-viewport"><Dialog.Popup className="editor-dialog"><Dialog.Title>{editorDialog === 'zone' ? 'Thêm zone mới' : 'Thêm bàn mới'}</Dialog.Title><Dialog.Description>{editorDialog === 'zone' ? 'Ví dụ: Tầng 1 hoặc Sân vườn.' : 'Bàn sẽ xuất hiện trong lưới vận hành POS của zone đã chọn.'}</Dialog.Description><form onSubmit={(event) => { event.preventDefault(); if (!newName.trim()) return; if (editorDialog === 'zone') createItem.mutate({ action: 'createZone', name: newName.trim() }); else if (selectedZone) createItem.mutate({ action: 'createTable', zoneId: selectedZone, name: newName.trim(), capacity: newCapacity, shape: newShape }) }}><label htmlFor="new-floor-name">{editorDialog === 'zone' ? 'Tên zone' : 'Tên bàn'}<input id="new-floor-name" autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} /></label>{editorDialog === 'table' && <div className="editor-form-grid"><label htmlFor="new-table-capacity">Sức chứa<input id="new-table-capacity" min="1" max="30" type="number" value={newCapacity} onChange={(event) => setNewCapacity(Number(event.target.value))} /></label><div><label className="block text-xs font-bold uppercase tracking-wider text-[#8c8177] mb-1.5">Hình dạng</label><Select value={newShape} onValueChange={(val) => { if (val) setNewShape(val as 'square' | 'round') }}><SelectTrigger className="w-full bg-white"><SelectValue placeholder="Chọn hình dạng" /><SelectIcon /></SelectTrigger><SelectContent><SelectItem value="square"><SelectItemText>Vuông</SelectItemText><SelectItemIndicator /></SelectItem><SelectItem value="round"><SelectItemText>Tròn</SelectItemText><SelectItemIndicator /></SelectItem></SelectContent></Select></div></div>} {createItem.isError && <p className="form-message">{createItem.error.message}</p>}<div className="dialog-actions"><Dialog.Close className="print-button" type="button">Đóng</Dialog.Close><button className="ember-button" disabled={createItem.isPending} type="submit">{editorDialog === 'zone' ? 'Tạo zone' : 'Tạo bàn'}</button></div></form></Dialog.Popup></Dialog.Viewport></Dialog.Portal></Dialog.Root>
    </section>}
    {section === 'staff' && <section className="admin-table-section empty-module"><h2>Nhân viên, permission và lương theo giờ</h2><p>Thêm nhân viên qua invite, cấp từng quyền theo action, chấm công vào/ra và chốt payroll theo kỳ.</p><button className="ember-button">Mời nhân viên</button></section>}
    {section === 'reports' && <section className="admin-table-section empty-module"><h2>Báo cáo ngày dương lịch Việt Nam</h2><p>Doanh thu tiền mặt, discount, COGS, tồn kho, giờ công và payroll sẽ xuất XLSX hoặc PDF theo khoảng ngày.</p><button className="ember-button">Chọn khoảng ngày</button></section>}
  </main></div>
}
