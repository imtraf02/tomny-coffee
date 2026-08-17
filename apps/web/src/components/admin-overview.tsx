import { Link } from '@tanstack/react-router'
import {
  IconCalendarEvent,
  IconCash,
  IconAlertTriangle,
  IconCircleCheck,
  IconCoffee,
  IconArmchair,
  IconPackage,
  IconReceipt,
  IconChartBar,
  IconUsers,
  IconHistory,
  IconSparkles,
  IconChevronRight,
  IconArrowUpRight,
  IconFlame,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { SkeletonMetricGrid } from '@/components/ui/skeleton'

type DashboardReport = {
  summary: {
    orderCount: number
    revenue: number
    discounts: number
    cogs: number
    grossMargin: number
    averageOrder: number
  }
  topItems: Array<{ name: string; variant: string; quantity: number; revenue: number; categoryName?: string }>
  hourly: Array<{ hour: string; orderCount: number; revenue: number }>
  dailyTrend?: Array<{ date: string; orderCount: number; revenue: number; cogs: number; grossMargin: number }>
  categoryBreakdown?: Array<{ categoryName: string; quantity: number; revenue: number; percentage: number }>
  sourcesBreakdown?: Array<{ source: string; count: number; revenue: number; percentage: number }>
  inventory?: Array<{ id: string; name: string; currentQuantity: number; reorderPoint: number; active: number | boolean }>
}
type DashboardTable = { status: 'trong' | 'dang_phuc_vu' | 'dat_truoc' | 'can_don' }
type DashboardFloor = { tables: DashboardTable[] }

const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}₫`
const max = (values: number[]) => Math.max(1, ...values)

const adminHubLinks = [
  {
    to: '/admin/menu',
    label: 'Sản Phẩm & Thực Đơn',
    desc: 'Danh mục món, bảng giá, size & topping',
    category: 'Vận Hành',
    icon: IconCoffee,
    iconColor: 'text-[var(--ember)]',
    bgColor: 'bg-[#fff2ee] border-[#fed7cc]',
  },
  {
    to: '/admin/tables',
    label: 'Sơ Đồ Bàn & Khu Vực',
    desc: 'Bố trí mặt bằng, trạng thái bàn phục vụ',
    category: 'Vận Hành',
    icon: IconArmchair,
    iconColor: 'text-[var(--moss)]',
    bgColor: 'bg-[#f2f7f0] border-[#d1e5cd]',
  },
  {
    to: '/admin/inventory',
    label: 'Kho & Nguyên Liệu',
    desc: 'Định mức tồn kho & nhập xuất lô FIFO',
    category: 'Vận Hành',
    icon: IconPackage,
    iconColor: 'text-[var(--amber)]',
    bgColor: 'bg-[#fef8ee] border-[#fde3b7]',
  },
  {
    to: '/admin/orders',
    label: 'Lịch Sử Đơn Hàng',
    desc: 'Chi tiết đơn, chiết khấu & hủy món',
    category: 'Vận Hành',
    icon: IconReceipt,
    iconColor: 'text-[var(--espresso)]',
    bgColor: 'bg-[#f2eeea] border-[#d8cec5]',
  },
  {
    to: '/admin/reports',
    label: 'Báo Cáo Doanh Thu',
    desc: 'Doanh thu, COGS & biên lợi nhuận',
    category: 'Quản Trị',
    icon: IconChartBar,
    iconColor: 'text-[var(--ember)]',
    bgColor: 'bg-[#fff2ee] border-[#fed7cc]',
  },
  {
    to: '/admin/staff',
    label: 'Nhân Sự & Quyền Hạn',
    desc: 'Tài khoản nhân viên, phân quyền & chấm công',
    category: 'Quản Trị',
    icon: IconUsers,
    iconColor: 'text-[var(--moss)]',
    bgColor: 'bg-[#f2f7f0] border-[#d1e5cd]',
  },
  {
    to: '/admin/audit',
    label: 'Nhật Ký Hoạt Động',
    desc: 'Lưu vết thao tác & lịch sử kiểm toán bảo mật',
    category: 'Quản Trị',
    icon: IconHistory,
    iconColor: 'text-[var(--stone)]',
    bgColor: 'bg-[#f7f5f2] border-[#e5ddd6]',
  },
]

export function AdminOverview({ report, floor }: { report?: DashboardReport; floor?: DashboardFloor }) {
  const summary = report?.summary
  const rawHours = report?.hourly ?? []

  // Construct operating timeline (07:00 to 22:00)
  const operatingTimeline = Array.from({ length: 16 }, (_, i) => {
    const hourNum = i + 7 // 7h -> 22h
    const hourStr = String(hourNum).padStart(2, '0')
    const match = rawHours.find((h) => String(parseInt(h.hour, 10)) === String(hourNum) || h.hour === hourStr)
    return {
      hour: String(hourNum),
      orderCount: match?.orderCount ?? 0,
      revenue: match?.revenue ?? 0,
    }
  })

  const maxRevenue = max(operatingTimeline.map((item) => item.revenue))
  const peakHour = operatingTimeline.reduce((prev, curr) => (curr.revenue > prev.revenue ? curr : prev), operatingTimeline[0])

  const totalTables = floor?.tables.length ?? 0
  const tableCounts = {
    trong: floor?.tables.filter((table) => table.status === 'trong').length ?? 0,
    dang_phuc_vu: floor?.tables.filter((table) => table.status === 'dang_phuc_vu').length ?? 0,
    dat_truoc: floor?.tables.filter((table) => table.status === 'dat_truoc').length ?? 0,
    can_don: floor?.tables.filter((table) => table.status === 'can_don').length ?? 0,
  }
  const occupancyRate = totalTables > 0 ? Math.round((tableCounts.dang_phuc_vu / totalTables) * 100) : 0

  const lowInventory = (report?.inventory ?? [])
    .filter((item) => Boolean(item.active) && Number(item.currentQuantity) <= Number(item.reorderPoint))
    .slice(0, 4)

  const topItemsTotal = (report?.topItems ?? []).reduce((acc, item) => acc + item.quantity, 0)

  return (
    <section className="dashboard-workspace grid gap-4 sm:gap-6 w-full min-w-0 max-w-full overflow-hidden pb-10">
      {/* Welcome & Fast Operations Banner */}
      <div className="overview-welcome-banner w-full min-w-0 max-w-full">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-2xl bg-[var(--espresso)] flex items-center justify-center text-[var(--crema)] shadow-md shrink-0">
            <IconSparkles size={20} stroke={2} />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <h2 className="overview-welcome-title truncate">Trung Tâm Quản Trị & Vận Hành</h2>
            <p className="overview-welcome-desc truncate">Truy cập nhanh các phân hệ chức năng và theo dõi hiệu suất quán.</p>
          </div>
        </div>
      </div>

      {/* Hub Menu Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 w-full min-w-0 max-w-full">
        {adminHubLinks.map((link) => {
          const Icon = link.icon
          return (
            <Link
              key={link.to}
              to={link.to}
              className="relative overflow-hidden rounded-2xl bg-white border border-[#e5ddd6] p-3.5 sm:p-5 group select-none flex items-center sm:flex-col sm:items-start justify-between text-decoration-none transition-all duration-200 hover:shadow-md hover:border-[#ded6cc] active:scale-[0.99] gap-3 min-w-0 max-w-full"
            >
              {/* Icon & Category Badge */}
              <div className="flex items-center sm:justify-between sm:w-full gap-3 shrink-0">
                <div
                  className={cn(
                    'w-10 h-10 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center shadow-2xs transition-transform duration-200 group-hover:scale-105 shrink-0',
                    link.bgColor,
                    link.iconColor,
                  )}
                >
                  <Icon size={20} stroke={1.8} />
                </div>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase tracking-wider bg-[#f8f6f1] text-[#61574f] border border-[#ede6de]">
                  {link.category}
                </span>
              </div>

              {/* Text Content */}
              <div className="flex-1 min-w-0 overflow-hidden sm:mt-2.5">
                <div className="flex items-center justify-between sm:block">
                  <h3 className="font-bold text-[var(--char)] text-sm sm:text-base tracking-tight leading-snug group-hover:text-[var(--ember)] transition-colors duration-200 truncate">
                    {link.label}
                  </h3>
                  <span className="sm:hidden text-[9.5px] font-bold uppercase tracking-wider text-[#8c8177] px-2 py-0.5 bg-[#f8f6f1] rounded-md border border-[#ede6de] shrink-0 ml-2">
                    {link.category}
                  </span>
                </div>
                <p className="text-[11.5px] text-[#8c8177] mt-0.5 sm:mt-1 font-medium truncate">
                  {link.desc}
                </p>
              </div>

              {/* Mobile Right Chevron */}
              <div className="sm:hidden text-[#c5bcaf] group-hover:text-[var(--ember)] transition-colors shrink-0">
                <IconChevronRight size={18} stroke={2} />
              </div>
            </Link>
          )
        })}
      </div>

      {!report && <SkeletonMetricGrid count={4} label="Đang tải số liệu hôm nay…" />}

      {summary && (
        <>
          {/* Dashboard Section Header with Date Chip and Detailed Report link */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-2">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[var(--char)] m-0">
                Hiệu Suất Vận Hành & Doanh Số
              </h3>
              <p className="text-xs text-[#8c8177] m-0 mt-0.5">
                Theo dõi các chỉ số tài chính, bàn phục vụ và kho nguyên liệu tức thời.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              <div className="overview-date-chip">
                <IconCalendarEvent size={15} stroke={1.75} />
                <span>Hôm nay · {new Date().toLocaleDateString('vi-VN')}</span>
              </div>
              <Link
                to="/admin/reports"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-[#1c1512] text-white hover:bg-[#2b1f1a] transition-colors"
              >
                <span>Báo cáo chi tiết</span>
                <IconArrowUpRight size={14} />
              </Link>
            </div>
          </div>

          {/* 4 Core Financial KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 w-full min-w-0 max-w-full">
            <article className="p-3.5 sm:p-4.5 rounded-2xl border border-[#e5ddd6] bg-white flex flex-col justify-between shadow-2xs min-w-0 max-w-full overflow-hidden hover:border-[#ded1c0] transition-colors">
              <div>
                <span className="text-[10.5px] sm:text-xs font-bold text-[#8c8177] uppercase tracking-wider block truncate">
                  Doanh thu hôm nay
                </span>
                <strong className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-[var(--ember)] block truncate mt-1">
                  {money(summary.revenue)}
                </strong>
              </div>
              <div className="mt-2.5 pt-2 border-t border-[#f4efe8] flex items-center justify-between text-[11px] text-[#8c8177]">
                <span>Thực nhận POS</span>
                <span className="font-semibold font-mono text-[var(--char)]">{summary.orderCount} đơn</span>
              </div>
            </article>

            <article className="p-3.5 sm:p-4.5 rounded-2xl border border-[#e5ddd6] bg-white flex flex-col justify-between shadow-2xs min-w-0 max-w-full overflow-hidden hover:border-[#ded1c0] transition-colors">
              <div>
                <span className="text-[10.5px] sm:text-xs font-bold text-[#8c8177] uppercase tracking-wider block truncate">
                  Giá trị TB / Đơn (AOV)
                </span>
                <strong className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-[var(--char)] block truncate mt-1">
                  {money(summary.averageOrder)}
                </strong>
              </div>
              <div className="mt-2.5 pt-2 border-t border-[#f4efe8] flex items-center justify-between text-[11px] text-[#8c8177]">
                <span>Giảm giá</span>
                <span className="font-semibold font-mono text-[#8c8177]">{money(summary.discounts)}</span>
              </div>
            </article>

            <article className="p-3.5 sm:p-4.5 rounded-2xl border border-[#e5ddd6] bg-white flex flex-col justify-between shadow-2xs min-w-0 max-w-full overflow-hidden hover:border-[#ded1c0] transition-colors">
              <div>
                <span className="text-[10.5px] sm:text-xs font-bold text-[#8c8177] uppercase tracking-wider block truncate">
                  Chi phí vốn (COGS)
                </span>
                <strong className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-[var(--char)] block truncate mt-1">
                  {money(summary.cogs)}
                </strong>
              </div>
              <div className="mt-2.5 pt-2 border-t border-[#f4efe8] flex items-center justify-between text-[11px] text-[#8c8177]">
                <span>Tỷ lệ giá vốn</span>
                <span className="font-semibold font-mono text-[var(--char)]">
                  {summary.revenue ? `${Math.round((summary.cogs / summary.revenue) * 100)}%` : '0%'}
                </span>
              </div>
            </article>

            <article className="p-3.5 sm:p-4.5 rounded-2xl border border-[#e5ddd6] bg-white flex flex-col justify-between shadow-2xs min-w-0 max-w-full overflow-hidden hover:border-[#ded1c0] transition-colors">
              <div>
                <span className="text-[10.5px] sm:text-xs font-bold text-[#8c8177] uppercase tracking-wider block truncate">
                  Lợi nhuận gộp
                </span>
                <strong className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-[var(--moss)] block truncate mt-1">
                  {money(summary.grossMargin)}
                </strong>
              </div>
              <div className="mt-2.5 pt-2 border-t border-[#f4efe8] flex items-center justify-between text-[11px] text-[#8c8177]">
                <span>Tỷ suất biên</span>
                <span className="font-bold font-mono text-emerald-800">
                  {summary.revenue ? `${Math.round((summary.grossMargin / summary.revenue) * 100)}%` : '0%'}
                </span>
              </div>
            </article>
          </div>

          {/* Main 2-Column Grid: Hourly Chart & Top Products */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 w-full min-w-0 max-w-full">
            {/* Hourly Revenue Chart (7 cols on desktop) */}
            <section className="p-4 sm:p-5 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs min-w-0 max-w-full overflow-hidden flex flex-col justify-between lg:col-span-7">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-[var(--char)] truncate m-0">
                      Doanh thu theo khung giờ
                    </h3>
                    {peakHour && peakHour.revenue > 0 && (
                      <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                        <IconFlame size={12} className="text-amber-600" />
                        Cao điểm: {peakHour.hour}h ({money(peakHour.revenue)})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#8c8177] truncate m-0 mt-0.5">
                    Phân bổ luồng đơn và doanh thu trong ngày (07:00 – 22:00).
                  </p>
                </div>
                <span className="catalog-status-pill is-active shrink-0 text-xs">
                  <span className="catalog-status-dot dot-active" />
                  Hôm nay
                </span>
              </div>

              <div className="w-full max-w-full min-w-0 overflow-x-auto pb-1 block scrollbar-none">
                <div className="flex items-end gap-1.5 sm:gap-2 min-w-[440px] h-44 pt-2 px-1 border-b border-[#eee8e0]">
                  {operatingTimeline.map((item) => {
                    const hasRevenue = item.revenue > 0
                    const isPeak = hasRevenue && item.hour === peakHour?.hour
                    const heightPercent = hasRevenue ? Math.max(14, Math.round((item.revenue / maxRevenue) * 100)) : 4
                    return (
                      <div
                        className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer"
                        key={item.hour}
                        title={`${item.hour}:00 · ${money(item.revenue)} (${item.orderCount} đơn)`}
                      >
                        <div className="w-full max-w-7 h-34 flex items-end relative">
                          <div
                            className={cn(
                              'w-full rounded-t-md transition-all duration-300',
                              isPeak
                                ? 'bg-gradient-to-t from-amber-600 to-amber-500 shadow-xs'
                                : hasRevenue
                                  ? 'bg-[var(--ember)] opacity-85 group-hover:opacity-100'
                                  : 'bg-[#e5ddd6] opacity-35',
                            )}
                            style={{ height: `${heightPercent}%` }}
                          />
                        </div>
                        <span
                          className={cn(
                            'text-[10.5px] font-mono tabular-nums',
                            isPeak ? 'font-bold text-amber-900' : 'text-[#8c8177]',
                          )}
                        >
                          {item.hour}h
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* Top Selling Items (5 cols on desktop) */}
            <section className="p-4 sm:p-5 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs min-w-0 max-w-full overflow-hidden flex flex-col justify-between lg:col-span-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-bold text-[var(--char)] truncate m-0">Top món bán chạy</h3>
                  <p className="text-xs text-[#8c8177] truncate m-0 mt-0.5">Xếp hạng theo số lượng đơn bán hôm nay.</p>
                </div>
                <span className="text-xs font-mono tabular-nums text-[#8c8177] font-semibold shrink-0">
                  {topItemsTotal} ly đã bán
                </span>
              </div>

              <div className="grid gap-2 w-full min-w-0">
                {(report?.topItems ?? []).slice(0, 5).map((item, index) => {
                  const maxQty = max((report?.topItems ?? []).map((e) => e.quantity))
                  const widthPercent = Math.max(12, Math.round((item.quantity / maxQty) * 100))
                  return (
                    <div
                      className="overview-top-row flex items-center gap-2.5 p-2.5 rounded-xl border border-[#ede6de] bg-white w-full min-w-0 hover:border-[#ded6cb] transition-colors"
                      key={`${item.name}-${item.variant}`}
                    >
                      <span
                        className={cn(
                          'overview-rank-badge',
                          index === 0 && 'is-gold',
                          index === 1 && 'is-silver',
                          index === 2 && 'is-bronze',
                        )}
                      >
                        #{index + 1}
                      </span>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex justify-between items-center mb-1 gap-2">
                          <strong className="text-xs font-bold text-[var(--char)] truncate">{item.name}</strong>
                          <span className="text-xs font-bold font-mono tabular-nums text-[var(--ember)] shrink-0">
                            {money(item.revenue)}
                          </span>
                        </div>
                        <div className="overview-prog-bar w-full h-1.5 bg-[#f0ebe4] rounded-full overflow-hidden">
                          <div
                            className="overview-prog-fill h-full bg-[var(--ember)] rounded-full"
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-1 text-[11px] text-[#8c8177] gap-2">
                          <span className="truncate">
                            {item.variant && !['Mặc định', 'Default', 'Phần'].includes(item.variant)
                              ? `Size ${item.variant}`
                              : 'Cỡ chuẩn'}
                          </span>
                          <span className="font-mono tabular-nums font-semibold text-[var(--char)] shrink-0">
                            Đã bán: {item.quantity} ly
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {!report?.topItems.length && (
                  <div className="py-8 text-center text-xs text-[#8c8177]">Chưa có dữ liệu bán hàng hôm nay.</div>
                )}
              </div>
            </section>
          </div>

          {/* Secondary 3-Column Widgets */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0 max-w-full">
            {/* Live Table Status */}
            <section className="p-4 sm:p-5 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs min-w-0 max-w-full overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-[var(--char)] m-0">Trạng thái bàn</h3>
                  <p className="text-xs text-[#8c8177] m-0 mt-0.5">Tình trạng phục vụ thực tế.</p>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#f4efe8] text-[#61574f]">
                  Lấp đầy {occupancyRate}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full min-w-0">
                <div className="p-2.5 rounded-xl border border-[#ede6de] bg-white flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] text-[#8c8177] block truncate">Trống</span>
                    <strong className="text-base font-mono tabular-nums">{tableCounts.trong}</strong>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl border border-[#ede6de] bg-white flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] text-[#8c8177] block truncate">Đang phục vụ</span>
                    <strong className="text-base font-mono tabular-nums">{tableCounts.dang_phuc_vu}</strong>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl border border-[#ede6de] bg-white flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] text-[#8c8177] block truncate">Đặt trước</span>
                    <strong className="text-base font-mono tabular-nums">{tableCounts.dat_truoc}</strong>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl border border-[#ede6de] bg-white flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#9ca3af] shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] text-[#8c8177] block truncate">Cần dọn</span>
                    <strong className="text-base font-mono tabular-nums">{tableCounts.can_don}</strong>
                  </div>
                </div>
              </div>
            </section>

            {/* Channels & Payment Sources */}
            <section className="p-4 sm:p-5 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs min-w-0 max-w-full overflow-hidden flex flex-col justify-between">
              <div className="mb-3">
                <h3 className="text-sm font-bold text-[var(--char)] m-0">Kênh bán & Nguồn thu</h3>
                <p className="text-xs text-[#8c8177] m-0 mt-0.5">Cơ cấu nguồn thu hôm nay.</p>
              </div>
              <div className="space-y-2">
                <div className="p-2.5 bg-[#fbf9f6] border border-[#ede6de] rounded-xl flex flex-col gap-1.5 w-full min-w-0">
                  <div className="flex justify-between items-center text-xs gap-2">
                    <span className="flex items-center gap-1.5 font-medium text-[var(--char)] truncate">
                      <IconCash size={16} stroke={1.75} className="text-[var(--ember)] shrink-0" />
                      <span>Tiền mặt (POS)</span>
                    </span>
                    <strong className="font-mono tabular-nums text-[var(--char)] shrink-0">{money(summary.revenue)}</strong>
                  </div>
                  <div className="w-full h-1.5 bg-[#ede6de] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--ember)] rounded-full" style={{ width: '100%' }} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#8c8177] px-1">
                  <span>Hình thức: Trực tiếp tại quầy</span>
                  <span className="font-semibold text-[var(--char)] font-mono">{summary.orderCount} đơn</span>
                </div>
              </div>
            </section>

            {/* Inventory Alerts */}
            <section className="p-4 sm:p-5 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs min-w-0 max-w-full overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-[var(--char)] m-0">Cảnh báo kho</h3>
                  <p className="text-xs text-[#8c8177] m-0 mt-0.5">Nguyên liệu chạm ngưỡng định mức.</p>
                </div>
                <Link to="/admin/inventory" className="text-xs font-bold text-[var(--ember)] hover:underline">
                  Kho →
                </Link>
              </div>
              <div className="grid gap-2 w-full min-w-0">
                {lowInventory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-[#fff9f5] border border-[#fbdcd0] text-xs gap-2 min-w-0"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                      <IconAlertTriangle size={15} stroke={1.75} className="text-[var(--ember)] shrink-0" />
                      <span className="font-semibold text-[var(--ember)] truncate">{item.name}</span>
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-[#8c8177] shrink-0 ml-1">
                      Còn {item.currentQuantity}
                    </span>
                  </div>
                ))}
                {!lowInventory.length && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#f4f9f4] border border-[#d2ead2] text-xs text-[#2d6a4f] min-w-0">
                    <IconCircleCheck size={16} stroke={1.75} className="shrink-0" />
                    <span className="truncate">Kho hàng ổn định, đủ định mức.</span>
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </section>
  )
}
