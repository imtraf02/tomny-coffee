import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:workers'
import { applyMigrations, seedCategory, seedCombo, seedModifierGroup, seedProduct, seedTable, seedUser, tableStatus } from './test-fixture'
import { addLine, cancelDraft, cancelOrder, createDraft, getOrderDetail, linkTable, listDrafts, mergeDrafts, moveDraft, payDraftCash, reserveOrderNumber, splitDraft, unlinkTable, updateNote, verifyManagerCredentials, voidLine } from './order-service'
import { saveProduct } from './catalog-service'

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

let cashier: { id: string }
let owner: { id: string; email: string; password: string }
let bystander: { id: string; email: string; password: string }
let tableA: string
let tableB: string
let categoryId: string
let coffee: { id: string; variants: Array<{ id: string; price: number }> }
let tea: { id: string; variants: Array<{ id: string; price: number }> }
let comboItem: { id: string; variants: Array<{ id: string; price: number }> }

beforeAll(async () => {
  await applyMigrations()
})

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM order_tables'),
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
  cashier = await seedUser(env.DB, 'cashier@test.dev', 'Thu ngân', 'cashier-pass', ['pos.cash'])
  owner = await seedUser(env.DB, 'owner@test.dev', 'Chủ quán', 'owner-pass', ['orders.cancel.paid.approve'])
  bystander = await seedUser(env.DB, 'staff@test.dev', 'Nhân viên', 'staff-pass', [])
  tableA = (await seedTable(env.DB, 'Bàn 1')).id
  tableB = (await seedTable(env.DB, 'Bàn 2')).id
  categoryId = await seedCategory(env.DB, 'Đồ uống')
  coffee = await seedProduct(env.DB, categoryId, 'Cà phê sữa', [{ name: 'Ly', price: 30_000 }, { name: 'Bình', price: 60_000 }])
  tea = await seedProduct(env.DB, categoryId, 'Trà đào', [{ name: 'Ly', price: 25_000 }])
  comboItem = await seedProduct(env.DB, categoryId, 'Combo sáng', [{ name: 'Bộ', price: 10_000 }], 'combo')
  await seedCombo(env.DB, comboItem.id, 45_000, [{ variantId: coffee.variants[0].id, quantity: 1 }, { variantId: tea.variants[0].id, quantity: 1 }])
  await seedModifierGroup(env.DB, 'Đá', 0, 1, [{ name: 'Thêm đá', priceDelta: 2_000 }], [coffee.variants[0].id])
})

