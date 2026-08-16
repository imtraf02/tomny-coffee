import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:workers'
import { applyMigrations, seedCategory, seedCombo, seedProduct, seedUser } from './test-fixture'
import { deleteModifierGroup, deleteProduct, saveCategory, saveCombo, saveModifierGroup, saveProduct, stopProduct } from './catalog-service'
import { createDraft, payDraftCash } from './order-service'

async function expectError(promise: Promise<unknown>, status: number, message?: string) {
  try {
    await promise
    expect.unreachable('expected to throw')
  } catch (error) {
    expect(error).toBeInstanceOf(Response)
    if (error instanceof Response) {
      expect(error.status).toBe(status)
      if (message) expect(await error.text()).toContain(message)
    }
  }
}

let actor: { id: string }
let categoryId: string
let drinkId: string
let drinkVariantId: string
let comboItemId: string
let componentId: string

beforeAll(async () => {
  await applyMigrations()
})

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM order_line_modifiers'),
    env.DB.prepare('DELETE FROM order_lines'),
    env.DB.prepare('DELETE FROM payments'),
    env.DB.prepare('DELETE FROM order_discounts'),
    env.DB.prepare('DELETE FROM order_refunds'),
    env.DB.prepare('DELETE FROM offline_sync_records'),
    env.DB.prepare('DELETE FROM audit_logs'),
    env.DB.prepare('DELETE FROM daily_order_counters'),
    env.DB.prepare('DELETE FROM menu_variant_price_history'),
    env.DB.prepare('DELETE FROM combo_components'),
    env.DB.prepare('DELETE FROM combos'),
    env.DB.prepare('DELETE FROM variant_modifier_groups'),
    env.DB.prepare('DELETE FROM modifiers'),
    env.DB.prepare('DELETE FROM modifier_groups'),
    env.DB.prepare('DELETE FROM menu_variants'),
    env.DB.prepare('DELETE FROM menu_items'),
    env.DB.prepare('DELETE FROM categories'),
    env.DB.prepare('DELETE FROM orders'),
    env.DB.prepare('DELETE FROM "tables"'),
    env.DB.prepare('DELETE FROM zones'),
    env.DB.prepare('DELETE FROM sessions'),
    env.DB.prepare('DELETE FROM user_permissions'),
    env.DB.prepare('DELETE FROM permissions'),
    env.DB.prepare('DELETE FROM users'),
  ])
  actor = await seedUser(env.DB, 'manager@test.dev', 'Quản lý', 'manager-pass', ['menu.manage'])
  categoryId = await seedCategory(env.DB, 'Đồ uống')
  const drink = await seedProduct(env.DB, categoryId, 'Cà phê sữa', [{ name: 'Ly', price: 30_000 }, { name: 'Bình', price: 60_000 }])
  drinkId = drink.id
  drinkVariantId = drink.variants[0].id
  const combo = await seedProduct(env.DB, categoryId, 'Combo sáng', [{ name: 'Bộ', price: 10_000 }], 'combo')
  comboItemId = combo.id
  const milk = await seedProduct(env.DB, categoryId, 'Sữa tươi', [{ name: 'Chai', price: 15_000 }])
  componentId = milk.variants[0].id
  await seedCombo(env.DB, comboItemId, 45_000, [{ variantId: drinkVariantId, quantity: 1 }, { variantId: componentId, quantity: 1 }])
})

