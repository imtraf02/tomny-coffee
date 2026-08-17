import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { getCurrentUser, requirePermission } from '../../server/auth'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const querySchema = z
  .object({ from: dateSchema, to: dateSchema })
  .refine(({ from, to }) => from <= to, 'Khoảng ngày không hợp lệ.')

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

  const [
    summary,
    topItems,
    dailyTrend,
    categoryBreakdown,
    sourcesBreakdown,
    cashierSummary,
    purchasingSummary,
    purchasingByIngredient,
    purchasingMovements,
    orders,
    inventory,
    timeEntries,
    hourly,
  ] = await Promise.all([
    env.DB.prepare(
      `SELECT 
        COUNT(*) AS orderCount, 
        COALESCE(SUM(total), 0) AS revenue, 
        COALESCE(SUM(discount_amount), 0) AS discounts, 
        COALESCE(SUM(cogs), 0) AS cogs, 
        COALESCE(SUM(total - cogs), 0) AS grossMargin, 
        COALESCE(AVG(total), 0) AS averageOrder 
       FROM orders 
       WHERE status = 'paid' AND created_at >= ? AND created_at < ?`,
    )
      .bind(start, end)
      .first(),
    env.DB.prepare(
      `SELECT 
        ol.name_snapshot AS name, 
        ol.variant_snapshot AS variant, 
        SUM(ol.quantity) AS quantity, 
        SUM(ol.line_total) AS revenue,
        COALESCE(c.name, 'Khác') AS categoryName
       FROM order_lines ol 
       JOIN orders o ON o.id = ol.order_id 
       LEFT JOIN menu_items mi ON mi.id = ol.menu_item_id
       LEFT JOIN categories c ON c.id = mi.category_id
       WHERE o.status = 'paid' AND o.created_at >= ? AND o.created_at < ? 
       GROUP BY ol.name_snapshot, ol.variant_snapshot 
       ORDER BY quantity DESC, revenue DESC 
       LIMIT 100`,
    )
      .bind(start, end)
      .all(),
    env.DB.prepare(
      `SELECT 
        strftime('%Y-%m-%d', datetime(created_at / 1000, 'unixepoch', '+7 hours')) AS date,
        COUNT(*) AS orderCount,
        COALESCE(SUM(total), 0) AS revenue,
        COALESCE(SUM(cogs), 0) AS cogs,
        COALESCE(SUM(total - cogs), 0) AS grossMargin,
        COALESCE(SUM(discount_amount), 0) AS discounts
       FROM orders 
       WHERE status = 'paid' AND created_at >= ? AND created_at < ?
       GROUP BY date 
       ORDER BY date ASC`,
    )
      .bind(start, end)
      .all(),
    env.DB.prepare(
      `SELECT 
        COALESCE(c.name, 'Khác') AS categoryName,
        SUM(ol.quantity) AS quantity,
        COALESCE(SUM(ol.line_total), 0) AS revenue
       FROM order_lines ol
       JOIN orders o ON o.id = ol.order_id
       LEFT JOIN menu_items mi ON mi.id = ol.menu_item_id
       LEFT JOIN categories c ON c.id = mi.category_id
       WHERE o.status = 'paid' AND o.created_at >= ? AND o.created_at < ?
       GROUP BY categoryName
       ORDER BY revenue DESC`,
    )
      .bind(start, end)
      .all(),
    env.DB.prepare(
      `SELECT 
        source,
        COUNT(*) AS count,
        COALESCE(SUM(total), 0) AS revenue
       FROM orders
       WHERE status = 'paid' AND created_at >= ? AND created_at < ?
       GROUP BY source
       ORDER BY revenue DESC`,
    )
      .bind(start, end)
      .all(),
    env.DB.prepare(
      `SELECT 
        u.display_name AS cashier,
        COUNT(o.id) AS orderCount,
        COALESCE(SUM(o.total), 0) AS revenue,
        COALESCE(SUM(o.discount_amount), 0) AS discounts
       FROM orders o
       JOIN users u ON u.id = o.created_by
       WHERE o.status = 'paid' AND o.created_at >= ? AND o.created_at < ?
       GROUP BY u.id, u.display_name
       ORDER BY revenue DESC`,
    )
      .bind(start, end)
      .all(),
    env.DB.prepare(
      `SELECT 
        COUNT(*) AS receiptCount,
        COALESCE(SUM(quantity_delta * unit_cost), 0) AS totalCost,
        COALESCE(SUM(quantity_delta), 0) AS totalQuantity
       FROM inventory_movements
       WHERE type = 'receipt' AND created_at >= ? AND created_at < ?`,
    )
      .bind(start, end)
      .first(),
    env.DB.prepare(
      `SELECT 
        i.name AS ingredientName,
        i.unit,
        SUM(m.quantity_delta) AS quantity,
        COALESCE(SUM(m.quantity_delta * m.unit_cost), 0) AS totalCost,
        CAST(COALESCE(SUM(m.quantity_delta * m.unit_cost) / NULLIF(SUM(m.quantity_delta), 0), 0) AS INTEGER) AS avgUnitCost
       FROM inventory_movements m
       JOIN ingredients i ON i.id = m.ingredient_id
       WHERE m.type = 'receipt' AND m.created_at >= ? AND m.created_at < ?
       GROUP BY i.id, i.name, i.unit
       ORDER BY totalCost DESC`,
    )
      .bind(start, end)
      .all(),
    env.DB.prepare(
      `SELECT 
        m.id,
        i.name AS ingredientName,
        i.unit,
        m.quantity_delta AS quantity,
        m.unit_cost AS unitCost,
        CAST((m.quantity_delta * m.unit_cost) AS INTEGER) AS totalCost,
        m.reason,
        u.display_name AS actorName,
        m.created_at AS createdAt
       FROM inventory_movements m
       JOIN ingredients i ON i.id = m.ingredient_id
       JOIN users u ON u.id = m.actor_id
       WHERE m.type = 'receipt' AND m.created_at >= ? AND m.created_at < ?
       ORDER BY m.created_at DESC
       LIMIT 100`,
    )
      .bind(start, end)
      .all(),
    env.DB.prepare(
      `SELECT 
        o.id, 
        o.order_code AS orderCode, 
        o.source, 
        o.status, 
        o.total, 
        o.discount_amount AS discountAmount, 
        o.cogs,
        o.created_at AS createdAt, 
        u.display_name AS cashier, 
        t.name AS tableName 
       FROM orders o 
       JOIN users u ON u.id = o.created_by 
       LEFT JOIN "tables" t ON t.id = o.table_id 
       WHERE o.created_at >= ? AND o.created_at < ? 
       ORDER BY o.created_at DESC 
       LIMIT 1000`,
    )
      .bind(start, end)
      .all(),
    env.DB.prepare(
      'SELECT id, name, unit, reorder_point AS reorderPoint, current_quantity AS currentQuantity, active FROM ingredients ORDER BY active DESC, name',
    ).all(),
    actor.permissions.includes('staff.read')
      ? env.DB.prepare(
          `SELECT t.id, t.user_id AS userId, u.display_name AS userName, t.check_in_at AS checkInAt, t.check_out_at AS checkOutAt, t.approved_at AS approvedAt FROM time_entries t JOIN users u ON u.id = t.user_id WHERE t.check_in_at >= ? AND t.check_out_at < ? ORDER BY t.check_in_at DESC`,
        )
          .bind(start, end)
          .all()
      : Promise.resolve({ results: [] }),
    env.DB.prepare(
      `SELECT 
        strftime('%H', datetime(created_at / 1000, 'unixepoch', '+7 hours')) AS hour, 
        COUNT(*) AS orderCount, 
        COALESCE(SUM(total), 0) AS revenue 
       FROM orders 
       WHERE status = 'paid' AND created_at >= ? AND created_at < ? 
       GROUP BY hour 
       ORDER BY hour`,
    )
      .bind(start, end)
      .all(),
  ])

  const summaryRow = (summary ?? {}) as Record<string, unknown>
  const totalRevenue = Number(summaryRow.revenue ?? 0)
  const purchaseRow = (purchasingSummary ?? {}) as Record<string, unknown>

  const formattedCategories = (categoryBreakdown.results as Array<{ categoryName: string; quantity: number; revenue: number }>).map((c) => ({
    categoryName: c.categoryName,
    quantity: Number(c.quantity || 0),
    revenue: Number(c.revenue || 0),
    percentage: totalRevenue > 0 ? Math.round((Number(c.revenue || 0) / totalRevenue) * 100) : 0,
  }))

  const formattedSources = (sourcesBreakdown.results as Array<{ source: string; count: number; revenue: number }>).map((s) => ({
    source: s.source,
    count: Number(s.count || 0),
    revenue: Number(s.revenue || 0),
    percentage: totalRevenue > 0 ? Math.round((Number(s.revenue || 0) / totalRevenue) * 100) : 0,
  }))

  return Response.json({
    from: parsed.data.from,
    to: parsed.data.to,
    summary: {
      ...summaryRow,
      revenue: totalRevenue,
      discounts: Number(summaryRow.discounts ?? 0),
      cogs: Number(summaryRow.cogs ?? 0),
      grossMargin: Number(summaryRow.grossMargin ?? 0),
      orderCount: Number(summaryRow.orderCount ?? 0),
      averageOrder: Number(summaryRow.averageOrder ?? 0),
      totalPurchasingCost: Number(purchaseRow.totalCost ?? 0),
      receiptCount: Number(purchaseRow.receiptCount ?? 0),
    },
    topItems: (topItems.results as Array<Record<string, unknown>>).map((item) => ({
      name: String(item.name || ''),
      variant: String(item.variant || ''),
      quantity: Number(item.quantity || 0),
      revenue: Number(item.revenue || 0),
      categoryName: String(item.categoryName || 'Khác'),
    })),
    dailyTrend: (dailyTrend.results as Array<Record<string, unknown>>).map((d) => ({
      date: String(d.date || ''),
      orderCount: Number(d.orderCount || 0),
      revenue: Number(d.revenue || 0),
      cogs: Number(d.cogs || 0),
      grossMargin: Number(d.grossMargin || 0),
      discounts: Number(d.discounts || 0),
    })),
    categoryBreakdown: formattedCategories,
    sourcesBreakdown: formattedSources,
    cashierSummary: (cashierSummary.results as Array<Record<string, unknown>>).map((c) => ({
      cashier: String(c.cashier || 'Thu ngân'),
      orderCount: Number(c.orderCount || 0),
      revenue: Number(c.revenue || 0),
      discounts: Number(c.discounts || 0),
    })),
    purchasing: {
      totalCost: Number(purchaseRow.totalCost ?? 0),
      receiptCount: Number(purchaseRow.receiptCount ?? 0),
      byIngredient: (purchasingByIngredient.results as Array<Record<string, unknown>>).map((p) => ({
        ingredientName: String(p.ingredientName || ''),
        unit: String(p.unit || ''),
        quantity: Number(p.quantity || 0),
        totalCost: Number(p.totalCost || 0),
        avgUnitCost: Number(p.avgUnitCost || 0),
      })),
      movements: (purchasingMovements.results as Array<Record<string, unknown>>).map((m) => ({
        id: String(m.id || ''),
        ingredientName: String(m.ingredientName || ''),
        unit: String(m.unit || ''),
        quantity: Number(m.quantity || 0),
        unitCost: Number(m.unitCost || 0),
        totalCost: Number(m.totalCost || 0),
        reason: String(m.reason || ''),
        actorName: String(m.actorName || ''),
        createdAt: Number(m.createdAt || 0),
      })),
    },
    orders: orders.results,
    inventory: inventory.results,
    timeEntries: timeEntries.results,
    hourly: hourly.results.map((row) => ({
      hour: String((row as { hour?: unknown }).hour ?? '00'),
      orderCount: Number((row as { orderCount?: unknown }).orderCount ?? 0),
      revenue: Number((row as { revenue?: unknown }).revenue ?? 0),
    })),
  })
}
