import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { getCurrentUser, requirePermission } from '../../server/auth'

const ingredientSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100),
  unit: z.string().trim().min(1).max(20),
  reorderPoint: z.number().finite().min(0).max(1_000_000).default(0),
  active: z.boolean().default(true),
})

const adjustmentSchema = z.object({
  ingredientId: z.string().uuid(),
  type: z.enum(['receipt', 'adjustment', 'stocktake']),
  quantityDelta: z.number().finite().refine((value) => value !== 0, 'Số lượng điều chỉnh không được bằng 0.'),
  reason: z.string().trim().min(2).max(250),
  unitCost: z.number().int().nonnegative().optional(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).superRefine((value, ctx) => {
  if (value.type === 'receipt' && (value.quantityDelta <= 0 || value.unitCost === undefined)) ctx.addIssue({ code: 'custom', path: ['unitCost'], message: 'Phiếu nhập cần số lượng dương và giá vốn.' })
})

const inputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('saveIngredient'), ingredient: ingredientSchema }),
  z.object({ action: z.literal('adjust'), adjustment: adjustmentSchema }),
])

export const Route = createFileRoute('/api/inventory')({
  server: { handlers: { GET: listInventory, POST: mutateInventory } },
})

async function listInventory({ request }: { request: Request }) {
  requirePermission(await getCurrentUser(request), 'inventory.read')
  const url = new URL(request.url)
  const ingredientId = url.searchParams.get('ingredientId')
  const monthParam = url.searchParams.get('month') // e.g. '2026-08'

  // Calculate month range (Vietnam time UTC+7)
  const now = new Date()
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const targetMonth = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthStr

  const [yStr, mStr] = targetMonth.split('-')
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10)
  const monthStart = new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00+07:00`).getTime()
  const nextMonthDate =
    m === 12
      ? new Date(`${y + 1}-01-01T00:00:00+07:00`)
      : new Date(`${y}-${String(m + 1).padStart(2, '0')}-01T00:00:00+07:00`)
  const monthEnd = nextMonthDate.getTime()

  const [ingredients, inventoryValue, monthlyPurchasing, ingredientMonthlyStats, movements] = await Promise.all([
    env.DB.prepare(`
      SELECT id, name, unit, reorder_point AS reorderPoint, current_quantity AS currentQuantity, active
      FROM ingredients
      ORDER BY active DESC, name
    `).all<{ id: string; name: string; unit: string; reorderPoint: number; currentQuantity: number; active: number }>(),

    env.DB.prepare('SELECT COALESCE(SUM(remaining_quantity * unit_cost), 0) AS value FROM inventory_lots WHERE remaining_quantity > 0').first<{ value: number }>(),

    env.DB.prepare(`
      SELECT 
        COUNT(*) AS receiptCount,
        COALESCE(SUM(quantity_delta * unit_cost), 0) AS totalCost,
        COALESCE(SUM(quantity_delta), 0) AS totalQuantity
      FROM inventory_movements
      WHERE type = 'receipt' AND created_at >= ? AND created_at < ?
    `).bind(monthStart, monthEnd).first<{ receiptCount: number; totalCost: number; totalQuantity: number }>(),

    env.DB.prepare(`
      SELECT 
        ingredient_id AS ingredientId,
        COALESCE(SUM(CASE WHEN type = 'receipt' THEN quantity_delta ELSE 0 END), 0) AS receivedQuantity,
        COALESCE(SUM(CASE WHEN type = 'receipt' THEN quantity_delta * unit_cost ELSE 0 END), 0) AS receivedCost,
        COALESCE(SUM(CASE WHEN type != 'receipt' AND quantity_delta < 0 THEN ABS(quantity_delta) ELSE 0 END), 0) AS usedQuantity
      FROM inventory_movements
      WHERE created_at >= ? AND created_at < ?
      GROUP BY ingredient_id
    `).bind(monthStart, monthEnd).all<{ ingredientId: string; receivedQuantity: number; receivedCost: number; usedQuantity: number }>(),

    env.DB.prepare(`
      SELECT m.id, m.ingredient_id AS ingredientId, i.name AS ingredientName, i.unit, m.type,
        m.quantity_delta AS quantityDelta, m.unit_cost AS unitCost, m.reason, m.created_at AS createdAt,
        u.display_name AS actorName
      FROM inventory_movements m
      JOIN ingredients i ON i.id = m.ingredient_id
      JOIN users u ON u.id = m.actor_id
      ${ingredientId ? 'WHERE m.ingredient_id = ?' : ''}
      ORDER BY m.created_at DESC
      LIMIT 300
    `).bind(...(ingredientId ? [ingredientId] : [])).all(),
  ])

  const statsMap = new Map((ingredientMonthlyStats.results ?? []).map((s) => [s.ingredientId, s]))

  return Response.json({
    month: targetMonth,
    monthlySummary: {
      totalCost: Number(monthlyPurchasing?.totalCost ?? 0),
      receiptCount: Number(monthlyPurchasing?.receiptCount ?? 0),
      totalQuantity: Number(monthlyPurchasing?.totalQuantity ?? 0),
    },
    ingredients: ingredients.results.map((item) => {
      const stat = statsMap.get(item.id)
      return {
        ...item,
        active: Boolean(item.active),
        lowStock: item.currentQuantity <= item.reorderPoint,
        monthlyReceivedQuantity: Number(stat?.receivedQuantity ?? 0),
        monthlyReceivedCost: Number(stat?.receivedCost ?? 0),
        monthlyUsedQuantity: Number(stat?.usedQuantity ?? 0),
      }
    }),
    movements: movements.results,
    inventoryValue: Number(inventoryValue?.value ?? 0),
  })
}

async function mutateInventory({ request }: { request: Request }) {
  const body = inputSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return Response.json({ message: 'Dữ liệu kho không hợp lệ.', issues: body.error.issues }, { status: 400 })
  const actor = requirePermission(await getCurrentUser(request), 'inventory.manage')
  const now = Date.now()
  try {
    if (body.data.action === 'saveIngredient') {
      const ingredient = body.data.ingredient
      const id = ingredient.id ?? crypto.randomUUID()
      const statement = ingredient.id
        ? env.DB.prepare('UPDATE ingredients SET name = ?, unit = ?, reorder_point = ?, active = ? WHERE id = ?').bind(ingredient.name, ingredient.unit, ingredient.reorderPoint, Number(ingredient.active), id)
        : env.DB.prepare('INSERT INTO ingredients (id, name, unit, reorder_point, current_quantity, active) VALUES (?, ?, ?, ?, 0, ?)').bind(id, ingredient.name, ingredient.unit, ingredient.reorderPoint, Number(ingredient.active))
      await env.DB.batch([statement, env.DB.prepare('INSERT INTO audit_logs (id, actor_id, entity_type, entity_id, action, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), actor.id, 'ingredient', id, ingredient.id ? 'updated' : 'created', JSON.stringify(ingredient), now)])
      return Response.json({ id })
    }

    const adjustment = body.data.adjustment
    const ingredient = await env.DB.prepare('SELECT id, current_quantity AS currentQuantity FROM ingredients WHERE id = ? AND active = 1').bind(adjustment.ingredientId).first<{ id: string; currentQuantity: number }>()
    if (!ingredient) return Response.json({ message: 'Nguyên liệu không tồn tại hoặc đã ngừng sử dụng.' }, { status: 404 })
    const nextQuantity = ingredient.currentQuantity + adjustment.quantityDelta
    if (nextQuantity < 0) return Response.json({ message: 'Số lượng xuất vượt tồn hiện tại. Kiểm tra kho trước khi lưu.' }, { status: 409 })
    const movementId = crypto.randomUUID()
    const lotId = adjustment.type === 'receipt' ? crypto.randomUUID() : null
    await env.DB.batch([
      env.DB.prepare('UPDATE ingredients SET current_quantity = ? WHERE id = ?').bind(nextQuantity, ingredient.id),
      ...(lotId ? [env.DB.prepare('INSERT INTO inventory_lots (id, ingredient_id, supplier_id, received_at, expires_at, original_quantity, remaining_quantity, unit_cost, note) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)').bind(lotId, ingredient.id, now, adjustment.expiresAt ? new Date(`${adjustment.expiresAt}T23:59:59+07:00`).getTime() : null, adjustment.quantityDelta, adjustment.quantityDelta, adjustment.unitCost, adjustment.reason)] : []),
      env.DB.prepare('INSERT INTO inventory_movements (id, ingredient_id, lot_id, order_id, type, quantity_delta, unit_cost, reason, actor_id, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)').bind(movementId, ingredient.id, lotId, adjustment.type, adjustment.quantityDelta, adjustment.unitCost ?? null, adjustment.reason, actor.id, now),
      env.DB.prepare('INSERT INTO audit_logs (id, actor_id, entity_type, entity_id, action, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), actor.id, 'ingredient', ingredient.id, 'adjusted', JSON.stringify({ ...adjustment, previousQuantity: ingredient.currentQuantity, nextQuantity, lotId }), now),
    ])
    return Response.json({ movementId, lotId, currentQuantity: nextQuantity })
  } catch (error) {
    const message = error instanceof Error && error.message.includes('UNIQUE') ? 'Tên nguyên liệu đã tồn tại.' : 'Không thể lưu thay đổi kho.'
    return Response.json({ message }, { status: 409 })
  }
}
