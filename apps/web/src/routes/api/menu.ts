import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { getCurrentUser, requirePermission } from '../../server/auth'
import { deleteModifierGroup, deleteProduct, saveCategory, saveCombo, saveModifierGroup, saveProduct, stopProduct } from '../../server/catalog-service'

const variantInput = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(40), price: z.number().int().nonnegative(), active: z.boolean().default(true), sortOrder: z.number().int().min(0).max(999).default(0), modifierGroupIds: z.array(z.string().uuid()).max(20).default([]) })
const categoryInput = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(60), active: z.boolean().default(true), sortOrder: z.number().int().min(0).max(999).default(0) })
const productInput = z.object({ id: z.string().uuid().optional(), categoryId: z.string().uuid(), name: z.string().trim().min(1).max(100), description: z.string().trim().max(500).default(''), imageKey: z.string().startsWith('menu/').nullable().optional(), active: z.boolean().default(true), kind: z.enum(['standard', 'combo']).default('standard'), sortOrder: z.number().int().min(0).max(999).default(0), variants: z.array(variantInput).min(1).max(20) })
const modifierInput = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(60), priceDelta: z.number().int().min(-1_000_000).max(1_000_000), active: z.boolean().default(true), sortOrder: z.number().int().min(0).max(999).default(0) })
const modifierGroupInput = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(60), minSelections: z.number().int().min(0).max(20), maxSelections: z.number().int().min(1).max(20), active: z.boolean().default(true), sortOrder: z.number().int().min(0).max(999), modifiers: z.array(modifierInput).max(50) }).refine((value) => value.minSelections <= value.maxSelections, 'Số lựa chọn tối thiểu không được lớn hơn tối đa.')
const comboInput = z.object({ id: z.string().uuid().optional(), menuItemId: z.string().uuid(), price: z.number().int().nonnegative(), active: z.boolean().default(true), components: z.array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(99) })).min(1).max(30) })
const mutationInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('saveCategory'), category: categoryInput }),
  z.object({ action: z.literal('saveProduct'), product: productInput }),
  z.object({ action: z.literal('saveModifierGroup'), group: modifierGroupInput }),
  z.object({ action: z.literal('saveCombo'), combo: comboInput }),
  z.object({ action: z.literal('stopProduct'), productId: z.string().uuid() }),
  z.object({ action: z.literal('deleteProduct'), productId: z.string().uuid() }),
  z.object({ action: z.literal('deleteModifierGroup'), groupId: z.string().uuid() }),
])

type CategoryRow = { id: string; name: string; sortOrder: number; active: number; updatedAt: number }
type ProductRow = { id: string; categoryId: string; name: string; description: string; imageKey: string | null; active: number; kind: 'standard' | 'combo'; sortOrder: number; createdAt: number; updatedAt: number; variantId: string | null; variantName: string | null; price: number | null; variantActive: number | null; variantSortOrder: number | null; variantUpdatedAt: number | null }

export const Route = createFileRoute('/api/menu')({ server: { handlers: { GET: getCatalog, POST: mutateCatalog } } })

