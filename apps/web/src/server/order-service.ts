import { calculateTotal, type Discount } from '../core/money'
import { verifyPassword } from './auth'

export type OrderActor = { id: string }

export type DraftSelection = { variantId: string; quantity: number; modifierIds: string[] }

export type DraftCreateInput = { source: 'table' | 'counter' | 'takeaway'; tableId?: string; tableIds?: string[]; note: string; lines: DraftSelection[]; idempotencyKey: string }
export type DraftAddLineInput = { orderId: string; expectedVersion: number; line: DraftSelection }
export type DraftVoidLineInput = { orderId: string; expectedVersion: number; lineId: string; quantity?: number; reason: string }
export type DraftNoteInput = { orderId: string; expectedVersion: number; note: string }
export type DraftMoveInput = { orderId: string; expectedVersion: number; tableId: string }
export type DraftCancelInput = { orderId: string; expectedVersion: number; reason: string }
export type DraftSplitInput = { orderId: string; expectedVersion: number; newIdempotencyKey: string; lines: Array<{ lineId: string; quantity: number }> }
export type DraftMergeInput = { sourceOrderId: string; sourceVersion: number; targetOrderId: string; targetVersion: number }
export type DraftLinkTableInput = { orderId: string; expectedVersion: number; tableId: string }
export type DraftUnlinkTableInput = { orderId: string; expectedVersion: number; tableId: string }
export type CashPayInput = { orderId: string; expectedVersion: number; idempotencyKey: string; deviceId: string; receivedAmount: number; discount?: Discount & { reason: string }; completeKds?: boolean }
export type ManagerCredentials = { username?: string; email?: string; password: string }
export type OrderCancelInput = { orderId: string; expectedVersion?: number; reason: string; manager?: ManagerCredentials }

export type SnapshotLine = { id: string; menuItemId: string; variantId: string; name: string; variant: string; unitPrice: number; quantity: number; lineTotal: number; comboSnapshot: string; modifiers: Array<{ id: string; name: string; priceDelta: number }> }
export type StoredLine = SnapshotLine & { lineStatus: string }
export type OrderLineView = { id: string; menuItemId: string; variantId: string; name: string; variant: string; quantity: number; unitPrice: number; lineTotal: number; lineStatus: string; replacedLineId: string | null; cancelReason: string | null; cancelledAt: number | null; cancelledById: string | null; cancelledByName: string | null; approvedById: string | null; approvedByName: string | null; modifiers: Array<{ name: string; priceDelta: number }> }
export type OrderDetailResult = { id: string; orderCode: string; displayNumber: number; businessDate: string; version: number; source: string; tableId: string | null; tableName: string | null; tableIds: string[]; tableNames: string[]; status: string; kdsStatus: string; subtotal: number; discountAmount: number; total: number; cogs: number; note: string; createdAt: number; updatedAt: number; paidAt: number | null; cancelledAt: number | null; cancelReason: string | null; mergedIntoOrderId: string | null; cashier: string; cancelledByName: string | null; approvedByName: string | null; lines: OrderLineView[]; discounts: Array<Record<string, unknown>>; payment: Record<string, unknown> | null; refund: Record<string, unknown> | null }

export async function verifyManagerCredentials(db: D1Database, credentials: ManagerCredentials) {
  const identifier = (credentials.username || credentials.email || '').trim().toLowerCase()
  const manager = await db.prepare('SELECT id, password_hash AS passwordHash, active FROM users WHERE (LOWER(username) = ? OR LOWER(email) = ?)').bind(identifier, identifier).first<{ id: string; passwordHash: string; active: number }>()
  if (!manager || !manager.active || !await verifyPassword(credentials.password, manager.passwordHash)) throw new Response('Thông tin đăng nhập quản lý không hợp lệ.', { status: 403 })
  const permission = await db.prepare(`SELECT 1 AS allowed FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = ? AND p.code = 'orders.cancel.paid.approve'`).bind(manager.id).first()
  if (!permission) throw new Response('Tài khoản này không có quyền duyệt hủy và hoàn tiền.', { status: 403 })
  return manager.id
}

export async function listDrafts(db: D1Database, tableId: string | null) {
  const rows = await db.prepare(`
    SELECT o.id, o.order_code AS orderCode, o.display_number AS displayNumber, o.business_date AS businessDate, o.source,
      o.table_id AS tableId, t.name AS tableName, z.name AS zoneName, o.note, o.status, o.version,
      o.subtotal, o.total, o.created_at AS createdAt, o.updated_at AS updatedAt, u.display_name AS cashier,
      (SELECT GROUP_CONCAT(t2.id, ',') FROM order_tables ot2 JOIN "tables" t2 ON t2.id = ot2.table_id WHERE ot2.order_id = o.id ORDER BY ot2.is_primary DESC, ot2.linked_at ASC) AS tableIdsStr,
      (SELECT GROUP_CONCAT(t2.name, '+') FROM order_tables ot2 JOIN "tables" t2 ON t2.id = ot2.table_id WHERE ot2.order_id = o.id ORDER BY ot2.is_primary DESC, ot2.linked_at ASC) AS tableNamesStr
    FROM orders o
    LEFT JOIN "tables" t ON t.id = o.table_id
    LEFT JOIN zones z ON z.id = t.zone_id
    JOIN users u ON u.id = o.created_by
    WHERE o.status = 'draft'
      AND EXISTS (SELECT 1 FROM order_lines l WHERE l.order_id = o.id AND l.line_status = 'active')
      ${tableId ? "AND EXISTS (SELECT 1 FROM order_tables ot WHERE ot.order_id = o.id AND ot.table_id = ?)" : ''}
    ORDER BY o.updated_at DESC
  `).bind(...(tableId ? [tableId] : [])).all()

  const draftRows = rows.results as Array<{ id: string; tableIdsStr?: string | null; tableNamesStr?: string | null; [key: string]: unknown }>
  const orderIds = draftRows.map((r) => r.id)
  const linesMap = await readLinesForOrders(db, orderIds, false)

  const orders = [] as Array<Record<string, unknown>>
  for (const row of draftRows) {
    const tableIds = row.tableIdsStr ? row.tableIdsStr.split(',') : (row.tableId ? [String(row.tableId)] : [])
    const tableNames = row.tableNamesStr ? row.tableNamesStr.split('+') : (row.tableName ? [String(row.tableName)] : [])
    orders.push({ ...row, tableIds, tableNames, lines: linesMap.get(row.id) ?? [] })
  }
  return orders
}


function businessDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const value = (kind: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === kind)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

export async function reserveOrderNumber(db: D1Database, now = new Date()): Promise<{ businessDate: string; displayNumber: number; orderCode: string }> {
  const date = businessDate(now)
  const row = await db.prepare(`INSERT INTO daily_order_counters (business_date, next_number) VALUES (?, 2) ON CONFLICT(business_date) DO UPDATE SET next_number = next_number + 1 RETURNING next_number - 1 AS displayNumber`).bind(date).first<{ displayNumber: number }>()
  if (!row) throw new Response('Không thể cấp số đơn mới.', { status: 500 })
  return { businessDate: date, displayNumber: row.displayNumber, orderCode: `${date.replaceAll('-', '')}-${String(row.displayNumber).padStart(3, '0')}` }
}

async function resolveLine(db: D1Database, input: DraftSelection): Promise<SnapshotLine> {
  const variant = await db.prepare(`SELECT v.id AS variantId, v.menu_item_id AS menuItemId, v.name AS variant, v.price AS basePrice, i.name, i.kind, i.active AS itemActive, c.active AS categoryActive, co.id AS comboId, co.price AS comboPrice, co.active AS comboActive FROM menu_variants v JOIN menu_items i ON i.id = v.menu_item_id JOIN categories c ON c.id = i.category_id LEFT JOIN combos co ON co.menu_item_id = i.id WHERE v.id = ? AND v.active = 1`).bind(input.variantId).first<{ variantId: string; menuItemId: string; variant: string; basePrice: number; name: string; kind: string; itemActive: number; categoryActive: number; comboId: string | null; comboPrice: number | null; comboActive: number | null }>()
  if (!variant || !variant.itemActive || !variant.categoryActive || (variant.kind === 'combo' && !variant.comboActive)) throw new Response('Món này không còn bán. Chọn món khác trước khi thêm vào đơn.', { status: 409 })
  const uniqueModifierIds = [...new Set(input.modifierIds)]
  if (uniqueModifierIds.length !== input.modifierIds.length) throw new Response('Một topping đang được chọn lặp lại.', { status: 400 })
  const groups = await db.prepare('SELECT g.id, g.min_selections AS minSelections, g.max_selections AS maxSelections FROM variant_modifier_groups vmg JOIN modifier_groups g ON g.id = vmg.group_id WHERE vmg.variant_id = ? AND g.active = 1').bind(variant.variantId).all<{ id: string; minSelections: number; maxSelections: number }>()
  const modifiers = uniqueModifierIds.length ? await db.prepare(`SELECT id, name, price_delta AS priceDelta, group_id AS groupId FROM modifiers WHERE active = 1 AND id IN (${uniqueModifierIds.map(() => '?').join(',')})`).bind(...uniqueModifierIds).all<{ id: string; name: string; priceDelta: number; groupId: string }>() : { results: [] as Array<{ id: string; name: string; priceDelta: number; groupId: string }> }
  if (modifiers.results.length !== uniqueModifierIds.length) throw new Response('Có topping không còn bán.', { status: 409 })
  const counts = new Map<string, number>()
  for (const modifier of modifiers.results) counts.set(modifier.groupId, (counts.get(modifier.groupId) ?? 0) + 1)
  for (const group of groups.results) {
    const count = counts.get(group.id) ?? 0
    if (count < group.minSelections || count > group.maxSelections) throw new Response('Số topping đã chọn không đúng quy định.', { status: 400 })
  }
  if (modifiers.results.some((modifier) => !groups.results.some((group) => group.id === modifier.groupId))) throw new Response('Topping không thuộc cấu hình của món.', { status: 400 })
  let comboSnapshot = '[]'
  if (variant.kind === 'combo' && variant.comboId) {
    const components = await db.prepare(`SELECT cc.variant_id AS variantId, cc.quantity, child.name AS name, cv.name AS variant FROM combo_components cc JOIN menu_variants cv ON cv.id = cc.variant_id JOIN menu_items child ON child.id = cv.menu_item_id WHERE cc.combo_id = ?`).bind(variant.comboId).all<{ variantId: string; quantity: number; name: string; variant: string }>()
    if (!components.results.length) throw new Response('Combo chưa có món thành phần.', { status: 409 })
    comboSnapshot = JSON.stringify(components.results)
  }
  const unitPrice = (variant.kind === 'combo' ? variant.comboPrice ?? variant.basePrice : variant.basePrice) + modifiers.results.reduce((sum, modifier) => sum + modifier.priceDelta, 0)
  return { id: crypto.randomUUID(), menuItemId: variant.menuItemId, variantId: variant.variantId, name: variant.name, variant: variant.variant, unitPrice, quantity: input.quantity, lineTotal: unitPrice * input.quantity, comboSnapshot, modifiers: modifiers.results.map(({ id, name, priceDelta }) => ({ id, name, priceDelta })) }
}

function insertLine(db: D1Database, orderId: string, line: SnapshotLine, replacedLineId: string | null = null) {
  const statements: D1PreparedStatement[] = [db.prepare('INSERT INTO order_lines (id, order_id, menu_item_id, variant_id, name_snapshot, variant_snapshot, recipe_snapshot, combo_snapshot, unit_price, quantity, line_total, line_status, replaced_line_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'active\', ?)').bind(line.id, orderId, line.menuItemId, line.variantId, line.name, line.variant, '[]', line.comboSnapshot, line.unitPrice, line.quantity, line.lineTotal, replacedLineId)]
  for (const modifier of line.modifiers) statements.push(db.prepare('INSERT INTO order_line_modifiers (id, order_line_id, modifier_id, name_snapshot, price_delta, quantity) VALUES (?, ?, ?, ?, ?, 1)').bind(crypto.randomUUID(), line.id, modifier.id, modifier.name, modifier.priceDelta))
  return statements
}