describe('order-service integration', () => {
  it('applies all migrations cleanly', async () => {
    await applyMigrations()
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM d1_migrations').first<{ n: number }>()
    expect(Number(row?.n)).toBeGreaterThan(10)
  })

  it('assigns sequential display numbers and resets per business day', async () => {
    const first = await reserveOrderNumber(env.DB, new Date('2026-08-15T08:00:00+07:00'))
    const second = await reserveOrderNumber(env.DB, new Date('2026-08-15T09:00:00+07:00'))
    expect(first.displayNumber).toBe(1)
    expect(second.displayNumber).toBe(2)
    expect(first.businessDate).toBe('2026-08-15')
    const nextDay = await reserveOrderNumber(env.DB, new Date('2026-08-16T08:00:00+07:00'))
    expect(nextDay.displayNumber).toBe(1)
    expect(nextDay.businessDate).toBe('2026-08-16')
  })

  it('returns the same draft for a repeated idempotency key without consuming a new number', async () => {
    const first = await createDraft(env.DB, cashier, { source: 'counter', note: '', lines: [{ variantId: coffee.variants[0].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'dup-key-1' })
    const second = await createDraft(env.DB, cashier, { source: 'counter', note: '', lines: [{ variantId: coffee.variants[0].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'dup-key-1' })
    expect(second).toMatchObject({ duplicate: true, id: first.id })
    const third = await createDraft(env.DB, cashier, { source: 'counter', note: '', lines: [{ variantId: coffee.variants[0].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'dup-key-2' })
    expect(third.displayNumber).toBe(first.displayNumber + 1)
    const orders = await env.DB.prepare('SELECT COUNT(*) AS n FROM orders').first<{ n: number }>()
    expect(Number(orders?.n)).toBe(2)
  })

  it('locks prices: later price changes do not affect existing lines', async () => {
    const draft = await createDraft(env.DB, cashier, { source: 'counter', note: '', lines: [{ variantId: coffee.variants[0].id, quantity: 2, modifierIds: [] }], idempotencyKey: 'price-lock-1' })
    await saveProduct(env.DB, cashier, { id: coffee.id, categoryId, name: 'Cà phê sữa (mới)', description: '', active: true, kind: 'standard', sortOrder: 0, variants: [{ id: coffee.variants[0].id, name: 'Ly', price: 35_000, active: true, sortOrder: 0, modifierGroupIds: [] }] })
    const added = await addLine(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, line: { variantId: coffee.variants[0].id, quantity: 1, modifierIds: [] } })
    expect(added.line.unitPrice).toBe(35_000)
    const detail = await getOrderDetail(env.DB, draft.id)
    expect(detail.lines).toHaveLength(2)
    expect(detail.lines[0].unitPrice).toBe(30_000)
    expect(detail.lines[0].name).toBe('Cà phê sữa')
    expect(detail.lines[1].unitPrice).toBe(35_000)
    expect(detail.lines[1].name).toBe('Cà phê sữa (mới)')
  })

  it('rejects mutations with a stale expectedVersion', async () => {
    const draft = await createDraft(env.DB, cashier, { source: 'counter', note: '', lines: [{ variantId: coffee.variants[0].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'stale-1' })
    await addLine(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, line: { variantId: tea.variants[0].id, quantity: 1, modifierIds: [] } })
    await expectError(addLine(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, line: { variantId: tea.variants[0].id, quantity: 1, modifierIds: [] } }), 409)
  })

  it('enforces modifier group min/max selections', async () => {
    const required = await seedModifierGroup(env.DB, 'Bắt buộc', 1, 1, [{ name: 'Bắt buộc chọn', priceDelta: 3_000 }], [coffee.variants[1].id])
    await expectError(createDraft(env.DB, cashier, { source: 'counter', note: '', lines: [{ variantId: coffee.variants[1].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'mod-0' }), 400)
    await expectError(createDraft(env.DB, cashier, { source: 'counter', note: '', lines: [{ variantId: coffee.variants[1].id, quantity: 1, modifierIds: ['a', 'b'] }], idempotencyKey: 'mod-2' }), 409)
    const draft = await createDraft(env.DB, cashier, { source: 'counter', note: '', lines: [{ variantId: coffee.variants[1].id, quantity: 1, modifierIds: [required.modifierIds[0]] }], idempotencyKey: 'mod-1' })
    const detail = await getOrderDetail(env.DB, draft.id)
    expect(detail.lines[0].unitPrice).toBe(63_000)
    expect(detail.lines[0].modifiers[0].name).toBe('Bắt buộc chọn')
  })

  it('voids part of a line via an immutable replacement line', async () => {
    const draft = await createDraft(env.DB, cashier, { source: 'counter', note: '', lines: [{ variantId: coffee.variants[0].id, quantity: 2, modifierIds: [] }], idempotencyKey: 'void-1' })
    const result = await voidLine(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, lineId: (await getOrderDetail(env.DB, draft.id)).lines[0].id, quantity: 1, reason: 'Khách gọi bớt' })
    expect(result.total).toBe(30_000)
    const detail = await getOrderDetail(env.DB, draft.id)
    expect(detail.lines).toHaveLength(2)
    const replaced = detail.lines.find((line) => line.replacedLineId)!
    expect(replaced.quantity).toBe(1)
    expect(replaced.lineTotal).toBe(30_000)
    expect(detail.lines[0].lineStatus).toBe('cancelled')
  })

  it('splits a draft into two tickets with snapshot lineage', async () => {
    const draft = await createDraft(env.DB, cashier, { source: 'counter', note: '', lines: [
      { variantId: coffee.variants[0].id, quantity: 2, modifierIds: [] },
      { variantId: tea.variants[0].id, quantity: 1, modifierIds: [] },
    ], idempotencyKey: 'split-1' })
    const firstLine = (await getOrderDetail(env.DB, draft.id)).lines.find((line) => line.variantId === coffee.variants[0].id)!
    const target = await splitDraft(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, newIdempotencyKey: 'split-target-1', lines: [{ lineId: firstLine.id, quantity: 1 }] })
    expect(target.total).toBe(30_000)
    expect(target.sourceSubtotal).toBe(55_000)
    const sourceDetail = await getOrderDetail(env.DB, draft.id)
    expect(sourceDetail.total).toBe(55_000)
    const targetDetail = await getOrderDetail(env.DB, target.id)
    expect(targetDetail.total).toBe(30_000)
    const targetLine = targetDetail.lines[0]
    expect(targetLine.replacedLineId).toBe(firstLine.id)
    expect(targetLine.name).toBe('Cà phê sữa')
  })

  it('merges drafts and records the merged_into chain', async () => {
    const source = await createDraft(env.DB, cashier, { source: 'counter', note: '', lines: [{ variantId: tea.variants[0].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'merge-source-1' })
    const target = await createDraft(env.DB, cashier, { source: 'counter', note: '', lines: [{ variantId: coffee.variants[0].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'merge-target-1' })
    const result = await mergeDrafts(env.DB, cashier, { sourceOrderId: source.id, sourceVersion: source.version, targetOrderId: target.id, targetVersion: target.version })
    expect(result.total).toBe(55_000)
    const sourceDetail = await getOrderDetail(env.DB, source.id)
    expect(sourceDetail.status).toBe('cancelled')
    expect(sourceDetail.mergedIntoOrderId).toBe(target.id)
    const targetDetail = await getOrderDetail(env.DB, target.id)
    expect(targetDetail.lines).toHaveLength(2)
    expect(targetDetail.lines[0].name).toBe('Cà phê sữa')
    expect(targetDetail.lines[1].name).toBe('Trà đào')
  })

  it('pays a draft in cash with discount and records payment + idempotency', async () => {
    const draft = await createDraft(env.DB, cashier, { source: 'counter', note: '', lines: [{ variantId: coffee.variants[0].id, quantity: 2, modifierIds: [] }], idempotencyKey: 'pay-1' })
    const result = await payDraftCash(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, idempotencyKey: 'pay-idem-1', deviceId: 'dev-1', receivedAmount: 100_000, discount: { type: 'percent', value: 10, reason: 'Khuyến mãi' } })
    expect(result.status).toBe('paid')
    expect(result.total).toBe(54_000)
    expect(result.change).toBe(46_000)
    const detail = await getOrderDetail(env.DB, draft.id)
    expect(detail.status).toBe('paid')
    expect(detail.discountAmount).toBe(6_000)
    expect(detail.payment).toMatchObject({ method: 'cash', amount: 54_000, receivedAmount: 100_000, changeAmount: 46_000 })
    expect(detail.discounts[0]).toMatchObject({ type: 'percent', value: 10, amount: 6_000 })
    const duplicate = await payDraftCash(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, idempotencyKey: 'pay-idem-1', deviceId: 'dev-1', receivedAmount: 100_000 })
    expect(duplicate.duplicate).toBe(true)
  })

  it('rejects cash payment with insufficient received amount', async () => {
    const draft = await createDraft(env.DB, cashier, { source: 'counter', note: '', lines: [{ variantId: coffee.variants[0].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'pay-2' })
    await expectError(payDraftCash(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, idempotencyKey: 'pay-idem-2', deviceId: 'dev-1', receivedAmount: 20_000 }), 400)
  })

  it('cancels a draft without manager approval', async () => {
    const draft = await createDraft(env.DB, cashier, { source: 'counter', note: '', lines: [{ variantId: coffee.variants[0].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'cancel-draft-1' })
    const result = await cancelDraft(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, reason: 'Khách không lấy' })
    expect(result.status).toBe('cancelled')
    const detail = await getOrderDetail(env.DB, draft.id)
    expect(detail.status).toBe('cancelled')
    expect(detail.cancelledByName).toBe('Thu ngân')
    expect(detail.lines[0].lineStatus).toBe('cancelled')
  })

  it('rejects cancelling a paid order without valid manager credentials', async () => {
    const draft = await createDraft(env.DB, cashier, { source: 'counter', note: '', lines: [{ variantId: coffee.variants[0].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'cancel-paid-1' })
    await payDraftCash(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, idempotencyKey: 'pay-idem-3', deviceId: 'dev-1', receivedAmount: 30_000 })
    await expectError(cancelOrder(env.DB, cashier, { orderId: draft.id, reason: 'Hủy' }), 403)
    await expectError(cancelOrder(env.DB, cashier, { orderId: draft.id, reason: 'Hủy', manager: { email: bystander.email, password: bystander.password } }), 403)
    await expectError(cancelOrder(env.DB, cashier, { orderId: draft.id, reason: 'Hủy', manager: { email: owner.email, password: 'sai-mật-khẩu' } }), 403)
  })

  it('cancels a paid order with manager approval, refunding and stamping approved_by', async () => {
    const draft = await createDraft(env.DB, cashier, { source: 'counter', note: '', lines: [{ variantId: coffee.variants[0].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'cancel-paid-2' })
    await payDraftCash(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, idempotencyKey: 'pay-idem-4', deviceId: 'dev-1', receivedAmount: 30_000 })
    const result = await cancelOrder(env.DB, cashier, { orderId: draft.id, reason: 'Khách trả đồ', manager: { email: owner.email, password: owner.password } })
    expect(result.status).toBe('cancelled')
    const detail = await getOrderDetail(env.DB, draft.id)
    expect(detail.status).toBe('cancelled')
    expect(detail.cancelledByName).toBe('Thu ngân')
    expect(detail.approvedByName).toBe('Chủ quán')
    expect(detail.refund).toMatchObject({ amount: 30_000, reason: 'Khách trả đồ', approvedById: owner.id })
    expect(detail.lines[0].lineStatus).toBe('cancelled')
    expect(detail.lines[0].approvedById).toBe(owner.id)
  })

  it('rejects cancelling a paid order at a stale version', async () => {
    const draft = await createDraft(env.DB, cashier, { source: 'counter', note: '', lines: [{ variantId: coffee.variants[0].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'cancel-paid-3' })
    await payDraftCash(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, idempotencyKey: 'pay-idem-5', deviceId: 'dev-1', receivedAmount: 30_000 })
    await expectError(cancelOrder(env.DB, cashier, { orderId: draft.id, expectedVersion: 1, reason: 'Hủy', manager: { email: owner.email, password: owner.password } }), 409)
  })

  it('tracks table status: occupied while a draft is open, freed after pay or cancel', async () => {
    expect(await tableStatus(env.DB, tableA)).toBe('trong')
    const draft = await createDraft(env.DB, cashier, { source: 'table', tableId: tableA, note: '', lines: [{ variantId: coffee.variants[0].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'table-1' })
    expect(await tableStatus(env.DB, tableA)).toBe('dang_phuc_vu')
    await payDraftCash(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, idempotencyKey: 'pay-idem-6', deviceId: 'dev-1', receivedAmount: 30_000 })
    expect(await tableStatus(env.DB, tableA)).toBe('trong')
    const draft2 = await createDraft(env.DB, cashier, { source: 'table', tableId: tableA, note: '', lines: [{ variantId: tea.variants[0].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'table-2' })
    expect(await tableStatus(env.DB, tableA)).toBe('dang_phuc_vu')
    await cancelDraft(env.DB, cashier, { orderId: draft2.id, expectedVersion: draft2.version, reason: 'Khách đi' })
    expect(await tableStatus(env.DB, tableA)).toBe('trong')
  })

  it('blocks a second draft on an occupied table', async () => {
    await createDraft(env.DB, cashier, { source: 'table', tableId: tableA, note: '', lines: [{ variantId: coffee.variants[0].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'occ-1' })
    await expectError(createDraft(env.DB, cashier, { source: 'table', tableId: tableA, note: '', lines: [{ variantId: tea.variants[0].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'occ-2' }), 409)
  })

  it('moves a draft between tables', async () => {
    const draft = await createDraft(env.DB, cashier, { source: 'table', tableId: tableA, note: '', lines: [{ variantId: coffee.variants[0].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'move-1' })
    const result = await moveDraft(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, tableId: tableB })
    expect(result.tableId).toBe(tableB)
    expect(await tableStatus(env.DB, tableA)).toBe('trong')
    expect(await tableStatus(env.DB, tableB)).toBe('dang_phuc_vu')
  })

  it('keeps snapshots intact after the product is renamed and stopped selling', async () => {
    const draft = await createDraft(env.DB, cashier, { source: 'counter', note: '', lines: [{ variantId: coffee.variants[0].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'snap-1' })
    await payDraftCash(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, idempotencyKey: 'pay-idem-7', deviceId: 'dev-1', receivedAmount: 30_000 })
    await saveProduct(env.DB, cashier, { categoryId, name: 'Cà phê sữa đá', description: '', active: true, kind: 'standard', sortOrder: 0, variants: [{ id: coffee.variants[0].id, name: 'Ly', price: 30_000, active: true, sortOrder: 0, modifierGroupIds: [] }] })
    const detail = await getOrderDetail(env.DB, draft.id)
    expect(detail.lines[0].name).toBe('Cà phê sữa')
    expect(detail.lines[0].unitPrice).toBe(30_000)
  })

  it('lists only open drafts and updates notes', async () => {
    const draft = await createDraft(env.DB, cashier, { source: 'counter', note: 'Ghi chú cũ', lines: [{ variantId: coffee.variants[0].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'note-1' })
    await updateNote(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, note: 'Không đường' })
    const drafts = await listDrafts(env.DB, null)
    expect(drafts).toHaveLength(1)
    expect(drafts[0].note).toBe('Không đường')
    expect(drafts[0].displayNumber).toBe(draft.displayNumber)
    const tableDrafts = await listDrafts(env.DB, tableA)
    expect(tableDrafts).toHaveLength(0)
  })

  it('verifyManagerCredentials rejects inactive users and users without the approval permission', async () => {
    await expectError(verifyManagerCredentials(env.DB, { email: 'khong-ton-tai@test.dev', password: 'x' }), 403)
    const inactive = await seedUser(env.DB, 'inactive@test.dev', 'Nghỉ việc', 'pass', ['orders.cancel.paid.approve'])
    await env.DB.prepare('UPDATE users SET active = 0 WHERE id = ?').bind(inactive.id).run()
    await expectError(verifyManagerCredentials(env.DB, { email: inactive.email, password: 'pass' }), 403)
  })

  describe('table grouping (gộp bàn)', () => {
    it('creates a grouped order spanning multiple tables and marks all of them occupied', async () => {
      const draft = await createDraft(env.DB, cashier, {
        source: 'table',
        tableIds: [tableA, tableB],
        note: 'Bàn ghép đoàn đông',
        lines: [{ variantId: coffee.variants[0].id, quantity: 2, modifierIds: [] }],
        idempotencyKey: 'group-draft-1',
      })
      expect(draft.tableIds).toEqual([tableA, tableB])
      expect(await tableStatus(env.DB, tableA)).toBe('dang_phuc_vu')
      expect(await tableStatus(env.DB, tableB)).toBe('dang_phuc_vu')

      // Creating another order on either table is blocked
      await expectError(
        createDraft(env.DB, cashier, { source: 'table', tableId: tableB, note: '', lines: [{ variantId: tea.variants[0].id, quantity: 1, modifierIds: [] }], idempotencyKey: 'blocked-1' }),
        409,
        'đã có ticket',
      )

      // Paying the order frees ALL grouped tables
      await payDraftCash(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, idempotencyKey: 'pay-group-1', deviceId: 'dev-1', receivedAmount: 60_000 })
      expect(await tableStatus(env.DB, tableA)).toBe('trong')
      expect(await tableStatus(env.DB, tableB)).toBe('trong')
    })

    it('links an empty table to an existing open order', async () => {
      const draft = await createDraft(env.DB, cashier, {
        source: 'table',
        tableId: tableA,
        note: '',
        lines: [{ variantId: coffee.variants[0].id, quantity: 1, modifierIds: [] }],
        idempotencyKey: 'single-draft-1',
      })
      expect(await tableStatus(env.DB, tableB)).toBe('trong')

      const linked = await linkTable(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, tableId: tableB })
      expect(linked.tableIds).toContain(tableA)
      expect(linked.tableIds).toContain(tableB)
      expect(await tableStatus(env.DB, tableA)).toBe('dang_phuc_vu')
      expect(await tableStatus(env.DB, tableB)).toBe('dang_phuc_vu')

      // Cannot link the same table again
      await expectError(
        linkTable(env.DB, cashier, { orderId: draft.id, expectedVersion: linked.version, tableId: tableB }),
        409,
        'đã nằm trong đơn',
      )
    })

    it('unlinks a secondary table and frees it, but blocks unlinking primary table when order has active lines', async () => {
      const draft = await createDraft(env.DB, cashier, {
        source: 'table',
        tableIds: [tableA, tableB],
        note: '',
        lines: [{ variantId: coffee.variants[0].id, quantity: 2, modifierIds: [] }],
        idempotencyKey: 'unlink-test-1',
      })

      // Attempting to remove primary table tableA while order has lines is blocked
      await expectError(
        unlinkTable(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, tableId: tableA }),
        409,
        'Không thể bớt bàn chính',
      )

      // Removing secondary table tableB succeeds
      const unlinked = await unlinkTable(env.DB, cashier, { orderId: draft.id, expectedVersion: draft.version, tableId: tableB })
      expect(unlinked.tableIds).toEqual([tableA])
      expect(await tableStatus(env.DB, tableA)).toBe('dang_phuc_vu')
      expect(await tableStatus(env.DB, tableB)).toBe('trong')
    })

    it('lists drafts with multi-table aggregation', async () => {
      await createDraft(env.DB, cashier, {
        source: 'table',
        tableIds: [tableA, tableB],
        note: 'Đoàn khách',
        lines: [{ variantId: tea.variants[0].id, quantity: 3, modifierIds: [] }],
        idempotencyKey: 'list-group-1',
      })

      const drafts = await listDrafts(env.DB, null)
      expect(drafts).toHaveLength(1)
      expect(drafts[0].tableIds).toEqual([tableA, tableB])
      expect(drafts[0].tableNames).toHaveLength(2)

      // Filtering by secondary table still finds the grouped order
      const byTableB = await listDrafts(env.DB, tableB)
      expect(byTableB).toHaveLength(1)
      expect(byTableB[0].tableIds).toEqual([tableA, tableB])
    })
  })
})