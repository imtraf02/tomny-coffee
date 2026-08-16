import { writeAudit } from './audit'

export type CatalogActor = { id: string }

export type VariantInput = { id?: string; name: string; price: number; active: boolean; sortOrder: number; modifierGroupIds: string[] }
export type ProductInput = { id?: string; categoryId: string; name: string; description: string; imageKey?: string | null; active: boolean; kind: 'standard' | 'combo'; sortOrder: number; variants: VariantInput[] }
export type CategoryInput = { id?: string; name: string; active: boolean; sortOrder: number }
export type ModifierInput = { id?: string; name: string; priceDelta: number; active: boolean; sortOrder: number }
export type ModifierGroupInput = { id?: string; name: string; minSelections: number; maxSelections: number; active: boolean; sortOrder: number; modifiers: ModifierInput[] }
export type ComboInput = { id?: string; menuItemId: string; price: number; active: boolean; components: Array<{ variantId: string; quantity: number }> }

export async function stopProduct(db: D1Database, actor: CatalogActor, productId: string) {
  const product = await db.prepare('SELECT id, name FROM menu_items WHERE id = ?').bind(productId).first<{ id: string; name: string }>()
  if (!product) throw new Response('Sản phẩm không tồn tại.', { status: 404 })
  const statements: D1PreparedStatement[] = [
    db.prepare('UPDATE menu_items SET active = 0, updated_at = ? WHERE id = ?').bind(Date.now(), product.id),
    db.prepare('UPDATE menu_variants SET active = 0, updated_at = ? WHERE menu_item_id = ?').bind(Date.now(), product.id),
    db.prepare(`UPDATE combos SET active = 0 WHERE id IN (SELECT DISTINCT cc.combo_id FROM combo_components cc JOIN menu_variants v ON v.id = cc.variant_id WHERE v.menu_item_id = ?)`).bind(product.id),
    db.prepare(`UPDATE menu_items SET active = 0, updated_at = ? WHERE id IN (SELECT c.menu_item_id FROM combos c JOIN combo_components cc ON cc.combo_id = c.id JOIN menu_variants v ON v.id = cc.variant_id WHERE v.menu_item_id = ?)`).bind(Date.now(), product.id),
  ]
  await db.batch(statements)
  await writeAudit(db, actor.id, 'menu_item', product.id, 'stopped_selling', { name: product.name, stoppedDependentCombos: true })
  return { id: product.id, stopped: true }
}

export async function deleteProduct(db: D1Database, actor: CatalogActor, productId: string) {
  const product = await db.prepare('SELECT id, name FROM menu_items WHERE id = ?').bind(productId).first<{ id: string; name: string }>()
  if (!product) throw new Response('Sản phẩm không tồn tại.', { status: 404 })
  const used = await db.prepare('SELECT id FROM order_lines WHERE menu_item_id = ? LIMIT 1').bind(product.id).first()
  if (used) throw new Response('Sản phẩm đã từng xuất hiện trong ticket nên chỉ có thể Ngừng bán.', { status: 409 })
  const dependentCombo = await db.prepare('SELECT cc.combo_id AS id FROM combo_components cc JOIN menu_variants v ON v.id = cc.variant_id WHERE v.menu_item_id = ? LIMIT 1').bind(product.id).first()
  if (dependentCombo) throw new Response('Sản phẩm đang được dùng trong combo. Hãy sửa hoặc ngừng bán combo trước.', { status: 409 })
  const ownCombo = await db.prepare('SELECT id FROM combos WHERE menu_item_id = ?').bind(product.id).first<{ id: string }>()
  const statements: D1PreparedStatement[] = []
  if (ownCombo) statements.push(db.prepare('DELETE FROM combo_components WHERE combo_id = ?').bind(ownCombo.id), db.prepare('DELETE FROM combos WHERE id = ?').bind(ownCombo.id))
  statements.push(db.prepare('DELETE FROM variant_modifier_groups WHERE variant_id IN (SELECT id FROM menu_variants WHERE menu_item_id = ?)').bind(product.id), db.prepare('DELETE FROM menu_variant_price_history WHERE menu_item_id = ?').bind(product.id), db.prepare('DELETE FROM menu_variants WHERE menu_item_id = ?').bind(product.id), db.prepare('DELETE FROM menu_items WHERE id = ?').bind(product.id))
  await db.batch(statements)
  await writeAudit(db, actor.id, 'menu_item', product.id, 'deleted', { name: product.name })
  return { id: product.id, deleted: true }
}

