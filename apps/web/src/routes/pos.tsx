import { Dialog } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs } from '@/components/ui/tabs'
import { Drawer } from '@/components/ui/drawer'
import { AppSelect, type SelectOption } from '@/components/ui/select'
import { Button, PrimaryButton, SecondaryButton } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconSearch,
  IconX,
  IconCoffee,
  IconPlus,
  IconMinus,
  IconCash,
  IconPrinter,
  IconCheck,
  IconReceipt,
  IconToolsKitchen2,
  IconClock,
  IconPlayerPlay,
  IconCircleCheck,
  IconHistory,
  IconAlertCircle,
} from '@tabler/icons-react'
import { DraftTools } from '../components/draft-tools'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cacheCatalog, cachedCatalog, deviceId, syncOutbox, type CatalogCategory, type CatalogCombo, type CatalogModifierGroup, type CatalogProduct, type CatalogVariant } from '../client/outbox'
import { calculateTotal } from '../core/money'
import { readSession } from '../server/session'

type OrderItem = { id: string; menuItemId: string; variantId: string; name: string; variant: string; price: number; quantity: number; modifierIds: string[]; modifiers?: Array<{ id: string; name: string; priceDelta?: number }> }
type TableStatus = 'trong' | 'dang_phuc_vu' | 'dat_truoc' | 'can_don'
type OperationalTable = { id: string; zoneId: string | null; name: string; shape: 'square' | 'round'; status: TableStatus }
type FloorPlan = { zones: { id: string; name: string }[]; tables: OperationalTable[] }
type PosCatalog = { categories: CatalogCategory[]; products: CatalogProduct[]; modifierGroups?: CatalogModifierGroup[]; combos?: CatalogCombo[]; cachedAt: number; fromCache: boolean }
type DraftOrder = { id: string; orderCode: string; displayNumber?: number; version: number; tableId: string | null; total: number; lines: Array<{ id: string; menuItemId: string; variantId: string; name: string; variant: string; unitPrice: number; quantity: number; modifiers: Array<{ id: string; name?: string; priceDelta?: number }> }> }

type KdsQueueOrder = {
  id: string
  orderCode: string
  source: 'counter' | 'takeaway' | 'table'
  tableId: string | null
  tableName: string | null
  zoneName: string | null
  status: 'draft' | 'paid'
  kdsStatus: 'new' | 'making' | 'ready' | 'served'
  kdsUpdatedAt: number | null
  createdAt: number
  updatedAt: number
  note: string | null
  cashier: string
  lines: Array<{
    id: string
    name: string
    variant: string
    quantity: number
    unitPrice: number
    lineTotal: number
    modifiers?: Array<{ name: string; priceDelta: number }>
  }>
}

type RecentPaidOrder = {
  id: string
  orderCode: string
  displayNumber?: number
  source: 'counter' | 'takeaway' | 'table'
  tableName: string | null
  status: 'paid'
  subtotal: number
  discountAmount: number
  total: number
  createdAt: number
  updatedAt: number
  paidAt: number | null
  cashier: string
  version?: number
}

const formatMoney = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + '₫'

const DISCOUNT_TYPE_OPTIONS: SelectOption[] = [
  { value: 'percent', label: 'Theo %' },
  { value: 'fixed', label: 'Theo tiền' },
]

async function getPosCatalog(): Promise<PosCatalog> {
  const cached = await cachedCatalog()
  try {
    const response = await fetch('/api/menu')
    if (!response.ok) throw new Error('Không tải được menu.')
    const body = (await response.json()) as { categories: CatalogCategory[]; products: CatalogProduct[]; modifierGroups?: CatalogModifierGroup[]; combos?: CatalogCombo[] }
    await cacheCatalog({ categories: body.categories, products: body.products, modifierGroups: body.modifierGroups ?? [], combos: body.combos ?? [] })
    return { ...body, cachedAt: Date.now(), fromCache: false }
  } catch (error) {
    if (cached) return { categories: cached.categories, products: cached.products, modifierGroups: cached.modifierGroups, combos: cached.combos, cachedAt: cached.cachedAt, fromCache: true }
    throw error
  }
}

async function getOperationalFloorPlan(): Promise<FloorPlan> {
  const response = await fetch('/api/floor-plan')
  if (!response.ok) throw new Error('Không tải được sơ đồ bàn.')
  return (await response.json()) as FloorPlan
}

function tableStatusLabel(status: TableStatus) {
  switch (status) {
    case 'trong': return 'Trống'
    case 'dang_phuc_vu': return 'Đang phục vụ'
    case 'dat_truoc': return 'Đặt trước'
    case 'can_don': return 'Cần dọn'
  }
}

export const Route = createFileRoute('/pos')({
  beforeLoad: async () => {
    const session = await readSession()
    if (!session || !session.permissions.includes('pos.read')) {
      throw redirect({ to: '/login', search: { next: '/pos' } })
    }
    return { user: session }
  },
  component: Pos,
})