describe('catalog-service integration', () => {
  it('applies all migrations cleanly', async () => {
    await applyMigrations()
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM d1_migrations').first<{ n: number }>()
    expect(Number(row?.n)).toBeGreaterThan(10)
  })

  it('records price history on create and on change', async () => {
    const created = await saveProduct(env.DB, actor, { categoryId, name: 'Matcha', description: '', active: true, kind: 'standard', sortOrder: 0, variants: [{ name: 'Ly', price: 40_000, active: true, sortOrder: 0, modifierGroupIds: [] }] })
    const createdHistory = await env.DB.prepare('SELECT change_kind AS changeKind, old_price AS oldPrice, new_price AS newPrice FROM menu_variant_price_history WHERE menu_item_id = ?').bind(created.id).all<{ changeKind: string; oldPrice: number | null; newPrice: number }>()
    expect(createdHistory.results[0]).toMatchObject({ changeKind: 'created', oldPrice: null, newPrice: 40_000 })
    const variant = await env.DB.prepare('SELECT id FROM menu_variants WHERE menu_item_id = ?').bind(created.id).first<{ id: string }>()
    await saveProduct(env.DB, actor, { id: created.id, categoryId, name: 'Matcha', description: '', active: true, kind: 'standard', sortOrder: 0, variants: [{ id: variant!.id, name: 'Ly', price: 45_000, active: true, sortOrder: 0, modifierGroupIds: [] }] })
    const changed = await env.DB.prepare('SELECT change_kind AS changeKind, old_price AS oldPrice, new_price AS newPrice FROM menu_variant_price_history WHERE menu_item_id = ? ORDER BY created_at').bind(created.id).all<{ changeKind: string; oldPrice: number | null; newPrice: number }>()
    expect(changed.results).toHaveLength(2)
    expect(changed.results[1]).toMatchObject({ changeKind: 'changed', oldPrice: 40_000, newPrice: 45_000 })
  })

  it('requires an active variant when the product is active', async () => {
    await expectError(saveProduct(env.DB, actor, { categoryId, name: 'Rỗng', description: '', active: true, kind: 'standard', sortOrder: 0, variants: [{ name: 'Ly', price: 10_000, active: false, sortOrder: 0, modifierGroupIds: [] }] }), 400)
  })

  it('deactivates variants that are removed from a product', async () => {
    await saveProduct(env.DB, actor, { id: drinkId, categoryId, name: 'Cà phê sữa', description: '', active: true, kind: 'standard', sortOrder: 0, variants: [{ id: drinkVariantId, name: 'Ly', price: 30_000, active: true, sortOrder: 0, modifierGroupIds: [] }] })
    const variant = await env.DB.prepare('SELECT active FROM menu_variants WHERE id = ?').bind(drinkVariantId).first<{ active: number }>()
    expect(variant?.active).toBe(1)
    const removed = await env.DB.prepare('SELECT id FROM menu_variants WHERE menu_item_id = ? AND active = 0').bind(drinkId).all<{ id: string }>()
    expect(removed.results).toHaveLength(1)
  })

  it('stops a product and cascades to dependent combos', async () => {
    await stopProduct(env.DB, actor, drinkId)
    const item = await env.DB.prepare('SELECT active FROM menu_items WHERE id = ?').bind(drinkId).first<{ active: number }>()
    const variant = await env.DB.prepare('SELECT active FROM menu_variants WHERE id = ?').bind(drinkVariantId).first<{ active: number }>()
    const combo = await env.DB.prepare('SELECT active FROM combos WHERE menu_item_id = ?').bind(comboItemId).first<{ active: number }>()
    const comboItem = await env.DB.prepare('SELECT active FROM menu_items WHERE id = ?').bind(comboItemId).first<{ active: number }>()
    expect([item?.active, variant?.active, combo?.active, comboItem?.active]).toEqual([0, 0, 0, 0])
  })

  it('blocks deletion of a product that appeared in an order', async () => {
    const draft = await createDraft(env.DB, actor, { source: 'counter', note: '', lines: [{ variantId: drinkVariantId, quantity: 1, modifierIds: [] }], idempotencyKey: 'del-used-1' })
    await payDraftCash(env.DB, actor, { orderId: draft.id, expectedVersion: draft.version, idempotencyKey: 'del-pay-1', deviceId: 'dev-1', receivedAmount: 30_000 })
    await expectError(deleteProduct(env.DB, actor, drinkId), 409, 'Ngừng bán')
  })

  it('blocks deletion of a product used as a combo component', async () => {
    const drink = await env.DB.prepare('SELECT id FROM menu_items WHERE id = ?').bind(drinkId).first<{ id: string }>()
    await expectError(deleteProduct(env.DB, actor, drink!.id), 409, 'combo')
  })

  it('deletes an unused product together with its combo', async () => {
    await deleteProduct(env.DB, actor, comboItemId)
    const item = await env.DB.prepare('SELECT id FROM menu_items WHERE id = ?').bind(comboItemId).first()
    const combo = await env.DB.prepare('SELECT id FROM combos WHERE menu_item_id = ?').bind(comboItemId).first()
    expect(item).toBeNull()
    expect(combo).toBeNull()
  })

  it('deletes an unused modifier group and its attachments', async () => {
    const group = await saveModifierGroup(env.DB, actor, { name: 'Thêm nước', minSelections: 0, maxSelections: 1, active: true, sortOrder: 9, modifiers: [{ name: 'Ít nước', priceDelta: 0, active: true, sortOrder: 0 }] })
    await saveProduct(env.DB, actor, { id: drinkId, categoryId, name: 'Cà phê sữa', description: '', active: true, kind: 'standard', sortOrder: 0, variants: [{ id: drinkVariantId, name: 'Ly', price: 30_000, active: true, sortOrder: 0, modifierGroupIds: [group.id] }] })
    await deleteModifierGroup(env.DB, actor, group.id)
    const stored = await env.DB.prepare('SELECT id FROM modifier_groups WHERE id = ?').bind(group.id).first()
    const modifiers = await env.DB.prepare('SELECT id FROM modifiers WHERE group_id = ?').bind(group.id).all()
    const attached = await env.DB.prepare('SELECT 1 AS attached FROM variant_modifier_groups WHERE group_id = ?').bind(group.id).first()
    expect(stored).toBeNull()
    expect(modifiers.results).toHaveLength(0)
    expect(attached).toBeNull()
  })

  it('blocks deleting a modifier group that was chosen in an order', async () => {
    const group = await saveModifierGroup(env.DB, actor, { name: 'Đá riêng', minSelections: 0, maxSelections: 1, active: true, sortOrder: 9, modifiers: [{ name: 'Thêm đá', priceDelta: 2_000, active: true, sortOrder: 0 }] })
    await env.DB.prepare('INSERT INTO variant_modifier_groups (variant_id, group_id) VALUES (?, ?)').bind(drinkVariantId, group.id).run()
    const modifier = await env.DB.prepare('SELECT id FROM modifiers WHERE group_id = ?').bind(group.id).first<{ id: string }>()
    const draft = await createDraft(env.DB, actor, { source: 'counter', note: '', lines: [{ variantId: drinkVariantId, quantity: 1, modifierIds: [modifier!.id] }], idempotencyKey: 'mod-used-1' })
    await payDraftCash(env.DB, actor, { orderId: draft.id, expectedVersion: draft.version, idempotencyKey: 'mod-used-pay-1', deviceId: 'dev-1', receivedAmount: 32_000 })
    await expectError(deleteModifierGroup(env.DB, actor, group.id), 409, 'ticket')
  })

  it('rejects a combo containing itself or duplicate variants', async () => {
    await expectError(saveCombo(env.DB, actor, { menuItemId: comboItemId, price: 45_000, active: true, components: [{ variantId: drinkVariantId, quantity: 1 }, { variantId: drinkVariantId, quantity: 1 }] }), 400)
    const selfVariant = await env.DB.prepare('SELECT id FROM menu_variants WHERE menu_item_id = ?').bind(comboItemId).first<{ id: string }>()
    await expectError(saveCombo(env.DB, actor, { menuItemId: comboItemId, price: 45_000, active: true, components: [{ variantId: selfVariant!.id, quantity: 1 }] }), 400)
  })

  it('rejects combo components that are not selling', async () => {
    await stopProduct(env.DB, actor, drinkId)
    await expectError(saveCombo(env.DB, actor, { menuItemId: comboItemId, price: 45_000, active: true, components: [{ variantId: drinkVariantId, quantity: 1 }, { variantId: componentId, quantity: 1 }] }), 400)
  })

  it('marks the combo item kind and keeps order snapshots stable', async () => {
    const kind = await env.DB.prepare('SELECT kind FROM menu_items WHERE id = ?').bind(comboItemId).first<{ kind: string }>()
    expect(kind?.kind).toBe('combo')
    const comboVariant = (await env.DB.prepare('SELECT id FROM menu_variants WHERE menu_item_id = ?').bind(comboItemId).first<{ id: string }>())!
    const draft = await createDraft(env.DB, actor, { source: 'counter', note: '', lines: [{ variantId: comboVariant.id, quantity: 1, modifierIds: [] }], idempotencyKey: 'combo-snap-1' })
    const line = await env.DB.prepare('SELECT unit_price AS unitPrice, combo_snapshot AS comboSnapshot FROM order_lines WHERE order_id = ?').bind(draft.id).first<{ unitPrice: number; comboSnapshot: string }>()
    expect(line?.unitPrice).toBe(45_000)
    const snapshot = JSON.parse(line?.comboSnapshot ?? '[]') as Array<{ name: string; quantity: number }>
    expect(snapshot).toHaveLength(2)
    expect(snapshot.map((component) => component.name)).toContain('Cà phê sữa')
  })

  it('deactivates modifiers removed from a group', async () => {
    const group = await saveModifierGroup(env.DB, actor, { name: 'Topping', minSelections: 0, maxSelections: 2, active: true, sortOrder: 0, modifiers: [{ name: 'Trân châu', priceDelta: 5_000, active: true, sortOrder: 0 }, { name: 'Thạch', priceDelta: 5_000, active: true, sortOrder: 0 }] })
    const ids = (await env.DB.prepare('SELECT id FROM modifiers WHERE group_id = ?').bind(group.id).all<{ id: string }>()).results
    await saveModifierGroup(env.DB, actor, { id: group.id, name: 'Topping', minSelections: 0, maxSelections: 2, active: true, sortOrder: 0, modifiers: [{ id: ids[0].id, name: 'Trân châu', priceDelta: 6_000, active: true, sortOrder: 0 }] })
    const states = await env.DB.prepare('SELECT active FROM modifiers WHERE group_id = ? ORDER BY rowid').bind(group.id).all<{ active: number }>()
    expect(states.results.map((row) => row.active)).toEqual([1, 0])
  })

  it('saves and updates categories', async () => {
    const created = await saveCategory(env.DB, actor, { name: 'Bánh', active: true, sortOrder: 1 })
    await saveCategory(env.DB, actor, { id: created.id, name: 'Bánh ngọt', active: true, sortOrder: 1 })
    const category = await env.DB.prepare('SELECT name FROM categories WHERE id = ?').bind(created.id).first<{ name: string }>()
    expect(category?.name).toBe('Bánh ngọt')
  })
})