export async function deleteModifierGroup(db: D1Database, actor: CatalogActor, groupId: string) {
  const group = await db.prepare('SELECT id, name FROM modifier_groups WHERE id = ?').bind(groupId).first<{ id: string; name: string }>()
  if (!group) throw new Response('Nhóm topping không tồn tại.', { status: 404 })
  const used = await db.prepare('SELECT 1 AS used FROM order_line_modifiers WHERE modifier_id IN (SELECT id FROM modifiers WHERE group_id = ?) LIMIT 1').bind(group.id).first()
  if (used) throw new Response('Nhóm topping đã từng được chọn trong ticket nên chỉ có thể ẩn bớt tùy chọn trong phần sửa.', { status: 409 })
  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM variant_modifier_groups WHERE group_id = ?').bind(group.id),
    db.prepare('DELETE FROM modifiers WHERE group_id = ?').bind(group.id),
    db.prepare('DELETE FROM modifier_groups WHERE id = ?').bind(group.id),
  ]
  await db.batch(statements)
  await writeAudit(db, actor.id, 'modifier_group', group.id, 'deleted', { name: group.name })
  return { id: group.id, deleted: true }
}

export async function saveCategory(db: D1Database, actor: CatalogActor, category: CategoryInput) {
  const id = category.id ?? crypto.randomUUID()
  const now = Date.now()
  if (category.id) await db.prepare('UPDATE categories SET name = ?, active = ?, sort_order = ?, updated_at = ? WHERE id = ?').bind(category.name, Number(category.active), category.sortOrder, now, id).run()
  else await db.prepare('INSERT INTO categories (id, name, sort_order, active, updated_at) VALUES (?, ?, ?, ?, ?)').bind(id, category.name, category.sortOrder, Number(category.active), now).run()
  await writeAudit(db, actor.id, 'category', id, category.id ? 'updated' : 'created', category)
  return { id }
}

