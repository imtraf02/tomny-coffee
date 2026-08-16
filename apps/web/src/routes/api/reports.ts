import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { getCurrentUser, requirePermission } from '../../server/auth'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const querySchema = z.object({ from: dateSchema, to: dateSchema }).refine(({ from, to }) => from <= to, 'Khoảng ngày không hợp lệ.')

function range(from: string, to: string) {
  const start = new Date(`${from}T00:00:00+07:00`).getTime()
  const end = new Date(`${to}T00:00:00+07:00`).getTime() + 86_400_000
  if (end - start > 366 * 86_400_000) throw new Response('Khoảng báo cáo tối đa là 366 ngày.', { status: 400 })
  return { start, end }
}

export const Route = createFileRoute('/api/reports')({ server: { handlers: { GET: getReports } } })

async function getReports({ request }: { request: Request }) {
  const actor = requirePermission(await getCurrentUser(request), 'reports.read')
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return Response.json({ message: 'Chọn khoảng ngày hợp lệ.' }, { status: 400 })
  const { start, end } = range(parsed.data.from, parsed.data.to)
  const [summary, topItems, orders, inventory, timeEntries, hourly] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS orderCount, COALESCE(SUM(total), 0) AS revenue, COALESCE(SUM(discount_amount), 0) AS discounts, COALESCE(SUM(cogs), 0) AS cogs, COALESCE(SUM(total - cogs), 0) AS grossMargin, COALESCE(AVG(total), 0) AS averageOrder FROM orders WHERE status = 'paid' AND created_at >= ? AND created_at < ?`).bind(start, end).first(),
    env.DB.prepare(`SELECT ol.name_snapshot AS name, ol.variant_snapshot AS variant, SUM(ol.quantity) AS quantity, SUM(ol.line_total) AS revenue FROM order_lines ol JOIN orders o ON o.id = ol.order_id WHERE o.status = 'paid' AND o.created_at >= ? AND o.created_at < ? GROUP BY ol.name_snapshot, ol.variant_snapshot ORDER BY quantity DESC, revenue DESC LIMIT 100`).bind(start, end).all(),
    env.DB.prepare(`SELECT o.id, o.order_code AS orderCode, o.source, o.status, o.total, o.discount_amount AS discountAmount, o.created_at AS createdAt, u.display_name AS cashier, t.name AS tableName FROM orders o JOIN users u ON u.id = o.created_by LEFT JOIN "tables" t ON t.id = o.table_id WHERE o.created_at >= ? AND o.created_at < ? ORDER BY o.created_at DESC LIMIT 1000`).bind(start, end).all(),
    env.DB.prepare('SELECT id, name, unit, reorder_point AS reorderPoint, current_quantity AS currentQuantity, active FROM ingredients ORDER BY active DESC, name').all(),
    actor.permissions.includes('staff.read') ? env.DB.prepare(`SELECT t.id, t.user_id AS userId, u.display_name AS userName, t.check_in_at AS checkInAt, t.check_out_at AS checkOutAt, t.approved_at AS approvedAt FROM time_entries t JOIN users u ON u.id = t.user_id WHERE t.check_in_at >= ? AND t.check_in_at < ? ORDER BY t.check_in_at DESC`).bind(start, end).all() : Promise.resolve({ results: [] }),
    env.DB.prepare(`SELECT strftime('%H', datetime(created_at / 1000, 'unixepoch', '+7 hours')) AS hour, COUNT(*) AS orderCount, COALESCE(SUM(total), 0) AS revenue FROM orders WHERE status = 'paid' AND created_at >= ? AND created_at < ? GROUP BY hour ORDER BY hour`).bind(start, end).all(),
  ])
  const summaryRow = (summary ?? {}) as Record<string, unknown>
  return Response.json({ from: parsed.data.from, to: parsed.data.to, summary: { ...summaryRow, revenue: Number(summaryRow.revenue ?? 0), discounts: Number(summaryRow.discounts ?? 0), cogs: Number(summaryRow.cogs ?? 0), grossMargin: Number(summaryRow.grossMargin ?? 0), orderCount: Number(summaryRow.orderCount ?? 0), averageOrder: Number(summaryRow.averageOrder ?? 0) }, topItems: topItems.results, orders: orders.results, inventory: inventory.results, timeEntries: timeEntries.results, hourly: hourly.results.map((row) => ({ hour: String((row as { hour?: unknown }).hour ?? '00'), orderCount: Number((row as { orderCount?: unknown }).orderCount ?? 0), revenue: Number((row as { revenue?: unknown }).revenue ?? 0) })) })
}
