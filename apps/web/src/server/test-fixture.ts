/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import type { D1Migration } from '@cloudflare/vitest-pool-workers'
import { hashPassword } from './auth'

declare const __D1_MIGRATIONS__: D1Migration[]

export async function applyMigrations() {
  await applyD1Migrations(env.DB, __D1_MIGRATIONS__)
}

export type SeededUser = { id: string; email: string; displayName: string; password: string }

export async function seedUser(db: D1Database, email: string, displayName: string, password: string, permissionCodes: string[] = []): Promise<SeededUser> {
  const id = crypto.randomUUID()
  const now = Date.now()
  await db.batch([
    db.prepare('INSERT INTO users (id, email, display_name, password_hash, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)').bind(id, email, displayName, await hashPassword(password), now, now),
    ...permissionCodes.map((code) => db.prepare('INSERT INTO permissions (id, code, label) VALUES (?, ?, ?) ON CONFLICT(code) DO NOTHING').bind(`perm-${code}`, code, code)),
  ])
  for (const code of permissionCodes) {
    const permission = await db.prepare('SELECT id FROM permissions WHERE code = ?').bind(code).first<{ id: string }>()
    await db.prepare('INSERT INTO user_permissions (user_id, permission_id, granted_at) VALUES (?, ?, ?)').bind(id, permission!.id, now).run()
  }
  return { id, email, displayName, password }
}

export async function seedTable(db: D1Database, name: string, zoneName = 'Sảnh') {
  const zone = await db.prepare('SELECT id FROM zones WHERE name = ?').bind(zoneName).first<{ id: string }>()
  const zoneId = zone?.id ?? crypto.randomUUID()
  const now = Date.now()
  if (!zone) await db.prepare('INSERT INTO zones (id, name, active, sort_order) VALUES (?, ?, 1, 0)').bind(zoneId, zoneName).run()
  const id = crypto.randomUUID()
  await db.prepare('INSERT INTO "tables" (id, zone_id, name, pos_x, pos_y, shape, status, active, sort_order, status_override, note, created_at, updated_at) VALUES (?, ?, ?, 0, 0, \'round\', \'trong\', 1, 0, NULL, \'\', ?, ?)').bind(id, zoneId, name, now, now).run()
  return { id, name }
}

export async function seedCategory(db: D1Database, name: string) {
  const id = crypto.randomUUID()
  await db.prepare('INSERT INTO categories (id, name, sort_order, active, updated_at) VALUES (?, ?, 0, 1, ?)').bind(id, name, Date.now()).run()
  return id
}

export type SeededVariant = { id: string; price: number }

export async function seedProduct(db: D1Database, categoryId: string, name: string, variants: Array<{ name: string; price: number }>, kind: 'standard' | 'combo' = 'standard') {
  const itemId = crypto.randomUUID()
  const now = Date.now()
  await db.prepare('INSERT INTO menu_items (id, category_id, name, description, image_key, active, kind, sort_order, created_at, updated_at) VALUES (?, ?, ?, \'\', NULL, 1, ?, 0, ?, ?)').bind(itemId, categoryId, name, kind, now, now).run()
  const seeded: SeededVariant[] = []
  for (const [index, variant] of variants.entries()) {
    const variantId = crypto.randomUUID()
    await db.prepare('INSERT INTO menu_variants (id, menu_item_id, name, price, active, sort_order, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)').bind(variantId, itemId, variant.name, variant.price, index, now).run()
    seeded.push({ id: variantId, price: variant.price })
  }
  return { id: itemId, variants: seeded }
}

export async function seedModifierGroup(db: D1Database, name: string, minSelections: number, maxSelections: number, modifiers: Array<{ name: string; priceDelta: number }>, variantIds: string[]) {
  const groupId = crypto.randomUUID()
  const now = Date.now()
  await db.prepare('INSERT INTO modifier_groups (id, name, min_selections, max_selections, active, sort_order, updated_at) VALUES (?, ?, ?, ?, 1, 0, ?)').bind(groupId, name, minSelections, maxSelections, now).run()
  const modifierIds: string[] = []
  for (const [index, modifier] of modifiers.entries()) {
    const modifierId = crypto.randomUUID()
    await db.prepare('INSERT INTO modifiers (id, group_id, name, price_delta, active, sort_order, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)').bind(modifierId, groupId, modifier.name, modifier.priceDelta, index, now).run()
    modifierIds.push(modifierId)
  }
  for (const variantId of variantIds) await db.prepare('INSERT INTO variant_modifier_groups (variant_id, group_id) VALUES (?, ?)').bind(variantId, groupId).run()
  return { id: groupId, modifierIds }
}

export async function seedCombo(db: D1Database, comboItemId: string, price: number, components: Array<{ variantId: string; quantity: number }>) {
  const comboId = crypto.randomUUID()
  await db.prepare('INSERT INTO combos (id, menu_item_id, price, active) VALUES (?, ?, ?, 1)').bind(comboId, comboItemId, price).run()
  for (const component of components) await db.prepare('INSERT INTO combo_components (id, combo_id, variant_id, quantity) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), comboId, component.variantId, component.quantity).run()
  return comboId
}

export async function tableStatus(db: D1Database, tableId: string) {
  const row = await db.prepare(`SELECT CASE WHEN EXISTS (SELECT 1 FROM orders o JOIN order_lines l ON l.order_id = o.id WHERE o.table_id = t.id AND o.status = 'draft' AND l.line_status = 'active') THEN 'dang_phuc_vu' ELSE 'trong' END AS status FROM "tables" t WHERE t.id = ?`).bind(tableId).first<{ status: string }>()
  return row?.status
}