export async function saveModifierGroup(db: D1Database, actor: CatalogActor, group: ModifierGroupInput) {
  const id = group.id ?? crypto.randomUUID()
  const now = Date.now()
  const statements: D1PreparedStatement[] = [group.id
    ? db.prepare('UPDATE modifier_groups SET name = ?, min_selections = ?, max_selections = ?, active = ?, sort_order = ?, updated_at = ? WHERE id = ?').bind(group.name, group.minSelections, group.maxSelections, Number(group.active), group.sortOrder, now, id)
    : db.prepare('INSERT INTO modifier_groups (id, name, min_selections, max_selections, active, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, group.name, group.minSelections, group.maxSelections, Number(group.active), group.sortOrder, now)]
  const existing = await db.prepare('SELECT id FROM modifiers WHERE group_id = ?').bind(id).all<{ id: string }>()
  const sentIds = new Set(group.modifiers.flatMap((modifier) => modifier.id ? [modifier.id] : []))
  for (const modifier of existing.results) if (!sentIds.has(modifier.id)) statements.push(db.prepare('UPDATE modifiers SET active = 0, updated_at = ? WHERE id = ? AND group_id = ?').bind(now, modifier.id, id))
  for (const modifier of group.modifiers) {
    if (modifier.id) statements.push(db.prepare('UPDATE modifiers SET name = ?, price_delta = ?, active = ?, sort_order = ?, updated_at = ? WHERE id = ? AND group_id = ?').bind(modifier.name, modifier.priceDelta, Number(modifier.active), modifier.sortOrder, now, modifier.id, id))
    else statements.push(db.prepare('INSERT INTO modifiers (id, group_id, name, price_delta, active, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), id, modifier.name, modifier.priceDelta, Number(modifier.active), modifier.sortOrder, now))
  }
  await db.batch(statements)
  await writeAudit(db, actor.id, 'modifier_group', id, group.id ? 'updated' : 'created', group)
  return { id }
}

export async function saveCombo(db: D1Database, actor: CatalogActor, combo: ComboInput) {
  const menuItem = await db.prepare('SELECT id FROM menu_items WHERE id = ?').bind(combo.menuItemId).first()
  if (!menuItem) throw new Response('Món combo không tồn tại.', { status: 404 })
  if (new Set(combo.components.map((component) => component.variantId)).size !== combo.components.length) throw new Response('Mỗi variant chỉ được thêm một lần trong combo.', { status: 400 })
  const componentRows = await db.prepare(`SELECT id, menu_item_id AS menuItemId FROM menu_variants WHERE id IN (${combo.components.map(() => '?').join(',')}) AND active = 1`).bind(...combo.components.map((component) => component.variantId)).all<{ id: string; menuItemId: string }>()
  if (componentRows.results.length !== combo.components.length) throw new Response('Có variant thành phần không còn bán.', { status: 400 })
  if (componentRows.results.some((component) => component.menuItemId === combo.menuItemId)) throw new Response('Combo không được chứa chính sản phẩm combo.', { status: 400 })
  const id = combo.id ?? crypto.randomUUID()
  const statements: D1PreparedStatement[] = [combo.id
    ? db.prepare('UPDATE combos SET menu_item_id = ?, price = ?, active = ? WHERE id = ?').bind(combo.menuItemId, combo.price, Number(combo.active), id)
    : db.prepare('INSERT INTO combos (id, menu_item_id, price, active) VALUES (?, ?, ?, ?)').bind(id, combo.menuItemId, combo.price, Number(combo.active)),
    db.prepare('UPDATE menu_items SET kind = ? WHERE id = ?').bind('combo', combo.menuItemId),
    db.prepare('DELETE FROM combo_components WHERE combo_id = ?').bind(id),
  ]
  for (const component of combo.components) statements.push(db.prepare('INSERT INTO combo_components (id, combo_id, variant_id, quantity) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), id, component.variantId, component.quantity))
  await db.batch(statements)
  await writeAudit(db, actor.id, 'combo', id, combo.id ? 'updated' : 'created', combo)
  return { id }
}

export async function saveProduct(db: D1Database, actor: CatalogActor, product: ProductInput) {
  const id = product.id ?? crypto.randomUUID()
  const now = Date.now()
  const activeVariants = product.variants.filter((variant) => variant.active)
  if (product.active && !activeVariants.length) throw new Response('Sản phẩm đang bán cần có ít nhất một variant đang bán.', { status: 400 })
  const category = await db.prepare('SELECT id FROM categories WHERE id = ?').bind(product.categoryId).first()
  if (!category) throw new Response('Danh mục sản phẩm không tồn tại.', { status: 400 })
  const statements: D1PreparedStatement[] = []
  const existingVariants = product.id ? await db.prepare('SELECT id, price FROM menu_variants WHERE menu_item_id = ?').bind(id).all<{ id: string; price: number }>() : { results: [] as Array<{ id: string; price: number }> }
  const previousPrice = new Map(existingVariants.results.map((variant) => [variant.id, variant.price]))
  if (product.id) statements.push(db.prepare('UPDATE menu_items SET category_id = ?, name = ?, description = ?, image_key = ?, active = ?, kind = ?, sort_order = ?, updated_at = ? WHERE id = ?').bind(product.categoryId, product.name, product.description, product.imageKey ?? null, Number(product.active), product.kind, product.sortOrder, now, id))
  else statements.push(db.prepare('INSERT INTO menu_items (id, category_id, name, description, image_key, active, kind, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, product.categoryId, product.name, product.description, product.imageKey ?? null, Number(product.active), product.kind, product.sortOrder, now, now))
  if (product.id) {
    const existing = await db.prepare('SELECT id FROM menu_variants WHERE menu_item_id = ?').bind(id).all<{ id: string }>()
    const existingIds = new Set(existing.results.map((variant) => variant.id))
    if (product.variants.some((variant) => variant.id && !existingIds.has(variant.id))) throw new Response('Variant không thuộc sản phẩm này.', { status: 400 })
    const sentIds = new Set(product.variants.flatMap((variant) => variant.id ? [variant.id] : []))
    for (const variant of existing.results) if (!sentIds.has(variant.id)) statements.push(db.prepare('UPDATE menu_variants SET active = 0, updated_at = ? WHERE id = ? AND menu_item_id = ?').bind(now, variant.id, id))
  }
  for (const variant of product.variants) {
    const variantId = variant.id ?? crypto.randomUUID()
    if (variant.id) statements.push(db.prepare('UPDATE menu_variants SET name = ?, price = ?, active = ?, sort_order = ?, updated_at = ? WHERE id = ? AND menu_item_id = ?').bind(variant.name, variant.price, Number(variant.active), variant.sortOrder, now, variant.id, id))
    else statements.push(db.prepare('INSERT INTO menu_variants (id, menu_item_id, name, price, active, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(variantId, id, variant.name, variant.price, Number(variant.active), variant.sortOrder, now))
    const oldPrice = variant.id ? previousPrice.get(variant.id) : undefined
    if (oldPrice === undefined || oldPrice !== variant.price) statements.push(db.prepare('INSERT INTO menu_variant_price_history (id, variant_id, menu_item_id, product_name_snapshot, variant_name_snapshot, old_price, new_price, changed_by, change_kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), variantId, id, product.name, variant.name, oldPrice ?? null, variant.price, actor.id, oldPrice === undefined ? 'created' : 'changed', now))
    statements.push(db.prepare('DELETE FROM variant_modifier_groups WHERE variant_id = ?').bind(variantId))
    for (const groupId of variant.modifierGroupIds) statements.push(db.prepare('INSERT INTO variant_modifier_groups (variant_id, group_id) VALUES (?, ?)').bind(variantId, groupId))
  }
  await db.batch(statements)
  await writeAudit(db, actor.id, 'menu_item', id, product.id ? 'updated' : 'created', product)
  return { id }
}