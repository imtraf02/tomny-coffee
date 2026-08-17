import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  IconCoffee,
  IconFlame,
  IconCheck,
  IconClock,
  IconAlertTriangle,
  IconBell,
  IconBellOff,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconSearch,
  IconX,
  IconLayoutGrid,
  IconLayoutList,
  IconLayoutColumns,
  IconRefresh,
  IconArrowBackUp,
  IconShoppingBag,
  IconArmchair,
  IconNote,
  IconChevronRight,
  IconSun,
  IconSunOff,
  IconHistory,
  IconLayersIntersect,
  IconBuildingStore,
} from '@tabler/icons-react'
import { readSession } from '../server/session'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Drawer } from '@/components/ui/drawer'

type KdsStatus = 'new' | 'making' | 'ready' | 'served'
type KdsLine = {
  id: string
  name: string
  variant: string
  quantity: number
  modifiers: Array<{ name: string; priceDelta: number }>
}
type KdsOrder = {
  id: string
  orderCode: string
  source: 'counter' | 'takeaway' | 'table'
  tableId: string | null
  tableName: string | null
  zoneName: string | null
  status: string
  kdsStatus: KdsStatus
  kdsUpdatedAt: number | null
  createdAt: number
  updatedAt: number
  note: string
  cashier: string
  lines: KdsLine[]
}

type ViewMode = 'grid' | 'kanban' | 'list' | 'summary'
type StatusFilter = 'all' | 'new' | 'making' | 'ready' | 'late'

export const Route = createFileRoute('/kds')({
  beforeLoad: async ({ location }) => {
    const user = await readSession()
    if (!user) throw redirect({ to: '/login', search: { next: location.pathname } })
    if (!user.permissions.includes('kds.read'))
      throw redirect({ to: user.permissions.includes('pos.read') ? '/pos' : '/admin' })
    return { user }
  },
  component: Kds,
})

// Trigger mobile haptic feedback if supported
function triggerHaptic() {
  try {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.([30, 20, 30])
    }
  } catch {}
}

// Play coffee-shop bell audio chime using Web Audio API
function playKitchenChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    const now = ctx.currentTime

    // Primary bell tone (E5 -> C6)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(659.25, now)
    osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.15)
    gain1.gain.setValueAtTime(0.2, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.75)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.75)

    // Harmonizing overtone (E6)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(1318.51, now + 0.06)
    gain2.gain.setValueAtTime(0.12, now + 0.06)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.06)
    osc2.stop(now + 0.85)
  } catch {
    // Ignore audio permission or autoplay restrictions
  }
}