async function getCatalog({ request }: { request: Request }) {
  const priceHistoryVariantId = new URL(request.url).searchParams.get('priceHistoryVariantId')
  if (priceHistoryVariantId) {
    requirePermission(await getCurrentUser(request), 'menu.read')
    const rows = await env.DB.prepare(`SELECT h.id, h.variant_id AS variantId, h.product_name_snapshot AS productName, h.variant_name_snapshot AS variantName, h.old_price AS oldPrice, h.new_price AS newPrice, h.change_kind AS changeKind, h.created_at AS createdAt, u.display_name AS changedBy FROM menu_variant_price_history h LEFT JOIN users u ON u.id = h.changed_by WHERE h.variant_id = ? ORDER BY h.created_at DESC`).bind(priceHistoryVariantId).all()
    return Response.json({ history: rows.results })
  }
  const admin = new URL(request.url).searchParams.get('view') === 'admin'
  requirePermission(await getCurrentUser(request), admin ? 'menu.read' : 'pos.read')
  const [categoryQuery, productQuery, modifierQuery, comboQuery, associationQuery] = await Promise.all([
    env.DB.prepare(`SELECT id, name, sort_order AS sortOrder, active, updated_at AS updatedAt FROM categories ${admin ? '' : 'WHERE active = 1'} ORDER BY sort_order, name`).all<CategoryRow>(),
    env.DB.prepare(`SELECT menu_items.id, menu_items.category_id AS categoryId, menu_items.name, menu_items.description, menu_items.image_key AS imageKey, menu_items.active, menu_items.kind, menu_items.sort_order AS sortOrder, menu_items.created_at AS createdAt, menu_items.updated_at AS updatedAt, menu_variants.id AS variantId, menu_variants.name AS variantName, menu_variants.price, menu_variants.active AS variantActive, menu_variants.sort_order AS variantSortOrder, menu_variants.updated_at AS variantUpdatedAt FROM menu_items JOIN categories ON categories.id = menu_items.category_id LEFT JOIN menu_variants ON menu_variants.menu_item_id = menu_items.id ${admin ? '' : 'WHERE menu_items.active = 1 AND categories.active = 1 AND menu_variants.active = 1'} ORDER BY categories.sort_order, categories.name, menu_items.sort_order, menu_items.name, menu_variants.sort_order, menu_variants.name`).all<ProductRow>(),
    env.DB.prepare(`SELECT g.id, g.name, g.min_selections AS minSelections, g.max_selections AS maxSelections, g.active, g.sort_order AS sortOrder, g.updated_at AS updatedAt, m.id AS modifierId, m.name AS modifierName, m.price_delta AS priceDelta, m.active AS modifierActive, m.sort_order AS modifierSortOrder, m.updated_at AS modifierUpdatedAt FROM modifier_groups g LEFT JOIN modifiers m ON m.group_id = g.id ${admin ? '' : 'WHERE g.active = 1 AND (m.id IS NULL OR m.active = 1)'} ORDER BY g.sort_order, g.name, m.sort_order, m.name`).all(),
    env.DB.prepare(`SELECT c.id, c.menu_item_id AS menuItemId, c.price, c.active, cc.variant_id AS variantId, cc.quantity FROM combos c JOIN combo_components cc ON cc.combo_id = c.id ${admin ? '' : 'WHERE c.active = 1'} ORDER BY c.id`).all(),
    env.DB.prepare('SELECT variant_id AS variantId, group_id AS groupId FROM variant_modifier_groups').all<{ variantId: string; groupId: string }>(),
  ])
  const groupIdsByVariant = new Map<string, string[]>()
  for (const row of associationQuery.results) groupIdsByVariant.set(row.variantId, [...(groupIdsByVariant.get(row.variantId) ?? []), row.groupId])
  const products = new Map<string, { id: string; categoryId: string; name: string; description: string; imageKey: string | null; active: boolean; kind: 'standard' | 'combo'; sortOrder: number; createdAt: number; updatedAt: number; variants: { id: string; name: string; price: number; active: boolean; sortOrder: number; updatedAt: number; modifierGroupIds: string[] }[] }>()
  for (const row of productQuery.results) {
    let product = products.get(row.id)
    if (!product) {
      product = { id: row.id, categoryId: row.categoryId, name: row.name, description: row.description, imageKey: row.imageKey, active: Boolean(row.active), kind: row.kind, sortOrder: row.sortOrder, createdAt: row.createdAt, updatedAt: row.updatedAt, variants: [] }
      products.set(row.id, product)
    }
    if (row.variantId && row.variantName !== null && row.price !== null && row.variantActive !== null && row.variantSortOrder !== null && row.variantUpdatedAt !== null) product.variants.push({ id: row.variantId, name: row.variantName, price: row.price, active: Boolean(row.variantActive), sortOrder: row.variantSortOrder, updatedAt: row.variantUpdatedAt, modifierGroupIds: groupIdsByVariant.get(row.variantId) ?? [] })
  }
  const modifierMap = new Map<string, { id: string; name: string; minSelections: number; maxSelections: number; active: boolean; sortOrder: number; updatedAt: number; modifiers: { id: string; name: string; priceDelta: number; active: boolean; sortOrder: number; updatedAt: number }[] }>()
  for (const row of modifierQuery.results as Array<{ id: string; name: string; minSelections: number; maxSelections: number; active: number; sortOrder: number; updatedAt: number; modifierId: string | null; modifierName: string | null; priceDelta: number | null; modifierActive: number | null; modifierSortOrder: number | null; modifierUpdatedAt: number | null }>) {
    const group = modifierMap.get(row.id) ?? { id: row.id, name: row.name, minSelections: row.minSelections, maxSelections: row.maxSelections, active: Boolean(row.active), sortOrder: row.sortOrder, updatedAt: row.updatedAt, modifiers: [] }
    if (row.modifierId && row.modifierName !== null && row.priceDelta !== null && row.modifierActive !== null && row.modifierSortOrder !== null && row.modifierUpdatedAt !== null) group.modifiers.push({ id: row.modifierId, name: row.modifierName, priceDelta: row.priceDelta, active: Boolean(row.modifierActive), sortOrder: row.modifierSortOrder, updatedAt: row.modifierUpdatedAt })
    modifierMap.set(row.id, group)
  }
  const combos = new Map<string, { id: string; menuItemId: string; price: number; active: boolean; components: { variantId: string; quantity: number }[] }>()
  for (const row of comboQuery.results as Array<{ id: string; menuItemId: string; price: number; active: number; variantId: string; quantity: number }>) {
    const combo = combos.get(row.id) ?? { id: row.id, menuItemId: row.menuItemId, price: row.price, active: Boolean(row.active), components: [] }
    combo.components.push({ variantId: row.variantId, quantity: row.quantity }); combos.set(row.id, combo)
  }
  if (!admin) {
    const comboByProduct = new Map<string, { price: number; active: boolean }>()
    for (const combo of combos.values()) comboByProduct.set(combo.menuItemId, { price: combo.price, active: combo.active })
    for (const product of products.values()) {
      if (product.kind !== 'combo') continue
      const combo = comboByProduct.get(product.id)
      product.active = Boolean(combo?.active)
      if (combo?.active) product.variants = product.variants.map((variant) => ({ ...variant, price: combo.price }))
    }
  }
  return Response.json({ categories: categoryQuery.results.map((category) => ({ ...category, active: Boolean(category.active) })), products: [...products.values()], modifierGroups: [...modifierMap.values()], combos: [...combos.values()] })
}