export async function readLinesForOrders(db: D1Database, orderIds: string[], includeVoided: boolean): Promise<Map<string, StoredLine[]>> {
  const result = new Map<string, StoredLine[]>()
  if (!orderIds.length) return result
  for (const id of orderIds) result.set(id, [])

  const placeholders = orderIds.map(() => '?').join(',')
  const rows = await db.prepare(`
    SELECT l.order_id AS orderId, l.id, l.menu_item_id AS menuItemId, l.variant_id AS variantId,
           l.name_snapshot AS name, l.variant_snapshot AS variant, l.unit_price AS unitPrice,
           l.quantity, l.line_total AS lineTotal, l.combo_snapshot AS comboSnapshot,
           l.line_status AS lineStatus, lm.id AS modifierLineId, lm.modifier_id AS modifierId,
           lm.name_snapshot AS modifierName, lm.price_delta AS priceDelta
    FROM order_lines l
    LEFT JOIN order_line_modifiers lm ON lm.order_line_id = l.id
    WHERE l.order_id IN (${placeholders}) ${includeVoided ? '' : "AND l.line_status = 'active'"}
    ORDER BY l.rowid
  `).bind(...orderIds).all()

  const rawLinesByOrder = new Map<string, Map<string, StoredLine>>()
  for (const id of orderIds) rawLinesByOrder.set(id, new Map())

  for (const row of rows.results as Array<Record<string, unknown>>) {
    const orderId = String(row.orderId)
    const lineMap = rawLinesByOrder.get(orderId)
    if (!lineMap) continue
    const lineId = String(row.id)
    const line = lineMap.get(lineId) ?? {
      id: lineId,
      menuItemId: String(row.menuItemId ?? ''),
      variantId: String(row.variantId ?? ''),
      name: String(row.name),
      variant: String(row.variant),
      unitPrice: Number(row.unitPrice),
      quantity: Number(row.quantity),
      lineTotal: Number(row.lineTotal),
      comboSnapshot: String(row.comboSnapshot ?? '[]'),
      lineStatus: String(row.lineStatus),
      modifiers: [],
    }
    if (row.modifierLineId) {
      line.modifiers.push({
        id: String(row.modifierId ?? row.modifierLineId),
        name: String(row.modifierName),
        priceDelta: Number(row.priceDelta),
      })
    }
    lineMap.set(lineId, line)
  }

  for (const [orderId, lineMap] of rawLinesByOrder.entries()) {
    const rawLines = [...lineMap.values()]
    if (includeVoided) {
      result.set(orderId, rawLines)
      continue
    }
    const consolidated = new Map<string, StoredLine>()
    for (const line of rawLines) {
      const modKey = line.modifiers.map((m) => m.id).sort().join(',')
      const key = `${line.variantId}::${modKey}`
      const existing = consolidated.get(key)
      if (existing) {
        existing.quantity += line.quantity
        existing.lineTotal += line.lineTotal
      } else {
        consolidated.set(key, { ...line })
      }
    }
    result.set(orderId, [...consolidated.values()])
  }

  return result
}

export async function readLines(db: D1Database, orderId: string, includeVoided: boolean): Promise<StoredLine[]> {
  const map = await readLinesForOrders(db, [orderId], includeVoided)
  return map.get(orderId) ?? []
}

async function refreshTotals(db: D1Database, orderId: string, expectedVersion: number, now: number) {
  const subtotal = await db.prepare("SELECT COALESCE(SUM(line_total), 0) AS subtotal FROM order_lines WHERE order_id = ? AND line_status = 'active'").bind(orderId).first<{ subtotal: number }>()
  const result = await db.prepare("UPDATE orders SET subtotal = ?, total = MAX(0, ? - discount_amount), version = version + 1, updated_at = ? WHERE id = ? AND status = 'draft' AND version = ?").bind(subtotal?.subtotal ?? 0, subtotal?.subtotal ?? 0, now, orderId, expectedVersion).run()
  if (result.meta.changes !== 1) throw new Response('Ticket vừa được cập nhật trên thiết bị khác. Tải lại trước khi tiếp tục.', { status: 409 })
  return subtotal?.subtotal ?? 0
}

async function getDraft(db: D1Database, id: string, version: number) {
  const order = await db.prepare("SELECT id, table_id AS tableId, source, version, subtotal, total FROM orders WHERE id = ? AND status = 'draft'").bind(id).first<{ id: string; tableId: string | null; source: string; version: number; subtotal: number; total: number }>()
  if (!order) throw new Response('Đơn mở không tồn tại hoặc đã đóng.', { status: 404 })
  if (order.version !== version) throw new Response('Ticket vừa được cập nhật trên thiết bị khác. Tải lại trước khi tiếp tục.', { status: 409 })
  return order
}

async function ensureTableAvailable(db: D1Database, tableId: string) {
  const table = await db.prepare('SELECT id, status_override AS statusOverride, active FROM "tables" WHERE id = ?').bind(tableId).first<{ id: string; statusOverride: string | null; active: number }>()
  if (!table || !table.active) throw new Response('Bàn không tồn tại hoặc đã ngừng sử dụng.', { status: 400 })
  if (table.statusOverride === 'dat_truoc') throw new Response('Bàn đang được đặt trước.', { status: 409 })
  const occupied = await db.prepare("SELECT 1 FROM order_tables ot JOIN orders o ON o.id = ot.order_id JOIN order_lines l ON l.order_id = o.id WHERE ot.table_id = ? AND o.status = 'draft' AND l.line_status = 'active' LIMIT 1").bind(tableId).first()
  if (occupied) throw new Response('Bàn này đã có ticket đang mở.', { status: 409 })
}

function audit(db: D1Database, actorId: string, entityId: string, action: string, detail: Record<string, unknown>, now: number) {
  return db.prepare('INSERT INTO audit_logs (id, actor_id, entity_type, entity_id, action, detail_json, created_at) VALUES (?, ?, \'order\', ?, ?, ?, ?)').bind(crypto.randomUUID(), actorId, entityId, action, JSON.stringify(detail), now)
}

async function cloneLine(db: D1Database, orderId: string, line: StoredLine, quantity: number, replacedLineId: string) {
  const cloned: SnapshotLine = { ...line, id: crypto.randomUUID(), quantity, lineTotal: line.unitPrice * quantity, modifiers: line.modifiers }
  return insertLine(db, orderId, cloned, replacedLineId)
}

