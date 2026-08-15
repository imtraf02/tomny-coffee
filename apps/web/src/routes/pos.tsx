import { Dialog } from '@/components/ui/dialog'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { AppHeader } from '../components/AppHeader'
import { deviceId, enqueueCheckout, pendingCheckouts, syncOutbox } from '../client/outbox'
import { readSession } from '../server/session'

type MenuItem = { id: string; name: string; detail: string; price: number; category: 'Cà phê' | 'Trà' | 'Đá xay' }
type OrderItem = MenuItem & { quantity: number }
type TableStatus = 'trong' | 'dang_phuc_vu' | 'dat_truoc' | 'can_don'
type OperationalTable = { id: string; zoneId: string | null; name: string; capacity: number; shape: 'square' | 'round'; status: TableStatus }
type FloorPlan = { zones: { id: string; name: string }[]; tables: OperationalTable[] }

const menu: MenuItem[] = [
  { id: 'latte', name: 'Latte', detail: 'Double shot · nóng', price: 55000, category: 'Cà phê' },
  { id: 'bac-xiu', name: 'Bạc xỉu', detail: 'Cà phê sữa · đá', price: 42000, category: 'Cà phê' },
  { id: 'americano', name: 'Americano', detail: 'Single origin · đá', price: 45000, category: 'Cà phê' },
  { id: 'peach-tea', name: 'Trà đào', detail: 'Đào vàng · cam sả', price: 49000, category: 'Trà' },
  { id: 'matcha', name: 'Matcha latte', detail: 'Uji matcha · sữa tươi', price: 62000, category: 'Trà' },
  { id: 'coco', name: 'Coco freeze', detail: 'Dừa · cà phê · kem', price: 59000, category: 'Đá xay' },
]

const formatMoney = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + '₫'

export const Route = createFileRoute('/pos')({
  beforeLoad: async ({ location }) => {
    const user = await readSession()
    if (!user) throw redirect({ to: '/login', search: { next: location.pathname } })
    return { user }
  },
  component: Pos,
})