async function mutateCatalog({ request }: { request: Request }) {
  const actor = requirePermission(await getCurrentUser(request), 'menu.manage')
  const input = mutationInput.safeParse(await request.json().catch(() => null))
  if (!input.success) return Response.json({ message: 'Dữ liệu catalog không hợp lệ.' }, { status: 400 })
  try {
    if (input.data.action === 'stopProduct') return Response.json(await stopProduct(env.DB, actor, input.data.productId))
    if (input.data.action === 'deleteProduct') return Response.json(await deleteProduct(env.DB, actor, input.data.productId))
    if (input.data.action === 'deleteModifierGroup') return Response.json(await deleteModifierGroup(env.DB, actor, input.data.groupId))
    if (input.data.action === 'saveCategory') return Response.json(await saveCategory(env.DB, actor, input.data.category))
    if (input.data.action === 'saveModifierGroup') return Response.json(await saveModifierGroup(env.DB, actor, input.data.group))
    if (input.data.action === 'saveCombo') return Response.json(await saveCombo(env.DB, actor, input.data.combo))
    return Response.json(await saveProduct(env.DB, actor, input.data.product))
  } catch (error) {
    if (error instanceof Response) return error
    const message = error instanceof Error && error.message.includes('UNIQUE') ? 'Tên danh mục hoặc variant đã tồn tại.' : 'Không thể lưu catalog.'
    return Response.json({ message }, { status: 409 })
  }
}