export type DraftCreateResult = { id: string; orderCode: string; displayNumber: number; version: number; tableId: string | null; tableIds: string[]; subtotal: number; total: number; lines: SnapshotLine[]; duplicate?: boolean }

export async function createDraft(db: D1Database, actor: OrderActor, input: DraftCreateInput): Promise<DraftCreateResult> {
  // Normalise: accept either tableId (single) or tableIds (multiple); tableIds takes precedence
  const resolvedTableIds = input.source === 'table'
    ? (input.tableIds?.length ? input.tableIds : (input.tableId ? [input.tableId] : []))
    : []
  if (input.source === 'table' && !resolvedTableIds.length) throw new Response('Đơn tại bàn cần chọn bàn.', { status: 400 })
  if (input.source !== 'table' && resolvedTableIds.length) throw new Response('Chỉ đơn tại bàn mới gắn bàn.', { status: 400 })
  // Deduplicate
  const uniqueTableIds = [...new Set(resolvedTableIds)]
  const primaryTableId = uniqueTableIds[0] ?? null

  const duplicate = await db.prepare('SELECT id, order_code AS orderCode, display_number AS displayNumber, version FROM orders WHERE idempotency_key = ?').bind(input.idempotencyKey).first<{ id: string; orderCode: string; displayNumber: number; version: number }>()
  if (duplicate) return { ...duplicate, duplicate: true, tableId: null, tableIds: [], subtotal: 0, total: 0, lines: [] }

  // Validate all tables available (sequential to give clear per-table errors)
  for (const tableId of uniqueTableIds) await ensureTableAvailable(db, tableId)

  const number = await reserveOrderNumber(db)
  const orderId = crypto.randomUUID()

  const consolidatedInputs = new Map<string, typeof input.lines[number]>()
  for (const line of input.lines) {
    const modKey = (line.modifierIds ?? []).slice().sort().join(',')
    const key = `${line.variantId}::${modKey}`
    const existing = consolidatedInputs.get(key)
    if (existing) {
      existing.quantity += line.quantity
    } else {
      consolidatedInputs.set(key, { ...line })
    }
  }

  const lines = await Promise.all([...consolidatedInputs.values()].map((line) => resolveLine(db, line)))
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0)
  const now = Date.now()
  const statements: D1PreparedStatement[] = [db.prepare('INSERT INTO orders (id, order_code, business_date, display_number, idempotency_key, source, table_id, note, status, version, subtotal, discount_amount, total, cogs, created_by, paid_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, \'draft\', 1, ?, 0, ?, 0, ?, NULL, ?, ?)').bind(orderId, number.orderCode, number.businessDate, number.displayNumber, input.idempotencyKey, input.source, primaryTableId, input.note, subtotal, subtotal, actor.id, now, now)]
  // Insert all tables into order_tables junction
  for (let i = 0; i < uniqueTableIds.length; i++) {
    statements.push(db.prepare('INSERT INTO order_tables (order_id, table_id, is_primary, linked_at) VALUES (?, ?, ?, ?)').bind(orderId, uniqueTableIds[i], i === 0 ? 1 : 0, now))
  }
  for (const line of lines) statements.push(...insertLine(db, orderId, line))
  statements.push(audit(db, actor.id, orderId, 'draft_created', { source: input.source, tableIds: uniqueTableIds, displayNumber: number.displayNumber }, now))
  await db.batch(statements)
  return { id: orderId, orderCode: number.orderCode, displayNumber: number.displayNumber, version: 1, tableId: primaryTableId, tableIds: uniqueTableIds, subtotal, total: subtotal, lines }
}


export async function addLine(db: D1Database, actor: OrderActor, input: DraftAddLineInput) {
  const order = await getDraft(db, input.orderId, input.expectedVersion)
  const line = await resolveLine(db, input.line)
  const existingLines = await readLines(db, order.id, false)
  const sortedModIds = (mods: { id: string }[]) => mods.map((m) => m.id).sort().join(',')
  const inputModIds = (input.line.modifierIds ?? []).slice().sort().join(',')
  const match = existingLines.find((l) => l.variantId === line.variantId && sortedModIds(l.modifiers) === inputModIds && l.unitPrice === line.unitPrice && l.name === line.name)

  if (match) {
    const newQty = match.quantity + line.quantity
    const newLineTotal = match.unitPrice * newQty
    const now = Date.now()
    const statements = [
      db.prepare("UPDATE order_lines SET quantity = ?, line_total = ? WHERE id = ? AND order_id = ? AND line_status = 'active'").bind(newQty, newLineTotal, match.id, order.id),
      audit(db, actor.id, order.id, 'line_quantity_increased', { lineId: match.id, variantId: line.variantId, newQuantity: newQty }, now),
    ]
    await db.batch(statements)
    const subtotal = await refreshTotals(db, order.id, order.version, now)
    const updatedLine = { ...match, quantity: newQty, lineTotal: newLineTotal }
    return { id: order.id, version: order.version + 1, subtotal, total: subtotal, line: updatedLine, merged: true }
  }

  const statements = [...insertLine(db, order.id, line), audit(db, actor.id, order.id, 'line_added', { lineId: line.id, variantId: line.variantId, unitPrice: line.unitPrice }, Date.now())]
  await db.batch(statements)
  const subtotal = await refreshTotals(db, order.id, order.version, Date.now())
  return { id: order.id, version: order.version + 1, subtotal, total: subtotal, line, merged: false }
}