function Pos() {
  const { user } = Route.useRouteContext()
  const [categoryId, setCategoryId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [items, setItems] = useState<OrderItem[]>([])
  const [configuringProduct, setConfiguringProduct] = useState<CatalogProduct | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([])
  const [paid, setPaid] = useState(false)
  const [confirmPayOpen, setConfirmPayOpen] = useState(false)
  const [completeKdsOnPay, setCompleteKdsOnPay] = useState(true)
  const [paymentMessage, setPaymentMessage] = useState('')
  const [lastPaidTotal, setLastPaidTotal] = useState(0)
  const [lastPaidOrder, setLastPaidOrder] = useState<{ id: string; version: number } | null>(null)
  const [refunding, setRefunding] = useState(false)
  const [refundForm, setRefundForm] = useState({ reason: '', email: '', password: '' })
  const [refundMessage, setRefundMessage] = useState('')
  const [refundError, setRefundError] = useState('')
  const [orderContext, setOrderContext] = useState<'counter' | 'takeaway' | 'table'>('counter')
  const [selectedTable, setSelectedTable] = useState<OperationalTable | null>(null)
  const [activeDraft, setActiveDraft] = useState<DraftOrder | null>(null)
  const [draftLoading, setDraftLoading] = useState(false)
  const [operationMessage, setOperationMessage] = useState('')
  const hydratingDraft = useRef(false)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent')
  const [discountValue, setDiscountValue] = useState(0)
  const [discountReason, setDiscountReason] = useState('')
  const [mobileTab, setMobileTab] = useState<'menu' | 'ticket'>('menu')

  // Unified Drawer State (1 Touchpoint on Header, 2 Tabs inside)
  const [servingDrawerOpen, setServingDrawerOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState<'serving' | 'recent'>('serving')
  const [selectedRecentDetailId, setSelectedRecentDetailId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [managerEmail, setManagerEmail] = useState('')
  const [managerPassword, setManagerPassword] = useState('')

  const catalog = useQuery({ queryKey: ['menu-catalog'], queryFn: getPosCatalog })
  const floorPlan = useQuery({ queryKey: ['floor-plan', 'operational'], queryFn: getOperationalFloorPlan, refetchInterval: 3000 })

  // Live Serving Queue Query (Tab 1: Đang phục vụ)
  const servingQueue = useQuery({
    queryKey: ['pos-serving-queue'],
    queryFn: async () => {
      const response = await fetch('/api/kds')
      if (!response.ok) return { orders: [] as KdsQueueOrder[] }
      const data = await response.json() as { orders: KdsQueueOrder[] }
      return { orders: data.orders ?? [] }
    },
    refetchInterval: 3000,
  })

  // Recent 5 Paid Orders Query (Tab 2: Gần đây - sorted by absolute timestamp)
  const recentPaidQuery = useQuery({
    queryKey: ['pos-recent-paid'],
    queryFn: async () => {
      const response = await fetch('/api/orders/history?status=paid')
      if (!response.ok) return { orders: [] as RecentPaidOrder[] }
      const data = await response.json() as { orders: RecentPaidOrder[] }
      return { orders: (data.orders ?? []).slice(0, 5) }
    },
  })

  // Detail Query for Selected Recent Order
  const recentDetailQuery = useQuery({
    queryKey: ['pos-recent-detail', selectedRecentDetailId],
    enabled: Boolean(selectedRecentDetailId),
    queryFn: async () => {
      const response = await fetch(`/api/orders/history?id=${selectedRecentDetailId}`)
      const body = await response.json().catch(() => ({})) as { message?: string; order?: any }
      if (!response.ok || !body.order) throw new Error(body.message ?? 'Không tải được chi tiết đơn.')
      return body.order
    },
  })

  // Quick Status Update for Live Serving Queue (Mini-KDS action)
  const updateKdsStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: 'making' | 'ready' | 'served' }) => {
      const response = await fetch('/api/kds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'setStatus', orderId, status }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string }
        throw new Error(body.message ?? 'Không thể cập nhật trạng thái pha chế.')
      }
      return response.json()
    },
    onSuccess: async () => {
      await servingQueue.refetch()
      await floorPlan.refetch()
    },
  })

  // Manager Cancellation & Refund Mutation from Detail View
  const cancelOrderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRecentDetailId || !recentDetailQuery.data) throw new Error('Chưa chọn đơn.')
      const response = await fetch('/api/orders/history', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          orderId: selectedRecentDetailId,
          expectedVersion: recentDetailQuery.data.version,
          reason: cancelReason.trim(),
          manager: { email: managerEmail.trim(), password: managerPassword },
        }),
      })
      const body = await response.json().catch(() => ({})) as { message?: string }
      if (!response.ok) throw new Error(body.message ?? 'Không thể hủy đơn.')
    },
    onSuccess: async () => {
      setCancelReason('')
      setManagerEmail('')
      setManagerPassword('')
      setSelectedRecentDetailId(null)
      await recentPaidQuery.refetch()
      await servingQueue.refetch()
      await floorPlan.refetch()
    },
  })

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items])
  const totalQuantity = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items])
  const discountInput = user.permissions.includes('pos.discount') && discountValue > 0 && discountReason.trim().length >= 3 ? { type: discountType, value: discountValue, reason: discountReason.trim() } : undefined
  const { discountAmount, total } = useMemo(() => calculateTotal(subtotal, discountInput), [subtotal, discountInput])
  const selectedZone = selectedZoneId ?? floorPlan.data?.zones[0]?.id ?? null
  const tablesInZone = floorPlan.data?.tables.filter((table) => table.zoneId === selectedZone) ?? []
  const activeCategories = catalog.data?.categories.filter((category) => category.active) ?? []
  const zoneOptions = useMemo(() => (floorPlan.data?.zones ?? []).map((z) => ({ value: z.id, label: z.name })), [floorPlan.data?.zones])

  const modifierLookup = useMemo(() => {
    const map = new Map<string, { id: string; name: string; priceDelta: number }>()
    for (const group of catalog.data?.modifierGroups ?? []) {
      for (const mod of group.modifiers) {
        map.set(mod.id, { id: mod.id, name: mod.name, priceDelta: mod.priceDelta })
      }
    }
    return map
  }, [catalog.data?.modifierGroups])

  const visibleProducts = useMemo(() => {
    return (catalog.data?.products ?? []).filter((product) => {
      if (!product.active || !product.variants.some((variant) => variant.active)) return false
      const matchesCategory = categoryId === 'all' || product.categoryId === categoryId
      if (!matchesCategory) return false
      if (!searchQuery.trim()) return true
      const term = searchQuery.trim().toLocaleLowerCase('vi-VN')
      const nameMatch = product.name.toLocaleLowerCase('vi-VN').includes(term)
      const descMatch = (product.description || '').toLocaleLowerCase('vi-VN').includes(term)
      return nameMatch || descMatch
    })
  }, [catalog.data?.products, categoryId, searchQuery])

  useEffect(() => {
    const refresh = () => { if (navigator.onLine) void syncOutbox() }
    void refresh(); window.addEventListener('online', refresh); window.addEventListener('offline', refresh)
    return () => { window.removeEventListener('online', refresh); window.removeEventListener('offline', refresh) }
  }, [])

  useEffect(() => {
    if (floorPlan.data?.zones.length && !floorPlan.data.zones.some((zone) => zone.id === selectedZoneId)) setSelectedZoneId(floorPlan.data.zones[0].id)
  }, [floorPlan.data, selectedZoneId])

  function consolidateDraftLines(lines: DraftOrder['lines']): OrderItem[] {
    const map = new Map<string, OrderItem>()
    for (const line of lines) {
      const modKey = (line.modifiers ?? []).map((m) => m.id).sort().join(',')
      const key = `${line.variantId}::${modKey}`
      const existing = map.get(key)
      if (existing) {
        existing.quantity += line.quantity
      } else {
        const resolvedModifiers = (line.modifiers ?? []).map((m) => {
          const found = modifierLookup.get(m.id)
          return {
            id: m.id,
            name: m.name || found?.name || m.id,
            priceDelta: m.priceDelta ?? found?.priceDelta ?? 0,
          }
        })
        map.set(key, {
          id: line.id,
          menuItemId: line.menuItemId,
          variantId: line.variantId,
          name: line.name,
          variant: line.variant,
          price: line.unitPrice,
          quantity: line.quantity,
          modifiers: resolvedModifiers,
          modifierIds: (line.modifiers ?? []).map((m) => m.id),
        })
      }
    }
    return Array.from(map.values())
  }

  async function addVariant(_product: CatalogProduct, variant: CatalogVariant, modifierIds: string[] = []) {
    setDraftLoading(true); setOperationMessage('')
    try {
      if (!activeDraft) {
        const response = await fetch('/api/orders/drafts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'create', source: orderContext, tableId: selectedTable?.id, idempotencyKey: crypto.randomUUID(), lines: [{ variantId: variant.id, quantity: 1, modifierIds }] }),
        })
        const body = await response.json().catch(() => ({})) as { message?: string; order?: DraftOrder }
        if (!response.ok) throw new Error(body.message ?? 'Không thể tạo ticket.')
        const draft = (body.order ?? body) as DraftOrder
        setActiveDraft(draft)
        setItems(consolidateDraftLines(draft.lines))
      } else {
        const response = await fetch('/api/orders/drafts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'addLine', orderId: activeDraft.id, expectedVersion: activeDraft.version, line: { variantId: variant.id, quantity: 1, modifierIds } }),
        })
        const body = await response.json().catch(() => ({})) as { message?: string; version: number; total: number; line: DraftOrder['lines'][number] }
        if (!response.ok) throw new Error(body.message ?? 'Không thể thêm món vào ticket.')
        setActiveDraft((current) => current ? { ...current, version: body.version, total: body.total } : current)
        setItems((current) => {
          const modKey = (body.line.modifiers ?? []).map((m) => m.id).sort().join(',')
          const key = `${body.line.variantId}::${modKey}`
          const resolvedModifiers = (body.line.modifiers ?? []).map((m) => {
            const found = modifierLookup.get(m.id)
            return {
              id: m.id,
              name: m.name || found?.name || m.id,
              priceDelta: m.priceDelta ?? found?.priceDelta ?? 0,
            }
          })
          const existingIndex = current.findIndex((item) => {
            const itemModKey = item.modifierIds.slice().sort().join(',')
            return `${item.variantId}::${itemModKey}` === key
          })
          if (existingIndex >= 0) {
            const next = [...current]
            next[existingIndex] = {
              ...next[existingIndex],
              id: body.line.id,
              quantity: body.line.quantity,
              price: body.line.unitPrice,
              modifiers: resolvedModifiers,
            }
            return next
          }
          return [
            ...current,
            {
              id: body.line.id,
              menuItemId: body.line.menuItemId,
              variantId: body.line.variantId,
              name: body.line.name,
              variant: body.line.variant,
              price: body.line.unitPrice,
              quantity: body.line.quantity,
              modifiers: resolvedModifiers,
              modifierIds: (body.line.modifiers ?? []).map((modifier) => modifier.id),
            },
          ]
        })
      }
      await floorPlan.refetch()
    } catch (error) { setOperationMessage(error instanceof Error ? error.message : 'Không thể thêm món vào ticket.') }
    finally { setDraftLoading(false) }
  }

  function selectProduct(product: CatalogProduct) {
    const variants = product.variants.filter((variant) => variant.active)
    if (variants.length === 1 && !(variants[0].modifierGroupIds?.length)) {
      void addVariant(product, variants[0])
      return
    }
    setConfiguringProduct(product)
    setSelectedVariantId(variants[0]?.id ?? null)
    setSelectedModifierIds([])
  }

  async function changeQuantity(lineId: string, change: number) {
    const line = items.find((item) => item.id === lineId)
    if (!line || !activeDraft) return
    if (change > 0) {
      const product = (catalog.data?.products ?? []).find((candidate) => candidate.id === line.menuItemId)
      const variant = product?.variants.find((candidate) => candidate.id === line.variantId)
      if (product && variant) await addVariant(product, variant, line.modifierIds)
      return
    }
    setDraftLoading(true); setOperationMessage('')
    try {
      const response = await fetch('/api/orders/drafts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'voidLine',
          orderId: activeDraft.id,
          expectedVersion: activeDraft.version,
          lineId,
          quantity: 1,
          reason: 'Điều chỉnh trước thanh toán',
        }),
      })
      const body = await response.json().catch(() => ({})) as { message?: string; version: number; total: number; cancelled?: boolean }
      if (!response.ok) throw new Error(body.message ?? 'Không thể hủy món.')
      const nextItems = items.map((item) => {
        if (item.id !== lineId) return item
        if (item.quantity > 1) return { ...item, quantity: item.quantity - 1 }
        return null
      }).filter((item): item is NonNullable<typeof item> => item !== null)

      if (body.cancelled || nextItems.length === 0) {
        setActiveDraft(null)
        setItems([])
        setDiscountValue(0)
        setDiscountReason('')
      } else {
        setActiveDraft((current) => current ? { ...current, version: body.version, total: body.total } : current)
        setItems(nextItems)
      }
      void floorPlan.refetch()
    } catch (error) { setOperationMessage(error instanceof Error ? error.message : 'Không thể hủy món.') }
    finally { setDraftLoading(false) }
  }

  async function openTable(table: OperationalTable) {
    if (table.status === 'dat_truoc' || table.status === 'can_don') {
      setOperationMessage(table.status === 'dat_truoc' ? 'Bàn đang được giữ cho khách đặt trước.' : 'Bàn cần được xử lý trước khi nhận đơn.')
      return
    }
    setDraftLoading(true); setOperationMessage('')
    try {
      const response = await fetch(`/api/orders/drafts?tableId=${encodeURIComponent(table.id)}`)
      if (!response.ok) throw new Error('Không tải được đơn đang mở của bàn.')
      const body = await response.json() as { orders: DraftOrder[] }
      const draft = body.orders[0]
      if (draft) {
        hydratingDraft.current = true
        setActiveDraft(draft)
        setItems(consolidateDraftLines(draft.lines))
        setOrderContext('table'); setSelectedTable(table)
        setTimeout(() => { hydratingDraft.current = false }, 100)
      } else {
        setSelectedTable(table); setOrderContext('table'); setActiveDraft(null); setItems([]); setDiscountValue(0); setDiscountReason('')
      }
      void floorPlan.refetch()
    } catch (error) { setOperationMessage(error instanceof Error ? error.message : 'Không thể mở bàn.') }
    finally { setDraftLoading(false) }
  }

  async function reloadDraftForTable(tableId: string, expectedOrderId: string) {
    setDraftLoading(true)
    try {
      const response = await fetch(`/api/orders/drafts?tableId=${encodeURIComponent(tableId)}`)
      if (!response.ok) throw new Error('Không tải được đơn của bàn.')
      const body = await response.json() as { orders: DraftOrder[] }
      const draft = body.orders.find((candidate) => candidate.id === expectedOrderId) ?? body.orders[0]
      if (draft) {
        hydratingDraft.current = true
        setActiveDraft(draft)
        setItems(consolidateDraftLines(draft.lines))
        setTimeout(() => { hydratingDraft.current = false }, 100)
      }
    } catch (error) { setOperationMessage(error instanceof Error ? error.message : 'Không thể tải lại ticket.') }
    finally { setDraftLoading(false) }
  }

  async function switchContext(nextContext: 'counter' | 'takeaway' | 'table') {
    if (nextContext === 'table') {
      setOrderContext('table')
      if (tablesInZone.length && !selectedTable) {
        const first = tablesInZone.find((t) => t.status === 'dang_phuc_vu') ?? tablesInZone.find((t) => t.status === 'trong') ?? tablesInZone[0]
        if (first) void openTable(first)
      }
    } else {
      setOrderContext(nextContext); setSelectedTable(null); setActiveDraft(null); setItems([]); setDiscountValue(0); setDiscountReason('')
    }
    void floorPlan.refetch()
  }

  async function moveToTable(tableId: string) {
    const target = floorPlan.data?.tables.find((candidate) => candidate.id === tableId)
    if (target) await openTable(target)
  }

  async function completeCashPayment(options?: { completeKds?: boolean }) {
    if (!items.length) return
    const idempotencyKey = crypto.randomUUID()
    const finalize = (message: string) => {
      setLastPaidTotal(total)
      setPaymentMessage(message)
      setLastPaidOrder(activeDraft ? { id: activeDraft.id, version: activeDraft.version + 1 } : null)
      setItems([])
      setSelectedTable(null)
      setActiveDraft(null)
      setOrderContext('counter')
      setDiscountValue(0)
      setDiscountReason('')
      setPaid(true)
      setMobileTab('menu')
    }
    if (activeDraft) {
      try {
        const response = await fetch('/api/orders/pay', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            orderId: activeDraft.id,
            expectedVersion: activeDraft.version,
            idempotencyKey,
            deviceId: deviceId(),
            receivedAmount: total,
            discount: discountInput,
            completeKds: options?.completeKds ?? (orderContext === 'table'),
          }),
        })
        if (!response.ok) throw new Error((await response.json().catch(() => ({ message: 'Không thể thanh toán ticket.' })) as { message?: string }).message ?? 'Không thể thanh toán ticket.')
        finalize('Đơn đã thanh toán và hoàn tất.')
        await floorPlan.refetch()
        await servingQueue.refetch()
        await recentPaidQuery.refetch()
        return
      } catch (error) { setOperationMessage(error instanceof Error ? error.message : 'Không thể thanh toán ticket.'); return }
    }
    setOperationMessage('Hãy thêm món để tạo ticket trước khi thanh toán.')
  }

  async function refundLastPaidOrder() {
    if (!lastPaidOrder) return
    setRefundError(''); setRefundMessage('')
    try {
      const response = await fetch('/api/orders/history', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', orderId: lastPaidOrder.id, expectedVersion: lastPaidOrder.version, reason: refundForm.reason.trim(), manager: { email: refundForm.email.trim(), password: refundForm.password } }),
      })
      const body = await response.json().catch(() => ({})) as { message?: string }
      if (!response.ok) throw new Error(body.message ?? 'Không thể hủy đơn đã thanh toán.')
      setRefundMessage('Đã hủy toàn bộ đơn và hoàn tiền mặt đầy đủ. Quản lý xác nhận hoàn tiền.')
      setRefundForm({ reason: '', email: '', password: '' })
      await floorPlan.refetch()
      await servingQueue.refetch()
      await recentPaidQuery.refetch()
    } catch (error) { setRefundError(error instanceof Error ? error.message : 'Không thể hủy đơn đã thanh toán.') }
  }

  const configVariants = configuringProduct?.variants.filter((variant) => variant.active) ?? []
  const selectedConfigVariant = configVariants.find((variant) => variant.id === selectedVariantId)
  const configGroups = (catalog.data?.modifierGroups ?? []).filter((group) => selectedConfigVariant?.modifierGroupIds?.includes(group.id))
  const configValid = configGroups.every((group) => { const count = group.modifiers.filter((modifier) => selectedModifierIds.includes(modifier.id)).length; return count >= group.minSelections && count <= group.maxSelections })

  const servingOrdersCount = servingQueue.data?.orders?.length ?? 0
  const recentOrders = recentPaidQuery.data?.orders ?? []

  return (
    <div className="pos-screen">
      {/* Fast Tab Switcher for Tablet & Mobile (< 1024px) */}
      <div className="pos-mobile-nav" role="tablist" aria-label="Chuyển đổi màn hình POS">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'menu'}
          className={cn('pos-mobile-nav-btn', mobileTab === 'menu' && 'is-active')}
          onClick={() => setMobileTab('menu')}
        >
          <IconCoffee size={16} stroke={1.75} />
          <span>Thực đơn món</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'ticket'}
          className={cn('pos-mobile-nav-btn', mobileTab === 'ticket' && 'is-active')}
          onClick={() => setMobileTab('ticket')}
        >
          <IconReceipt size={16} stroke={1.75} />
          <span>Đơn hàng {totalQuantity > 0 ? `(${totalQuantity})` : ''}</span>
          {totalQuantity > 0 && <span className="pos-mobile-nav-badge font-mono tabular-nums">{formatMoney(total)}</span>}
        </button>
      </div>

      <main className="pos-main">
        <section className={cn('menu-pane', mobileTab !== 'menu' && 'is-hidden-mobile')} aria-labelledby="pos-title">
          {/* Header Title Bar with Espresso Anchor & Unified Drawer Button (1 Touchpoint) */}
          <div className="pos-title-row flex items-center justify-between gap-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-[var(--espresso)] text-[var(--crema)] shadow-2xs">
                  QUẦY THU NGÂN
                </span>
                <span className="text-xs text-[#8c8177] hidden sm:inline">· Điểm bán POS</span>
              </div>
              <h1 id="pos-title" className="text-xl sm:text-2xl font-bold font-display text-[var(--char)] mt-0.5">
                {activeDraft?.displayNumber
                  ? `Đơn #${String(activeDraft.displayNumber).padStart(3, '0')}`
                  : activeDraft
                  ? 'Ticket đang mở'
                  : 'Tạo đơn mới'}
              </h1>
            </div>

            {/* Single Touchpoint: Opens Unified Order Drawer (Serving Queue + Recent History) */}
            <button
              type="button"
              onClick={() => setServingDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#fff8eb] text-[#b45309] border border-[#fde68a] hover:bg-[#fef3c7] shadow-2xs active:scale-[0.98] transition-all cursor-pointer select-none shrink-0"
              aria-label="Xem đơn đang phục vụ và lịch sử gần đây"
            >
              <span className={cn('w-2 h-2 rounded-full bg-[#f59e0b] shrink-0', servingOrdersCount > 0 && 'animate-pulse')} />
              <span className="font-mono tabular-nums font-extrabold">{servingOrdersCount}</span>
              <span>đang phục vụ</span>
            </button>
          </div>

          {/* Service Context & Table Picker */}
          <section className="pos-table-section" aria-label="Chọn hình thức & bàn phục vụ">
            <Tabs.Root
              value={orderContext}
              onValueChange={(val) => {
                if (val === 'table' || val === 'counter' || val === 'takeaway') {
                  void switchContext(val)
                }
              }}
              className="w-full gap-0 flex flex-col"
            >
              <div className="pos-table-header">
                <Tabs.List variant="pill" className="pos-context-toggle">
                  <Tabs.Indicator variant="pill" className="pos-context-indicator" />
                  <Tabs.Tab
                    value="table"
                    variant="pill"
                    className="pos-context-pill"
                  >
                    {selectedTable
                      ? (selectedTable.name.toLowerCase().startsWith('bàn') ? selectedTable.name : `Bàn ${selectedTable.name}`)
                      : 'Tại bàn'}
                  </Tabs.Tab>
                  <Tabs.Tab
                    value="counter"
                    variant="pill"
                    className="pos-context-pill"
                  >
                    Tại quầy
                  </Tabs.Tab>
                  <Tabs.Tab
                    value="takeaway"
                    variant="pill"
                    className="pos-context-pill"
                  >
                    Mang đi
                  </Tabs.Tab>
                </Tabs.List>

                {orderContext === 'table' && !!floorPlan.data?.zones.length && (
                  <div className="pos-zone-selector">
                    <AppSelect
                      size="sm"
                      items={zoneOptions}
                      value={selectedZone ?? ''}
                      onValueChange={(val) => setSelectedZoneId(val)}
                      aria-label="Chọn khu vực"
                      triggerClassName="bg-white min-w-28 text-xs"
                    />
                  </div>
                )}
              </div>

              <Tabs.Panel value="table" className="pos-context-panel mt-1">
                {!!floorPlan.data?.zones.length && (
                  <div className="pos-tables-wrap">
                    {tablesInZone.length ? (
                      <div className="pos-tables-list" role="list">
                        {tablesInZone.map((table) => {
                          const isSelected = selectedTable?.id === table.id
                          const isDisabled = table.status === 'dat_truoc' || table.status === 'can_don' || draftLoading
                          return (
                            <button
                              key={table.id}
                              type="button"
                              disabled={isDisabled}
                              className={cn(
                                'pos-table-card',
                                `status-${table.status}`,
                                isSelected && 'is-selected'
                              )}
                              onClick={() => void openTable(table)}
                              aria-label={`${table.name}, ${tableStatusLabel(table.status)}`}
                            >
                              <span className="pos-table-name">{table.name}</span>
                              <span className="pos-table-status">
                                <span className={cn('pos-table-dot', `dot-${table.status}`)} aria-hidden="true" />
                                {tableStatusLabel(table.status)}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="pos-tables-empty">Khu vực này chưa có bàn nào.</p>
                    )}
                  </div>
                )}
              </Tabs.Panel>

              <Tabs.Panel value="counter" className="pos-context-panel mt-1">
                <p className="pos-context-desc">
                  <IconCheck size={14} stroke={2.5} className="text-[var(--moss)]" />
                  <span>Đơn phục vụ nhanh tại quầy · Không gắn số bàn</span>
                </p>
              </Tabs.Panel>

              <Tabs.Panel value="takeaway" className="pos-context-panel mt-1">
                <p className="pos-context-desc">
                  <IconCheck size={14} stroke={2.5} className="text-[var(--ember)]" />
                  <span>Đơn đóng gói mang đi · Không gắn số bàn</span>
                </p>
              </Tabs.Panel>
            </Tabs.Root>

            {operationMessage && <p className="floor-feedback is-error mt-1" role="alert">{operationMessage}</p>}
          </section>

          {/* Sticky Search & Category Bar */}
          <div className="pos-sticky-toolbar">
            <div className="pos-search-box">
              <span className="pos-search-icon" aria-hidden="true">
                <IconSearch size={15} stroke={1.75} />
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm món hoặc mô tả (VD: Latte, Bạc xỉu...)"
                className="pos-search-input"
                aria-label="Tìm kiếm món"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="pos-search-clear"
                  aria-label="Xóa tìm kiếm"
                >
                  <IconX size={14} stroke={2} />
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div className="pos-category-bar" role="tablist" aria-label="Lọc theo danh mục món">
              <button
                type="button"
                role="tab"
                aria-selected={categoryId === 'all'}
                className={cn('pos-cat-chip', categoryId === 'all' && 'is-active')}
                onClick={() => setCategoryId('all')}
              >
                Tất cả món
              </button>
              {activeCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={categoryId === category.id}
                  className={cn('pos-cat-chip', categoryId === category.id && 'is-active')}
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {catalog.data?.fromCache && <p className="catalog-cache-note">Đang dùng menu đã lưu lúc {new Date(catalog.data.cachedAt).toLocaleTimeString('vi-VN')}.</p>}
          {catalog.isLoading && <p className="floor-feedback">Đang tải menu…</p>}
          {catalog.isError && <p className="floor-feedback is-error">Không tải được menu. Kết nối mạng để nhận catalog lần đầu.</p>}
          {catalog.data && !catalog.isLoading && !visibleProducts.length && (
            <div className="pos-empty-catalog" role="status">
              <div className="pos-empty-inner">
                <div className="pos-empty-icon" aria-hidden="true">
                  <IconCoffee size={22} stroke={1.5} className="text-[#8c8177]" />
                </div>
                <h3 className="pos-empty-title">
                  {searchQuery ? 'Không tìm thấy món phù hợp' : 'Không có món đang bán'}
                </h3>
                <p className="pos-empty-desc">
                  {searchQuery
                    ? `Không có món nào khớp với từ khóa "${searchQuery}". Hãy thử tìm từ khóa khác.`
                    : categoryId === 'all'
                    ? 'Menu hiện chưa có món nào đang bán. Vui lòng thêm món trong trang Quản trị.'
                    : `Danh mục "${activeCategories.find((c) => c.id === categoryId)?.name || 'này'}" hiện chưa có món.`}
                </p>
                <div className="pos-empty-actions mt-3 flex items-center justify-center gap-2 flex-wrap">
                  {searchQuery && (
                    <SecondaryButton size="sm" onClick={() => setSearchQuery('')}>
                      Xóa tìm kiếm
                    </SecondaryButton>
                  )}
                  {categoryId !== 'all' && (
                    <SecondaryButton size="sm" onClick={() => setCategoryId('all')}>
                      Xem tất cả món
                    </SecondaryButton>
                  )}
                  <SecondaryButton size="sm" onClick={() => void catalog.refetch()}>
                    Tải lại menu
                  </SecondaryButton>
                </div>
              </div>
            </div>
          )}

          {/* Product Cards Grid with 1:1 Thumbnails */}
          <div className="pos-menu-grid">
            {visibleProducts.map((product) => {
              const activeVariants = product.variants.filter((v) => v.active)
              const isSingleVariant = activeVariants.length === 1 && !(activeVariants[0].modifierGroupIds?.length)
              const minPrice = Math.min(...activeVariants.map((v) => v.price))

              return (
                <button
                  key={product.id}
                  type="button"
                  className="pos-product-card"
                  onClick={() => selectProduct(product)}
                >
                  {/* Left 1:1 Thumbnail */}
                  {product.imageKey ? (
                    <img
                      src={`/api/media/menu-images?key=${encodeURIComponent(product.imageKey)}`}
                      alt=""
                      className="pos-card-img"
                    />
                  ) : (
                    <div className="pos-card-img-placeholder" aria-hidden="true">
                      <IconCoffee size={24} stroke={1.5} className="text-[#a19588]" />
                    </div>
                  )}

                  {/* Right Content */}
                  <div className="pos-card-body">
                    <div className="pos-card-top">
                      <strong className="pos-card-name" title={product.name}>{product.name}</strong>
                      {product.description && (
                        <span className="pos-card-desc" title={product.description}>{product.description}</span>
                      )}
                    </div>

                    <div className="pos-card-footer">
                      <strong className="pos-card-price font-mono tabular-nums">
                        {isSingleVariant ? formatMoney(activeVariants[0].price) : `Từ ${formatMoney(minPrice)}`}
                      </strong>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Floating Cart Checkout Bar on Tablet/Mobile (< 1024px) */}
          {totalQuantity > 0 && (
            <div className="pos-mobile-floating-bar" role="region" aria-label="Đơn hàng đang chọn">
              <div className="pos-floating-info" onClick={() => setMobileTab('ticket')}>
                <div className="pos-floating-qty">
                  <IconReceipt size={17} stroke={1.75} />
                  <span>{totalQuantity} món đang chọn</span>
                </div>
                <strong className="pos-floating-total font-mono tabular-nums">{formatMoney(total)}</strong>
              </div>
              <button
                type="button"
                className="pos-floating-pay-btn"
                onClick={() => setConfirmPayOpen(true)}
              >
                <span>Thanh toán</span>
              </button>
            </div>
          )}
        </section>

        {/* Right Ticket Pane with Thermal Receipt Motif */}
        <aside className={cn('order-pane', mobileTab !== 'ticket' && 'is-hidden-mobile')} aria-labelledby="ticket-title">
          <div className="ticket-card">
            <div className="order-ticket">
              <div className="ticket-head">
                <div>
                  <p className="eyebrow" id="ticket-title">
                    {orderContext === 'table'
                      ? (selectedTable ? (selectedTable.name.toLowerCase().startsWith('bàn') ? selectedTable.name : `Bàn ${selectedTable.name}`) : 'Đơn tại bàn')
                      : orderContext === 'takeaway'
                      ? 'Đơn mang đi'
                      : 'Đơn tại quầy'}
                  </p>
                  <strong className="order-code font-mono tabular-nums">
                    {activeDraft?.displayNumber ? `#${String(activeDraft.displayNumber).padStart(3, '0')}` : (activeDraft ? `#${activeDraft.orderCode}` : 'Chưa có món')}
                  </strong>
                </div>

                <div className="ticket-head-actions">
                  <span className="status-badge">
                    {orderContext === 'table' ? (selectedTable ? selectedTable.name : 'Bàn') : orderContext === 'takeaway' ? 'Mang đi' : 'Tại quầy'}
                  </span>
                  {activeDraft && selectedTable && (
                    <DraftTools
                      order={activeDraft}
                      table={selectedTable}
                      tables={floorPlan.data?.tables ?? []}
                      onReload={async (tableId: string) => {
                        await reloadDraftForTable(tableId, activeDraft.id)
                      }}
                      onMoved={async (tableId: string) => {
                        await moveToTable(tableId)
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Perforated Ticket Divider with Side Cutout Notches */}
              <div className="ticket-notch-divider" aria-hidden="true">
                <div className="ticket-notch-line" />
              </div>

              {/* Order Lines List */}
              <div className="ticket-lines" role="list">
                {!items.length ? (
                  <div className="empty-order" role="status">
                    <span className="empty-order-icon" aria-hidden="true">☕</span>
                    <strong className="empty-order-title">Chưa có món nào</strong>
                    <span className="empty-order-sub">Chạm vào món trong thực đơn để thêm</span>
                  </div>
                ) : (
                  items.map((item) => {
                    const resolvedToppings = (item.modifiers ?? []).map((m) => {
                      const found = modifierLookup.get(m.id)
                      return { id: m.id, name: m.name || found?.name || m.id, priceDelta: m.priceDelta ?? found?.priceDelta ?? 0 }
                    })
                    return (
                      <div key={item.id} className="order-line" role="listitem">
                        <div className="order-line-left">
                          <strong className="order-line-title">{item.name}</strong>
                          {item.variant && !['Mặc định', 'Phần', 'Default'].includes(item.variant) && (
                            <div className="order-line-meta">
                              <span className="order-line-badge">{item.variant}</span>
                            </div>
                          )}
                          {resolvedToppings.length > 0 && (
                            <div className="order-line-toppings">
                              {resolvedToppings.map((mod) => (
                                <span key={mod.id} className="order-line-topping-chip font-mono">
                                  +{mod.name}
                                  {mod.priceDelta ? ` (+${formatMoney(mod.priceDelta)})` : ''}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="order-line-right">
                          <b className="order-line-price font-mono tabular-nums">{formatMoney(item.price * item.quantity)}</b>
                          <div className="quantity-control">
                            <button type="button" onClick={() => void changeQuantity(item.id, -1)} aria-label={`Bớt một ${item.name}`} disabled={draftLoading} className="flex items-center justify-center">
                              <IconMinus size={11} stroke={2.5} />
                            </button>
                            <span className="font-mono tabular-nums">{item.quantity}</span>
                            <button type="button" onClick={() => void changeQuantity(item.id, 1)} aria-label={`Thêm một ${item.name}`} disabled={draftLoading} className="flex items-center justify-center">
                              <IconPlus size={11} stroke={2.5} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Discount Section */}
              {user.permissions.includes('pos.discount') && items.length > 0 && (
                <div className="discount-panel">
                  <div className="discount-panel-head">
                    <strong>Giảm giá</strong>
                    {discountAmount > 0 && <span className="font-mono tabular-nums text-[var(--moss)]">-{formatMoney(discountAmount)}</span>}
                  </div>
                  <div className="discount-controls">
                    <div className="discount-row-inputs">
                      <AppSelect
                        size="sm"
                        items={DISCOUNT_TYPE_OPTIONS}
                        value={discountType}
                        onValueChange={(val) => setDiscountType(val as 'percent' | 'fixed')}
                        aria-label="Loại giảm giá"
                        triggerClassName="w-full text-xs font-medium bg-white"
                      />
                      <Input
                        size="sm"
                        aria-label="Giá trị giảm giá"
                        min="0"
                        max={discountType === 'percent' ? 100 : subtotal}
                        type="number"
                        value={discountValue || ''}
                        onChange={(event) => setDiscountValue(Math.max(0, Number(event.target.value) || 0))}
                        placeholder={discountType === 'percent' ? '% giảm (VD: 10)' : 'Số tiền VNĐ'}
                      />
                    </div>
                    <Input
                      size="sm"
                      aria-label="Lý do giảm giá"
                      placeholder="Lý do giảm giá (tối thiểu 3 ký tự)..."
                      value={discountReason}
                      onChange={(event) => setDiscountReason(event.target.value)}
                    />
                  </div>
                  {discountValue > 0 && !discountInput && (
                    <small className="discount-help">Nhập lý do giảm giá để ghi nhận audit.</small>
                  )}
                </div>
              )}

              {/* Perforated Divider before Totals */}
              <div className="ticket-notch-divider mt-auto" aria-hidden="true">
                <div className="ticket-notch-line" />
              </div>

              {/* Totals Breakdown */}
              <div className="ticket-total-breakdown">
                <div className="ticket-row subtotal-row">
                  <span>Tạm tính</span>
                  <span className="font-mono tabular-nums font-semibold">{formatMoney(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="ticket-row discount-row">
                    <span>Giảm giá</span>
                    <span className="font-mono tabular-nums text-[var(--moss)] font-semibold">-{formatMoney(discountAmount)}</span>
                  </div>
                )}
                <hr className="ticket-divider" />
                <div className="ticket-row grand-total-row">
                  <strong>TỔNG TIỀN</strong>
                  <strong className="font-mono tabular-nums text-lg text-[var(--ember)]">{formatMoney(total)}</strong>
                </div>
              </div>
            </div>

            {/* Pay Button Section */}
            <div className="pay-section p-4 pt-2">
              <button
                type="button"
                disabled={!items.length || draftLoading}
                className={cn('pay-button flex items-center justify-between', !items.length && 'is-disabled')}
                onClick={() => setConfirmPayOpen(true)}
              >
                <span className="flex items-center gap-2 font-bold text-sm">
                  <IconCash size={19} stroke={1.75} />
                  <span>Thanh toán tiền mặt</span>
                </span>
                <span className="font-mono tabular-nums font-extrabold text-base">{formatMoney(total)}</span>
              </button>
              <p className="payment-note mt-1 text-[11px] text-[#8c8177]">Chỉ hỗ trợ thanh toán tiền mặt</p>
            </div>
          </div>
        </aside>
      </main>

      {/* Confirmation & Payment Flow Modal */}
      <ConfirmDialog
        open={confirmPayOpen}
        onOpenChange={setConfirmPayOpen}
        title="Xác nhận thanh toán"
        desc={
          <div className="flex flex-col gap-2.5">
            <p>
              Thu <b className="font-mono tabular-nums">{formatMoney(total)}</b> tiền mặt từ khách. Sau khi xác nhận, ticket sẽ được hoàn tất.
            </p>
            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--char)] cursor-pointer select-none mt-1">
              <input
                type="checkbox"
                checked={completeKdsOnPay}
                onChange={(e) => setCompleteKdsOnPay(e.target.checked)}
                className="rounded border-[#ded6cc] text-[var(--ember)] focus:ring-[var(--ember)]"
              />
              <span>Đánh dấu món xong trên KDS (không cần pha chế lại)</span>
            </label>
          </div>
        }
        confirmText="Xác nhận thanh toán"
        destructive={false}
        isLoading={draftLoading}
        handleConfirm={() => {
          setConfirmPayOpen(false)
          void completeCashPayment({ completeKds: completeKdsOnPay })
        }}
      />

      {/* Payment Success & Receipt Dialog */}
      <Dialog.Root open={paid} onOpenChange={(open) => { setPaid(open); if (!open) { setRefunding(false); setRefundForm({ reason: '', email: '', password: '' }); setRefundMessage(''); setRefundError(''); setLastPaidOrder(null) } }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="dialog-backdrop" />
          <Dialog.Viewport className="dialog-viewport">
            <Dialog.Popup className="payment-dialog print-receipt">
              <p className="eyebrow">TOMNY COFFEE · ĐÃ GHI NHẬN</p>
              <Dialog.Title className="flex items-center gap-2">
                <IconCheck size={22} stroke={2.5} className="text-[var(--moss)]" />
                <span>Thanh toán thành công</span>
              </Dialog.Title>
              <Dialog.Description>{paymentMessage}</Dialog.Description>
              <div className="payment-total font-mono tabular-nums">{formatMoney(lastPaidTotal)}</div>
              {refunding && (
                <div className="refund-panel">
                  <h3>Hủy & hoàn tiền toàn bộ đơn</h3>
                  <p className="drawer-note">Chỉ hủy toàn đơn kèm hoàn tiền tiền mặt đầy đủ. Quản lý cần đăng nhập lại để duyệt.</p>
                  <Field.Root>
                    <Field.Label>Lý do hủy</Field.Label>
                    <Input size="sm" value={refundForm.reason} onChange={(event) => setRefundForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Ví dụ: khách trả món" />
                  </Field.Root>
                  <Field.Root className="mt-2">
                    <Field.Label>Email quản lý</Field.Label>
                    <Input size="sm" type="email" value={refundForm.email} onChange={(event) => setRefundForm((current) => ({ ...current, email: event.target.value }))} placeholder="manager@tomny.coffee" />
                  </Field.Root>
                  <Field.Root className="mt-2">
                    <Field.Label>Mật khẩu quản lý</Field.Label>
                    <Input size="sm" type="password" value={refundForm.password} onChange={(event) => setRefundForm((current) => ({ ...current, password: event.target.value }))} placeholder="Nhập để duyệt" />
                  </Field.Root>
                  {refundMessage && <p className="form-message success-message mt-2" role="status">{refundMessage}</p>}
                  {refundError && <p className="form-message mt-2" role="alert">{refundError}</p>}
                  <button
                    className="refund-button"
                    disabled={refundForm.reason.trim().length < 3 || !refundForm.email.trim() || !refundForm.password}
                    onClick={() => void refundLastPaidOrder()}
                  >
                    Xác nhận hủy & hoàn tiền
                  </button>
                </div>
              )}
              <div className="dialog-actions">
                <button className="print-button flex items-center justify-center gap-1.5" onClick={() => window.print()}>
                  <IconPrinter size={16} stroke={1.75} />
                  <span>In hóa đơn</span>
                </button>
                {user.permissions.includes('pos.cancel') && !refundMessage && (
                  <button className="refund-link" onClick={() => { setRefunding(true); setRefundError('') }}>
                    Hủy & hoàn tiền (quản lý)
                  </button>
                )}
                <Dialog.Close className="dialog-close" onClick={() => setPaid(false)}>Tạo đơn mới</Dialog.Close>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>

      {/* UNIFIED DRAWER: 1 Touchpoint, 2 Tabs (Tab 1: Đang phục vụ, Tab 2: 5 Đơn Gần đây) */}
      <Drawer.Root open={servingDrawerOpen} onOpenChange={setServingDrawerOpen}>
        <Drawer.Content className="max-w-lg w-full">
          {/* Drawer Top Bar */}
          <div className="flex items-start justify-between pb-3 border-b border-[#ede6de]">
            <div>
              <p className="eyebrow text-xs text-[#8c8177] uppercase font-bold tracking-wider">
                ĐƠN HÀNG
              </p>
              <Drawer.Title className="text-xl font-bold font-display text-[var(--char)] mt-0.5">
                {drawerTab === 'serving' ? `${servingOrdersCount} đơn đang phục vụ` : '5 đơn thanh toán gần nhất'}
              </Drawer.Title>
            </div>
            <Drawer.Close aria-label="Đóng" className="dialog-close-btn">
              <IconX size={18} stroke={1.75} />
            </Drawer.Close>
          </div>

          {/* 2-Tab Navigation inside Drawer */}
          <div className="mt-3.5">
            <div className="flex items-center p-1 bg-[#ede6de] rounded-xl gap-1" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={drawerTab === 'serving'}
                onClick={() => setDrawerTab('serving')}
                className={cn(
                  'flex-1 min-w-0 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer select-none flex items-center justify-center gap-1 whitespace-nowrap',
                  drawerTab === 'serving'
                    ? 'bg-white text-[var(--char)] shadow-xs'
                    : 'text-[#61574f] hover:text-[var(--char)]'
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full bg-[#f59e0b] shrink-0', servingOrdersCount > 0 && 'animate-pulse')} />
                <span className="truncate">Đang phục vụ</span>
                <span className="px-1 rounded-full bg-[#ede6de] font-mono text-[10px] shrink-0">
                  {servingOrdersCount}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={drawerTab === 'recent'}
                onClick={() => { setDrawerTab('recent'); void recentPaidQuery.refetch() }}
                className={cn(
                  'flex-1 min-w-0 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer select-none flex items-center justify-center gap-1 whitespace-nowrap',
                  drawerTab === 'recent'
                    ? 'bg-white text-[var(--char)] shadow-xs'
                    : 'text-[#61574f] hover:text-[var(--char)]'
                )}
              >
                <IconHistory size={13} stroke={2} className="text-[#8c8177] shrink-0" />
                <span className="truncate">Gần đây</span>
                <span className="px-1 rounded-full bg-[#ede6de] font-mono text-[10px] shrink-0">
                  {recentOrders.length}
                </span>
              </button>
            </div>
          </div>

          {/* TAB 1: ĐƠN ĐANG PHỤC VỤ (Mini-KDS Queue) */}
          {drawerTab === 'serving' && (
            <div className="grid gap-3.5 mt-3.5 pb-6">
              {!servingOrdersCount && (
                <div className="text-center p-8 bg-[#fffdfa] rounded-2xl border border-[#ede6de]">
                  <IconToolsKitchen2 size={36} stroke={1.5} className="mx-auto text-[#c5bcaf] mb-2" />
                  <p className="font-bold text-sm text-[var(--char)]">Hiện không có đơn nào đang chờ pha</p>
                  <span className="text-xs text-[#8c8177] mt-1 block">Các đơn mới từ quầy và bàn sẽ tự động xuất hiện tại đây.</span>
                </div>
              )}

              {servingQueue.data?.orders?.map((order) => {
                const isMaking = order.kdsStatus === 'making'
                const isReady = order.kdsStatus === 'ready'
                const isNew = order.kdsStatus === 'new'
                const waitMinutes = Math.floor((Date.now() - order.createdAt) / 60000)

                return (
                  <div
                    key={order.id}
                    className={cn(
                      'p-4 rounded-2xl border bg-white shadow-2xs flex flex-col gap-2.5 transition-all',
                      isMaking ? 'border-[#3b82f6]/40 bg-[#f8fbff]' : isReady ? 'border-[#22c55e]/40 bg-[#f7fcf8]' : 'border-[#ede6de]'
                    )}
                  >
                    {/* Order Head */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold font-mono text-[var(--char)]">
                          #{order.orderCode}
                        </span>
                        <span className="text-xs font-semibold text-[#61574f]">
                          {order.source === 'table' ? (order.tableName ? (order.tableName.startsWith('Bàn') ? order.tableName : `Bàn ${order.tableName}`) : 'Tại bàn') : (order.source === 'takeaway' ? 'Mang đi' : 'Tại quầy')}
                        </span>
                      </div>

                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[10.5px] font-extrabold flex items-center gap-1',
                        isNew ? 'bg-[#fff8e1] text-[#b45309]' : isMaking ? 'bg-[#eff6ff] text-[#1d4ed8]' : 'bg-[#e8f5e9] text-[#2e7d32]'
                      )}>
                        {isNew ? '● Chờ pha' : isMaking ? '⚙ Đang pha' : '✓ Đã xong'}
                      </span>
                    </div>

                    {/* Lines list */}
                    <div className="grid gap-1 py-1 text-xs">
                      {order.lines.map((l) => (
                        <div key={l.id} className="flex justify-between items-start">
                          <div>
                            <strong className="text-[var(--char)]">{l.quantity} × {l.name}</strong>
                            {l.variant && !['Mặc định', 'Phần'].includes(l.variant) && (
                              <span className="text-[#8c8177]"> · {l.variant}</span>
                            )}
                            {l.modifiers && l.modifiers.length > 0 && (
                              <span className="text-[#a09488] block text-[11px]">
                                +{l.modifiers.map((m) => m.name).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <IconClock size={13} stroke={1.75} className="text-[#8c8177] shrink-0" />
                        <span className="font-mono font-bold text-[var(--char)]">
                          {new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={cn(
                          'font-semibold',
                          waitMinutes >= 10 ? 'text-[var(--ember)]' : 'text-[#8c8177]'
                        )}>
                          · {waitMinutes < 1 ? 'vừa mới' : `${waitMinutes} phút`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isNew && (
                          <Button
                            size="xs"
                            variant="primary"
                            disabled={updateKdsStatus.isPending}
                            onClick={() => updateKdsStatus.mutate({ orderId: order.id, status: 'making' })}
                            className="flex items-center gap-1 font-bold text-xs"
                          >
                            <IconPlayerPlay size={13} stroke={2} />
                            <span>Bắt đầu pha</span>
                          </Button>
                        )}
                        {isMaking && (
                          <Button
                            size="xs"
                            variant="primary"
                            disabled={updateKdsStatus.isPending}
                            onClick={() => updateKdsStatus.mutate({ orderId: order.id, status: 'ready' })}
                            className="bg-[#2e7d32] hover:bg-[#1b5e20] flex items-center gap-1 font-bold text-xs"
                          >
                            <IconCheck size={13} stroke={2.5} />
                            <span>Đã pha xong</span>
                          </Button>
                        )}
                        {isReady && (
                          <Button
                            size="xs"
                            variant="secondary"
                            disabled={updateKdsStatus.isPending}
                            onClick={() => updateKdsStatus.mutate({ orderId: order.id, status: 'served' })}
                            className="border-[#2e7d32] text-[#2e7d32] hover:bg-[#e8f5e9] flex items-center gap-1 font-bold text-xs"
                          >
                            <IconCircleCheck size={13} stroke={2} />
                            <span>Hoàn tất & Giao</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* TAB 2: 5 ĐƠN GẦN ĐÂY (Recent Paid Orders) */}
          {drawerTab === 'recent' && (
            <div className="grid gap-3 mt-3.5 pb-6">
              {!recentOrders.length && (
                <div className="text-center p-8 bg-[#fffdfa] rounded-2xl border border-[#ede6de]">
                  <IconReceipt size={36} stroke={1.5} className="mx-auto text-[#c5bcaf] mb-2" />
                  <p className="font-bold text-sm text-[var(--char)]">Chưa có đơn đã thanh toán gần đây</p>
                  <span className="text-xs text-[#8c8177] mt-1 block">Sau khi thanh toán đơn tại POS, đơn sẽ tự động xuất hiện tại đây để in lại hoặc xem lại.</span>
                </div>
              )}

              {recentOrders.map((order) => {
                return (
                  <div
                    key={order.id}
                    className="p-3.5 rounded-2xl border border-[#ede6de] bg-white shadow-2xs flex flex-col gap-2.5"
                  >
                    {/* Compact Card Top */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {order.displayNumber ? (
                          <span className="px-2 py-0.5 rounded-lg bg-[#f0e6d7] text-[#684838] font-bold text-xs font-mono border border-[#ded6cd]">
                            #{String(order.displayNumber).padStart(3, '0')}
                          </span>
                        ) : null}
                        <span className="text-xs font-mono font-bold text-[var(--char)]">
                          #{order.orderCode}
                        </span>
                        <span className="text-xs text-[#61574f]">
                          {order.source === 'table' ? (order.tableName ? (order.tableName.startsWith('Bàn') ? order.tableName : `Bàn ${order.tableName}`) : 'Tại bàn') : (order.source === 'takeaway' ? 'Mang đi' : 'Tại quầy')}
                        </span>
                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-extrabold bg-[#e8f5e9] text-[#2e7d32]">
                        ✓ Đã thanh toán
                      </span>
                    </div>

                    {/* Compact Card Bottom: Time & Total & Action Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#ede6de]/80">
                      <div>
                        <span className="font-mono tabular-nums text-base font-extrabold text-[var(--char)] block">
                          {formatMoney(order.total)}
                        </span>
                        <span className="text-[10.5px] text-[#8c8177] flex items-center gap-1 mt-0.5">
                          <IconClock size={11} stroke={1.75} />
                          <span>{new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · Thu ngân: {order.cashier}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => window.print()}
                          className="flex items-center gap-1 text-xs"
                          aria-label="In lại hóa đơn"
                        >
                          <IconPrinter size={13} stroke={1.75} />
                          <span>In lại</span>
                        </Button>
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => setSelectedRecentDetailId(order.id)}
                          className="flex items-center gap-1 text-xs font-bold"
                          aria-label="Xem chi tiết đơn"
                        >
                          <span>Chi tiết</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Root>

      {/* Recent Order Detail & Manager Cancellation Modal */}
      <Drawer.Root
        open={Boolean(selectedRecentDetailId)}
        onOpenChange={(open) => { if (!open) { setSelectedRecentDetailId(null); setCancelReason(''); setManagerEmail(''); setManagerPassword('') } }}
      >
        <Drawer.Content className="max-w-lg w-full">
          <div className="flex items-start justify-between pb-4 border-b border-[#ede6de]">
            <div>
              <p className="eyebrow text-xs text-[#8c8177] uppercase font-bold tracking-wider">
                CHI TIẾT ĐƠN ĐÃ THANH TOÁN
              </p>
              <Drawer.Title className="text-xl font-bold font-display text-[var(--char)] mt-0.5">
                {recentDetailQuery.data?.displayNumber ? `Đơn #${String(recentDetailQuery.data.displayNumber).padStart(3, '0')}` : (recentDetailQuery.data ? `Đơn #${recentDetailQuery.data.orderCode}` : 'Đơn hàng')}
              </Drawer.Title>
            </div>
            <Drawer.Close aria-label="Đóng" className="dialog-close-btn">
              <IconX size={18} stroke={1.75} />
            </Drawer.Close>
          </div>

          {recentDetailQuery.isLoading && <p className="floor-feedback mt-4">Đang tải chi tiết đơn…</p>}
          {recentDetailQuery.isError && <p className="floor-feedback is-error mt-4">{recentDetailQuery.error.message}</p>}

          {recentDetailQuery.data && (
            <div className="grid gap-4 mt-4 pb-6 text-xs">
              {/* Order Meta */}
              <div className="p-3.5 bg-[#fffdfa] border border-[#ede6de] rounded-xl flex justify-between items-center">
                <div>
                  <strong className="text-[var(--char)] text-sm block">
                    {recentDetailQuery.data.source === 'table' ? (recentDetailQuery.data.tableName || 'Tại bàn') : (recentDetailQuery.data.source === 'takeaway' ? 'Mang đi' : 'Tại quầy')}
                  </strong>
                  <span className="text-[#8c8177] mt-0.5 block">Thu ngân: {recentDetailQuery.data.cashier}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-[var(--char)] font-bold block">{new Date(recentDetailQuery.data.createdAt).toLocaleTimeString('vi-VN')}</span>
                  <span className="font-mono text-[10.5px] text-[#8c8177]">{new Date(recentDetailQuery.data.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>

              {/* Items list */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#8c8177] mb-2">Món đã gọi</h4>
                <div className="grid gap-2">
                  {recentDetailQuery.data.lines?.map((line: any) => (
                    <div key={line.id} className="p-3 rounded-xl border border-[#ede6de] bg-white flex justify-between items-start">
                      <div>
                        <strong className="text-[var(--char)] text-sm block">{line.name}</strong>
                        <small className="text-[#8c8177] block mt-0.5">
                          {line.variant || 'Tiêu chuẩn'}
                          {line.modifiers?.length ? ` · ${line.modifiers.map((m: any) => m.name).join(', ')}` : ''}
                        </small>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-[var(--char)] block">
                          {line.quantity} × {formatMoney(line.unitPrice)}
                        </span>
                        <span className="font-mono text-xs text-[#8c8177] block">{formatMoney(line.lineTotal)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-4 bg-[#fffdfa] border border-[#ede6de] rounded-xl grid gap-2">
                <div className="flex justify-between text-[#8c8177]">
                  <span>Tạm tính</span>
                  <span className="font-mono font-semibold text-[var(--char)]">{formatMoney(recentDetailQuery.data.subtotal)}</span>
                </div>
                {recentDetailQuery.data.discountAmount > 0 && (
                  <div className="flex justify-between text-[var(--ember)] font-medium">
                    <span>Giảm giá</span>
                    <span className="font-mono">-{formatMoney(recentDetailQuery.data.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-[var(--char)] pt-2 border-t border-[#ede6de]">
                  <span>Tổng tiền đã thanh toán</span>
                  <span className="font-mono text-[var(--ember)] text-base">{formatMoney(recentDetailQuery.data.total)}</span>
                </div>
              </div>

              {/* Actions: Print */}
              <div className="flex gap-2">
                <Button
                  size="md"
                  variant="outline"
                  onClick={() => window.print()}
                  className="w-full font-bold flex items-center justify-center gap-1.5"
                >
                  <IconPrinter size={16} stroke={1.75} />
                  <span>In lại biên lai</span>
                </Button>
              </div>

              {/* Manager Cancellation Flow (Strict Requirement: Inside Detail View Only) */}
              {user.permissions.includes('pos.cancel') && (
                <div className="p-4 bg-[#fff9f8] border border-[#fbdcd0] rounded-xl grid gap-3 mt-1">
                  <div>
                    <h5 className="text-xs font-bold text-[var(--ember)] uppercase tracking-wider">Hủy & hoàn tiền đơn đã thanh toán</h5>
                    <p className="text-[11px] text-[#8c8177] mt-0.5">
                      Yêu cầu nhập lý do và mật khẩu quản lý để duyệt hoàn tiền mặt.
                    </p>
                  </div>

                  <Field.Root>
                    <Field.Label className="text-xs font-semibold text-[var(--char)]">Lý do hủy đơn *</Field.Label>
                    <Input
                      size="sm"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="VD: Khách trả món, thanh toán nhầm"
                      className="bg-white mt-1"
                    />
                  </Field.Root>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Field.Root>
                      <Field.Label className="text-xs font-semibold text-[var(--char)]">Email Quản lý</Field.Label>
                      <Input
                        size="sm"
                        type="email"
                        value={managerEmail}
                        onChange={(e) => setManagerEmail(e.target.value)}
                        placeholder="manager@tomny.coffee"
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

                  {cancelOrderMutation.isError && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-[#fdf2f2] text-xs text-[#9c1c1c]">
                      <IconAlertCircle size={15} stroke={1.75} className="shrink-0" />
                      <span>{cancelOrderMutation.error?.message ?? 'Không thể hủy đơn.'}</span>
                    </div>
                  )}

                  <Button
                    variant="danger"
                    size="md"
                    disabled={cancelOrderMutation.isPending || cancelReason.trim().length < 3 || !managerEmail.trim() || !managerPassword}
                    onClick={() => cancelOrderMutation.mutate()}
                    className="w-full font-bold text-xs"
                  >
                    {cancelOrderMutation.isPending ? 'Đang xử lý…' : 'Xác nhận hủy & hoàn tiền'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Root>

      {/* Fast Variant & Modifiers Configuration Dialog (≤ 3 taps) */}
      <Dialog.Root open={configuringProduct !== null} onOpenChange={(open) => { if (!open) { setConfiguringProduct(null); setSelectedVariantId(null); setSelectedModifierIds([]) } }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="dialog-backdrop" />
          <Dialog.Viewport className="dialog-viewport">
            <Dialog.Popup className="product-config-dialog max-w-md w-full">
              <p className="eyebrow text-xs font-bold uppercase text-[#8c8177]">TÙY CHỌN MÓN</p>
              <Dialog.Title className="text-xl font-bold font-display text-[var(--char)] mt-0.5">
                {configuringProduct?.name}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-[#8c8177] mt-0.5">
                {configuringProduct?.description || 'Chọn kích cỡ và tùy chọn đính kèm trước khi thêm vào đơn.'}
              </Dialog.Description>

              {/* Sizes (Large Touch Pills) */}
              <div className="mt-4">
                <label className="text-xs font-bold uppercase tracking-wider text-[#61574f] block mb-2">
                  Kích cỡ (Size) *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {configVariants.map((variant) => {
                    const isSelected = selectedVariantId === variant.id
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        className={cn(
                          'p-2.5 rounded-xl border text-center transition-all cursor-pointer select-none flex flex-col items-center justify-center gap-0.5',
                          isSelected
                            ? 'bg-[var(--espresso)] text-[var(--crema)] border-[var(--espresso)] shadow-xs'
                            : 'bg-white text-[var(--char)] border-[#ded6cc] hover:bg-[#faf7f2]'
                        )}
                        onClick={() => { setSelectedVariantId(variant.id); setSelectedModifierIds([]) }}
                      >
                        <span className="text-xs font-bold">{variant.name}</span>
                        <span className={cn('text-[11px] font-mono tabular-nums', isSelected ? 'text-[var(--crema)]/90' : 'text-[var(--ember)]')}>
                          {formatMoney(variant.price)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Modifiers (Sugar / Ice / Toppings) */}
              {configGroups.map((group) => (
                <fieldset className="modifier-choice-group mt-4 pt-3 border-t border-[#ede6de]" key={group.id}>
                  <legend className="text-xs font-bold uppercase tracking-wider text-[#61574f]">
                    {group.name}{' '}
                    <small className="text-[#8c8177] font-normal lowercase">
                      ({group.minSelections === group.maxSelections ? `chọn ${group.maxSelections}` : `chọn ${group.minSelections}–${group.maxSelections}`})
                    </small>
                  </legend>
                  <div className="modifier-choices grid grid-cols-2 gap-2 mt-2">
                    {group.modifiers.filter((modifier) => modifier.active).map((modifier) => {
                      const checked = selectedModifierIds.includes(modifier.id)
                      return (
                        <label
                          key={modifier.id}
                          className={cn(
                            'p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all cursor-pointer select-none',
                            checked
                              ? 'bg-[#fff5eb] border-[var(--ember)] text-[var(--char)] font-bold shadow-2xs'
                              : 'bg-white border-[#ded6cc] text-[#61574f] hover:bg-[#faf7f2]'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Checkbox.Root
                              checked={checked}
                              onCheckedChange={() => setSelectedModifierIds((current) => checked ? current.filter((id) => id !== modifier.id) : [...current, modifier.id])}
                              aria-label={`Chọn ${modifier.name}`}
                            >
                              <Checkbox.Indicator />
                            </Checkbox.Root>
                            <span className="truncate">{modifier.name}</span>
                          </div>
                          <span className="font-mono tabular-nums text-[11px] text-[var(--ember)] shrink-0">
                            {modifier.priceDelta ? `+${formatMoney(modifier.priceDelta)}` : '0₫'}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              ))}

              {/* Modal Bottom CTA */}
              <div className="dialog-actions mt-5 flex gap-2">
                <Dialog.Close className="print-button shrink-0">Hủy</Dialog.Close>
                <PrimaryButton
                  size="md"
                  disabled={!selectedVariantId || !configValid || draftLoading}
                  onClick={() => {
                    if (configuringProduct && selectedConfigVariant) {
                      void addVariant(configuringProduct, selectedConfigVariant, selectedModifierIds)
                      setConfiguringProduct(null)
                      setSelectedVariantId(null)
                      setSelectedModifierIds([])
                    }
                  }}
                  className="flex-1 font-bold text-xs"
                >
                  Thêm vào đơn · {selectedConfigVariant ? formatMoney(selectedConfigVariant.price + selectedModifierIds.reduce((sum, modId) => {
                    const mod = configGroups.flatMap((g) => g.modifiers).find((m) => m.id === modId)
                    return sum + (mod?.priceDelta ?? 0)
                  }, 0)) : '0₫'}
                </PrimaryButton>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