function Pos() {
  const [category, setCategory] = useState<'Tất cả' | MenuItem['category']>('Tất cả')
  const [items, setItems] = useState<OrderItem[]>([])
  const [paid, setPaid] = useState(false)
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [paymentMessage, setPaymentMessage] = useState('')
  const [lastPaidTotal, setLastPaidTotal] = useState(0)
  const [orderContext, setOrderContext] = useState<'counter' | 'takeaway' | 'table'>('counter')
  const [selectedTable, setSelectedTable] = useState<OperationalTable | null>(null)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const floorPlan = useQuery({
    queryKey: ['floor-plan'],
    queryFn: async (): Promise<FloorPlan> => {
      const response = await fetch('/api/floor-plan')
      if (!response.ok) throw new Error('Không tải được sơ đồ bàn.')
      return response.json() as Promise<FloorPlan>
    },
  })
  const visibleMenu = category === 'Tất cả' ? menu : menu.filter((item) => item.category === category)
  const total = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items])
  const selectedZone = selectedZoneId ?? floorPlan.data?.zones[0]?.id ?? null
  const tablesInZone = floorPlan.data?.tables.filter((table) => table.zoneId === selectedZone) ?? []

  useEffect(() => {
    const refresh = async () => { setOnline(navigator.onLine); setPending((await pendingCheckouts()).length); if (navigator.onLine) setPending((await syncOutbox()).length) }
    void refresh()
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    return () => { window.removeEventListener('online', refresh); window.removeEventListener('offline', refresh) }
  }, [])

  function addItem(item: MenuItem) {
    setItems((current) => {
      const existing = current.find((line) => line.id === item.id)
      return existing ? current.map((line) => line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { ...item, quantity: 1 }]
    })
  }

  function changeQuantity(id: string, change: number) {
    setItems((current) => current.flatMap((line) => line.id === id ? (line.quantity + change > 0 ? [{ ...line, quantity: line.quantity + change }] : []) : [line]))
  }

  async function completeCashPayment() {
    if (!items.length) return
    const idempotencyKey = crypto.randomUUID()
    const payload = {
      idempotencyKey,
      orderCode: `POS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${idempotencyKey.slice(0, 8).toUpperCase()}`,
      deviceId: deviceId(), source: orderContext, tableId: selectedTable?.id,
      receivedAmount: total,
      lines: items.map((item) => ({ id: crypto.randomUUID(), name: item.name, variant: item.detail, unitPrice: item.price, quantity: item.quantity, recipeSnapshot: [] })),
    }
    if (!navigator.onLine) {
      await enqueueCheckout(payload)
      setPending((await pendingCheckouts()).length)
      setLastPaidTotal(total); setPaymentMessage('Đơn đã thu tiền và đang chờ đồng bộ.')
      setItems([]); setSelectedTable(null); setOrderContext('counter'); setPaid(true)
      return
    }
    try {
      const response = await fetch('/api/orders/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      if (!response.ok) {
        const body = await response.json().catch(() => ({ message: 'Không thể ghi nhận đơn.' })) as { message?: string }
        throw new Error(body.message ?? 'Không thể ghi nhận đơn.')
      }
      setLastPaidTotal(total); setPaymentMessage('Đơn đã thanh toán và hoàn tất.')
      setItems([]); setSelectedTable(null); setOrderContext('counter'); setPaid(true)
    } catch (error) {
      await enqueueCheckout(payload)
      setPending((await pendingCheckouts()).length)
      setLastPaidTotal(total); setPaymentMessage(error instanceof Error ? `${error.message} Đơn đã được xếp hàng đồng bộ.` : 'Đơn đã được xếp hàng đồng bộ.')
      setItems([]); setSelectedTable(null); setOrderContext('counter'); setPaid(true)
    }
  }

  return (
    <div className="pos-screen">
      <AppHeader area="POS" />
      <main className="pos-main">
        <section className="menu-pane" aria-labelledby="pos-title">
          <div className="pos-title-row"><div><p className="eyebrow">QUẦY THU NGÂN</p><h1 id="pos-title">Đơn mới <span className="order-code">#T-0248</span></h1></div><p className="sync-state"><span className={online ? 'online-dot' : 'offline-dot'} />{online ? 'Đang online' : 'Đang offline'} · {pending} đơn chờ đồng bộ</p></div>
          <section className="table-operation" aria-labelledby="service-context-title">
            <div className="table-operation-head"><div><p className="eyebrow">NGỮ CẢNH PHỤC VỤ</p><h2 id="service-context-title">{selectedTable ? `Bàn ${selectedTable.name}` : orderContext === 'takeaway' ? 'Mang đi' : 'Tại quầy'}</h2></div><span className="table-operation-note">Chọn bàn để mở đơn phục vụ tại bàn</span></div>
            <div className="context-controls" aria-label="Loại đơn">
              <button className={orderContext === 'counter' ? 'context-button is-active' : 'context-button'} onClick={() => { setOrderContext('counter'); setSelectedTable(null) }}>Tại quầy</button>
              <button className={orderContext === 'takeaway' ? 'context-button is-active' : 'context-button'} onClick={() => { setOrderContext('takeaway'); setSelectedTable(null) }}>Mang đi</button>
            </div>
            {floorPlan.isLoading && <p className="floor-feedback">Đang tải sơ đồ bàn…</p>}
            {floorPlan.isError && <p className="floor-feedback is-error">Không tải được sơ đồ bàn. Vẫn có thể tạo đơn tại quầy hoặc mang đi.</p>}
            {!!floorPlan.data?.zones.length && <>
              <div className="zone-tabs" aria-label="Khu vực bàn">
                {floorPlan.data.zones.map((zone) => <button key={zone.id} className={selectedZone === zone.id ? 'zone-tab is-selected' : 'zone-tab'} onClick={() => setSelectedZoneId(zone.id)}>{zone.name}</button>)}
              </div>
              {tablesInZone.length ? <div className="table-grid" aria-label="Các bàn trong khu vực">
                {tablesInZone.map((table) => <button key={table.id} disabled={table.status === 'dat_truoc'} className={`table-tile is-${table.status} ${selectedTable?.id === table.id ? 'is-selected' : ''} ${table.shape === 'round' ? 'is-round' : ''}`} onClick={() => { setSelectedTable(table); setOrderContext('table') }}>
                  <strong>{table.name}</strong><span>{table.capacity} chỗ</span><em>{tableStatusLabel(table.status)}</em>
                </button>)}
              </div> : <p className="floor-feedback">Khu vực này chưa có bàn. Thêm bàn trong Quản trị.</p>}
            </>}
          </section>
          <div className="category-tabs" aria-label="Danh mục món">
            {(['Tất cả', 'Cà phê', 'Trà', 'Đá xay'] as const).map((name) => <button key={name} onClick={() => setCategory(name)} className={category === name ? 'category-tab is-selected' : 'category-tab'}>{name}</button>)}
          </div>
          <div className="menu-grid">
            {visibleMenu.map((item) => <button key={item.id} className="menu-button" onClick={() => addItem(item)}><span className="menu-name">{item.name}</span><span className="menu-detail">{item.detail}</span><span className="menu-price">{formatMoney(item.price)}</span></button>)}
          </div>
        </section>
        <aside className="order-pane" aria-label="Đơn hàng hiện tại">
          <div className="ticket-card order-ticket">
            <div className="ticket-head"><div><p className="eyebrow">{selectedTable ? `ĐƠN BÀN ${selectedTable.name.toUpperCase()}` : orderContext === 'takeaway' ? 'ĐƠN MANG ĐI' : 'ĐƠN TẠI QUẦY'}</p><strong className="order-code">#T-0248</strong></div><span className="status-badge">Chưa thanh toán</span></div>
            <div className="ticket-lines">
              {items.length === 0 ? <p className="empty-order">Chưa có món nào<br /><span>Chọn món từ danh sách bên trái</span></p> : items.map((item) => <div className="order-line" key={item.id}><div><strong>{item.name}</strong><span>{formatMoney(item.price)}</span></div><div className="quantity-control"><button onClick={() => changeQuantity(item.id, -1)} aria-label={`Bớt một ${item.name}`}>−</button><span>{item.quantity}</span><button onClick={() => changeQuantity(item.id, 1)} aria-label={`Thêm một ${item.name}`}>+</button></div><b>{formatMoney(item.price * item.quantity)}</b></div>)}
            </div>
            <div className="ticket-total"><span>Tổng tiền</span><strong>{formatMoney(total)}</strong></div>
          </div>
          <Dialog.Root open={paid} onOpenChange={setPaid}>
            <button disabled={!items.length} className="pay-button" onClick={() => void completeCashPayment()}>Thanh toán tiền mặt <span>{formatMoney(total)}</span></button>
            <Dialog.Portal><Dialog.Backdrop className="dialog-backdrop" /><Dialog.Viewport className="dialog-viewport"><Dialog.Popup className="payment-dialog print-receipt"><p className="eyebrow">TOMNY COFFEE · ĐÃ GHI NHẬN</p><Dialog.Title>Thanh toán thành công</Dialog.Title><Dialog.Description>{paymentMessage}</Dialog.Description><div className="payment-total">{formatMoney(lastPaidTotal)}</div><div className="dialog-actions"><button className="print-button" onClick={() => window.print()}>In hóa đơn</button><Dialog.Close className="dialog-close" onClick={() => setPaid(false)}>Tạo đơn mới</Dialog.Close></div></Dialog.Popup></Dialog.Viewport></Dialog.Portal>
          </Dialog.Root>
          <p className="payment-note">Tiền mặt · chừa chỗ mở rộng phương thức thanh toán sau này</p>
        </aside>
      </main>
    </div>
  )
}

function tableStatusLabel(status: TableStatus) {
  return { trong: 'Trống', dang_phuc_vu: 'Đang phục vụ', dat_truoc: 'Đặt trước', can_don: 'Cần dọn' }[status]
}