export async function voidLine(db: D1Database, actor: OrderActor, input: DraftVoidLineInput) {
  const order = await getDraft(db, input.orderId, input.expectedVersion)
  const lines = await readLines(db, order.id, false)
  const line = lines.find((candidate) => candidate.id === input.lineId)
  if (!line) throw new Response('Dòng món không còn hiệu lực trong ticket.', { status: 409 })
  const quantity = input.quantity ?? line.quantity
  if (quantity > line.quantity) throw new Response('Số lượng hủy vượt quá dòng món đang có.', { status: 400 })
  const now = Date.now()
  if (quantity >= line.quantity) {
    const statements: D1PreparedStatement[] = [
      db.prepare("UPDATE order_lines SET line_status = 'cancelled', cancel_reason = ?, cancelled_by = ?, cancelled_at = ? WHERE id = ? AND order_id = ? AND line_status = 'active'").bind(input.reason, actor.id, now, line.id, order.id),
      audit(db, actor.id, order.id, 'line_voided', { lineId: line.id, quantity, reason: input.reason }, now),
    ]
    await db.batch(statements)
  } else {
    const replacement = await cloneLine(db, order.id, line, line.quantity - quantity, line.id)
    const statements: D1PreparedStatement[] = [
      db.prepare("UPDATE order_lines SET line_status = 'cancelled', cancel_reason = ?, cancelled_by = ?, cancelled_at = ? WHERE id = ? AND order_id = ? AND line_status = 'active'").bind(input.reason, actor.id, now, line.id, order.id),
      ...replacement,
      audit(db, actor.id, order.id, 'line_voided', { lineId: line.id, quantity, remaining: line.quantity - quantity, reason: input.reason }, now),
    ]
    await db.batch(statements)
  }
  const subtotal = await refreshTotals(db, order.id, order.version, now)
  if (subtotal <= 0) {
    await db.batch([
      db.prepare("UPDATE orders SET status = 'cancelled', cancel_reason = 'Xóa hết món trong ticket', cancelled_by = ?, cancelled_at = ?, version = version + 1, updated_at = ? WHERE id = ? AND status = 'draft'").bind(actor.id, now, now, order.id),
      audit(db, actor.id, order.id, 'draft_auto_cancelled_empty', { reason: 'empty_lines' }, now),
    ])
    return { id: order.id, version: order.version + 2, subtotal: 0, total: 0, cancelled: true }
  }
  return { id: order.id, version: order.version + 1, subtotal, total: subtotal }
}

export async function updateNote(db: D1Database, actor: OrderActor, input: DraftNoteInput) {
  const order = await getDraft(db, input.orderId, input.expectedVersion)
  const result = await db.prepare("UPDATE orders SET note = ?, version = version + 1, updated_at = ? WHERE id = ? AND status = 'draft' AND version = ?").bind(input.note, Date.now(), order.id, order.version).run()
  if (result.meta.changes !== 1) throw new Response('Ticket vừa được cập nhật trên thiết bị khác.', { status: 409 })
  void actor
  return { id: order.id, version: order.version + 1 }
}

export async function moveDraft(db: D1Database, actor: OrderActor, input: DraftMoveInput) {
  const order = await getDraft(db, input.orderId, input.expectedVersion)
  if (order.tableId !== input.tableId) await ensureTableAvailable(db, input.tableId)
  const now = Date.now()
  await db.batch([
    db.prepare("UPDATE orders SET table_id = ?, source = 'table', version = version + 1, updated_at = ? WHERE id = ? AND status = 'draft' AND version = ?").bind(input.tableId, now, order.id, order.version),
    // Move primary entry in junction: delete old primary, insert new one (non-primary entries for grouped tables stay)
    db.prepare('DELETE FROM order_tables WHERE order_id = ? AND table_id = ? AND is_primary = 1').bind(order.id, order.tableId ?? input.tableId),
    db.prepare('INSERT OR IGNORE INTO order_tables (order_id, table_id, is_primary, linked_at) VALUES (?, ?, 1, ?)').bind(order.id, input.tableId, now),
    audit(db, actor.id, order.id, 'moved', { fromTableId: order.tableId, toTableId: input.tableId }, now),
  ])
  return { id: order.id, version: order.version + 1, tableId: input.tableId }
}


export async function cancelDraft(db: D1Database, actor: OrderActor, input: DraftCancelInput) {
  const order = await getDraft(db, input.orderId, input.expectedVersion)
  const now = Date.now()
  await db.batch([db.prepare("UPDATE orders SET status = 'cancelled', cancel_reason = ?, cancelled_by = ?, cancelled_at = ?, version = version + 1, updated_at = ? WHERE id = ? AND status = 'draft' AND version = ?").bind(input.reason, actor.id, now, now, order.id, order.version), db.prepare("UPDATE order_lines SET line_status = 'cancelled', cancel_reason = ?, cancelled_by = ?, cancelled_at = ? WHERE order_id = ? AND line_status = 'active'").bind(input.reason, actor.id, now, order.id), audit(db, actor.id, order.id, 'cancelled', { reason: input.reason }, now)])
  return { id: order.id, status: 'cancelled' }
}

export async function splitDraft(db: D1Database, actor: OrderActor, input: DraftSplitInput) {
  const source = await getDraft(db, input.orderId, input.expectedVersion)
  const activeLines = await readLines(db, source.id, false)
  const requested = new Map(input.lines.map((line) => [line.lineId, line.quantity]))
  if (requested.size !== input.lines.length || [...requested.entries()].some(([id, quantity]) => quantity > (activeLines.find((line) => line.id === id)?.quantity ?? 0))) throw new Response('Số lượng tách không hợp lệ.', { status: 400 })
  const duplicate = await db.prepare('SELECT id FROM orders WHERE idempotency_key = ?').bind(input.newIdempotencyKey).first<{ id: string }>()
  if (duplicate) return { ...duplicate, duplicate: true, orderCode: '', displayNumber: 0, sourceVersion: 0, sourceSubtotal: 0, total: 0 }
  const number = await reserveOrderNumber(db)
  const targetId = crypto.randomUUID()
  const now = Date.now()
  const statements: D1PreparedStatement[] = [
    db.prepare("INSERT INTO orders (id, order_code, business_date, display_number, idempotency_key, source, table_id, note, status, version, subtotal, discount_amount, total, cogs, created_by, paid_at, created_at, updated_at) SELECT ?, ?, ?, ?, ?, source, table_id, note, 'draft', 1, 0, 0, 0, 0, created_by, NULL, ?, ? FROM orders WHERE id = ?").bind(targetId, number.orderCode, number.businessDate, number.displayNumber, input.newIdempotencyKey, now, now, source.id),
    db.prepare('INSERT INTO order_tables (order_id, table_id, is_primary, linked_at) SELECT ?, table_id, is_primary, ? FROM order_tables WHERE order_id = ?').bind(targetId, now, source.id),
  ]
  for (const line of activeLines) {
    const moved = requested.get(line.id) ?? 0
    if (!moved) continue
    statements.push(db.prepare("UPDATE order_lines SET line_status = 'transferred' WHERE id = ? AND line_status = 'active'").bind(line.id))
    if (line.quantity > moved) statements.push(...await cloneLine(db, source.id, line, line.quantity - moved, line.id))
    statements.push(...await cloneLine(db, targetId, line, moved, line.id))
  }
  statements.push(audit(db, actor.id, source.id, 'split', { targetOrderId: targetId }, now), audit(db, actor.id, targetId, 'split_created', { sourceOrderId: source.id }, now))
  await db.batch(statements)
  const sourceSubtotal = await refreshTotals(db, source.id, source.version, now)
  const targetSubtotal = await db.prepare("SELECT COALESCE(SUM(line_total), 0) AS subtotal FROM order_lines WHERE order_id = ? AND line_status = 'active'").bind(targetId).first<{ subtotal: number }>()
  await db.prepare('UPDATE orders SET subtotal = ?, total = ?, updated_at = ? WHERE id = ?').bind(targetSubtotal?.subtotal ?? 0, targetSubtotal?.subtotal ?? 0, now, targetId).run()
  return { id: targetId, orderCode: number.orderCode, displayNumber: number.displayNumber, sourceVersion: source.version + 1, sourceSubtotal, total: targetSubtotal?.subtotal ?? 0 }
}