function Kds() {
  const { user } = Route.useRouteContext()
  const queryClient = useQueryClient()

  // View & Filter States
  const [zone, setZone] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'table' | 'takeaway' | 'counter'>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tomny_kds_sound') !== 'false'
    } catch {
      return true
    }
  })
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [cardDensity, setCardDensity] = useState<'standard' | 'compact'>('standard')

  // Checked items checklist state (per order item id)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})

  const toggleItemCheck = (lineId: string) => {
    setCheckedItems((prev) => ({ ...prev, [lineId]: !prev[lineId] }))
  }

  // Live Timer ticker for real-time order age updates
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Poll active orders every 2.5 seconds
  const query = useQuery({
    queryKey: ['kds-orders'],
    queryFn: async () => {
      const response = await fetch('/api/kds')
      if (!response.ok) {
        const err = (await response.json().catch(() => ({
          message: 'Không tải được đơn pha chế.',
        }))) as { message?: string }
        throw new Error(err.message ?? 'Không tải được đơn pha chế.')
      }
      return (await response.json()) as { orders: KdsOrder[]; polledAt: number }
    },
    refetchInterval: 2500,
    refetchIntervalInBackground: true,
  })

  // Poll recently served orders for history drawer when open
  const historyQuery = useQuery({
    queryKey: ['kds-orders-history'],
    queryFn: async () => {
      const response = await fetch('/api/kds?history=true')
      if (!response.ok) throw new Error('Không tải được lịch sử.')
      return (await response.json()) as { orders: KdsOrder[]; polledAt: number }
    },
    enabled: historyOpen,
    refetchInterval: historyOpen ? 5000 : false,
  })

  // Mutation to advance or change status
  const update = useMutation({
    mutationFn: async (input: {
      orderId: string
      status: KdsStatus
      expectedUpdatedAt: number | null
    }) => {
      triggerHaptic()
      const response = await fetch('/api/kds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'setStatus', ...input }),
      })
      const body = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok)
        throw new Error(body.message ?? 'Không thể cập nhật trạng thái đơn.')
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['kds-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['kds-orders-history'] }),
      ])
    },
  })

  const orders = useMemo(() => query.data?.orders ?? [], [query.data?.orders])

  // Sound Chime when new orders arrive
  const prevOrderIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!orders.length) {
      prevOrderIdsRef.current = new Set()
      return
    }
    const currentIds = new Set(orders.map((o) => o.id))
    if (prevOrderIdsRef.current.size > 0) {
      const hasNewOrder = orders.some(
        (o) => !prevOrderIdsRef.current.has(o.id) && o.kdsStatus === 'new',
      )
      if (hasNewOrder && soundEnabled) {
        playKitchenChime()
      }
    }
    prevOrderIdsRef.current = currentIds
  }, [orders, soundEnabled])

  const toggleSound = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    try {
      localStorage.setItem('tomny_kds_sound', String(next))
    } catch {}
    if (next) playKitchenChime()
  }

  // Screen Wake Lock API to prevent screen dimming during kitchen operations
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const toggleWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        if (!wakeLockActive) {
          wakeLockRef.current = await navigator.wakeLock.request('screen')
          setWakeLockActive(true)
          wakeLockRef.current.addEventListener('release', () => {
            setWakeLockActive(false)
          })
        } else if (wakeLockRef.current) {
          await wakeLockRef.current.release()
          wakeLockRef.current = null
          setWakeLockActive(false)
        }
      }
    } catch {
      setWakeLockActive(false)
    }
  }

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (wakeLockActive && document.visibilityState === 'visible' && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen')
        } catch {}
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (wakeLockRef.current) {
        void wakeLockRef.current.release()
      }
    }
  }, [wakeLockActive])

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Zones list
  const zones = useMemo(
    () => [
      ...new Set(
        orders
          .map((order) => order.zoneName)
          .filter((name): name is string => Boolean(name)),
      ),
    ],
    [orders],
  )

  useEffect(() => {
    if (zone !== 'all' && !zones.includes(zone)) setZone('all')
  }, [zone, zones])

  // Status counts
  const countByStatus = (status: KdsStatus) =>
    orders.filter((order) => order.kdsStatus === status).length

  const lateCount = useMemo(() => {
    return orders.filter((order) => {
      const ageMinutes = Math.floor((now - order.createdAt) / 60_000)
      return ageMinutes >= 15 && order.kdsStatus !== 'ready'
    }).length
  }, [orders, now])

  // Filtered orders
  const visibleOrders = useMemo(() => {
    return orders.filter((order) => {
      // Zone filter
      if (zone !== 'all' && order.zoneName !== zone) return false

      // Source filter
      if (sourceFilter !== 'all' && order.source !== sourceFilter) return false

      // Status filter
      if (statusFilter === 'late') {
        const ageMinutes = Math.floor((now - order.createdAt) / 60_000)
        if (ageMinutes < 15 || order.kdsStatus === 'ready') return false
      } else if (statusFilter !== 'all' && order.kdsStatus !== statusFilter) {
        return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchCode = order.orderCode.toLowerCase().includes(q)
        const matchTable = (order.tableName ?? '').toLowerCase().includes(q)
        const matchItem = order.lines.some((l) =>
          l.name.toLowerCase().includes(q) || (l.variant && l.variant.toLowerCase().includes(q)),
        )
        const matchNote = (order.note ?? '').toLowerCase().includes(q)
        const matchCashier = order.cashier.toLowerCase().includes(q)
        if (!matchCode && !matchTable && !matchItem && !matchNote && !matchCashier) return false
      }

      return true
    })
  }, [orders, zone, sourceFilter, statusFilter, searchQuery, now])

  // Aggregated Drink Items for Summary Batch View
  const aggregatedItems = useMemo(() => {
    type AggregatedItem = {
      key: string
      name: string
      variant: string
      totalQuantity: number
      ordersList: Array<{
        orderCode: string
        tableName: string | null
        source: 'counter' | 'takeaway' | 'table'
        quantity: number
        modifiers: Array<{ name: string; priceDelta: number }>
        kdsStatus: KdsStatus
      }>
    }
    const map = new Map<string, AggregatedItem>()

    // Filter to active preparation orders (new or making)
    const targetOrders = visibleOrders.filter((o) => o.kdsStatus === 'new' || o.kdsStatus === 'making')

    for (const order of targetOrders) {
      for (const line of order.lines) {
        const key = `${line.name}__${line.variant || 'default'}`
        const existing = map.get(key)
        if (existing) {
          existing.totalQuantity += line.quantity
          existing.ordersList.push({
            orderCode: order.orderCode,
            tableName: order.tableName,
            source: order.source,
            quantity: line.quantity,
            modifiers: line.modifiers,
            kdsStatus: order.kdsStatus,
          })
        } else {
          map.set(key, {
            key,
            name: line.name,
            variant: line.variant,
            totalQuantity: line.quantity,
            ordersList: [
              {
                orderCode: order.orderCode,
                tableName: order.tableName,
                source: order.source,
                quantity: line.quantity,
                modifiers: line.modifiers,
                kdsStatus: order.kdsStatus,
              },
            ],
          })
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalQuantity - a.totalQuantity)
  }, [visibleOrders])

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[var(--char)] flex flex-col selection:bg-[#efe3d0]">
      {/* ========================================================================= */}
      {/* 1. STICKY TOP APP BAR                                                     */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#f7f4ee]/92 border-b border-[#e6ddd2] shadow-2xs">
        <div className="max-w-[1700px] mx-auto px-3 sm:px-5 py-2.5 flex flex-col gap-2.5">
          {/* Top Row: Brand, Live Info & Quick Actions */}
          <div className="flex items-center justify-between gap-2">
            {/* Left: Brand + Status Counter */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex rounded-full size-2.5 bg-emerald-600" />
                </span>
                <span className="font-display font-black text-sm sm:text-base tracking-tight text-[var(--espresso)] uppercase whitespace-nowrap">
                  TOMNY <span className="text-[var(--amber)]">KDS</span>
                </span>
              </div>

              <div className="h-4 w-px bg-[#d9cfc2] hidden xs:block" />

              {/* Order Count Capsule */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ede5d8] border border-[#ded4c6] text-xs font-bold text-[var(--espresso)] shrink-0">
                <span>Đang chờ:</span>
                <span className="font-data text-[var(--ember)] font-black text-sm">
                  {orders.length}
                </span>
                <span className="text-[11px] text-[var(--stone)] font-medium hidden sm:inline">đơn</span>
              </div>
            </div>

            {/* Right: Live Clock & Quick Operational Actions */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Live Digital Clock */}
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 border border-[#ded4c6] text-xs font-data font-semibold text-[var(--char)]">
                <IconClock size={14} className="text-[var(--stone)]" />
                <span>{new Date(now).toLocaleTimeString('vi-VN')}</span>
              </div>

              {/* History Drawer Trigger */}
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="p-2 sm:px-2.5 sm:py-1.5 rounded-lg border border-[#ded4c6] bg-white text-[var(--char)] hover:bg-[#ede5d8] active:scale-95 transition-all text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                title="Xem đơn đã giao gần đây"
              >
                <IconHistory size={16} className="text-[var(--stone)]" />
                <span className="hidden sm:inline">Đã giao</span>
              </button>

              {/* Screen Wake Lock Toggle */}
              {'wakeLock' in (typeof window !== 'undefined' ? navigator : {}) && (
                <button
                  type="button"
                  onClick={toggleWakeLock}
                  className={cn(
                    'p-2 sm:px-2.5 sm:py-1.5 rounded-lg border transition-all text-xs font-bold flex items-center gap-1.5 shadow-2xs active:scale-95',
                    wakeLockActive
                      ? 'border-amber-400 bg-amber-100/80 text-amber-950 font-black ring-1 ring-amber-400'
                      : 'border-[#ded4c6] bg-white text-[var(--stone)] hover:bg-[#ede5d8] hover:text-[var(--char)]',
                  )}
                  title={
                    wakeLockActive
                      ? 'Giữ sáng màn hình: ĐANG BẬT (Không tự khóa màn)'
                      : 'Giữ sáng màn hình: Đang tắt'
                  }
                >
                  {wakeLockActive ? (
                    <IconSun size={16} className="text-amber-700 animate-pulse" />
                  ) : (
                    <IconSunOff size={16} />
                  )}
                  <span className="hidden lg:inline">
                    {wakeLockActive ? 'Sáng màn hình' : 'Tắt giữ sáng'}
                  </span>
                </button>
              )}

              {/* Sound Notification Chime */}
              <button
                type="button"
                onClick={toggleSound}
                className={cn(
                  'p-2 sm:px-2.5 sm:py-1.5 rounded-lg border transition-all text-xs font-bold flex items-center gap-1.5 shadow-2xs active:scale-95',
                  soundEnabled
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-[#ded4c6] bg-white text-[var(--stone)] hover:bg-[#ede5d8]',
                )}
                title={soundEnabled ? 'Chuông báo đơn mới: ĐANG BẬT' : 'Chuông báo: Tắt'}
              >
                {soundEnabled ? (
                  <IconBell size={16} className="text-emerald-700" />
                ) : (
                  <IconBellOff size={16} />
                )}
                <span className="hidden lg:inline">
                  {soundEnabled ? 'Chuông' : 'Tắt chuông'}
                </span>
              </button>

              {/* Fullscreen Toggle */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="hidden sm:flex p-2 rounded-lg border border-[#ded4c6] bg-white text-[var(--stone)] hover:bg-[#ede5d8] hover:text-[var(--char)] active:scale-95 transition-all shadow-2xs"
                title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình (F11)'}
              >
                {isFullscreen ? <IconArrowsMinimize size={16} /> : <IconArrowsMaximize size={16} />}
              </button>

              {/* Instant Manual Refresh */}
              <button
                type="button"
                onClick={() => query.refetch()}
                className="p-2 rounded-lg border border-[#ded4c6] bg-white text-[var(--stone)] hover:bg-[#ede5d8] hover:text-[var(--char)] active:scale-95 transition-all shadow-2xs"
                title="Tải lại ngay"
              >
                <IconRefresh
                  size={16}
                  className={query.isFetching ? 'animate-spin text-[var(--ember)]' : ''}
                />
              </button>
            </div>
          </div>

          {/* Bottom Row: Status Filter Carousel, Zones, Search & View Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Status Pills Carousel */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none snap-x touch-pan-x">
              {/* All */}
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all')
                  if (viewMode === 'summary') setViewMode('grid')
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 active:scale-95 shadow-2xs select-none',
                  statusFilter === 'all' && viewMode !== 'summary'
                    ? 'bg-[var(--espresso)] text-[var(--crema)] ring-2 ring-[var(--espresso)]/30'
                    : 'bg-white border border-[#ded4c6] text-[#6b5d52] hover:bg-[#ede5d8] hover:text-[var(--char)]',
                )}
              >
                <span>Tất cả</span>
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded-full text-[11px] font-data font-bold',
                    statusFilter === 'all' && viewMode !== 'summary'
                      ? 'bg-white/20 text-white'
                      : 'bg-[#ede5d8] text-[var(--char)]',
                  )}
                >
                  {orders.length}
                </span>
              </button>

              {/* New */}
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('new')
                  if (viewMode === 'summary') setViewMode('grid')
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 active:scale-95 shadow-2xs select-none',
                  statusFilter === 'new' && viewMode !== 'summary'
                    ? 'bg-amber-500 text-white ring-2 ring-amber-400/40 shadow-amber-200'
                    : 'bg-white border border-[#ded4c6] text-amber-900 hover:bg-amber-50/70',
                )}
              >
                <span className="size-2 rounded-full bg-amber-400 shrink-0" />
                <span>Mới nhận</span>
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded-full text-[11px] font-data font-bold',
                    statusFilter === 'new' && viewMode !== 'summary'
                      ? 'bg-white/30 text-white'
                      : 'bg-amber-100 text-amber-950',
                  )}
                >
                  {countByStatus('new')}
                </span>
              </button>

              {/* Making */}
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('making')
                  if (viewMode === 'summary') setViewMode('grid')
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 active:scale-95 shadow-2xs select-none',
                  statusFilter === 'making' && viewMode !== 'summary'
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-500/40 shadow-emerald-200'
                    : 'bg-white border border-[#ded4c6] text-emerald-900 hover:bg-emerald-50/70',
                )}
              >
                <span className="size-2 rounded-full bg-emerald-400 shrink-0" />
                <span>Đang pha</span>
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded-full text-[11px] font-data font-bold',
                    statusFilter === 'making' && viewMode !== 'summary'
                      ? 'bg-white/30 text-white'
                      : 'bg-emerald-100 text-emerald-950',
                  )}
                >
                  {countByStatus('making')}
                </span>
              </button>

              {/* Ready */}
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ready')
                  if (viewMode === 'summary') setViewMode('grid')
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 active:scale-95 shadow-2xs select-none',
                  statusFilter === 'ready' && viewMode !== 'summary'
                    ? 'bg-teal-700 text-white ring-2 ring-teal-600/40 shadow-teal-200'
                    : 'bg-white border border-[#ded4c6] text-teal-950 hover:bg-teal-50/70',
                )}
              >
                <span className="size-2 rounded-full bg-teal-400 shrink-0" />
                <span>Sẵn sàng</span>
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded-full text-[11px] font-data font-bold',
                    statusFilter === 'ready' && viewMode !== 'summary'
                      ? 'bg-white/30 text-white'
                      : 'bg-teal-100 text-teal-950',
                  )}
                >
                  {countByStatus('ready')}
                </span>
              </button>

              {/* Late Alert Button */}
              {lateCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('late')
                    if (viewMode === 'summary') setViewMode('grid')
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 active:scale-95 shadow-2xs select-none animate-pulse',
                    statusFilter === 'late' && viewMode !== 'summary'
                      ? 'bg-red-600 text-white ring-2 ring-red-500/50'
                      : 'bg-red-50 border border-red-300 text-red-900 hover:bg-red-100',
                  )}
                >
                  <IconAlertTriangle size={13} className="shrink-0" />
                  <span>Trễ (&gt;15p)</span>
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded-full text-[11px] font-data font-bold',
                      statusFilter === 'late' && viewMode !== 'summary'
                        ? 'bg-white/30 text-white'
                        : 'bg-red-200 text-red-950',
                    )}
                  >
                    {lateCount}
                  </span>
                </button>
              )}

              {/* Batch Item Summary / Gom món Toggle */}
              <button
                type="button"
                onClick={() => setViewMode((prev) => (prev === 'summary' ? 'grid' : 'summary'))}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 active:scale-95 shadow-2xs select-none',
                  viewMode === 'summary'
                    ? 'bg-[var(--ember)] text-white ring-2 ring-[var(--ember)]/40 shadow-xs'
                    : 'bg-white border border-[#ded4c6] text-[var(--ember)] hover:bg-red-50/50',
                )}
                title="Xem tổng hợp gom các món cần pha cùng lúc"
              >
                <IconLayersIntersect size={14} />
                <span>Gom món ({aggregatedItems.reduce((acc, i) => acc + i.totalQuantity, 0)})</span>
              </button>
            </div>

            {/* Right: Search, Source/Zone Selectors & View Switcher */}
            <div className="flex items-center gap-2 justify-between lg:justify-end">
              {/* Source Quick Filter (Counter/Takeaway/Table) */}
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
                className="h-8.5 px-2.5 text-xs font-semibold rounded-lg border border-[#ded4c6] bg-white text-[var(--char)] focus:border-[var(--ember)] focus:ring-1 focus:ring-[var(--ember)] outline-hidden transition-all shadow-2xs"
              >
                <option value="all">Tất cả nguồn</option>
                <option value="table">Tại bàn</option>
                <option value="takeaway">Mang đi</option>
                <option value="counter">Tại quầy</option>
              </select>

              {/* Zone Filter if present */}
              {zones.length > 0 && (
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  className="h-8.5 px-2.5 text-xs font-semibold rounded-lg border border-[#ded4c6] bg-white text-[var(--char)] focus:border-[var(--ember)] focus:ring-1 focus:ring-[var(--ember)] outline-hidden transition-all shadow-2xs"
                >
                  <option value="all">Tất cả khu</option>
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              )}

              {/* Search Bar */}
              <div className="relative flex-1 sm:w-48 md:w-56">
                <IconSearch
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--stone)]"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm đơn, bàn, món…"
                  className="w-full h-8.5 pl-8 pr-7 text-xs rounded-lg border border-[#ded4c6] bg-white text-[var(--char)] placeholder:text-[#9e9286] focus:border-[var(--ember)] focus:ring-1 focus:ring-[var(--ember)] transition-all outline-hidden font-medium shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--stone)] hover:text-[var(--char)]"
                  >
                    <IconX size={13} stroke={2.5} />
                  </button>
                )}
              </div>

              {/* View Mode & Card Density Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Density Switcher (Standard / Compact) */}
                <div className="inline-flex items-center p-0.5 rounded-lg bg-[#eae1d4] border border-[#ded4c6] gap-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setCardDensity('standard')}
                    className={cn(
                      'px-2 py-1 rounded-md text-[11px] font-bold transition-all',
                      cardDensity === 'standard'
                        ? 'bg-white text-[var(--char)] shadow-xs'
                        : 'text-[#7d7065] hover:text-[var(--char)]',
                    )}
                    title="Chiều cao chuẩn"
                  >
                    Chuẩn
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardDensity('compact')}
                    className={cn(
                      'px-2 py-1 rounded-md text-[11px] font-bold transition-all',
                      cardDensity === 'compact'
                        ? 'bg-white text-[var(--char)] shadow-xs'
                        : 'text-[#7d7065] hover:text-[var(--char)]',
                    )}
                    title="Chiều cao gọn (xem được nhiều đơn hơn)"
                  >
                    Gọn
                  </button>
                </div>

                {/* View Mode Switcher (Grid, Kanban, List) */}
                <div className="inline-flex items-center p-0.5 rounded-lg bg-[#eae1d4] border border-[#ded4c6] gap-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      'p-1.5 rounded-md transition-all',
                      viewMode === 'grid'
                        ? 'bg-white text-[var(--char)] shadow-xs font-bold'
                        : 'text-[#7d7065] hover:text-[var(--char)]',
                    )}
                    title="Dạng thẻ lưới"
                  >
                    <IconLayoutGrid size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('kanban')}
                    className={cn(
                      'p-1.5 rounded-md transition-all',
                      viewMode === 'kanban'
                        ? 'bg-white text-[var(--char)] shadow-xs font-bold'
                        : 'text-[#7d7065] hover:text-[var(--char)]',
                    )}
                    title="Dạng cột trạng thái"
                  >
                    <IconLayoutColumns size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={cn(
                      'p-1.5 rounded-md transition-all',
                      viewMode === 'list'
                        ? 'bg-white text-[var(--char)] shadow-xs font-bold'
                        : 'text-[#7d7065] hover:text-[var(--char)]',
                    )}
                    title="Dạng danh sách cuộn"
                  >
                    <IconLayoutList size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT AREA                                                      */}
      {/* ========================================================================= */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-3 sm:p-5 md:p-6 flex flex-col gap-4">
        {/* Loading Skeletons */}
        {query.isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" role="status" aria-busy="true">
            <span className="sr-only">Đang tải danh sách đơn pha chế…</span>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-[#ded4c6] p-4 flex flex-col gap-3 shadow-xs"
                aria-hidden="true"
              >
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-5 w-24 rounded-md" />
                    <Skeleton className="h-4 w-16 rounded-md" />
                  </div>
                  <Skeleton className="h-6 w-14 rounded-full" />
                </div>
                <div className="space-y-2.5 my-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
                <Skeleton className="h-11 w-full rounded-xl mt-auto" />
              </div>
            ))}
          </div>
        )}

        {/* Error Banners */}
        {query.isError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-xl text-sm font-semibold flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <IconAlertTriangle size={18} className="text-red-600 shrink-0" />
              <span>{query.error.message}</span>
            </div>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-md hover:bg-red-700 transition-all"
            >
              Thử lại
            </button>
          </div>
        )}

        {update.isError && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs">
            <IconAlertTriangle size={16} className="text-red-600 shrink-0" />
            <span>{update.error.message}</span>
          </div>
        )}

        {/* Empty State */}
        {!query.isLoading && !visibleOrders.length && (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-white border border-[#ded4c6] rounded-2xl text-center shadow-xs my-4">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-[#f7f3eb] text-[var(--stone)] mb-3.5 border border-[#e8ded2] shadow-2xs">
              <IconCoffee size={32} stroke={1.5} className="text-[var(--espresso)]" />
            </div>
            <h2 className="text-lg font-bold text-[var(--char)] font-display">
              {searchQuery || statusFilter !== 'all' || zone !== 'all' || sourceFilter !== 'all'
                ? 'Không tìm thấy đơn phù hợp'
                : 'Hiện không có đơn nào đang chờ pha'}
            </h2>
            <p className="text-xs text-[var(--stone)] max-w-sm mt-1 leading-relaxed">
              {searchQuery || statusFilter !== 'all' || zone !== 'all' || sourceFilter !== 'all'
                ? 'Thử xóa từ khóa tìm kiếm hoặc đặt lại các bộ lọc bên trên.'
                : 'Đơn mới tạo từ thu ngân sẽ tự động xuất hiện tại đây và phát chuông báo.'}
            </p>
            {(searchQuery || statusFilter !== 'all' || zone !== 'all' || sourceFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                  setZone('all')
                  setSourceFilter('all')
                  setViewMode('grid')
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-[var(--espresso)] text-[var(--crema)] text-xs font-bold shadow-xs hover:bg-[#3d2a21] active:scale-95 transition-all"
              >
                Đặt lại toàn bộ bộ lọc
              </button>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* 3. DYNAMIC VIEWS                                                      */}
        {/* ===================================================================== */}
        {!query.isLoading && visibleOrders.length > 0 && (
          <>
            {/* VIEW MODE 1: BATCH ITEM SUMMARY (MÓN GOM CẦN PHA) */}
            {viewMode === 'summary' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#fffdfa] p-3.5 rounded-xl border border-[#ded4c6] shadow-2xs">
                  <div>
                    <h2 className="text-base font-bold text-[var(--char)] font-display flex items-center gap-2">
                      <IconLayersIntersect size={18} className="text-[var(--ember)]" />
                      Tổng hợp món đang cần chuẩn bị ({aggregatedItems.length} loại món)
                    </h2>
                    <p className="text-xs text-[var(--stone)] mt-0.5">
                      Gom nhóm các món từ các đơn chưa hoàn thành để quầy bar pha chế cùng lúc nhanh hơn.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className="self-start sm:self-center px-3 py-1.5 rounded-lg border border-[#ded4c6] bg-white text-xs font-bold hover:bg-[#ede5d8] transition-all"
                  >
                    Quay lại xem theo thẻ đơn
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {aggregatedItems.map((item) => (
                    <article
                      key={item.key}
                      className="bg-white rounded-xl border border-[#ded4c6] p-4 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-[#f0e8dc]">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-[var(--char)] leading-tight">
                              {item.name}
                            </h3>
                            {item.variant && item.variant !== 'Tiêu chuẩn' && (
                              <span className="text-xs font-semibold text-[var(--stone)]">
                                {item.variant}
                              </span>
                            )}
                          </div>
                          <span className="flex items-center justify-center min-w-9 h-9 px-2 rounded-xl bg-amber-500 text-white font-data font-black text-lg shadow-2xs shrink-0">
                            {item.totalQuantity}×
                          </span>
                        </div>

                        {/* Breakdown by destination table / order */}
                        <div className="mt-3 flex flex-col gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--stone)]">
                            Chi tiết theo đơn:
                          </span>
                          <ul className="flex flex-col gap-1.5 list-none p-0 m-0 text-xs">
                            {item.ordersList.map((ord, idx) => (
                              <li
                                key={idx}
                                className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-[#faf6ef] border border-[#efe6da]"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-data font-bold text-[var(--char)]">
                                    {ord.orderCode}
                                  </span>
                                  <span className="text-[11px] text-[var(--stone)] truncate">
                                    ({ord.tableName ? `Bàn ${ord.tableName}` : ord.source === 'takeaway' ? 'Mang đi' : 'Tại quầy'})
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={cn(
                                      'size-2 rounded-full',
                                      ord.kdsStatus === 'new' ? 'bg-amber-500' : 'bg-emerald-500',
                                    )}
                                  />
                                  <span className="font-data font-bold text-sm text-[var(--char)]">
                                    {ord.quantity} ly
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {/* VIEW MODE 2: RESPONSIVE GRID TILES */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 items-start">
                {visibleOrders.map((order) => (
                  <KdsTicketCard
                    key={order.id}
                    order={order}
                    now={now}
                    density={cardDensity}
                    checkedItems={checkedItems}
                    onToggleItemCheck={toggleItemCheck}
                    disabled={update.isPending || !user.permissions.includes('kds.manage')}
                    onStatus={(status) =>
                      update.mutate({
                        orderId: order.id,
                        status,
                        expectedUpdatedAt: order.kdsUpdatedAt,
                      })
                    }
                  />
                ))}
              </div>
            )}

            {/* VIEW MODE 3: KANBAN BOARD (COLUMNS) */}
            {viewMode === 'kanban' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                {/* Column 1: Mới nhận */}
                <div className="flex flex-col gap-3 bg-[#f0e8dc]/70 p-3 rounded-2xl border border-[#ded4c6]">
                  <div className="flex items-center justify-between px-1.5 py-1">
                    <span className="flex items-center gap-2 text-xs font-black uppercase text-amber-950 font-display">
                      <span className="size-2.5 rounded-full bg-amber-500 animate-pulse" />
                      MỚI NHẬN ({visibleOrders.filter((o) => o.kdsStatus === 'new').length})
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {visibleOrders
                      .filter((o) => o.kdsStatus === 'new')
                      .map((order) => (
                        <KdsTicketCard
                          key={order.id}
                          order={order}
                          now={now}
                          density={cardDensity}
                          checkedItems={checkedItems}
                          onToggleItemCheck={toggleItemCheck}
                          disabled={update.isPending || !user.permissions.includes('kds.manage')}
                          onStatus={(status) =>
                            update.mutate({
                              orderId: order.id,
                              status,
                              expectedUpdatedAt: order.kdsUpdatedAt,
                            })
                          }
                        />
                      ))}
                    {visibleOrders.filter((o) => o.kdsStatus === 'new').length === 0 && (
                      <div className="p-8 text-center text-xs text-[var(--stone)] font-medium border border-dashed border-[#d9cfc2] rounded-xl">
                        Không có đơn mới
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 2: Đang pha */}
                <div className="flex flex-col gap-3 bg-[#f0e8dc]/70 p-3 rounded-2xl border border-[#ded4c6]">
                  <div className="flex items-center justify-between px-1.5 py-1">
                    <span className="flex items-center gap-2 text-xs font-black uppercase text-emerald-950 font-display">
                      <span className="size-2.5 rounded-full bg-emerald-600 animate-pulse" />
                      ĐANG PHA ({visibleOrders.filter((o) => o.kdsStatus === 'making').length})
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {visibleOrders
                      .filter((o) => o.kdsStatus === 'making')
                      .map((order) => (
                        <KdsTicketCard
                          key={order.id}
                          order={order}
                          now={now}
                          density={cardDensity}
                          checkedItems={checkedItems}
                          onToggleItemCheck={toggleItemCheck}
                          disabled={update.isPending || !user.permissions.includes('kds.manage')}
                          onStatus={(status) =>
                            update.mutate({
                              orderId: order.id,
                              status,
                              expectedUpdatedAt: order.kdsUpdatedAt,
                            })
                          }
                        />
                      ))}
                    {visibleOrders.filter((o) => o.kdsStatus === 'making').length === 0 && (
                      <div className="p-8 text-center text-xs text-[var(--stone)] font-medium border border-dashed border-[#d9cfc2] rounded-xl">
                        Không có đơn đang pha
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 3: Sẵn sàng */}
                <div className="flex flex-col gap-3 bg-[#f0e8dc]/70 p-3 rounded-2xl border border-[#ded4c6]">
                  <div className="flex items-center justify-between px-1.5 py-1">
                    <span className="flex items-center gap-2 text-xs font-black uppercase text-teal-950 font-display">
                      <span className="size-2.5 rounded-full bg-teal-600 animate-pulse" />
                      SẴN SÀNG GIAO ({visibleOrders.filter((o) => o.kdsStatus === 'ready').length})
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {visibleOrders
                      .filter((o) => o.kdsStatus === 'ready')
                      .map((order) => (
                        <KdsTicketCard
                          key={order.id}
                          order={order}
                          now={now}
                          density={cardDensity}
                          checkedItems={checkedItems}
                          onToggleItemCheck={toggleItemCheck}
                          disabled={update.isPending || !user.permissions.includes('kds.manage')}
                          onStatus={(status) =>
                            update.mutate({
                              orderId: order.id,
                              status,
                              expectedUpdatedAt: order.kdsUpdatedAt,
                            })
                          }
                        />
                      ))}
                    {visibleOrders.filter((o) => o.kdsStatus === 'ready').length === 0 && (
                      <div className="p-8 text-center text-xs text-[var(--stone)] font-medium border border-dashed border-[#d9cfc2] rounded-xl">
                        Không có đơn chờ giao
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW MODE 4: COMPACT LIST VIEW */}
            {viewMode === 'list' && (
              <div className="flex flex-col gap-2.5">
                {visibleOrders.map((order) => (
                  <KdsTicketListRow
                    key={order.id}
                    order={order}
                    now={now}
                    disabled={update.isPending || !user.permissions.includes('kds.manage')}
                    onStatus={(status) =>
                      update.mutate({
                        orderId: order.id,
                        status,
                        expectedUpdatedAt: order.kdsUpdatedAt,
                      })
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 4. RECENTLY SERVED HISTORY DRAWER                                         */}
      {/* ========================================================================= */}
      <Drawer.Root open={historyOpen} onOpenChange={setHistoryOpen}>
        <Drawer.Content direction="right" className="max-w-md">
          <Drawer.Header>
            <div className="flex items-center justify-between">
              <Drawer.Title className="flex items-center gap-2 text-base sm:text-lg">
                <IconHistory size={20} className="text-[var(--ember)]" />
                Lịch sử đơn đã hoàn tất
              </Drawer.Title>
            </div>
            <Drawer.Description>
              Hiển thị 30 đơn pha chế gần nhất. Bạn có thể khôi phục lại đơn nếu bấm nhầm.
            </Drawer.Description>
          </Drawer.Header>

          <Drawer.Body className="space-y-3">
            {historyQuery.isLoading && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            )}

            {!historyQuery.isLoading && !historyQuery.data?.orders?.length && (
              <div className="text-center py-12 text-xs text-[var(--stone)]">
                Chưa có đơn nào hoàn tất trong ca này.
              </div>
            )}

            {historyQuery.data?.orders?.map((histOrder) => (
              <div
                key={histOrder.id}
                className="p-3.5 rounded-xl border border-[#ded4c6] bg-white shadow-2xs flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-data font-bold text-sm text-[var(--char)]">
                    {histOrder.orderCode}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Đã giao
                  </span>
                </div>
                <div className="text-xs text-[var(--stone)]">
                  {histOrder.tableName ? `Bàn ${histOrder.tableName}` : histOrder.source === 'takeaway' ? 'Mang đi' : 'Tại quầy'} · Thu ngân: {histOrder.cashier}
                </div>
                <div className="text-xs font-semibold text-[var(--char)] truncate">
                  {histOrder.lines.map((l) => `${l.quantity}× ${l.name}`).join(', ')}
                </div>

                <div className="pt-2 border-t border-[#f0e8dc] flex items-center justify-between text-[11px]">
                  <span className="text-[var(--stone)] font-data">
                    {histOrder.kdsUpdatedAt
                      ? new Date(histOrder.kdsUpdatedAt).toLocaleTimeString('vi-VN')
                      : 'Vừa xong'}
                  </span>
                  <button
                    type="button"
                    disabled={update.isPending || !user.permissions.includes('kds.manage')}
                    onClick={() => {
                      update.mutate({
                        orderId: histOrder.id,
                        status: 'ready',
                        expectedUpdatedAt: histOrder.kdsUpdatedAt,
                      })
                    }}
                    className="px-2.5 py-1 rounded-md bg-[#f4ebe1] hover:bg-[var(--espresso)] hover:text-white text-[var(--char)] font-bold transition-all text-[11px] active:scale-95 disabled:opacity-50"
                  >
                    Khôi phục về Chờ giao
                  </button>
                </div>
              </div>
            ))}
          </Drawer.Body>

          <Drawer.Footer>
            <Drawer.Close className="w-full py-2.5 rounded-xl bg-[var(--espresso)] text-[var(--crema)] font-bold text-xs shadow-xs hover:bg-[#3e2b22] active:scale-95 transition-all text-center">
              Đóng lại
            </Drawer.Close>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Root>
    </div>
  )
}

// -----------------------------------------------------------------------------
// TICKET CARD COMPONENT (FOR GRID & KANBAN)
// -----------------------------------------------------------------------------

function KdsTicketCard({
  order,
  now,
  checkedItems,
  onToggleItemCheck,
  disabled,
  onStatus,
  density = 'standard',
}: {
  order: KdsOrder
  now: number
  checkedItems: Record<string, boolean>
  onToggleItemCheck: (lineId: string) => void
  disabled: boolean
  onStatus: (status: KdsStatus) => void
  density?: 'standard' | 'compact'
}) {
  const elapsedMs = Math.max(0, now - order.createdAt)
  const elapsedMinutes = Math.floor(elapsedMs / 60_000)
  const elapsedSeconds = Math.floor((elapsedMs % 60_000) / 1000)
  const isLate = elapsedMinutes >= 15 && order.kdsStatus !== 'ready'
  const isCaution = elapsedMinutes >= 8 && elapsedMinutes < 15 && order.kdsStatus !== 'ready'

  // Next and Prev transitions
  const nextStatus: KdsStatus =
    order.kdsStatus === 'new'
      ? 'making'
      : order.kdsStatus === 'making'
      ? 'ready'
      : 'served'

  const prevStatus: KdsStatus | null =
    order.kdsStatus === 'making'
      ? 'new'
      : order.kdsStatus === 'ready'
      ? 'making'
      : null

  const actionConfig = {
    new: {
      label: 'Bắt đầu pha chế',
      icon: IconFlame,
      bg: 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs',
    },
    making: {
      label: 'Đánh dấu sẵn sàng',
      icon: IconCheck,
      bg: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs',
    },
    ready: {
      label: 'Đã giao cho khách',
      icon: IconCheck,
      bg: 'bg-[var(--ember)] hover:bg-[#963721] text-white shadow-xs',
    },
    served: {
      label: 'Hoàn tất',
      icon: IconCheck,
      bg: 'bg-gray-500 text-white',
    },
  }[order.kdsStatus]

  const ActionIcon = actionConfig.icon

  return (
    <article
      className={cn(
        'group flex flex-col bg-white rounded-2xl border border-[#ded4c6] shadow-xs overflow-hidden transition-all duration-150',
        'hover:shadow-md hover:border-[#c5b8a9]',
        order.kdsStatus === 'new' && 'border-t-4 border-t-amber-500',
        order.kdsStatus === 'making' && 'border-t-4 border-t-emerald-600',
        order.kdsStatus === 'ready' && 'border-t-4 border-t-teal-600',
        isLate && 'border-t-4 border-t-red-600 ring-2 ring-red-500/40 shadow-red-100',
      )}
    >
      {/* Top Header - Compact and Sticky within card */}
      <div className="p-2.5 sm:px-3 sm:py-2 border-b border-[#f0e8dc] bg-[#fcfaf7] shrink-0">
        <div className="flex items-start justify-between gap-1.5">
          {/* Order Code & Table / Source */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm sm:text-base font-bold font-data text-[var(--char)] tracking-tight">
                {order.orderCode}
              </span>
            </div>

            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {order.source === 'takeaway' ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-100/80 text-amber-950 text-[10.5px] font-bold border border-amber-300/60">
                  <IconShoppingBag size={11} stroke={2.5} />
                  Mang đi
                </span>
              ) : order.tableName ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-100/80 text-emerald-950 text-[10.5px] font-bold border border-emerald-300/60">
                  <IconArmchair size={11} stroke={2.5} />
                  Bàn {order.tableName} {order.zoneName ? `· ${order.zoneName}` : ''}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-stone-100 text-stone-900 text-[10.5px] font-bold border border-stone-300/60">
                  <IconBuildingStore size={11} stroke={2.5} />
                  Tại quầy
                </span>
              )}
            </div>
          </div>

          {/* Live Timer Badge */}
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <div
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-data font-bold select-none shadow-2xs',
                isLate && 'bg-red-100 text-red-900 border border-red-300 animate-pulse',
                isCaution && 'bg-amber-100 text-amber-900 border border-amber-300',
                !isLate && !isCaution && 'bg-[#ede5d8] text-[#5e5145] border border-[#ded4c6]',
              )}
            >
              <IconClock size={11} stroke={2.5} />
              <span>
                {String(elapsedMinutes).padStart(2, '0')}:
                {String(elapsedSeconds).padStart(2, '0')}
              </span>
            </div>
            {isLate && (
              <span className="text-[9.5px] font-black text-red-600 uppercase tracking-tight font-data">
                Trễ {elapsedMinutes}p
              </span>
            )}
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between text-[10.5px] text-[var(--stone)] font-medium pt-1 border-t border-[#f0e8dc]/60">
          <span className="font-data">{new Date(order.createdAt).toLocaleTimeString('vi-VN')}</span>
          <span>Thu ngân: <b>{order.cashier}</b></span>
        </div>
      </div>

      {/* Item Lines & Tap-to-Checklist */}
      <div
        className={cn(
          'flex flex-col gap-1.5 max-h-[380px] overflow-y-auto overscroll-contain scrollbar-thin',
          density === 'compact' ? 'p-2' : 'p-2.5 sm:p-3'
        )}
      >
        <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
          {order.lines.map((line) => {
            const isChecked = Boolean(checkedItems[line.id])
            return (
              <li
                key={line.id}
                onClick={() => onToggleItemCheck(line.id)}
                className={cn(
                  'flex items-start gap-2 p-1.5 rounded-lg border transition-all cursor-pointer select-none',
                  isChecked
                    ? 'bg-emerald-50/50 border-emerald-200 opacity-60'
                    : 'bg-[#fcfaf7] border-[#ede5d8] hover:bg-[#faf4ec]',
                )}
                title="Bấm để đánh dấu đã làm xong món này"
              >
                {/* Quantity or Check Icon */}
                <div className="shrink-0 mt-0.5">
                  {isChecked ? (
                    <span className="flex size-5 items-center justify-center rounded-md bg-emerald-600 text-white font-bold text-[11px] shadow-2xs">
                      <IconCheck size={12} stroke={3} />
                    </span>
                  ) : (
                    <span className="flex size-5 items-center justify-center rounded-md bg-[var(--espresso)] text-white font-bold text-[11px] font-data shadow-2xs">
                      {line.quantity}×
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-xs sm:text-[13px] font-bold leading-snug',
                      isChecked ? 'line-through text-emerald-950' : 'text-[var(--char)]',
                    )}
                  >
                    {line.name}
                    {line.variant && line.variant !== 'Tiêu chuẩn' && (
                      <span className="ml-1 font-semibold text-[11px] text-[var(--stone)]">
                        ({line.variant})
                      </span>
                    )}
                  </p>

                  {/* Modifiers Chips */}
                  {line.modifiers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {line.modifiers.map((mod, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#f5ecdc] text-[#6d4d29] border border-[#e2d2ba]"
                        >
                          {mod.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>

        {/* Special Kitchen Notes */}
        {order.note && (
          <div className="mt-1 flex items-start gap-1.5 p-2 rounded-lg bg-amber-50/90 border border-amber-200 text-amber-950 text-[11px] font-medium shadow-2xs">
            <IconNote size={13} className="shrink-0 text-amber-700 mt-0.5" />
            <div className="leading-tight min-w-0">
              <strong className="text-amber-900 uppercase text-[9.5px] tracking-wider block">Ghi chú bếp:</strong>
              <span className="font-semibold">{order.note}</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Footer (Ergonomic Touch Target) */}
      <div className="p-2 sm:p-2.5 bg-[#f7f3eb] border-t border-[#ede5d8] flex items-center gap-1.5 shrink-0 mt-auto">
        {prevStatus && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onStatus(prevStatus)}
            className="flex size-9 sm:size-10 items-center justify-center rounded-xl border border-[#d9cfc2] bg-white text-[var(--stone)] hover:bg-[#ede5d8] hover:text-[var(--char)] active:scale-95 transition-all shadow-2xs disabled:opacity-40 shrink-0"
            title="Quay lại trạng thái trước"
          >
            <IconArrowBackUp size={16} stroke={2.2} />
          </button>
        )}

        <button
          type="button"
          disabled={disabled}
          onClick={() => onStatus(nextStatus)}
          className={cn(
            'flex-1 min-h-9 sm:min-h-10 px-3 rounded-xl font-bold text-xs sm:text-[13px] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-50 select-none cursor-pointer shadow-xs',
            actionConfig.bg,
          )}
        >
          <ActionIcon size={16} stroke={2.5} />
          <span className="tracking-tight">{actionConfig.label}</span>
        </button>
      </div>
    </article>
  )
}

// -----------------------------------------------------------------------------
// TICKET COMPACT ROW (FOR LIST VIEW & HIGH-DENSITY MOBILE)
// -----------------------------------------------------------------------------

function KdsTicketListRow({
  order,
  now,
  disabled,
  onStatus,
}: {
  order: KdsOrder
  now: number
  disabled: boolean
  onStatus: (status: KdsStatus) => void
}) {
  const elapsedMs = Math.max(0, now - order.createdAt)
  const elapsedMinutes = Math.floor(elapsedMs / 60_000)
  const isLate = elapsedMinutes >= 15 && order.kdsStatus !== 'ready'

  const nextStatus: KdsStatus =
    order.kdsStatus === 'new'
      ? 'making'
      : order.kdsStatus === 'making'
      ? 'ready'
      : 'served'

  const actionText =
    order.kdsStatus === 'new'
      ? 'Bắt đầu'
      : order.kdsStatus === 'making'
      ? 'Sẵn sàng'
      : 'Giao món'

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#ded4c6] shadow-2xs hover:shadow-xs transition-all',
        order.kdsStatus === 'new' && 'border-l-4 border-l-amber-500',
        order.kdsStatus === 'making' && 'border-l-4 border-l-emerald-600',
        order.kdsStatus === 'ready' && 'border-l-4 border-l-teal-600',
        isLate && 'border-l-4 border-l-red-600 bg-red-50/30',
      )}
    >
      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
        <div className="flex flex-col shrink-0">
          <span className="font-data font-bold text-base text-[var(--char)]">
            {order.orderCode}
          </span>
          <span className="text-[11px] font-semibold text-[var(--stone)]">
            {order.tableName ? `Bàn ${order.tableName}` : order.source === 'takeaway' ? 'Mang đi' : 'Tại quầy'}
          </span>
        </div>

        <div className="flex-1 min-w-0 border-l border-[#f0e8dc] pl-3">
          <p className="text-xs sm:text-sm font-bold text-[var(--char)] truncate">
            {order.lines.map((l) => `${l.quantity}× ${l.name}`).join(', ')}
          </p>
          {order.note && (
            <p className="text-[11px] text-amber-900 font-semibold truncate mt-0.5">
              Ghi chú: {order.note}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#f0e8dc]">
        <span
          className={cn(
            'px-2.5 py-1 rounded-full text-xs font-data font-bold shadow-2xs',
            isLate ? 'bg-red-100 text-red-900 border border-red-300' : 'bg-[#ede5d8] text-[#5c5044] border border-[#ded4c6]',
          )}
        >
          {elapsedMinutes}p
        </span>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onStatus(nextStatus)}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all text-white active:scale-95 shadow-2xs',
            order.kdsStatus === 'new' && 'bg-amber-600 hover:bg-amber-700',
            order.kdsStatus === 'making' && 'bg-emerald-600 hover:bg-emerald-700',
            order.kdsStatus === 'ready' && 'bg-[var(--ember)] hover:bg-[#973922]',
          )}
        >
          <span>{actionText}</span>
          <IconChevronRight size={14} stroke={2.5} />
        </button>
      </div>
    </div>
  )
}
