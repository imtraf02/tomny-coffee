import { Dialog } from '@/components/ui/dialog'
import { Tabs } from '@/components/ui/tabs'
import { Drawer } from '@/components/ui/drawer'
import { AppSelect, type SelectOption } from '@/components/ui/select'
import { Button, PrimaryButton, SecondaryButton } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/lib/use-mobile'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconSearch,
  IconX,
  IconCoffee,
  IconPlus,
  IconMinus,
  IconCash,
  IconCheck,
  IconReceipt,
  IconArrowsJoin,
  IconArrowLeft,
} from '@tabler/icons-react'
import { DraftTools } from '../components/draft-tools'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ReceiptModal } from '@/components/receipt-modal'
import type { ReceiptOrderData } from '@/components/receipt-document'
import { cacheCatalog, cachedCatalog, deviceId, syncOutbox, type CatalogCategory, type CatalogCombo, type CatalogModifierGroup, type CatalogProduct, type CatalogVariant } from '../client/outbox'
import { calculateTotal } from '../core/money'
import { readSession } from '../server/session'

type OrderItem = { id: string; menuItemId: string; variantId: string; name: string; variant: string; price: number; quantity: number; modifierIds: string[]; modifiers?: Array<{ id: string; name: string; priceDelta?: number }> }
type TableStatus = 'trong' | 'dang_phuc_vu' | 'dat_truoc' | 'can_don'
type OperationalTable = { id: string; zoneId: string | null; name: string; shape: 'square' | 'round'; status: TableStatus; activeOrderId?: string | null }
type FloorPlan = { zones: { id: string; name: string }[]; tables: OperationalTable[] }
type PosCatalog = { categories: CatalogCategory[]; products: CatalogProduct[]; modifierGroups?: CatalogModifierGroup[]; combos?: CatalogCombo[]; cachedAt: number; fromCache: boolean }
type DraftOrder = {
  id: string
  orderCode: string
  displayNumber?: number
  version: number
  source?: 'table' | 'counter' | 'takeaway'
  tableId: string | null
  tableName?: string | null
  tableIds?: string[]
  tableNames?: string[]
  zoneName?: string | null
  subtotal?: number
  total: number
  createdAt?: number
  updatedAt?: number
  cashier?: string
  lines: Array<{
    id: string
    menuItemId: string
    variantId: string
    name: string
    variant: string
    unitPrice: number
    quantity: number
    modifiers: Array<{ id: string; name?: string; priceDelta?: number }>
  }>
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
  const isMobile = useIsMobile()
  const [categoryId, setCategoryId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [items, setItems] = useState<OrderItem[]>([])
  const [configuringProduct, setConfiguringProduct] = useState<CatalogProduct | null>(null)
  const [cachedConfigProduct, setCachedConfigProduct] = useState<CatalogProduct | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([])
  const [configQuantity, setConfigQuantity] = useState(1)

  useEffect(() => {
    if (configuringProduct) {
      setCachedConfigProduct(configuringProduct)
    }
  }, [configuringProduct])
  const [paid, setPaid] = useState(false)
  const [lastPaidReceiptData, setLastPaidReceiptData] = useState<ReceiptOrderData | null>(null)
  const [reprintReceiptData, setReprintReceiptData] = useState<ReceiptOrderData | null>(null)
  const [confirmPayOpen, setConfirmPayOpen] = useState(false)
  const [completeKdsOnPay, setCompleteKdsOnPay] = useState(true)
  const [paymentMessage, setPaymentMessage] = useState('')
  const [lastPaidOrder, setLastPaidOrder] = useState<{ id: string; version: number } | null>(null)
  const [refunding, setRefunding] = useState(false)
  const [refundForm, setRefundForm] = useState({ reason: '', username: '', password: '' })
  const [refundMessage, setRefundMessage] = useState('')
  const [refundError, setRefundError] = useState('')
  const [orderContext, setOrderContext] = useState<'counter' | 'takeaway' | 'table'>('table')
  const [selectedTable, setSelectedTable] = useState<OperationalTable | null>(null)
  const [activeDraft, setActiveDraft] = useState<DraftOrder | null>(null)
  const [draftLoading, setDraftLoading] = useState(false)
  const [operationMessage, setOperationMessage] = useState('')
  const hydratingDraft = useRef(false)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent')
  const [discountValue, setDiscountValue] = useState(0)
  const [discountReason, setDiscountReason] = useState('')
  const [showDiscountForm, setShowDiscountForm] = useState(false)
  const [mobileView, setMobileView] = useState<'main' | 'ticket'>('main')

  // Group mode: multi-select tables to create a grouped order
  const [isGroupMode, setIsGroupMode] = useState(false)
  const [pendingGroupTableIds, setPendingGroupTableIds] = useState<string[]>([])

  const catalog = useQuery({ queryKey: ['menu-catalog'], queryFn: getPosCatalog, staleTime: 5 * 60 * 1000 })
  const floorPlan = useQuery({ queryKey: ['floor-plan', 'operational'], queryFn: getOperationalFloorPlan, refetchInterval: 3500 })

  // Active Unpaid Orders Query (for open drafts in table section)
  const activeDraftsQuery = useQuery({
    queryKey: ['pos-active-drafts'],
    queryFn: async () => {
      const response = await fetch('/api/orders/drafts')
      if (!response.ok) return { orders: [] as DraftOrder[] }
      const data = (await response.json()) as { orders: DraftOrder[] }
      return { orders: data.orders ?? [] }
    },
    refetchInterval: 3000,
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
        // In normal mode: single tableId. Group mode creates draft with tableIds[] but only reachable
        // after confirmGroupMode(), so here selectedTable is always the primary table.
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
      void floorPlan.refetch()
      void activeDraftsQuery.refetch()
    } catch (error) { setOperationMessage(error instanceof Error ? error.message : 'Không thể thêm món vào ticket.') }
    finally { setDraftLoading(false) }
  }

  function selectProduct(product: CatalogProduct) {
    const variants = product.variants.filter((variant) => variant.active)
    if (variants.length === 1 && !(variants[0].modifierGroupIds?.length)) {
      void addVariant(product, variants[0])
      return
    }
    const defaultVariant = variants[0] ?? null
    const defaultMods: string[] = []
    if (defaultVariant?.modifierGroupIds?.length) {
      for (const gid of defaultVariant.modifierGroupIds) {
        const group = (catalog.data?.modifierGroups ?? []).find((g) => g.id === gid)
        if (group && group.minSelections === 1 && group.maxSelections === 1) {
          const firstActiveMod = group.modifiers.find((m) => m.active)
          if (firstActiveMod) defaultMods.push(firstActiveMod.id)
        }
      }
    }
    setConfigQuantity(1)
    setConfiguringProduct(product)
    setSelectedVariantId(defaultVariant?.id ?? null)
    setSelectedModifierIds(defaultMods)
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
      void activeDraftsQuery.refetch()
    } catch (error) { setOperationMessage(error instanceof Error ? error.message : 'Không thể hủy món.') }
    finally { setDraftLoading(false) }
  }

  function selectDraftOrder(draft: DraftOrder, autoOpenPay = false) {
    hydratingDraft.current = true
    setActiveDraft(draft)
    setItems(consolidateDraftLines(draft.lines))
    const nextContext = (draft.source as 'table' | 'counter' | 'takeaway') || (draft.tableId ? 'table' : 'counter')
    setOrderContext(nextContext)

    if (draft.tableId && floorPlan.data?.tables) {
      const targetTable = floorPlan.data.tables.find((t) => t.id === draft.tableId)
      if (targetTable) {
        setSelectedTable(targetTable)
        if (targetTable.zoneId) setSelectedZoneId(targetTable.zoneId)
      }
    } else {
      setSelectedTable(null)
    }

    setMobileView('ticket')
    setTimeout(() => {
      hydratingDraft.current = false
      if (autoOpenPay) {
        setConfirmPayOpen(true)
      }
    }, 100)
  }


  async function openTable(table: OperationalTable) {
    if (table.status === 'dat_truoc' || table.status === 'can_don') {
      setOperationMessage(table.status === 'dat_truoc' ? 'Bàn đang được giữ cho khách đặt trước.' : 'Bàn cần được xử lý trước khi nhận đơn.')
      return
    }
    setDraftLoading(true)
    setOperationMessage('')
    try {
      const response = await fetch(`/api/orders/drafts?tableId=${encodeURIComponent(table.id)}`)
      if (!response.ok) throw new Error('Không tải được đơn đang mở của bàn.')
      const body = await response.json() as { orders: DraftOrder[] }
      const draft = body.orders[0]
      if (draft) {
        selectDraftOrder({ ...draft, tableId: table.id, tableName: table.name, source: 'table' })
      } else {
        setSelectedTable(table)
        setOrderContext('table')
        setActiveDraft(null)
        setItems([])
        setDiscountValue(0)
        setDiscountReason('')
      }
      setMobileView('ticket')
      void floorPlan.refetch()
      void activeDraftsQuery.refetch()
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Không thể mở bàn.')
    } finally {
      setDraftLoading(false)
    }
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
    setOrderContext(nextContext)
    if (nextContext !== 'table') {
      setSelectedTable(null)
      setActiveDraft(null)
      setItems([])
      setDiscountValue(0)
      setDiscountReason('')
    }
    void floorPlan.refetch()
  }

  async function moveToTable(tableId: string) {
    const target = floorPlan.data?.tables.find((candidate) => candidate.id === tableId)
    if (target) await openTable(target)
  }

  function exitGroupMode() {
    setIsGroupMode(false)
    setPendingGroupTableIds([])
  }

  async function confirmGroupMode() {
    if (pendingGroupTableIds.length < 2) return
    setDraftLoading(true)
    setOperationMessage('')
    try {
      const primaryTableId = pendingGroupTableIds[0]
      const primaryTable = floorPlan.data?.tables.find((t) => t.id === primaryTableId)
      const response = await fetch('/api/orders/drafts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create', source: 'table', tableIds: pendingGroupTableIds, idempotencyKey: crypto.randomUUID(), lines: [] }),
      })
      const body = await response.json().catch(() => ({})) as { message?: string } & Partial<DraftOrder>
      if (!response.ok) throw new Error((body as { message?: string }).message ?? 'Không thể tạo ticket gộp bàn.')
      const draft = body as DraftOrder
      // Enrich draft with multi-table names
      const tableNames = pendingGroupTableIds.map((id) => floorPlan.data?.tables.find((t) => t.id === id)?.name ?? id)
      setActiveDraft({ ...draft, tableIds: pendingGroupTableIds, tableNames })
      setItems([])
      setDiscountValue(0)
      setDiscountReason('')
      if (primaryTable) {
        setSelectedTable(primaryTable)
        setOrderContext('table')
        if (primaryTable.zoneId) setSelectedZoneId(primaryTable.zoneId)
      }
      exitGroupMode()
      setMobileView('ticket')
      void floorPlan.refetch()
      void activeDraftsQuery.refetch()
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Không thể tạo ticket.')
    } finally {
      setDraftLoading(false)
    }
  }

  async function completeCashPayment(options?: { completeKds?: boolean }) {
    if (!items.length) return
    const idempotencyKey = crypto.randomUUID()
    const finalize = (message: string) => {
      const receiptSnapshot: ReceiptOrderData = {
        orderCode: activeDraft?.orderCode || `ORD-${Date.now().toString().slice(-6)}`,
        tableName: selectedTable?.name || (orderContext === 'table' ? 'Bàn phục vụ' : null),
        source: orderContext,
        cashier: user.displayName || user.email,
        createdAt: new Date(),
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          variantName: item.variant,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: (item.price + (item.modifiers?.reduce((sum, m) => sum + (m.priceDelta ?? 0), 0) ?? 0)) * item.quantity,
          modifiers: item.modifiers,
        })),
        subtotal,
        discountAmount,
        discountReason: discountReason || undefined,
        total,
        paymentMethod: 'Tiền mặt',
        receivedAmount: total,
        changeAmount: 0,
      }
      setLastPaidReceiptData(receiptSnapshot)
      setPaymentMessage(message)
      setLastPaidOrder(activeDraft ? { id: activeDraft.id, version: activeDraft.version + 1 } : null)
      setItems([])
      setSelectedTable(null)
      setActiveDraft(null)
      setOrderContext('counter')
      setDiscountValue(0)
      setDiscountReason('')
      setPaid(true)
      setMobileView('main')
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
        await activeDraftsQuery.refetch()
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
        body: JSON.stringify({ action: 'cancel', orderId: lastPaidOrder.id, expectedVersion: lastPaidOrder.version, reason: refundForm.reason.trim(), manager: { username: refundForm.username.trim(), password: refundForm.password } }),
      })
      const body = await response.json().catch(() => ({})) as { message?: string }
      if (!response.ok) throw new Error(body.message ?? 'Không thể hủy đơn đã thanh toán.')
      setRefundMessage('Đã hủy toàn bộ đơn và hoàn tiền mặt đầy đủ. Quản lý xác nhận hoàn tiền.')
      setRefundForm({ reason: '', username: '', password: '' })
      await floorPlan.refetch()
      await activeDraftsQuery.refetch()
    } catch (error) { setRefundError(error instanceof Error ? error.message : 'Không thể hủy đơn đã thanh toán.') }
  }

  const activeConfigProduct = configuringProduct ?? cachedConfigProduct
  const configVariants = activeConfigProduct?.variants.filter((variant) => variant.active) ?? []
  const selectedConfigVariant = configVariants.find((variant) => variant.id === selectedVariantId)
  const configGroups = (catalog.data?.modifierGroups ?? []).filter((group) => selectedConfigVariant?.modifierGroupIds?.includes(group.id))
  const configValid = configGroups.every((group) => { const count = group.modifiers.filter((modifier) => selectedModifierIds.includes(modifier.id)).length; return count >= group.minSelections && count <= group.maxSelections })

  const singleUnitPrice = (selectedConfigVariant?.price ?? 0) + selectedModifierIds.reduce((sum, modId) => {
    const mod = configGroups.flatMap((g) => g.modifiers).find((m) => m.id === modId)
    return sum + (mod?.priceDelta ?? 0)
  }, 0)
  const totalConfigPrice = singleUnitPrice * configQuantity

  function handleSelectVariant(variantId: string) {
    setSelectedVariantId(variantId)
    const variant = configVariants.find((v) => v.id === variantId)
    if (!variant) return
    const supportedGroupIds = new Set(variant.modifierGroupIds ?? [])
    const nextModifierGroups = (catalog.data?.modifierGroups ?? []).filter((g) => supportedGroupIds.has(g.id))

    setSelectedModifierIds((current) => {
      const retained = current.filter((id) => nextModifierGroups.some((g) => g.modifiers.some((m) => m.id === id)))
      for (const g of nextModifierGroups) {
        if (g.minSelections === 1 && g.maxSelections === 1) {
          const hasInGroup = retained.some((id) => g.modifiers.some((m) => m.id === id))
          if (!hasInGroup) {
            const firstActive = g.modifiers.find((m) => m.active)
            if (firstActive) retained.push(firstActive.id)
          }
        }
      }
      return retained
    })
  }

  function handleToggleModifier(group: CatalogModifierGroup, modifierId: string) {
    setSelectedModifierIds((current) => {
      const isSingle = group.maxSelections === 1
      const groupModIds = new Set(group.modifiers.map((m) => m.id))
      const isAlreadySelected = current.includes(modifierId)

      if (isSingle) {
        if (isAlreadySelected) {
          return group.minSelections === 0 ? current.filter((id) => id !== modifierId) : current
        }
        return [...current.filter((id) => !groupModIds.has(id)), modifierId]
      }

      if (isAlreadySelected) {
        return current.filter((id) => id !== modifierId)
      } else {
        const currentSelectedInGroup = current.filter((id) => groupModIds.has(id)).length
        if (group.maxSelections && currentSelectedInGroup >= group.maxSelections) {
          return current
        }
        return [...current, modifierId]
      }
    })
  }

  async function handleAddConfiguredProduct() {
    if (!activeConfigProduct || !selectedConfigVariant || !configValid || draftLoading) return
    const qty = Math.max(1, configQuantity)
    for (let i = 0; i < qty; i++) {
      await addVariant(activeConfigProduct, selectedConfigVariant, selectedModifierIds)
    }
    setConfiguringProduct(null)
    setSelectedVariantId(null)
    setSelectedModifierIds([])
    setConfigQuantity(1)
  }

  const activeDrafts = activeDraftsQuery.data?.orders ?? []
  const activeDraftsCount = activeDrafts.length

  return (
    <div className="pos-screen">
      <main className="pos-main">
        <section className={cn('menu-pane', mobileView === 'ticket' && 'is-hidden-mobile')} aria-label="Khu vực chọn bàn và món">
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
                    <button
                      type="button"
                      className={cn('pos-group-mode-toggle', isGroupMode && 'is-active')}
                      onClick={() => { if (isGroupMode) exitGroupMode(); else setIsGroupMode(true) }}
                      title="Gộp bàn"
                    >
                      <IconArrowsJoin size={13} stroke={2.5} />
                      <span>{isGroupMode ? 'Huỷ' : 'Gộp bàn'}</span>
                    </button>
                  </div>
                )}
              </div>

              <Tabs.Panel value="table" className="pos-context-panel mt-1">
                {!!floorPlan.data?.zones.length && (
                  <div className={cn('pos-tables-wrap', isGroupMode && 'is-group-mode')}>
                    {tablesInZone.length ? (
                      <div className="pos-tables-list" role="list">
                        {tablesInZone.map((table) => {
                          const isSelected = selectedTable?.id === table.id
                          const isPending = pendingGroupTableIds.includes(table.id)
                          const isOccupiedByOther = table.status === 'dang_phuc_vu'
                          const isDisabled = table.status === 'dat_truoc' || table.status === 'can_don' || draftLoading
                            || (isGroupMode && isOccupiedByOther && !isPending)

                          // In group mode: only empty tables are selectable (and already-pending ones to deselect)
                          const handleClick = isGroupMode
                            ? () => {
                                if (isOccupiedByOther) return
                                setPendingGroupTableIds((ids) =>
                                  ids.includes(table.id) ? ids.filter((id) => id !== table.id) : [...ids, table.id]
                                )
                              }
                            : () => void openTable(table)

                          return (
                            <button
                              key={table.id}
                              type="button"
                              disabled={isDisabled}
                              className={cn(
                                'pos-table-card',
                                `status-${table.status}`,
                                isSelected && !isGroupMode && 'is-selected',
                                isPending && 'is-group-pending',
                                isGroupMode && isOccupiedByOther && 'is-group-dimmed',
                              )}
                              onClick={handleClick}
                              aria-pressed={isGroupMode ? isPending : undefined}
                              aria-label={`${table.name}, ${tableStatusLabel(table.status)}${isPending ? ', đã chọn' : ''}`}
                            >
                              <span className="pos-table-name">{table.name}</span>
                              <span className="pos-table-status">
                                {isPending ? 'Đã chọn' : tableStatusLabel(table.status)}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="pos-tables-empty">Khu vực này chưa có bàn nào.</p>
                    )}

                    {/* Group mode confirmation bar */}
                    {isGroupMode && (
                      <div className="pos-group-bar">
                        <span className="pos-group-bar-label">
                          {pendingGroupTableIds.length === 0
                            ? 'Chọn 2+ bàn trống để gộp'
                            : pendingGroupTableIds.length === 1
                            ? `Đã chọn 1 bàn — chọn thêm ít nhất 1 bàn nữa`
                            : `Gộp ${pendingGroupTableIds.length} bàn: ${pendingGroupTableIds.map((id) => floorPlan.data?.tables.find((t) => t.id === id)?.name ?? id).join(' + ')}`
                          }
                        </span>
                        <div className="pos-group-bar-actions">
                          <button type="button" className="pos-group-cancel-btn" onClick={exitGroupMode}>Huỷ</button>
                          <button
                            type="button"
                            className="pos-group-confirm-btn"
                            disabled={pendingGroupTableIds.length < 2 || draftLoading}
                            onClick={() => void confirmGroupMode()}
                          >
                            Xác nhận gộp
                          </button>
                        </div>
                      </div>
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

              {/* Active Draft Orders Strip (Always visible across all modes when orders are active) */}
              {activeDraftsCount > 0 && !isGroupMode && (
                <div className="mt-2.5 pt-2 border-t border-[#ede6de] flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--char)] flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                      <span>Hóa đơn đang phục vụ ({activeDraftsCount})</span>
                    </span>
                    <span className="text-[10.5px] text-[#8c8177]">Chạm để mở</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 pt-0.5">
                    {activeDrafts.map((draft) => {
                      const isCurrentActive = activeDraft?.id === draft.id
                      const lineCount = draft.lines.reduce((s, l) => s + l.quantity, 0)
                      const isTable = draft.source === 'table'
                      const isTakeaway = draft.source === 'takeaway'
                      const label = isTable
                        ? draft.tableNames && draft.tableNames.length > 1
                          ? draft.tableNames.join('+')
                          : draft.tableName
                            ? draft.tableName.toLowerCase().startsWith('bàn')
                              ? draft.tableName
                              : `Bàn ${draft.tableName}`
                            : 'Tại bàn'
                        : isTakeaway
                        ? `Mang đi #${String(draft.displayNumber || draft.orderCode).slice(-3)}`
                        : `Tại quầy #${String(draft.displayNumber || draft.orderCode).slice(-3)}`

                      return (
                        <button
                          key={draft.id}
                          type="button"
                          onClick={() => selectDraftOrder(draft)}
                          className={cn(
                            'w-full p-2 rounded-xl text-left border transition-all cursor-pointer select-none flex flex-col justify-between gap-1 shadow-2xs hover:shadow-xs active:scale-[0.98]',
                            isCurrentActive
                              ? 'bg-[var(--espresso)] text-[var(--crema)] border-[var(--espresso)] ring-2 ring-amber-400/40 shadow-sm'
                              : 'bg-white hover:bg-[#fcfaf7] text-[var(--char)] border-[#ded6cc] hover:border-amber-400'
                          )}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={cn(
                              'text-[9px] px-1 py-0.2 rounded font-bold uppercase shrink-0',
                              isCurrentActive
                                ? 'bg-amber-400/20 text-amber-300'
                                : isTable
                                ? 'bg-[#f5ede3] text-[#7a533b]'
                                : isTakeaway
                                ? 'bg-[#e6f4ea] text-[#137333]'
                                : 'bg-[#e8f0fe] text-[#1a73e8]'
                            )}>
                              {isTable ? 'Bàn' : isTakeaway ? 'Mang đi' : 'Quầy'}
                            </span>
                            <strong className="text-xs font-bold truncate block">{label}</strong>
                          </div>

                          <div className="flex items-baseline justify-between gap-1.5 pt-0.5">
                            <span className={cn('text-[10px] font-mono block', isCurrentActive ? 'text-[#d7ccc3]' : 'text-[#8c8177]')}>
                              #{String(draft.displayNumber || draft.orderCode).padStart(3, '0')} · {lineCount} món
                            </span>
                            <strong className={cn('text-xs font-mono tabular-nums font-bold shrink-0', isCurrentActive ? 'text-amber-300' : 'text-[var(--ember)]')}>
                              {formatMoney(draft.total)}
                            </strong>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

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
          {catalog.isLoading && (
            <div className="pos-menu-grid" role="status" aria-busy="true">
              <span className="sr-only">Đang tải menu…</span>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="pos-product-card pointer-events-none cursor-default" aria-hidden="true">
                  <Skeleton className="aspect-square w-full rounded-lg border border-[#ede6de]" />
                  <div className="pos-card-body">
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-3.5 w-1/2 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
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
                      loading="lazy"
                      decoding="async"
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
              <div className="pos-floating-info" onClick={() => setMobileView('ticket')}>
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
        <aside className={cn('order-pane', mobileView !== 'ticket' && 'is-hidden-mobile')} aria-labelledby="ticket-title">
          {/* Mobile Top Navigation Bar */}
          <div className="lg:hidden flex items-center justify-between gap-2 mb-2">
            <button
              type="button"
              onClick={() => setMobileView('main')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#ede5db] hover:bg-[#e2d8cd] text-xs font-bold text-[var(--char)] transition-all cursor-pointer shadow-2xs"
            >
              <IconArrowLeft size={16} stroke={2.2} />
              <span>Sơ đồ bàn</span>
            </button>

            <span className="text-xs font-extrabold text-[var(--char)] px-2.5 py-1 rounded-lg bg-[#ede6de]">
              {orderContext === 'table'
                ? (activeDraft?.tableNames && activeDraft.tableNames.length > 1
                    ? activeDraft.tableNames.join('+')
                    : (selectedTable ? selectedTable.name : 'Tại bàn'))
                : orderContext === 'takeaway' ? 'Mang đi' : 'Tại quầy'}
            </span>
          </div>

          <div className="ticket-card">
            <div className="order-ticket">
              <div className="ticket-head flex items-start justify-between gap-3 pb-2 border-b border-[#ede6de]">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                      orderContext === 'table'
                        ? 'bg-[#f5ede3] text-[#7a533b]'
                        : orderContext === 'takeaway'
                        ? 'bg-[#e6f4ea] text-[#137333]'
                        : 'bg-[#e8f0fe] text-[#1a73e8]'
                    )}>
                      {orderContext === 'table' ? 'Tại bàn' : orderContext === 'takeaway' ? 'Mang đi' : 'Tại quầy'}
                    </span>
                    {(activeDraft?.displayNumber || activeDraft?.orderCode) && (
                      <span className="text-[11px] font-mono font-bold text-[var(--stone)]">
                        #{String(activeDraft.displayNumber || activeDraft.orderCode).padStart(3, '0')}
                      </span>
                    )}
                  </div>
                  <strong className="text-base font-extrabold text-[var(--char)] truncate block">
                    {orderContext === 'table'
                      ? (() => {
                          if (activeDraft?.tableNames && activeDraft.tableNames.length > 1) {
                            return activeDraft.tableNames.join(' + ')
                          }
                          const name = selectedTable?.name
                          return name ? (name.toLowerCase().startsWith('bàn') ? name : `Bàn ${name}`) : 'Chưa chọn bàn'
                        })()
                      : orderContext === 'takeaway'
                      ? 'Đơn mang đi'
                      : 'Đơn tại quầy'}
                  </strong>
                </div>

                <div className="ticket-head-actions flex items-center gap-2 shrink-0">
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
                      onTableLinked={(tableIds, tableNames) => {
                        setActiveDraft((current) => current ? { ...current, tableIds, tableNames } : current)
                        void floorPlan.refetch()
                        void activeDraftsQuery.refetch()
                      }}
                      onTableUnlinked={(tableIds, tableNames) => {
                        setActiveDraft((current) => current ? { ...current, tableIds, tableNames } : current)
                        void floorPlan.refetch()
                        void activeDraftsQuery.refetch()
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
                    <span className="empty-order-sub">Chạm vào món trong thực đơn bên dưới để thêm vào đơn</span>
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

              {/* Collapsible Discount Section */}
              {user.permissions.includes('pos.discount') && items.length > 0 && (
                <div className="discount-section mt-1.5 pt-1.5 border-t border-[#ede6de]/80">
                  {!showDiscountForm && discountValue === 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowDiscountForm(true)}
                      className="text-[11.5px] font-semibold text-[#8c8177] hover:text-[var(--ember)] flex items-center gap-1.5 py-0.5 px-1.5 rounded-md hover:bg-[#f7f2eb] transition-all cursor-pointer select-none"
                    >
                      <IconPlus size={12} stroke={2.5} />
                      <span>Thêm giảm giá</span>
                    </button>
                  ) : (
                    <div className="discount-panel p-2.5 rounded-xl bg-[#fcf9f5] border border-[#ded6cc] flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <strong className="text-xs font-bold text-[var(--char)]">Giảm giá</strong>
                        <button
                          type="button"
                          onClick={() => {
                            setDiscountValue(0)
                            setDiscountReason('')
                            setShowDiscountForm(false)
                          }}
                          className="text-[11px] text-[#8c8177] hover:text-red-600 font-semibold cursor-pointer"
                        >
                          {discountValue > 0 ? 'Xóa giảm giá' : 'Đóng'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 items-center">
                        <AppSelect
                          size="sm"
                          items={DISCOUNT_TYPE_OPTIONS}
                          value={discountType}
                          onValueChange={(val) => setDiscountType(val as 'percent' | 'fixed')}
                          aria-label="Loại giảm giá"
                          triggerClassName="w-full text-xs font-medium bg-white h-8 min-h-[32px] rounded-lg"
                        />
                        <Input
                          size="sm"
                          aria-label="Giá trị giảm giá"
                          min="0"
                          max={discountType === 'percent' ? 100 : subtotal}
                          type="number"
                          value={discountValue || ''}
                          onChange={(event) => setDiscountValue(Math.max(0, Number(event.target.value) || 0))}
                          placeholder={discountType === 'percent' ? '% giảm' : 'Số tiền'}
                          className="h-8 min-h-[32px] text-xs rounded-lg bg-white"
                        />
                      </div>
                      <Input
                        size="sm"
                        aria-label="Lý do giảm giá"
                        placeholder="Lý do giảm giá (tối thiểu 3 ký tự)..."
                        value={discountReason}
                        onChange={(event) => setDiscountReason(event.target.value)}
                        className="h-8 min-h-[32px] text-xs rounded-lg bg-white"
                      />
                      {discountValue > 0 && !discountInput && (
                        <small className="text-[10.5px] text-amber-700">Nhập lý do giảm giá để ghi nhận audit.</small>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Perforated Divider before Totals */}
              <div className="ticket-notch-divider" aria-hidden="true">
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
            <div className="pay-section p-4 pt-2 flex flex-col gap-2">
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

              <p className="payment-note text-[11px] text-[#8c8177]">Chỉ hỗ trợ thanh toán tiền mặt</p>
            </div>
          </div>

          {/* Menu Catalog directly below Ticket on Mobile (List món trực tiếp bên hóa đơn) */}
          <div className="lg:hidden flex flex-col gap-3 mt-4 pt-3 border-t border-[#ede6de]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#8c8177]">
                Thực đơn chọn món
              </span>
              <span className="text-[11px] text-[#8c8177]">
                Chạm vào món để thêm vào hóa đơn
              </span>
            </div>

            {/* Quick Search & Category Bar */}
            <div className="relative flex items-center">
              <IconSearch size={15} stroke={2} className="absolute left-3 text-[#8c8177] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm món..."
                className="w-full h-9 pl-8.5 pr-8 rounded-xl bg-white border border-[#ded6cd] text-xs text-[var(--char)] placeholder-[#a19588] focus:outline-none focus:border-[var(--espresso)] focus:ring-1 focus:ring-[var(--espresso)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 p-1 text-[#8c8177] hover:text-[var(--char)] cursor-pointer"
                >
                  <IconX size={13} stroke={2.5} />
                </button>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              <button
                type="button"
                onClick={() => setCategoryId('all')}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer select-none',
                  categoryId === 'all'
                    ? 'bg-[var(--espresso)] text-[var(--crema)] shadow-2xs'
                    : 'bg-white border border-[#ded6cd] text-[#6b5d52] hover:text-[var(--char)]'
                )}
              >
                Tất cả ({catalog.data?.products?.filter((p) => p.active)?.length ?? 0})
              </button>
              {activeCategories.map((cat) => {
                const count = catalog.data?.products?.filter((p) => p.active && p.categoryId === cat.id)?.length ?? 0
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer select-none',
                      categoryId === cat.id
                        ? 'bg-[var(--espresso)] text-[var(--crema)] shadow-2xs'
                        : 'bg-white border border-[#ded6cd] text-[#6b5d52] hover:text-[var(--char)]'
                    )}
                  >
                    {cat.name} ({count})
                  </button>
                )
              })}
            </div>

            {/* Product Cards Grid */}
            <div className="pos-menu-grid">
              {visibleProducts.map((product) => {
                const activeVariants = product.variants.filter((v) => v.active)
                const isSingleVariant = activeVariants.length === 1 && !(activeVariants[0].modifierGroupIds?.length)
                const minPrice = Math.min(...activeVariants.map((v) => v.price))
                const quantityInDraft = items.filter((it) => it.menuItemId === product.id).reduce((s, it) => s + it.quantity, 0)

                return (
                  <button
                    key={product.id}
                    type="button"
                    className={cn('pos-product-card relative', quantityInDraft > 0 && 'ring-1 ring-[var(--espresso)]')}
                    onClick={() => selectProduct(product)}
                  >
                    {quantityInDraft > 0 && (
                      <span className="absolute top-2 right-2 size-5 rounded-full bg-[var(--espresso)] text-[var(--crema)] text-[10px] font-black flex items-center justify-center shadow-xs z-10">
                        {quantityInDraft}
                      </span>
                    )}
                    {product.imageKey ? (
                      <img
                        src={`/api/media/menu-images?key=${encodeURIComponent(product.imageKey)}`}
                        alt=""
                        className="pos-card-img"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="pos-card-img-placeholder" aria-hidden="true">
                        <IconCoffee size={24} stroke={1.5} className="text-[#a19588]" />
                      </div>
                    )}

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

      {/* Payment Success & Receipt Modal */}
      <ReceiptModal
        open={paid}
        onOpenChange={(open) => {
          setPaid(open)
          if (!open) {
            setRefunding(false)
            setRefundForm({ reason: '', username: '', password: '' })
            setRefundMessage('')
            setRefundError('')
            setLastPaidOrder(null)
          }
        }}
        order={lastPaidReceiptData}
        title="Thanh toán thành công"
        description={paymentMessage}
        successBadge={true}
        onNewOrder={() => setPaid(false)}
        customActions={
          user.permissions.includes('pos.cancel') && lastPaidOrder ? (
            <div className="pt-2 border-t border-[#ded1c0]/50 mt-1">
              {refunding ? (
                <div className="refund-panel p-3 bg-[#fdfaf6] border border-[#ede6de] rounded-xl text-left">
                  <h4 className="text-xs font-bold text-[var(--char)] m-0 mb-1">Hủy & hoàn tiền toàn bộ đơn</h4>
                  <p className="drawer-note text-[11px] text-[#8c8177] mb-2">Chỉ hủy toàn đơn kèm hoàn tiền tiền mặt đầy đủ.</p>
                  <Field.Root>
                    <Field.Label className="text-xs">Lý do hủy</Field.Label>
                    <Textarea size="sm" rows={2} value={refundForm.reason} onChange={(event) => setRefundForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Ví dụ: khách trả món" className="resize-none" />
                  </Field.Root>
                  <Field.Root className="mt-2">
                    <Field.Label className="text-xs">Tên đăng nhập Quản lý</Field.Label>
                    <Input size="sm" value={refundForm.username} onChange={(event) => setRefundForm((current) => ({ ...current, username: event.target.value }))} placeholder="VD: admin" />
                  </Field.Root>
                  <Field.Root className="mt-2">
                    <Field.Label className="text-xs">Mật khẩu quản lý</Field.Label>
                    <Input size="sm" type="password" value={refundForm.password} onChange={(event) => setRefundForm((current) => ({ ...current, password: event.target.value }))} placeholder="Nhập để duyệt" />
                  </Field.Root>
                  {refundMessage && <p className="form-message success-message mt-2 text-xs" role="status">{refundMessage}</p>}
                  {refundError && <p className="form-message mt-2 text-xs text-[var(--ember)]" role="alert">{refundError}</p>}
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={() => setRefunding(false)} className="flex-1">Hủy</Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={refundForm.reason.trim().length < 3 || !refundForm.username.trim() || !refundForm.password}
                      onClick={() => void refundLastPaidOrder()}
                      className="flex-1"
                    >
                      Xác nhận
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => { setRefunding(true); setRefundError('') }}
                  className="w-full text-xs text-[var(--ember)] hover:bg-[#fff0eb]"
                >
                  Hủy & hoàn tiền (quản lý)
                </Button>
              )}
            </div>
          ) : null
        }
      />

      {/* Reprint Receipt Modal */}
      <ReceiptModal
        open={Boolean(reprintReceiptData)}
        onOpenChange={(open) => { if (!open) setReprintReceiptData(null) }}
        order={reprintReceiptData}
        title="In lại hóa đơn"
        description="Bản in lại hóa đơn bán hàng."
      />


      {/* Fast Variant & Modifiers Configuration Dialog / Drawer (≤ 3 taps) */}
      {isMobile ? (
        <Drawer.Root
          open={configuringProduct !== null}
          onOpenChange={(open) => {
            if (!open) {
              setConfiguringProduct(null)
              setSelectedVariantId(null)
              setSelectedModifierIds([])
              setConfigQuantity(1)
            }
          }}
        >
          <Drawer.Content direction="bottom" className="max-w-lg w-full max-h-[90dvh] p-0 bg-[#fffdf9] rounded-t-3xl border-t border-[#ded1c0] shadow-2xl flex flex-col">
            {activeConfigProduct && (
              <>
                {/* Header */}
                <div className="px-5 pt-3.5 pb-3 border-b border-[#ede6de] flex items-center gap-3 shrink-0 bg-[#fdfbf7]">
                  {activeConfigProduct.imageKey ? (
                    <img
                      src={`/api/media/menu-images?key=${encodeURIComponent(activeConfigProduct.imageKey)}`}
                      alt=""
                      className="size-12 rounded-xl object-cover border border-[#ded5cb] shadow-2xs shrink-0"
                    />
                  ) : (
                    <div className="size-12 rounded-xl bg-[#f5ede4] text-[var(--ember)] border border-[#ded5cb] flex items-center justify-center shrink-0">
                      <IconCoffee size={22} stroke={1.75} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold uppercase tracking-wider bg-[#ede6de] text-[#5e5246]">
                        {catalog.data?.categories.find((c) => c.id === activeConfigProduct.categoryId)?.name ?? 'Món'}
                      </span>
                      <span className="font-mono text-xs font-bold text-[var(--ember)] tabular-nums">
                        {selectedConfigVariant ? formatMoney(selectedConfigVariant.price) : '0₫'}
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold font-display text-[var(--char)] m-0 truncate leading-tight">
                      {activeConfigProduct.name}
                    </h3>
                  </div>
                </div>

                {/* Body */}
                <div className="px-5 py-3.5 space-y-4 overflow-y-auto flex-1 min-h-0 -webkit-overflow-scrolling-touch">
                  {/* Sizes */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--char)] flex items-center gap-1">
                        <span>Kích cỡ (Size)</span>
                        <span className="text-[var(--ember)]">*</span>
                      </label>
                      <span className="text-[10.5px] font-semibold text-[#8c8177]">
                        {configVariants.length} kích cỡ
                      </span>
                    </div>

                    <div className={cn('grid gap-2', configVariants.length <= 2 ? 'grid-cols-2' : configVariants.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4')}>
                      {configVariants.map((variant) => {
                        const isSelected = selectedVariantId === variant.id
                        return (
                          <button
                            key={variant.id}
                            type="button"
                            className={cn(
                              'px-3.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer select-none flex items-center justify-between gap-2 active:scale-[0.98]',
                              isSelected
                                ? 'bg-[#261c18] text-white border-[#261c18] shadow-xs ring-2 ring-[#261c18]/15'
                                : 'bg-white text-[var(--char)] border-[#ded6cc] hover:bg-[#faf7f2] hover:border-[#c5b8a9]'
                            )}
                            onClick={() => handleSelectVariant(variant.id)}
                          >
                            <div className="min-w-0 flex-1">
                              <div className={cn('text-xs sm:text-sm font-bold truncate leading-tight', isSelected ? 'text-white' : 'text-[var(--char)]')}>
                                {variant.name}
                              </div>
                              <div className={cn('text-[11px] font-mono font-bold tabular-nums mt-0.5 leading-tight', isSelected ? 'text-[#e8c89b]' : 'text-[var(--ember)]')}>
                                {formatMoney(variant.price)}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="size-5 rounded-full bg-[#e8c89b] text-[#261c18] flex items-center justify-center shrink-0 shadow-2xs">
                                <IconCheck size={12} stroke={3.5} />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Modifiers */}
                  {configGroups.map((group) => {
                    const isSingle = group.maxSelections === 1
                    const isPillGroup = isSingle && group.modifiers.every((m) => !m.priceDelta || m.priceDelta === 0)
                    const selectedCount = group.modifiers.filter((m) => selectedModifierIds.includes(m.id)).length
                    const isGroupSatisfied = selectedCount >= group.minSelections && selectedCount <= group.maxSelections

                    return (
                      <div key={group.id} className="pt-3.5 border-t border-[#ede6de]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--char)]">
                              {group.name}
                            </span>
                            {group.minSelections > 0 && (
                              <span className="text-[var(--ember)] font-bold">*</span>
                            )}
                          </div>

                          <div>
                            {group.minSelections === 1 && group.maxSelections === 1 ? (
                              <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
                                Bắt buộc chọn 1
                              </span>
                            ) : group.minSelections === 0 ? (
                              <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-semibold bg-[#f0ebe4] text-[#716559]">
                                Tối đa {group.maxSelections}
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  'px-1.5 py-0.5 rounded-md text-[9.5px] font-bold border',
                                  isGroupSatisfied
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-rose-50 text-rose-800 border-rose-200'
                                )}
                              >
                                Chọn {group.minSelections}–{group.maxSelections}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* If single choice without extra fees: render as clean flex-wrap chips */}
                        {isPillGroup ? (
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {group.modifiers.filter((m) => m.active).map((modifier) => {
                              const checked = selectedModifierIds.includes(modifier.id)
                              return (
                                <button
                                  key={modifier.id}
                                  type="button"
                                  onClick={() => handleToggleModifier(group, modifier.id)}
                                  className={cn(
                                    'px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none flex items-center gap-1.5 active:scale-[0.98]',
                                    checked
                                      ? 'bg-[#261c18] text-white border-[#261c18] shadow-2xs'
                                      : 'bg-white border-[#ded6cc] text-[#554a40] hover:bg-[#faf7f2] hover:border-[#c5b8a9]'
                                  )}
                                >
                                  {checked && <IconCheck size={12} stroke={3.5} className="text-[#e8c89b]" />}
                                  <span>{modifier.name}</span>
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          /* If multi-choice or options with additional pricing: render as 2-column cards */
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {group.modifiers.filter((m) => m.active).map((modifier) => {
                              const checked = selectedModifierIds.includes(modifier.id)
                              return (
                                <button
                                  key={modifier.id}
                                  type="button"
                                  onClick={() => handleToggleModifier(group, modifier.id)}
                                  className={cn(
                                    'px-3 py-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all cursor-pointer select-none text-left active:scale-[0.98]',
                                    checked
                                      ? 'bg-[#fff5eb] border-[var(--ember)] text-[var(--char)] font-bold shadow-2xs ring-1 ring-[var(--ember)]/30'
                                      : 'bg-white border-[#ded6cc] text-[#554a40] hover:bg-[#faf7f2] hover:border-[#c5b8a9]'
                                  )}
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div
                                      className={cn(
                                        'size-4 flex items-center justify-center shrink-0 border transition-all',
                                        isSingle ? 'rounded-full' : 'rounded-[4px]',
                                        checked
                                          ? 'bg-[var(--ember)] border-[var(--ember)] text-white'
                                          : 'border-[#c5b8a9] bg-white'
                                      )}
                                    >
                                      {checked && <IconCheck size={11} stroke={3} />}
                                    </div>
                                    <span className="truncate font-semibold">{modifier.name}</span>
                                  </div>

                                  {modifier.priceDelta > 0 && (
                                    <span className="font-mono tabular-nums text-[11px] shrink-0 font-bold text-[var(--ember)] pl-1">
                                      +{formatMoney(modifier.priceDelta)}
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Footer */}
                <div className="px-5 pt-3 pb-[calc(0.85rem+env(safe-area-inset-bottom,0px))] border-t border-[#ede6de] bg-[#fffdfa] flex items-center gap-3 shrink-0">
                  {/* Quantity Stepper */}
                  <div className="flex items-center border border-[#ded5cb] rounded-xl bg-white p-0.5 shadow-2xs shrink-0">
                    <button
                      type="button"
                      disabled={configQuantity <= 1}
                      onClick={() => setConfigQuantity((q) => Math.max(1, q - 1))}
                      className="size-8.5 rounded-lg flex items-center justify-center text-[var(--char)] hover:bg-[#f0ebe4] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                      aria-label="Giảm số lượng"
                    >
                      <IconMinus size={14} stroke={2.5} />
                    </button>
                    <span className="w-8 text-center font-mono font-bold text-xs tabular-nums text-[var(--char)] select-none">
                      {configQuantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfigQuantity((q) => q + 1)}
                      className="size-8.5 rounded-lg flex items-center justify-center text-[var(--char)] hover:bg-[#f0ebe4] active:scale-95 transition-all cursor-pointer"
                      aria-label="Tăng số lượng"
                    >
                      <IconPlus size={14} stroke={2.5} />
                    </button>
                  </div>

                  {/* Primary CTA */}
                  <PrimaryButton
                    size="md"
                    disabled={!selectedVariantId || !configValid || draftLoading}
                    onClick={() => void handleAddConfiguredProduct()}
                    className="flex-1 font-bold text-xs h-10 flex items-center justify-between px-4 shadow-sm"
                  >
                    <span>Thêm vào đơn</span>
                    <span className="font-mono text-sm tabular-nums font-bold tracking-tight">
                      {formatMoney(totalConfigPrice)}
                    </span>
                  </PrimaryButton>
                </div>
              </>
            )}
          </Drawer.Content>
        </Drawer.Root>
      ) : (
        <Dialog.Root
          open={configuringProduct !== null}
          onOpenChange={(open) => {
            if (!open) {
              setConfiguringProduct(null)
              setSelectedVariantId(null)
              setSelectedModifierIds([])
              setConfigQuantity(1)
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Backdrop className="dialog-backdrop" />
            <Dialog.Viewport className="dialog-viewport p-3 sm:p-4">
              <Dialog.Popup className="w-full max-w-[460px] rounded-2xl bg-[#fffdf9] p-0 shadow-2xl border border-[#ded1c0] overflow-hidden">
                {activeConfigProduct && (
                  <div className="flex flex-col max-h-[85vh]">
                    {/* Header */}
                    <div className="px-4 sm:px-5 py-3 border-b border-[#ede6de] flex items-center justify-between gap-3 bg-[#fdfbf7] shrink-0">
                      <div className="flex items-center gap-3 min-w-0">
                        {activeConfigProduct.imageKey ? (
                          <img
                            src={`/api/media/menu-images?key=${encodeURIComponent(activeConfigProduct.imageKey)}`}
                            alt=""
                            className="size-11 rounded-xl object-cover border border-[#ded5cb] shadow-2xs shrink-0"
                          />
                        ) : (
                          <div className="size-11 rounded-xl bg-[#f5ede4] text-[var(--ember)] border border-[#ded5cb] flex items-center justify-center shrink-0">
                            <IconCoffee size={20} stroke={1.75} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold uppercase tracking-wider bg-[#ede6de] text-[#5e5246]">
                              {catalog.data?.categories.find((c) => c.id === activeConfigProduct.categoryId)?.name ?? 'Món'}
                            </span>
                            <span className="font-mono text-xs font-bold text-[var(--ember)] tabular-nums">
                              {selectedConfigVariant ? formatMoney(selectedConfigVariant.price) : '0₫'}
                            </span>
                          </div>
                          <Dialog.Title className="text-sm sm:text-base font-bold font-display text-[var(--char)] m-0 truncate leading-tight">
                            {activeConfigProduct.name}
                          </Dialog.Title>
                        </div>
                      </div>

                      <Dialog.Close aria-label="Đóng" className="size-8 rounded-lg text-[#8c8177] hover:text-[var(--char)] hover:bg-[#efe7dc] flex items-center justify-center transition-colors cursor-pointer shrink-0">
                        <IconX size={17} stroke={2} />
                      </Dialog.Close>
                    </div>

                    {/* Body */}
                    <div className="px-4 sm:px-5 py-3.5 space-y-4 overflow-y-auto flex-1 min-h-0">
                      {/* Sizes */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--char)] flex items-center gap-1">
                            <span>Kích cỡ (Size)</span>
                            <span className="text-[var(--ember)]">*</span>
                          </label>
                          <span className="text-[10.5px] font-semibold text-[#8c8177]">
                            {configVariants.length} kích cỡ
                          </span>
                        </div>

                        <div className={cn('grid gap-2', configVariants.length <= 2 ? 'grid-cols-2' : configVariants.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4')}>
                          {configVariants.map((variant) => {
                            const isSelected = selectedVariantId === variant.id
                            return (
                              <button
                                key={variant.id}
                                type="button"
                                className={cn(
                                  'px-3.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer select-none flex items-center justify-between gap-2 active:scale-[0.98]',
                                  isSelected
                                    ? 'bg-[#261c18] text-white border-[#261c18] shadow-xs ring-2 ring-[#261c18]/15'
                                    : 'bg-white text-[var(--char)] border-[#ded6cc] hover:bg-[#faf7f2] hover:border-[#c5b8a9]'
                                )}
                                onClick={() => handleSelectVariant(variant.id)}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className={cn('text-xs sm:text-sm font-bold truncate leading-tight', isSelected ? 'text-white' : 'text-[var(--char)]')}>
                                    {variant.name}
                                  </div>
                                  <div className={cn('text-[11px] font-mono font-bold tabular-nums mt-0.5 leading-tight', isSelected ? 'text-[#e8c89b]' : 'text-[var(--ember)]')}>
                                    {formatMoney(variant.price)}
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="size-5 rounded-full bg-[#e8c89b] text-[#261c18] flex items-center justify-center shrink-0 shadow-2xs">
                                    <IconCheck size={12} stroke={3.5} />
                                  </div>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Modifiers */}
                      {configGroups.map((group) => {
                        const isSingle = group.maxSelections === 1
                        const isPillGroup = isSingle && group.modifiers.every((m) => !m.priceDelta || m.priceDelta === 0)
                        const selectedCount = group.modifiers.filter((m) => selectedModifierIds.includes(m.id)).length
                        const isGroupSatisfied = selectedCount >= group.minSelections && selectedCount <= group.maxSelections

                        return (
                          <div key={group.id} className="pt-3.5 border-t border-[#ede6de]">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--char)]">
                                  {group.name}
                                </span>
                                {group.minSelections > 0 && (
                                  <span className="text-[var(--ember)] font-bold">*</span>
                                )}
                              </div>

                              <div>
                                {group.minSelections === 1 && group.maxSelections === 1 ? (
                                  <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
                                    Bắt buộc chọn 1
                                  </span>
                                ) : group.minSelections === 0 ? (
                                  <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-semibold bg-[#f0ebe4] text-[#716559]">
                                    Tối đa {group.maxSelections}
                                  </span>
                                ) : (
                                  <span
                                    className={cn(
                                      'px-1.5 py-0.5 rounded-md text-[9.5px] font-bold border',
                                      isGroupSatisfied
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                        : 'bg-rose-50 text-rose-800 border-rose-200'
                                    )}
                                  >
                                    Chọn {group.minSelections}–{group.maxSelections}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* If single choice without extra fees: render as clean flex-wrap chips */}
                            {isPillGroup ? (
                              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                {group.modifiers.filter((m) => m.active).map((modifier) => {
                                  const checked = selectedModifierIds.includes(modifier.id)
                                  return (
                                    <button
                                      key={modifier.id}
                                      type="button"
                                      onClick={() => handleToggleModifier(group, modifier.id)}
                                      className={cn(
                                        'px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none flex items-center gap-1.5 active:scale-[0.98]',
                                        checked
                                          ? 'bg-[#261c18] text-white border-[#261c18] shadow-2xs'
                                          : 'bg-white border-[#ded6cc] text-[#554a40] hover:bg-[#faf7f2] hover:border-[#c5b8a9]'
                                      )}
                                    >
                                      {checked && <IconCheck size={12} stroke={3.5} className="text-[#e8c89b]" />}
                                      <span>{modifier.name}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            ) : (
                              /* If multi-choice or options with additional pricing: render as 2-column cards */
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {group.modifiers.filter((m) => m.active).map((modifier) => {
                                  const checked = selectedModifierIds.includes(modifier.id)
                                  return (
                                    <button
                                      key={modifier.id}
                                      type="button"
                                      onClick={() => handleToggleModifier(group, modifier.id)}
                                      className={cn(
                                        'px-3 py-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all cursor-pointer select-none text-left active:scale-[0.98]',
                                        checked
                                          ? 'bg-[#fff5eb] border-[var(--ember)] text-[var(--char)] font-bold shadow-2xs ring-1 ring-[var(--ember)]/30'
                                          : 'bg-white border-[#ded6cc] text-[#554a40] hover:bg-[#faf7f2] hover:border-[#c5b8a9]'
                                      )}
                                    >
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <div
                                          className={cn(
                                            'size-4 flex items-center justify-center shrink-0 border transition-all',
                                            isSingle ? 'rounded-full' : 'rounded-[4px]',
                                            checked
                                              ? 'bg-[var(--ember)] border-[var(--ember)] text-white'
                                              : 'border-[#c5b8a9] bg-white'
                                          )}
                                        >
                                          {checked && <IconCheck size={11} stroke={3} />}
                                        </div>
                                        <span className="truncate font-semibold">{modifier.name}</span>
                                      </div>

                                      {modifier.priceDelta > 0 && (
                                        <span className="font-mono tabular-nums text-[11px] shrink-0 font-bold text-[var(--ember)] pl-1">
                                          +{formatMoney(modifier.priceDelta)}
                                        </span>
                                      )}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Footer */}
                    <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-t border-[#ede6de] bg-[#fbf8f4] flex items-center gap-3 shrink-0">
                      {/* Quantity Stepper */}
                      <div className="flex items-center border border-[#ded5cb] rounded-xl bg-white p-0.5 shadow-2xs shrink-0">
                        <button
                          type="button"
                          disabled={configQuantity <= 1}
                          onClick={() => setConfigQuantity((q) => Math.max(1, q - 1))}
                          className="size-8 rounded-lg flex items-center justify-center text-[var(--char)] hover:bg-[#f0ebe4] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                          aria-label="Giảm số lượng"
                        >
                          <IconMinus size={13} stroke={2.5} />
                        </button>
                        <span className="w-7 text-center font-mono font-bold text-xs tabular-nums text-[var(--char)] select-none">
                          {configQuantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setConfigQuantity((q) => q + 1)}
                          className="size-8 rounded-lg flex items-center justify-center text-[var(--char)] hover:bg-[#f0ebe4] active:scale-95 transition-all cursor-pointer"
                          aria-label="Tăng số lượng"
                        >
                          <IconPlus size={13} stroke={2.5} />
                        </button>
                      </div>

                      <PrimaryButton
                        size="md"
                        disabled={!selectedVariantId || !configValid || draftLoading}
                        onClick={() => void handleAddConfiguredProduct()}
                        className="flex-1 font-bold text-xs h-9.5 flex items-center justify-between px-4 shadow-xs"
                      >
                        <span>Thêm vào đơn</span>
                        <span className="font-mono text-sm tabular-nums font-bold tracking-tight">
                          {formatMoney(totalConfigPrice)}
                        </span>
                      </PrimaryButton>
                    </div>
                  </div>
                )}
              </Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  )
}