export async function mergeDrafts(db: D1Database, actor: OrderActor, input: DraftMergeInput) {
  const source = await getDraft(db, input.sourceOrderId, input.sourceVersion)
  const target = await getDraft(db, input.targetOrderId, input.targetVersion)
  if (source.id === target.id) throw new Response('Không thể gộp ticket vào chính nó.', { status: 400 })
  const activeLines = await readLines(db, source.id, false)
  const now = Date.now()
  const statements: D1PreparedStatement[] = []
  for (const line of activeLines) {
    statements.push(db.prepare("UPDATE order_lines SET line_status = 'transferred' WHERE id = ? AND line_status = 'active'").bind(line.id), ...await cloneLine(db, target.id, line, line.quantity, line.id))
  }
  statements.push(
    db.prepare("UPDATE orders SET status = 'cancelled', merged_into_order_id = ?, cancel_reason = 'merged', cancelled_by = ?, cancelled_at = ?, version = version + 1, updated_at = ? WHERE id = ? AND status = 'draft' AND version = ?").bind(target.id, actor.id, now, now, source.id, source.version),
    db.prepare('DELETE FROM order_tables WHERE order_id = ?').bind(source.id),
    audit(db, actor.id, target.id, 'merged', { sourceOrderId: source.id }, now),
    audit(db, actor.id, source.id, 'merged_into', { targetOrderId: target.id }, now),
  )
  await db.batch(statements)
  const subtotal = await refreshTotals(db, target.id, target.version, now)
  return { id: target.id, version: target.version + 1, subtotal, total: subtotal }
}

