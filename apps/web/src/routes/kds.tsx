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
} from '@tabler/icons-react'
import { readSession } from '../server/session'
import { cn } from '@/lib/utils'

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

type ViewMode = 'grid' | 'kanban' | 'list'
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
    gain1.gain.setValueAtTime(0.18, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.7)

    // Harmonizing overtone (E6)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(1318.51, now + 0.08)
    gain2.gain.setValueAtTime(0.12, now + 0.08)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.08)
    osc2.stop(now + 0.8)
  } catch {
    // Ignore audio permission or autoplay restrictions
  }
}

function Kds() {
  const { user } = Route.useRouteContext()
  const queryClient = useQueryClient()

  // View & Filter States
  const [zone, setZone] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tomny_kds_sound') !== 'false'
    } catch {
      return true
    }
  })
  const [isFullscreen, setIsFullscreen] = useState(false)

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

  // Mutation to advance or change status
  const update = useMutation({
    mutationFn: async (input: {
      orderId: string
      status: KdsStatus
      expectedUpdatedAt: number | null
    }) => {
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
      await queryClient.invalidateQueries({ queryKey: ['kds-orders'] })
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

  // Helper counts
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
          l.name.toLowerCase().includes(q),
        )
        const matchCashier = order.cashier.toLowerCase().includes(q)
        if (!matchCode && !matchTable && !matchItem && !matchCashier) return false
      }

      return true
    })
  }, [orders, zone, statusFilter, searchQuery, now])

  return (
    <div className="min-h-screen bg-[#f5f0e8] text-[var(--char)] flex flex-col">
      <main className="flex-1 flex flex-col max-w-[1600px] w-full mx-auto p-3 sm:p-5 md:p-6 gap-4">
        {/* Top Header & Overview Banner */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#fffdfa] border border-[#ded6cc] rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-2 rounded-full bg-[var(--moss)] animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--stone)]">
                  MÀN HÌNH BẾP & PHA CHẾ
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold font-display text-[var(--char)] leading-tight mt-0.5">
                Đang xử lý{' '}
                <span className="font-data text-[var(--ember)]">
                  {orders.length}
                </span>{' '}
                đơn
              </h1>
            </div>

            {/* Polling timestamp & manual refresh on mobile */}
            <div className="flex items-center gap-1.5 md:hidden">
              <button
                type="button"
                onClick={() => query.refetch()}
                className="p-2 rounded-lg border border-[#e5ddd3] text-[var(--stone)] hover:bg-[#faf6f0] hover:text-[var(--char)] active:scale-95 transition-all"
                title="Tải lại đơn"
              >
                <IconRefresh size={16} className={query.isFetching ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                onClick={toggleSound}
                className={cn(
                  'p-2 rounded-lg border transition-all',
                  soundEnabled
                    ? 'border-[var(--amber)] bg-amber-50 text-amber-900'
                    : 'border-[#ded6cc] text-[var(--stone)]',
                )}
                title={soundEnabled ? 'Chuông báo: Bật' : 'Chuông báo: Tắt'}
              >
                {soundEnabled ? <IconBell size={16} /> : <IconBellOff size={16} />}
              </button>
            </div>
          </div>

          {/* KPI Status Badges (Clickable filters) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setStatusFilter('new')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-left shrink-0',
                statusFilter === 'new'
                  ? 'border-[var(--amber)] bg-amber-50 shadow-xs ring-2 ring-[var(--amber)]/30'
                  : 'border-[#ded6cc] bg-white hover:bg-[#faf6f0]',
              )}
            >
              <span className="flex size-6 items-center justify-center rounded-md bg-amber-100 text-amber-800">
                <IconCoffee size={14} stroke={2.5} />
              </span>
              <div>
                <span className="block text-[11px] font-bold text-amber-900/70 uppercase">
                  Mới nhận
                </span>
                <strong className="block text-base font-bold font-data text-amber-950 leading-none">
                  {countByStatus('new')}
                </strong>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('making')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-left shrink-0',
                statusFilter === 'making'
                  ? 'border-[var(--moss)] bg-emerald-50 shadow-xs ring-2 ring-[var(--moss)]/30'
                  : 'border-[#ded6cc] bg-white hover:bg-[#faf6f0]',
              )}
            >
              <span className="flex size-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
                <IconFlame size={14} stroke={2.5} />
              </span>
              <div>
                <span className="block text-[11px] font-bold text-emerald-900/70 uppercase">
                  Đang pha
                </span>
                <strong className="block text-base font-bold font-data text-emerald-950 leading-none">
                  {countByStatus('making')}
                </strong>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('ready')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-left shrink-0',
                statusFilter === 'ready'
                  ? 'border-[#2d6a4f] bg-teal-50 shadow-xs ring-2 ring-[#2d6a4f]/30'
                  : 'border-[#ded6cc] bg-white hover:bg-[#faf6f0]',
              )}
            >
              <span className="flex size-6 items-center justify-center rounded-md bg-teal-100 text-teal-800">
                <IconCheck size={14} stroke={3} />
              </span>
              <div>
                <span className="block text-[11px] font-bold text-teal-900/70 uppercase">
                  Sẵn sàng
                </span>
                <strong className="block text-base font-bold font-data text-teal-950 leading-none">
                  {countByStatus('ready')}
                </strong>
              </div>
            </button>

            {lateCount > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('late')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-left shrink-0 animate-pulse',
                  statusFilter === 'late'
                    ? 'border-[var(--ember)] bg-red-50 shadow-xs ring-2 ring-[var(--ember)]/30'
                    : 'border-red-300 bg-red-50/70 hover:bg-red-100',
                )}
              >
                <span className="flex size-6 items-center justify-center rounded-md bg-red-200 text-red-800">
                  <IconAlertTriangle size={14} stroke={2.5} />
                </span>
                <div>
                  <span className="block text-[11px] font-bold text-red-900 uppercase">
                    Trễ (&gt;15p)
                  </span>
                  <strong className="block text-base font-bold font-data text-red-900 leading-none">
                    {lateCount}
                  </strong>
                </div>
              </button>
            )}
          </div>
        </header>

        {/* Toolbar: Filter, Search, Views, Controls */}
        <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#fffdfa] border border-[#ded6cc] rounded-xl p-2.5 sm:p-3 shadow-2xs">
          {/* Left: Zone & Status Filter Chips */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap overflow-x-auto scrollbar-none">
            {/* Status Selector */}
            <div className="inline-flex items-center p-1 rounded-lg bg-[#f0e8dc] gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-bold transition-all',
                  statusFilter === 'all'
                    ? 'bg-[var(--espresso)] text-[var(--crema)] shadow-xs'
                    : 'text-[#6b5d52] hover:text-[var(--char)] hover:bg-white/60',
                )}
              >
                Tất cả ({orders.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('new')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-bold transition-all',
                  statusFilter === 'new'
                    ? 'bg-[var(--espresso)] text-[var(--crema)] shadow-xs'
                    : 'text-[#6b5d52] hover:text-[var(--char)] hover:bg-white/60',
                )}
              >
                Mới ({countByStatus('new')})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('making')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-bold transition-all',
                  statusFilter === 'making'
                    ? 'bg-[var(--espresso)] text-[var(--crema)] shadow-xs'
                    : 'text-[#6b5d52] hover:text-[var(--char)] hover:bg-white/60',
                )}
              >
                Đang pha ({countByStatus('making')})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ready')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-bold transition-all',
                  statusFilter === 'ready'
                    ? 'bg-[var(--espresso)] text-[var(--crema)] shadow-xs'
                    : 'text-[#6b5d52] hover:text-[var(--char)] hover:bg-white/60',
                )}
              >
                Sẵn sàng ({countByStatus('ready')})
              </button>
            </div>

            {/* Zone Selector (if multiple zones exist) */}
            {zones.length > 0 && (
              <div className="inline-flex items-center p-1 rounded-lg bg-[#f0e8dc] gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setZone('all')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
                    zone === 'all'
                      ? 'bg-white text-[var(--char)] shadow-xs font-bold'
                      : 'text-[#6b5d52] hover:text-[var(--char)]',
                  )}
                >
                  Tất cả khu
                </button>
                {zones.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setZone(name)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-semibold transition-all truncate max-w-[110px]',
                      zone === name
                        ? 'bg-white text-[var(--char)] shadow-xs font-bold'
                        : 'text-[#6b5d52] hover:text-[var(--char)]',
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Search, View Switcher & Controls */}
          <div className="flex items-center gap-2 justify-between lg:justify-end">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-56 sm:flex-initial">
              <IconSearch
                size={15}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--stone)]"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm mã đơn, bàn, món…"
                className="w-full h-8.5 pl-8 pr-7 text-xs rounded-lg border border-[#ded6cc] bg-white text-[var(--char)] focus:border-[var(--ember)] focus:ring-1 focus:ring-[var(--ember)] transition-all outline-hidden font-medium"
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

            {/* View Mode Buttons */}
            <div className="hidden sm:inline-flex items-center p-1 rounded-lg bg-[#f0e8dc] gap-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1.5 rounded-md text-[var(--char)] transition-all',
                  viewMode === 'grid'
                    ? 'bg-white shadow-2xs text-[var(--char)] font-bold'
                    : 'text-[#7d7065] hover:text-[var(--char)]',
                )}
                title="Dạng lưới"
              >
                <IconLayoutGrid size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={cn(
                  'p-1.5 rounded-md text-[var(--char)] transition-all',
                  viewMode === 'kanban'
                    ? 'bg-white shadow-2xs text-[var(--char)] font-bold'
                    : 'text-[#7d7065] hover:text-[var(--char)]',
                )}
                title="Dạng cột Kanban"
              >
                <IconLayoutColumns size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-1.5 rounded-md text-[var(--char)] transition-all',
                  viewMode === 'list'
                    ? 'bg-white shadow-2xs text-[var(--char)] font-bold'
                    : 'text-[#7d7065] hover:text-[var(--char)]',
                )}
                title="Dạng danh sách cuộn"
              >
                <IconLayoutList size={15} />
              </button>
            </div>

            {/* Desktop Actions (Sound & Fullscreen & Refresh) */}
            <div className="hidden md:flex items-center gap-1">
              <button
                type="button"
                onClick={toggleSound}
                className={cn(
                  'p-2 rounded-lg border transition-all text-xs font-semibold flex items-center gap-1.5',
                  soundEnabled
                    ? 'border-[var(--amber)] bg-amber-50 text-amber-900'
                    : 'border-[#ded6cc] text-[var(--stone)] hover:bg-[#faf6f0]',
                )}
                title={soundEnabled ? 'Chuông báo: Bật' : 'Chuông báo: Tắt'}
              >
                {soundEnabled ? <IconBell size={15} /> : <IconBellOff size={15} />}
                <span className="hidden xl:inline">
                  {soundEnabled ? 'Âm báo' : 'Tắt âm'}
                </span>
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-2 rounded-lg border border-[#ded6cc] bg-white text-[var(--stone)] hover:bg-[#faf6f0] hover:text-[var(--char)] transition-all"
                title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
              >
                {isFullscreen ? (
                  <IconArrowsMinimize size={15} />
                ) : (
                  <IconArrowsMaximize size={15} />
                )}
              </button>

              <button
                type="button"
                onClick={() => query.refetch()}
                className="p-2 rounded-lg border border-[#ded6cc] bg-white text-[var(--stone)] hover:bg-[#faf6f0] hover:text-[var(--char)] transition-all"
                title="Tải lại ngay"
              >
                <IconRefresh
                  size={15}
                  className={query.isFetching ? 'animate-spin' : ''}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Feedback Messages */}
        {query.isLoading && (
          <div className="p-8 text-center bg-white border border-[#ded6cc] rounded-xl">
            <IconRefresh size={28} className="animate-spin text-[var(--ember)] mx-auto mb-2" />
            <p className="font-semibold text-sm text-[var(--char)]">Đang tải danh sách đơn pha chế…</p>
          </div>
        )}

        {query.isError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-xl text-sm font-semibold flex items-center gap-2">
            <IconAlertTriangle size={18} className="text-red-600 shrink-0" />
            <span>{query.error.message}</span>
          </div>
        )}

        {update.isError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs font-semibold flex items-center gap-2">
            <IconAlertTriangle size={16} className="text-red-600 shrink-0" />
            <span>{update.error.message}</span>
          </div>
        )}

        {/* Empty State */}
        {!query.isLoading && !visibleOrders.length && (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-[#fffdfa] border border-[#ded6cc] rounded-2xl text-center shadow-xs">
            <div className="flex size-16 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--crema)_60%,white)] text-[var(--stone)] mb-3 border border-[#e8ded2]">
              <IconCoffee size={32} stroke={1.5} />
            </div>
            <h2 className="text-lg font-bold text-[var(--char)] font-display">
              {searchQuery || statusFilter !== 'all' || zone !== 'all'
                ? 'Không tìm thấy đơn phù hợp bộ lọc'
                : 'Hiện chưa có đơn cần pha'}
            </h2>
            <p className="text-xs text-[var(--stone)] max-w-sm mt-1">
              {searchQuery || statusFilter !== 'all' || zone !== 'all'
                ? 'Thử xóa từ khóa tìm kiếm hoặc chuyển sang bộ lọc khác.'
                : 'Đơn hàng mới từ thu ngân sẽ tự động xuất hiện và phát chuông báo.'}
            </p>
            {(searchQuery || statusFilter !== 'all' || zone !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                  setZone('all')
                }}
                className="mt-4 px-4 py-2 rounded-lg bg-[var(--espresso)] text-[var(--crema)] text-xs font-bold shadow-xs hover:bg-[#3d2a21] transition-all"
              >
                Đặt lại bộ lọc
              </button>
            )}
          </div>
        )}

        {/* Orders Layout - Dynamic Views */}
        {!query.isLoading && visibleOrders.length > 0 && (
          <>
            {/* VIEW MODE 1: KANBAN COLUMNS */}
            {viewMode === 'kanban' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                {/* Column 1: Mới nhận */}
                <div className="flex flex-col gap-3 bg-[#f0e9df] p-3 rounded-xl border border-[#ded5cb]">
                  <div className="flex items-center justify-between px-1">
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-amber-950">
                      <span className="size-2.5 rounded-full bg-amber-500" />
                      Mới nhận ({visibleOrders.filter((o) => o.kdsStatus === 'new').length})
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
                </div>

                {/* Column 2: Đang pha */}
                <div className="flex flex-col gap-3 bg-[#f0e9df] p-3 rounded-xl border border-[#ded5cb]">
                  <div className="flex items-center justify-between px-1">
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-emerald-950">
                      <span className="size-2.5 rounded-full bg-emerald-500" />
                      Đang pha ({visibleOrders.filter((o) => o.kdsStatus === 'making').length})
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
                </div>

                {/* Column 3: Sẵn sàng */}
                <div className="flex flex-col gap-3 bg-[#f0e9df] p-3 rounded-xl border border-[#ded5cb]">
                  <div className="flex items-center justify-between px-1">
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-teal-950">
                      <span className="size-2.5 rounded-full bg-teal-500" />
                      Sẵn sàng giao ({visibleOrders.filter((o) => o.kdsStatus === 'ready').length})
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
                </div>
              </div>
            )}

            {/* VIEW MODE 2: GRID / RESPONSIVE TILES */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
                {visibleOrders.map((order) => (
                  <KdsTicketCard
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

            {/* VIEW MODE 3: COMPACT LIST VIEW */}
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
    </div>
  )
}

// -------------------------------------------------------------
// TICKET CARD (GRID / KANBAN)
// -------------------------------------------------------------

function KdsTicketCard({
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
      bg: 'bg-[var(--espresso)] hover:bg-[#3d2a21] text-[var(--crema)] shadow-xs',
    },
    making: {
      label: 'Đánh dấu sẵn sàng',
      icon: IconCheck,
      bg: 'bg-[var(--moss)] hover:bg-[#525d48] text-white shadow-xs',
    },
    ready: {
      label: 'Đã giao cho khách',
      icon: IconCheck,
      bg: 'bg-[var(--ember)] hover:bg-[#973922] text-white shadow-xs',
    },
    served: {
      label: 'Hoàn tất',
      icon: IconCheck,
      bg: 'bg-gray-400 text-white',
    },
  }[order.kdsStatus]

  const ActionIcon = actionConfig.icon

  return (
    <article
      className={cn(
        'group flex flex-col justify-between bg-white rounded-xl border border-[#ded5cb] shadow-sm overflow-hidden transition-all duration-150',
        'hover:shadow-md hover:border-[#c5b8a9]',
        order.kdsStatus === 'new' && 'border-t-4 border-t-amber-500',
        order.kdsStatus === 'making' && 'border-t-4 border-t-emerald-600',
        order.kdsStatus === 'ready' && 'border-t-4 border-t-teal-600',
        isLate && 'border-t-4 border-t-red-600 ring-2 ring-red-400/40',
      )}
    >
      {/* Top Header */}
      <div className="p-3.5 pb-2.5 border-b border-[#f0e9df] bg-[#fcfaf7]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-bold font-data text-[var(--char)] tracking-tight">
              {order.orderCode}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs font-semibold text-[#665a50]">
              {order.source === 'takeaway' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100/70 text-amber-900 text-[11px] font-bold">
                  <IconShoppingBag size={12} />
                  Mang đi
                </span>
              ) : order.tableName ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100/70 text-emerald-900 text-[11px] font-bold">
                  <IconArmchair size={12} />
                  Bàn {order.tableName} {order.zoneName ? `· ${order.zoneName}` : ''}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 text-stone-800 text-[11px] font-bold">
                  Tại quầy
                </span>
              )}
            </div>
          </div>

          {/* Live Timer Badge */}
          <div className="flex flex-col items-end gap-1">
            <div
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-data font-bold select-none',
                isLate && 'bg-red-100 text-red-900 border border-red-300 animate-pulse',
                isCaution && 'bg-amber-100 text-amber-900 border border-amber-300',
                !isLate && !isCaution && 'bg-[#efe8de] text-[#5e5145]',
              )}
            >
              <IconClock size={12} stroke={2.5} />
              <span>
                {String(elapsedMinutes).padStart(2, '0')}:
                {String(elapsedSeconds).padStart(2, '0')}
              </span>
            </div>
            {isLate && (
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-tight">
                Trễ {elapsedMinutes}p
              </span>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--stone)] font-medium">
          <span>{new Date(order.createdAt).toLocaleTimeString('vi-VN')}</span>
          <span>Thu ngân: {order.cashier}</span>
        </div>
      </div>

      {/* Item Lines */}
      <div className="p-3.5 flex-1 flex flex-col gap-2.5 min-h-[110px]">
        <ul className="flex flex-col gap-2 list-none p-0 m-0">
          {order.lines.map((line) => (
            <li
              key={line.id}
              className="flex items-start gap-2.5 pb-2 border-b border-[#f3ece2] last:border-0 last:pb-0"
            >
              <span className="flex size-6 items-center justify-center rounded-md bg-[#eee6dc] text-[var(--char)] font-bold text-xs font-data shrink-0 mt-0.5">
                {line.quantity}×
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--char)] leading-tight">
                  {line.name}
                  {line.variant && line.variant !== 'Tiêu chuẩn' && (
                    <span className="ml-1.5 font-normal text-xs text-[var(--stone)]">
                      ({line.variant})
                    </span>
                  )}
                </p>

                {/* Modifiers Chips */}
                {line.modifiers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {line.modifiers.map((mod, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-[#faf2e6] text-[#785935] border border-[#eadaa8]/60"
                      >
                        {mod.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* Note if available */}
        {order.note && (
          <div className="mt-auto pt-2 flex items-start gap-1.5 p-2 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-950 text-xs font-medium">
            <IconNote size={14} className="shrink-0 text-amber-700 mt-0.5" />
            <span className="leading-tight">
              <b>Ghi chú:</b> {order.note}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="p-3 bg-[#faf7f2] border-t border-[#f0eae0] flex items-center gap-1.5">
        {prevStatus && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onStatus(prevStatus)}
            className="flex size-10 items-center justify-center rounded-lg border border-[#d9cebf] bg-white text-[var(--stone)] hover:bg-[#ede5dc] hover:text-[var(--char)] active:scale-95 transition-all disabled:opacity-40"
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
            'flex-1 min-h-10 px-4 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 select-none cursor-pointer',
            actionConfig.bg,
          )}
        >
          <ActionIcon size={16} stroke={2.5} />
          <span>{actionConfig.label}</span>
        </button>
      </div>
    </article>
  )
}

// -------------------------------------------------------------
// TICKET COMPACT ROW (FOR LIST VIEW / MOBILE)
// -------------------------------------------------------------

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
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#ded5cb] shadow-2xs hover:shadow-sm transition-all',
        order.kdsStatus === 'new' && 'border-l-4 border-l-amber-500',
        order.kdsStatus === 'making' && 'border-l-4 border-l-emerald-600',
        order.kdsStatus === 'ready' && 'border-l-4 border-l-teal-600',
        isLate && 'border-l-4 border-l-red-600 bg-red-50/20',
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
            <p className="text-[11px] text-amber-900 font-medium truncate mt-0.5">
              Ghi chú: {order.note}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#f0e8dc]">
        <span
          className={cn(
            'px-2 py-0.5 rounded-full text-xs font-data font-bold',
            isLate ? 'bg-red-100 text-red-900' : 'bg-[#f0e8dc] text-[#5c5044]',
          )}
        >
          {elapsedMinutes}p
        </span>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onStatus(nextStatus)}
          className={cn(
            'px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all text-white active:scale-95',
            order.kdsStatus === 'new' && 'bg-[var(--espresso)] hover:bg-[#3d2a21]',
            order.kdsStatus === 'making' && 'bg-[var(--moss)] hover:bg-[#54614a]',
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