export async function payDraftCash(db: D1Database, actor: OrderActor, input: CashPayInput) {
  const existing = await db.prepare('SELECT o.id, o.order_code AS orderCode, o.display_number AS displayNumber, o.status, o.total FROM offline_sync_records s JOIN orders o ON o.id = s.order_id WHERE s.idempotency_key = ?').bind(input.idempotencyKey).first<{ id: string; orderCode: string; displayNumber: number; status: string; total: number }>()
  if (existing) return { ...existing, duplicate: true, change: input.receivedAmount - existing.total }
  const order = await db.prepare("SELECT id, order_code AS orderCode, display_number AS displayNumber, source, version, status, kds_status AS kdsStatus FROM orders WHERE id = ?").bind(input.orderId).first<{ id: string; orderCode: string; displayNumber: number; source: string; version: number; status: string; kdsStatus: string }>()
  if (!order || order.status !== 'draft') throw new Response('Đơn mở không tồn tại hoặc đã được thanh toán.', { status: 409 })
  if (order.version !== input.expectedVersion) throw new Response('Ticket vừa được cập nhật trên thiết bị khác. Tải lại trước khi thanh toán.', { status: 409 })
  const subtotalRow = await db.prepare("SELECT COALESCE(SUM(line_total), 0) AS subtotal FROM order_lines WHERE order_id = ? AND line_status = 'active'").bind(order.id).first<{ subtotal: number }>()
  const subtotal = subtotalRow?.subtotal ?? 0
  if (subtotal <= 0) throw new Response('Ticket chưa có món còn hiệu lực để thanh toán.', { status: 400 })
  const { discountAmount, total } = calculateTotal(subtotal, input.discount)
  if (input.receivedAmount < total) throw new Response('Số tiền nhận không đủ để thanh toán đơn này.', { status: 400 })
  const now = Date.now()
  const shouldCompleteKds = input.completeKds ?? (order.source === 'table')

  const updateOrderSql = shouldCompleteKds && order.kdsStatus !== 'served'
    ? "UPDATE orders SET status = 'paid', subtotal = ?, discount_amount = ?, total = ?, cogs = 0, paid_at = ?, kds_status = 'served', kds_updated_at = ?, version = version + 1, updated_at = ? WHERE id = ? AND status = 'draft' AND version = ?"
    : "UPDATE orders SET status = 'paid', subtotal = ?, discount_amount = ?, total = ?, cogs = 0, paid_at = ?, version = version + 1, updated_at = ? WHERE id = ? AND status = 'draft' AND version = ?"

  const updateOrderParams = shouldCompleteKds && order.kdsStatus !== 'served'
    ? [subtotal, discountAmount, total, now, now, now, order.id, order.version]
    : [subtotal, discountAmount, total, now, now, order.id, order.version]

  const statements: D1PreparedStatement[] = [
    db.prepare(updateOrderSql).bind(...updateOrderParams),
    db.prepare("INSERT INTO payments (id, order_id, method, amount, received_amount, change_amount, created_at) VALUES (?, ?, 'cash', ?, ?, ?, ?)").bind(crypto.randomUUID(), order.id, total, input.receivedAmount, input.receivedAmount - total, now),
    db.prepare('INSERT INTO offline_sync_records (idempotency_key, order_id, device_id, synced_at) VALUES (?, ?, ?, ?)').bind(input.idempotencyKey, order.id, input.deviceId, now),
    db.prepare("INSERT INTO audit_logs (id, actor_id, entity_type, entity_id, action, detail_json, created_at) VALUES (?, ?, 'order', ?, 'cash_checkout', ?, ?)").bind(crypto.randomUUID(), actor.id, order.id, JSON.stringify({ orderCode: order.orderCode, displayNumber: order.displayNumber, subtotal, discountAmount, total, cogs: 0, completedKds: shouldCompleteKds }), now),
  ]
  if (input.discount && discountAmount > 0) statements.push(db.prepare('INSERT INTO order_discounts (id, order_id, type, value, amount, reason, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), order.id, input.discount.type, input.discount.value, discountAmount, input.discount.reason, actor.id, now))
  const result = await db.batch(statements)
  if (result[0]?.meta.changes !== 1) throw new Response('Ticket vừa được cập nhật trên thiết bị khác. Tải lại trước khi thanh toán.', { status: 409 })
  return { id: order.id, orderCode: order.orderCode, displayNumber: order.displayNumber, status: 'paid', total, change: input.receivedAmount - total, cogs: 0, duplicate: false }
}

export async function getOrderDetail(db: D1Database, orderId: string): Promise<OrderDetailResult> {
  const order = await db.prepare(`SELECT o.id, o.order_code AS orderCode, o.display_number AS displayNumber, o.business_date AS businessDate, o.version, o.source, o.table_id AS tableId, t.name AS tableName, o.status, o.kds_status AS kdsStatus, o.subtotal, o.discount_amount AS discountAmount, o.total, o.cogs, o.note, o.created_at AS createdAt, o.updated_at AS updatedAt, o.paid_at AS paidAt, o.cancelled_at AS cancelledAt, o.cancel_reason AS cancelReason, o.merged_into_order_id AS mergedIntoOrderId, u.display_name AS cashier, cancelled.display_name AS cancelledByName, approved.display_name AS approvedByName FROM orders o LEFT JOIN "tables" t ON t.id = o.table_id JOIN users u ON u.id = o.created_by LEFT JOIN users cancelled ON cancelled.id = o.cancelled_by LEFT JOIN users approved ON approved.id = (SELECT approved_by FROM order_lines WHERE order_id = o.id AND approved_by IS NOT NULL LIMIT 1) WHERE o.id = ?`).bind(orderId).first<Omit<OrderDetailResult, 'lines' | 'discounts' | 'payment' | 'refund'>>()
  if (!order) throw new Response('Đơn không tồn tại.', { status: 404 })
  const [lines, discounts, payment, refund] = await Promise.all([
    db.prepare(`SELECT l.id, l.menu_item_id AS menuItemId, l.variant_id AS variantId, l.name_snapshot AS name, l.variant_snapshot AS variant, l.quantity, l.unit_price AS unitPrice, l.line_total AS lineTotal, l.line_status AS lineStatus, l.replaced_line_id AS replacedLineId, l.cancel_reason AS cancelReason, l.cancelled_at AS cancelledAt, l.cancelled_by AS cancelledById, l.approved_by AS approvedById, cb.display_name AS cancelledByName, ap.display_name AS approvedByName, lm.id AS modifierLineId, lm.name_snapshot AS modifierName, lm.price_delta AS priceDelta FROM order_lines l LEFT JOIN order_line_modifiers lm ON lm.order_line_id = l.id LEFT JOIN users cb ON cb.id = l.cancelled_by LEFT JOIN users ap ON ap.id = l.approved_by WHERE l.order_id = ? ORDER BY l.rowid`).bind(orderId).all(),
    db.prepare('SELECT type, value, amount, reason, created_at AS createdAt FROM order_discounts WHERE order_id = ? ORDER BY created_at DESC').bind(orderId).all(),
    db.prepare('SELECT method, amount, received_amount AS receivedAmount, change_amount AS changeAmount, created_at AS createdAt FROM payments WHERE order_id = ?').bind(orderId).first(),
    db.prepare('SELECT amount, reason, actor_id AS actorId, approved_by AS approvedById, created_at AS createdAt FROM order_refunds WHERE order_id = ?').bind(orderId).first(),
  ])
  return { ...order, lines: groupOrderLines(lines.results as Array<Record<string, unknown>>), discounts: discounts.results, payment, refund }
}

function groupOrderLines(rows: Array<Record<string, unknown>>): OrderLineView[] {
  const map = new Map<string, OrderLineView>()
  for (const row of rows) {
    const line = map.get(String(row.id)) ?? ({ id: String(row.id), menuItemId: String(row.menuItemId ?? ''), variantId: String(row.variantId ?? ''), name: String(row.name ?? ''), variant: String(row.variant ?? ''), quantity: Number(row.quantity ?? 0), unitPrice: Number(row.unitPrice ?? 0), lineTotal: Number(row.lineTotal ?? 0), lineStatus: String(row.lineStatus ?? 'active'), replacedLineId: row.replacedLineId ? String(row.replacedLineId) : null, cancelReason: row.cancelReason ? String(row.cancelReason) : null, cancelledAt: row.cancelledAt ? Number(row.cancelledAt) : null, cancelledById: row.cancelledById ? String(row.cancelledById) : null, cancelledByName: row.cancelledByName ? String(row.cancelledByName) : null, approvedById: row.approvedById ? String(row.approvedById) : null, approvedByName: row.approvedByName ? String(row.approvedByName) : null, modifiers: [] })
    if (row.modifierLineId) line.modifiers.push({ name: String(row.modifierName ?? ''), priceDelta: Number(row.priceDelta ?? 0) })
    map.set(String(row.id), line)
  }
  return [...map.values()]
}

export async function cancelOrder(db: D1Database, actor: OrderActor, input: OrderCancelInput) {
  const order = await db.prepare('SELECT id, order_code AS orderCode, status, version FROM orders WHERE id = ?').bind(input.orderId).first<{ id: string; orderCode: string; status: string; version: number }>()
  if (!order) throw new Response('Đơn không tồn tại.', { status: 404 })
  if (order.status !== 'draft' && order.status !== 'paid') throw new Response('Đơn này không thể hủy ở trạng thái hiện tại.', { status: 409 })
  if (input.expectedVersion !== undefined && input.expectedVersion !== order.version) throw new Response('Ticket vừa được cập nhật. Tải lại trước khi hủy.', { status: 409 })
  let approvedBy: string | null = null
  if (order.status === 'paid') {
    if ((!input.manager?.username && !input.manager?.email) || !input.manager.password) throw new Response('Hủy đơn đã thanh toán cần quản lý đăng nhập lại để duyệt.', { status: 403 })
    approvedBy = await verifyManagerCredentials(db, input.manager)
  }
  const now = Date.now()
  const statements: D1PreparedStatement[] = [
    db.prepare("UPDATE orders SET status = 'cancelled', cancel_reason = ?, cancelled_by = ?, cancelled_at = ?, version = version + 1, updated_at = ? WHERE id = ? AND status = ? AND version = ?").bind(input.reason.trim(), actor.id, now, now, order.id, order.status, order.version),
    db.prepare("UPDATE order_lines SET line_status = 'cancelled', cancel_reason = ?, cancelled_by = ?, cancelled_at = ?, approved_by = ? WHERE order_id = ? AND line_status = 'active'").bind(input.reason.trim(), actor.id, now, approvedBy, order.id),
    db.prepare("INSERT INTO audit_logs (id, actor_id, entity_type, entity_id, action, detail_json, created_at) VALUES (?, ?, 'order', ?, 'cancelled', ?, ?)").bind(crypto.randomUUID(), actor.id, order.id, JSON.stringify({ orderCode: order.orderCode, reason: input.reason.trim(), approvedBy }), now),
  ]
  if (approvedBy) {
    const payment = await db.prepare('SELECT amount FROM payments WHERE order_id = ?').bind(order.id).first<{ amount: number }>()
    statements.push(db.prepare('INSERT INTO order_refunds (id, order_id, amount, reason, actor_id, approved_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), order.id, payment?.amount ?? 0, input.reason.trim(), actor.id, approvedBy, now))
  }
  const result = await db.batch(statements)
  if (result[0]?.meta.changes !== 1) throw new Response('Ticket vừa được cập nhật. Tải lại trước khi hủy.', { status: 409 })
  return { id: order.id, status: 'cancelled' }
}

export async function linkTable(db: D1Database, actor: OrderActor, input: DraftLinkTableInput) {
  const order = await getDraft(db, input.orderId, input.expectedVersion)
  if (order.source !== 'table') throw new Response('Chỉ đơn tại bàn mới gộp thêm bàn được.', { status: 400 })
  // Check if already linked
  const existing = await db.prepare('SELECT 1 FROM order_tables WHERE order_id = ? AND table_id = ?').bind(order.id, input.tableId).first()
  if (existing) throw new Response('Bàn này đã nằm trong đơn.', { status: 409 })
  await ensureTableAvailable(db, input.tableId)
  const now = Date.now()
  await db.batch([
    db.prepare('INSERT INTO order_tables (order_id, table_id, is_primary, linked_at) VALUES (?, ?, 0, ?)').bind(order.id, input.tableId, now),
    db.prepare("UPDATE orders SET version = version + 1, updated_at = ? WHERE id = ? AND status = 'draft' AND version = ?").bind(now, order.id, order.version),
    audit(db, actor.id, order.id, 'table_linked', { tableId: input.tableId }, now),
  ])
  // Fetch updated table list
  const tables = await db.prepare('SELECT ot.table_id AS tableId, t.name AS tableName FROM order_tables ot JOIN "tables" t ON t.id = ot.table_id WHERE ot.order_id = ? ORDER BY ot.is_primary DESC, ot.linked_at ASC').bind(order.id).all<{ tableId: string; tableName: string }>()
  return { id: order.id, version: order.version + 1, tableIds: tables.results.map((r) => r.tableId), tableNames: tables.results.map((r) => r.tableName) }
}

export async function unlinkTable(db: D1Database, actor: OrderActor, input: DraftUnlinkTableInput) {
  const order = await getDraft(db, input.orderId, input.expectedVersion)
  const currentTables = await db.prepare('SELECT table_id AS tableId, is_primary AS isPrimary FROM order_tables WHERE order_id = ? ORDER BY is_primary DESC, linked_at ASC').bind(order.id).all<{ tableId: string; isPrimary: number }>()
  if (!currentTables.results.some((r) => r.tableId === input.tableId)) throw new Response('Bàn này không nằm trong đơn.', { status: 400 })
  if (currentTables.results.length <= 1) throw new Response('Đơn phải có ít nhất một bàn.', { status: 400 })
  // Check if order has lines — if so, only allow unlinking non-primary secondary tables (MVP constraint)
  const hasLines = await db.prepare("SELECT 1 FROM order_lines WHERE order_id = ? AND line_status = 'active' LIMIT 1").bind(order.id).first()
  const isRemovingPrimary = currentTables.results.find((r) => r.tableId === input.tableId)?.isPrimary === 1
  if (hasLines && isRemovingPrimary) throw new Response('Không thể bớt bàn chính khi đơn đã có món. Dùng tính năng Tách ticket nếu cần.', { status: 409 })
  const now = Date.now()
  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM order_tables WHERE order_id = ? AND table_id = ?').bind(order.id, input.tableId),
    db.prepare("UPDATE orders SET version = version + 1, updated_at = ? WHERE id = ? AND status = 'draft' AND version = ?").bind(now, order.id, order.version),
    audit(db, actor.id, order.id, 'table_unlinked', { tableId: input.tableId }, now),
  ]
  // If removing primary, promote next table to primary and update orders.table_id
  if (isRemovingPrimary) {
    const nextPrimary = currentTables.results.find((r) => r.tableId !== input.tableId)
    if (nextPrimary) {
      statements.push(
        db.prepare('UPDATE order_tables SET is_primary = 1 WHERE order_id = ? AND table_id = ?').bind(order.id, nextPrimary.tableId),
        db.prepare('UPDATE orders SET table_id = ? WHERE id = ?').bind(nextPrimary.tableId, order.id),
      )
    }
  }
  await db.batch(statements)
  const updatedTables = await db.prepare('SELECT ot.table_id AS tableId, t.name AS tableName FROM order_tables ot JOIN "tables" t ON t.id = ot.table_id WHERE ot.order_id = ? ORDER BY ot.is_primary DESC, ot.linked_at ASC').bind(order.id).all<{ tableId: string; tableName: string }>()
  return { id: order.id, version: order.version + 1, tableIds: updatedTables.results.map((r) => r.tableId), tableNames: updatedTables.results.map((r) => r.tableName) }
}