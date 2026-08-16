#!/usr/bin/env node
/**
 * Generates deterministic sample SQL for the local D1 database (tomny-coffee).
 * Usage:
 *   node ./scripts/seed-local.mjs > /tmp/seed.sql
 *   npx wrangler d1 execute tomny-coffee --local --file /tmp/seed.sql
 *
 * All seeded rows are keyed by `seed-` prefixed labels that are translated
 * into deterministic UUIDs at insert time, so ids stay valid for the app's
 * UUID-validated routes while re-running the script wipes the previous data.
 * Demo password for every seeded user is `123456` (PBKDF2, 310000 iterations —
 * same scheme as src/server/auth.ts).
 */

const NOW = Date.now()
const DAY = 86400000

const esc = (value) => {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'number') return String(value)
  return `'${String(value).replaceAll("'", "''")}'`
}

const toCamel = (column) => column.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

const insert = (table, columns, rows) => {
  if (!rows.length) return ''
  const translated = translateIds(rows)
  return [
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES`,
    translated
      .map((row) => `  (${columns.map((column) => esc(row[toCamel(column)])).join(', ')})`)
      .join(',\n'),
    ';',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Passwords (PBKDF2-SHA256, 310000 rounds, base64url — matches auth.ts)
// ---------------------------------------------------------------------------
import { createHash, webcrypto } from 'node:crypto'

const uuidMap = new Map()
const seedUuid = (seed) => {
  let value = uuidMap.get(seed)
  if (!value) {
    const hash = createHash('sha256').update(seed).digest('hex')
    value = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`
    uuidMap.set(seed, value)
  }
  return value
}

const translateIds = (value) => {
  if (typeof value === 'string' && value.startsWith('seed-')) return seedUuid(value)
  if (Array.isArray(value)) return value.map(translateIds)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, translateIds(item)]))
  return value
}

async function hashPassword(password) {
  const salt = new TextEncoder().encode('seed-salt-123456')
  const key = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const derived = new Uint8Array(
    await webcrypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
      key,
      256,
    ),
  )
  return `pbkdf2$310000$${Buffer.from(salt).toString('base64url')}$${Buffer.from(derived).toString('base64url')}`
}

// ---------------------------------------------------------------------------
// Users & permissions
// ---------------------------------------------------------------------------
const users = [
  { id: 'seed-user-owner', email: 'owner@tomny.coffee', displayName: 'Chủ quán' },
  { id: 'seed-user-cashier', email: 'cashier@tomny.coffee', displayName: 'Thu ngân' },
  { id: 'seed-user-barista', email: 'barista@tomny.coffee', displayName: 'Pha chế' },
  { id: 'seed-user-stock', email: 'stock@tomny.coffee', displayName: 'Quản kho' },
]

const ALL_PERMISSIONS = [
  'pos.read', 'pos.checkout', 'pos.discount', 'pos.cancel', 'pos.reprint',
  'menu.read', 'menu.manage',
  'floor_plan.read', 'floor_plan.manage',
  'inventory.read', 'inventory.manage', 'inventory.stocktake',
  'staff.read', 'staff.manage', 'payroll.manage',
  'reports.read', 'reports.export', 'settings.manage',
  'kds.read', 'kds.manage',
  'orders.read', 'orders.manage', 'orders.cancel.paid.approve',
  'audit.read',
]

const permissionByUser = {
  'seed-user-owner': ALL_PERMISSIONS,
  'seed-user-cashier': [
    'pos.read', 'pos.checkout', 'pos.discount', 'pos.cancel', 'pos.reprint',
    'menu.read', 'floor_plan.read', 'inventory.read', 'staff.read', 'reports.read',
  ],
  'seed-user-barista': ['pos.read', 'menu.read', 'floor_plan.read'],
  'seed-user-stock': [
    'menu.read', 'inventory.read', 'inventory.manage', 'inventory.stocktake', 'reports.read',
  ],
}

const permissions = ALL_PERMISSIONS.map((code) => ({ id: `seed-perm-${code}`, code, label: PERMISSION_LABELS[code] ?? code }))

const PERMISSION_LABELS = {
  'pos.read': 'Truy cập POS',
  'pos.checkout': 'Thanh toán đơn hàng',
  'pos.cash': 'Quản lý tiền mặt',
  'pos.discount': 'Áp dụng chiết khấu',
  'pos.cancel': 'Hủy đơn hàng',
  'pos.reprint': 'In lại hóa đơn',
  'menu.read': 'Xem danh mục món',
  'menu.manage': 'Quản lý thực đơn & giá',
  'floor_plan.read': 'Xem sơ đồ bàn',
  'floor_plan.manage': 'Chỉnh sửa sơ đồ bàn',
  'inventory.read': 'Xem tồn kho & định mức',
  'inventory.manage': 'Nhập/xuất & kiểm kho',
  'inventory.stocktake': 'Kiểm kê kho',
  'staff.read': 'Xem danh sách nhân sự',
  'staff.manage': 'Phân quyền & mời nhân viên',
  'payroll.manage': 'Chốt lương nhân viên',
  'reports.read': 'Xem báo cáo tài chính',
  'reports.export': 'Xuất báo cáo Excel/PDF',
  'settings.manage': 'Quản trị hệ thống',
  'kds.read': 'Xem màn hình pha chế (KDS)',
  'kds.manage': 'Cập nhật trạng thái pha chế',
  'orders.read': 'Xem lịch sử hóa đơn',
  'orders.manage': 'Xử lý hoàn trả đơn',
  'orders.cancel.paid.approve': 'Duyệt hủy & hoàn tiền đơn đã thanh toán',
  'audit.read': 'Xem nhật ký hoạt động',
  'tables.operate': 'Thao tác mở/chuyển bàn',
  'timeclock.use': 'Chấm công ca làm',
  'timeclock.manage': 'Duyệt chấm công',
}

const userPermissions = []
for (const [userId, codes] of Object.entries(permissionByUser)) {
  for (const code of codes) {
    userPermissions.push({ userId, permissionId: `seed-perm-${code}`, grantedAt: NOW - 30 * DAY })
  }
}

// ---------------------------------------------------------------------------
// Floor plan: zones, tables, blocks
// ---------------------------------------------------------------------------
const zones = [
  { id: 'seed-zone-1', name: 'Tầng 1', sortOrder: 0 },
  { id: 'seed-zone-2', name: 'Tầng 2', sortOrder: 1 },
  { id: 'seed-zone-garden', name: 'Sân vườn', sortOrder: 2 },
]

const tables = [
  { id: 'seed-table-1', zoneId: 'seed-zone-1', name: 'Bàn 1', posX: 0.1, posY: 0.1, shape: 'square', sortOrder: 0, publicCode: 'T1-01' },
  { id: 'seed-table-2', zoneId: 'seed-zone-1', name: 'Bàn 2', posX: 0.35, posY: 0.1, shape: 'square', sortOrder: 1, publicCode: 'T1-02' },
  { id: 'seed-table-3', zoneId: 'seed-zone-1', name: 'Bàn 3', posX: 0.6, posY: 0.1, shape: 'square', sortOrder: 2, publicCode: 'T1-03', statusOverride: 'dat_truoc', note: 'Khách đặt trước' },
  { id: 'seed-table-4', zoneId: 'seed-zone-1', name: 'Bàn 4', posX: 0.85, posY: 0.1, shape: 'square', sortOrder: 3, publicCode: 'T1-04' },
  { id: 'seed-table-5', zoneId: 'seed-zone-1', name: 'Bàn 5', posX: 0.2, posY: 0.5, shape: 'round', sortOrder: 4, publicCode: 'T1-05' },
  { id: 'seed-table-6', zoneId: 'seed-zone-1', name: 'Bàn 6', posX: 0.55, posY: 0.5, shape: 'square', sortOrder: 5, publicCode: 'T1-06', status: 'dang_phuc_vu' },
  { id: 'seed-table-7', zoneId: 'seed-zone-2', name: 'Bàn 7', posX: 0.15, posY: 0.2, shape: 'square', sortOrder: 0, publicCode: 'T2-01' },
  { id: 'seed-table-8', zoneId: 'seed-zone-2', name: 'Bàn 8', posX: 0.5, posY: 0.2, shape: 'square', sortOrder: 1, publicCode: 'T2-02', status: 'can_don' },
  { id: 'seed-table-9', zoneId: 'seed-zone-2', name: 'Bàn 9', posX: 0.15, posY: 0.6, shape: 'square', sortOrder: 2, publicCode: 'T2-03' },
  { id: 'seed-table-10', zoneId: 'seed-zone-2', name: 'Bàn 10', posX: 0.5, posY: 0.6, shape: 'round', sortOrder: 3, publicCode: 'T2-04' },
  { id: 'seed-table-11', zoneId: 'seed-zone-garden', name: 'Bàn 11', posX: 0.2, posY: 0.3, shape: 'round', sortOrder: 0, publicCode: 'GV-01' },
  { id: 'seed-table-12', zoneId: 'seed-zone-garden', name: 'Bàn 12', posX: 0.6, posY: 0.3, shape: 'square', sortOrder: 1, publicCode: 'GV-02' },
]

const tableBlocks = [
  {
    id: 'seed-block-1', tableId: 'seed-table-8', kind: 'cleaning', reason: 'Dọn bàn',
    startsAt: NOW - 1 * 3600000, endsAt: NOW + 1 * 3600000,
    createdBy: 'seed-user-cashier', createdAt: NOW - 1 * 3600000,
  },
  {
    id: 'seed-block-2', tableId: 'seed-table-11', kind: 'maintenance', reason: 'Sửa ghế',
    startsAt: NOW - 2 * DAY, endsAt: NOW - 2 * DAY + 2 * 3600000,
    createdBy: 'seed-user-owner', resolvedBy: 'seed-user-owner',
    resolvedAt: NOW - 2 * DAY + 2 * 3600000 + 600000, createdAt: NOW - 2 * DAY,
  },
]

// ---------------------------------------------------------------------------
// Menu: categories, items, variants, modifiers, combos
// ---------------------------------------------------------------------------
const categories = [
  { id: 'seed-cat-coffee', name: 'Cà phê', sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-cat-tea', name: 'Trà', sortOrder: 1, updatedAt: NOW - 30 * DAY },
  { id: 'seed-cat-smoothie', name: 'Sinh tố', sortOrder: 2, updatedAt: NOW - 30 * DAY },
  { id: 'seed-cat-bakery', name: 'Bánh', sortOrder: 3, updatedAt: NOW - 30 * DAY },
  { id: 'seed-cat-combo', name: 'Combo', sortOrder: 4, updatedAt: NOW - 30 * DAY },
]

const menuItems = [
  { id: 'seed-item-espresso', categoryId: 'seed-cat-coffee', name: 'Espresso', description: 'Cà phê nguyên chất pha máy', sortOrder: 0, createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY },
  { id: 'seed-item-bacxiu', categoryId: 'seed-cat-coffee', name: 'Bạc xỉu', description: 'Cà phê pha sữa đặc', sortOrder: 1, createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY },
  { id: 'seed-item-capuchino', categoryId: 'seed-cat-coffee', name: 'Cappuccino', description: 'Espresso, sữa nóng và bọt sữa', sortOrder: 2, createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY },
  { id: 'seed-item-latte', categoryId: 'seed-cat-coffee', name: 'Cà phê sữa Latte', description: 'Espresso pha sữa tươi', sortOrder: 3, createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY },
  { id: 'seed-item-den-da', categoryId: 'seed-cat-coffee', name: 'Cà phê đen đá', description: 'Cà phê đen truyền thống', sortOrder: 4, createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY },
  { id: 'seed-item-sua-da', categoryId: 'seed-cat-coffee', name: 'Cà phê sữa đá', description: 'Cà phê pha sữa đặc', sortOrder: 5, createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY },
  { id: 'seed-item-tra-sen', categoryId: 'seed-cat-tea', name: 'Trà sen vàng', description: 'Trà ướp sen thơm dịu', sortOrder: 0, createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY },
  { id: 'seed-item-tra-dao', categoryId: 'seed-cat-tea', name: 'Trà đào cam sả', description: 'Trà đào mát lạnh', sortOrder: 1, createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY },
  { id: 'seed-item-tra-chanh', categoryId: 'seed-cat-tea', name: 'Trà chanh', description: 'Trà chanh giải khát', sortOrder: 2, createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY },
  { id: 'seed-item-matcha', categoryId: 'seed-cat-tea', name: 'Matcha latte', description: 'Trà xanh Nhật pha sữa', sortOrder: 3, createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY },
  { id: 'seed-item-xoai', categoryId: 'seed-cat-smoothie', name: 'Sinh tố xoài', description: 'Xoài tươi xay mịn', sortOrder: 0, createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY },
  { id: 'seed-item-bo', categoryId: 'seed-cat-smoothie', name: 'Sinh tố bơ', description: 'Bơ sáp xay cùng sữa tươi', sortOrder: 1, createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY },
  { id: 'seed-item-dau', categoryId: 'seed-cat-smoothie', name: 'Sinh tố dâu', description: 'Dâu tây xay cùng sữa', sortOrder: 2, createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY },
  { id: 'seed-item-tiramisu', categoryId: 'seed-cat-bakery', name: 'Tiramisu', description: 'Bánh kem phô mai mascarpone', sortOrder: 0, createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY },
  { id: 'seed-item-banh-mi', categoryId: 'seed-cat-bakery', name: 'Bánh mì bơ tỏi', description: 'Bánh mì nướng bơ tỏi', sortOrder: 1, createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY },
  { id: 'seed-item-croissant', categoryId: 'seed-cat-bakery', name: 'Croissant', description: 'Bánh sừng bò bơ Pháp', sortOrder: 2, createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY },
  { id: 'seed-item-muffin', categoryId: 'seed-cat-bakery', name: 'Muffin socola', description: 'Bánh nướng nhân socola', sortOrder: 3, createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY },
  { id: 'seed-item-combo-sang', categoryId: 'seed-cat-combo', name: 'Combo Bữa sáng', description: '1 cà phê sữa đá + 1 bánh mì bơ tỏi', kind: 'combo', sortOrder: 0, createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY },
]

const menuVariants = [
  { id: 'seed-var-espresso-single', menuItemId: 'seed-item-espresso', name: '1 tầng', price: 25000, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-espresso-double', menuItemId: 'seed-item-espresso', name: '2 tầng', price: 30000, sortOrder: 1, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-bacxiu', menuItemId: 'seed-item-bacxiu', name: 'Đá', price: 30000, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-capuchino-ice', menuItemId: 'seed-item-capuchino', name: 'Đá', price: 40000, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-capuchino-hot', menuItemId: 'seed-item-capuchino', name: 'Nóng', price: 38000, sortOrder: 1, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-latte-ice', menuItemId: 'seed-item-latte', name: 'Đá', price: 42000, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-latte-hot', menuItemId: 'seed-item-latte', name: 'Nóng', price: 40000, sortOrder: 1, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-den-da', menuItemId: 'seed-item-den-da', name: 'Đá', price: 25000, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-sua-da', menuItemId: 'seed-item-sua-da', name: 'Đá', price: 30000, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-tra-sen', menuItemId: 'seed-item-tra-sen', name: 'Đá', price: 35000, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-tra-dao', menuItemId: 'seed-item-tra-dao', name: 'Đá', price: 39000, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-tra-chanh', menuItemId: 'seed-item-tra-chanh', name: 'Đá', price: 29000, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-matcha-ice', menuItemId: 'seed-item-matcha', name: 'Đá', price: 45000, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-matcha-hot', menuItemId: 'seed-item-matcha', name: 'Nóng', price: 43000, sortOrder: 1, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-xoai', menuItemId: 'seed-item-xoai', name: 'Ly', price: 40000, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-bo', menuItemId: 'seed-item-bo', name: 'Ly', price: 45000, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-dau', menuItemId: 'seed-item-dau', name: 'Ly', price: 42000, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-tiramisu', menuItemId: 'seed-item-tiramisu', name: 'Phần', price: 55000, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-banh-mi', menuItemId: 'seed-item-banh-mi', name: 'Phần', price: 20000, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-croissant', menuItemId: 'seed-item-croissant', name: 'Phần', price: 25000, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-var-muffin', menuItemId: 'seed-item-muffin', name: 'Phần', price: 22000, sortOrder: 0, updatedAt: NOW - 30 * DAY },
]

const modifierGroups = [
  { id: 'seed-mg-sweet', name: 'Độ ngọt', minSelections: 0, maxSelections: 1, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-mg-ice', name: 'Lượng đá', minSelections: 0, maxSelections: 1, sortOrder: 1, updatedAt: NOW - 30 * DAY },
  { id: 'seed-mg-topping', name: 'Topping', minSelections: 0, maxSelections: 2, sortOrder: 3, updatedAt: NOW - 30 * DAY },
]

const modifiers = [
  { id: 'seed-mod-sweet-none', groupId: 'seed-mg-sweet', name: 'Không đường', priceDelta: 0, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-mod-sweet-less', groupId: 'seed-mg-sweet', name: 'Ít đường', priceDelta: 0, sortOrder: 1, updatedAt: NOW - 30 * DAY },
  { id: 'seed-mod-sweet-more', groupId: 'seed-mg-sweet', name: 'Nhiều đường', priceDelta: 0, sortOrder: 2, updatedAt: NOW - 30 * DAY },
  { id: 'seed-mod-ice-less', groupId: 'seed-mg-ice', name: 'Ít đá', priceDelta: 0, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-mod-ice-more', groupId: 'seed-mg-ice', name: 'Nhiều đá', priceDelta: 0, sortOrder: 1, updatedAt: NOW - 30 * DAY },
  { id: 'seed-mod-tranchau', groupId: 'seed-mg-topping', name: 'Trân châu', priceDelta: 5000, sortOrder: 0, updatedAt: NOW - 30 * DAY },
  { id: 'seed-mod-thach', groupId: 'seed-mg-topping', name: 'Thạch', priceDelta: 5000, sortOrder: 1, updatedAt: NOW - 30 * DAY },
  { id: 'seed-mod-kem', groupId: 'seed-mg-topping', name: 'Kem sữa', priceDelta: 8000, sortOrder: 2, updatedAt: NOW - 30 * DAY },
]

const variantModifierGroups = []
for (const variantId of [
  'seed-var-espresso-single', 'seed-var-espresso-double',
  'seed-var-bacxiu', 'seed-var-capuchino-ice', 'seed-var-capuchino-hot',
  'seed-var-latte-ice', 'seed-var-latte-hot',
  'seed-var-den-da', 'seed-var-sua-da',
  'seed-var-tra-sen', 'seed-var-tra-dao', 'seed-var-tra-chanh',
  'seed-var-matcha-ice', 'seed-var-matcha-hot',
]) {
  variantModifierGroups.push({ variantId, groupId: 'seed-mg-sweet' }, { variantId, groupId: 'seed-mg-ice' })
}
for (const variantId of ['seed-var-tra-sen', 'seed-var-tra-dao', 'seed-var-tra-chanh', 'seed-var-matcha-ice', 'seed-var-matcha-hot', 'seed-var-xoai', 'seed-var-bo', 'seed-var-dau']) {
  variantModifierGroups.push({ variantId, groupId: 'seed-mg-topping' })
}

const combos = [
  { id: 'seed-combo-sang', menuItemId: 'seed-item-combo-sang', price: 45000 },
]

const comboComponents = [
  { id: 'seed-cc-sang-1', comboId: 'seed-combo-sang', variantId: 'seed-var-sua-da', quantity: 1 },
  { id: 'seed-cc-sang-2', comboId: 'seed-combo-sang', variantId: 'seed-var-banh-mi', quantity: 1 },
]

// ---------------------------------------------------------------------------
// Inventory: ingredients, suppliers, recipes, lots, movements
// ---------------------------------------------------------------------------
const ingredients = [
  { id: 'seed-ing-coffee', name: 'Cà phê hạt', unit: 'kg', reorderPoint: 2, currentQuantity: 12 },
  { id: 'seed-ing-sua-dac', name: 'Sữa đặc', unit: 'kg', reorderPoint: 3, currentQuantity: 18 },
  { id: 'seed-ing-sua-tuoi', name: 'Sữa tươi', unit: 'lít', reorderPoint: 5, currentQuantity: 30 },
  { id: 'seed-ing-tra', name: 'Trà khô', unit: 'kg', reorderPoint: 1, currentQuantity: 6 },
  { id: 'seed-ing-duong', name: 'Đường', unit: 'kg', reorderPoint: 2, currentQuantity: 15 },
  { id: 'seed-ing-da', name: 'Đá viên', unit: 'kg', reorderPoint: 10, currentQuantity: 60 },
  { id: 'seed-ing-xoai', name: 'Xoài', unit: 'kg', reorderPoint: 2, currentQuantity: 8 },
  { id: 'seed-ing-bo', name: 'Bơ', unit: 'kg', reorderPoint: 1.5, currentQuantity: 5 },
  { id: 'seed-ing-dau', name: 'Dâu tây', unit: 'kg', reorderPoint: 1.5, currentQuantity: 4 },
  { id: 'seed-ing-dao', name: 'Đào hộp', unit: 'kg', reorderPoint: 1, currentQuantity: 3 },
  { id: 'seed-ing-chanh', name: 'Chanh', unit: 'kg', reorderPoint: 1, currentQuantity: 3 },
  { id: 'seed-ing-bot-mi', name: 'Bột mì', unit: 'kg', reorderPoint: 2, currentQuantity: 10 },
  { id: 'seed-ing-socola', name: 'Sô cô la', unit: 'kg', reorderPoint: 1, currentQuantity: 3.5 },
  { id: 'seed-ing-phomai', name: 'Phô mai mascarpone', unit: 'kg', reorderPoint: 1, currentQuantity: 2.5 },
  { id: 'seed-ing-matcha', name: 'Bột matcha', unit: 'kg', reorderPoint: 0.5, currentQuantity: 1.5 },
  { id: 'seed-ing-tranchau', name: 'Trân châu', unit: 'kg', reorderPoint: 1, currentQuantity: 5 },
  { id: 'seed-ing-thach', name: 'Thạch', unit: 'kg', reorderPoint: 1, currentQuantity: 4 },
  { id: 'seed-ing-kem', name: 'Kem sữa', unit: 'lít', reorderPoint: 1, currentQuantity: 3 },
]

const suppliers = [
  { id: 'seed-sup-coffee', name: 'Công ty Cà phê Đà Lạt', phone: '0912345678', note: 'Thanh toán cuối tháng' },
  { id: 'seed-sup-milk', name: 'Công ty Sữa Mộc Châu', phone: '0987654321', note: '' },
  { id: 'seed-sup-agri', name: 'Chợ đầu mối Nông sản', phone: '0905123456', note: 'Nhận buổi sáng' },
  { id: 'seed-sup-bakery', name: 'Đại lý Nguyên liệu Bánh', phone: '0934111222', note: '' },
]

const inventoryLots = [
  { id: 'seed-lot-coffee-1', ingredientId: 'seed-ing-coffee', supplierId: 'seed-sup-coffee', receivedAt: NOW - 15 * DAY, originalQuantity: 10, remainingQuantity: 9.5, unitCost: 150000 },
  { id: 'seed-lot-coffee-2', ingredientId: 'seed-ing-coffee', supplierId: 'seed-sup-coffee', receivedAt: NOW - 3 * DAY, originalQuantity: 5, remainingQuantity: 5, unitCost: 155000 },
  { id: 'seed-lot-sua-dac', ingredientId: 'seed-ing-sua-dac', supplierId: 'seed-sup-milk', receivedAt: NOW - 10 * DAY, originalQuantity: 20, remainingQuantity: 18, unitCost: 55000 },
  { id: 'seed-lot-sua-tuoi', ingredientId: 'seed-ing-sua-tuoi', supplierId: 'seed-sup-milk', receivedAt: NOW - 7 * DAY, originalQuantity: 30, remainingQuantity: 30, unitCost: 25000 },
  { id: 'seed-lot-tra', ingredientId: 'seed-ing-tra', supplierId: 'seed-sup-coffee', receivedAt: NOW - 12 * DAY, originalQuantity: 8, remainingQuantity: 6, unitCost: 120000 },
  { id: 'seed-lot-duong', ingredientId: 'seed-ing-duong', supplierId: 'seed-sup-agri', receivedAt: NOW - 20 * DAY, originalQuantity: 15, remainingQuantity: 15, unitCost: 22000 },
  { id: 'seed-lot-da', ingredientId: 'seed-ing-da', supplierId: 'seed-sup-agri', receivedAt: NOW - 1 * DAY, originalQuantity: 60, remainingQuantity: 60, unitCost: 3000 },
  { id: 'seed-lot-xoai', ingredientId: 'seed-ing-xoai', supplierId: 'seed-sup-agri', receivedAt: NOW - 4 * DAY, originalQuantity: 10, remainingQuantity: 8, unitCost: 30000 },
  { id: 'seed-lot-tranchau', ingredientId: 'seed-ing-tranchau', supplierId: 'seed-sup-bakery', receivedAt: NOW - 6 * DAY, originalQuantity: 5, remainingQuantity: 5, unitCost: 40000 },
  { id: 'seed-lot-phomai', ingredientId: 'seed-ing-phomai', supplierId: 'seed-sup-bakery', receivedAt: NOW - 8 * DAY, originalQuantity: 2.5, remainingQuantity: 2.5, unitCost: 120000 },
]

const inventoryMovements = [
  { id: 'seed-mv-1', ingredientId: 'seed-ing-coffee', lotId: 'seed-lot-coffee-1', type: 'receipt', quantityDelta: 10, unitCost: 150000, reason: 'Nhập kho', actorId: 'seed-user-owner', createdAt: NOW - 15 * DAY },
  { id: 'seed-mv-2', ingredientId: 'seed-ing-coffee', lotId: 'seed-lot-coffee-2', type: 'receipt', quantityDelta: 5, unitCost: 155000, reason: 'Nhập kho', actorId: 'seed-user-owner', createdAt: NOW - 3 * DAY },
  { id: 'seed-mv-3', ingredientId: 'seed-ing-sua-dac', lotId: 'seed-lot-sua-dac', type: 'receipt', quantityDelta: 20, unitCost: 55000, reason: 'Nhập kho', actorId: 'seed-user-owner', createdAt: NOW - 10 * DAY },
  { id: 'seed-mv-4', ingredientId: 'seed-ing-sua-tuoi', lotId: 'seed-lot-sua-tuoi', type: 'receipt', quantityDelta: 30, unitCost: 25000, reason: 'Nhập kho', actorId: 'seed-user-owner', createdAt: NOW - 7 * DAY },
  { id: 'seed-mv-5', ingredientId: 'seed-ing-tra', lotId: 'seed-lot-tra', type: 'receipt', quantityDelta: 8, unitCost: 120000, reason: 'Nhập kho', actorId: 'seed-user-owner', createdAt: NOW - 12 * DAY },
  { id: 'seed-mv-6', ingredientId: 'seed-ing-duong', lotId: 'seed-lot-duong', type: 'receipt', quantityDelta: 15, unitCost: 22000, reason: 'Nhập kho', actorId: 'seed-user-owner', createdAt: NOW - 20 * DAY },
  { id: 'seed-mv-7', ingredientId: 'seed-ing-da', lotId: 'seed-lot-da', type: 'receipt', quantityDelta: 60, unitCost: 3000, reason: 'Nhập kho', actorId: 'seed-user-owner', createdAt: NOW - 1 * DAY },
  { id: 'seed-mv-8', ingredientId: 'seed-ing-xoai', lotId: 'seed-lot-xoai', type: 'receipt', quantityDelta: 10, unitCost: 30000, reason: 'Nhập kho', actorId: 'seed-user-owner', createdAt: NOW - 4 * DAY },
  { id: 'seed-mv-9', ingredientId: 'seed-ing-tranchau', lotId: 'seed-lot-tranchau', type: 'receipt', quantityDelta: 5, unitCost: 40000, reason: 'Nhập kho', actorId: 'seed-user-owner', createdAt: NOW - 6 * DAY },
  { id: 'seed-mv-10', ingredientId: 'seed-ing-phomai', lotId: 'seed-lot-phomai', type: 'receipt', quantityDelta: 2.5, unitCost: 120000, reason: 'Nhập kho', actorId: 'seed-user-owner', createdAt: NOW - 8 * DAY },
]

// ---------------------------------------------------------------------------
// Orders, lines, payments, discounts
// ---------------------------------------------------------------------------
const orderLine = (id, orderId, menuItemId, variantId, name, variant, unitPrice, quantity) => ({
  id, orderId, menuItemId, variantId, nameSnapshot: name, variantSnapshot: variant,
  recipeSnapshot: '[]', unitPrice, quantity, lineTotal: unitPrice * quantity,
})

// Display numbers are per business day (Asia/Ho_Chi_Minh) — the same rule the
// server uses in `reserveOrderNumber`.
const businessDate = (timestamp) => new Date(timestamp + 7 * 3600000).toISOString().slice(0, 10)

const orders = [
  {
    id: 'seed-order-1', orderCode: 'POS-20260815-001', idempotencyKey: 'seed-ik-1', source: 'counter',
    status: 'paid', kdsStatus: 'served', version: 1, subtotal: 60000, discountAmount: 0,
    total: 60000, cogs: 16000, createdBy: 'seed-user-cashier', paidAt: NOW - 4 * 3600000,
    createdAt: NOW - 4 * 3600000, updatedAt: NOW - 4 * 3600000,
    lines: [orderLine('seed-line-1-1', 'seed-order-1', 'seed-item-sua-da', 'seed-var-sua-da', 'Cà phê sữa đá', 'Đá', 30000, 2)],
  },
  {
    id: 'seed-order-2', orderCode: 'POS-20260815-002', idempotencyKey: 'seed-ik-2', source: 'table',
    tableId: 'seed-table-6', status: 'paid', kdsStatus: 'making', kdsUpdatedAt: NOW - 2 * 3600000,
    version: 1, subtotal: 136000, discountAmount: 0, total: 136000, cogs: 28000,
    createdBy: 'seed-user-cashier', paidAt: NOW - 3 * 3600000, createdAt: NOW - 3 * 3600000,
    updatedAt: NOW - 2 * 3600000,
    lines: [
      orderLine('seed-line-2-1', 'seed-order-2', 'seed-item-latte', 'seed-var-latte-ice', 'Cà phê sữa Latte', 'Đá', 42000, 1),
      orderLine('seed-line-2-2', 'seed-order-2', 'seed-item-tra-dao', 'seed-var-tra-dao', 'Trà đào cam sả', 'Đá', 39000, 1),
      orderLine('seed-line-2-3', 'seed-order-2', 'seed-item-tiramisu', 'seed-var-tiramisu', 'Tiramisu', 'Phần', 55000, 1),
    ],
  },
  {
    id: 'seed-order-3', orderCode: 'POS-20260814-003', idempotencyKey: 'seed-ik-3', source: 'takeaway',
    status: 'paid', kdsStatus: 'served', version: 1, subtotal: 82000, discountAmount: 5000,
    total: 77000, cogs: 18000, createdBy: 'seed-user-cashier', paidAt: NOW - 1 * DAY - 6 * 3600000,
    createdAt: NOW - 1 * DAY - 6 * 3600000, updatedAt: NOW - 1 * DAY - 6 * 3600000,
    discount: { type: 'fixed', value: 5000, reason: 'Khuyến mãi khách hàng thân thiết' },
    lines: [
      orderLine('seed-line-3-1', 'seed-order-3', 'seed-item-espresso', 'seed-var-espresso-double', 'Espresso', '2 tầng', 30000, 2),
      orderLine('seed-line-3-2', 'seed-order-3', 'seed-item-muffin', 'seed-var-muffin', 'Muffin socola', 'Phần', 22000, 1),
    ],
  },
  {
    id: 'seed-order-4', orderCode: 'B-1130-ABC123', idempotencyKey: 'seed-ik-4', source: 'table',
    tableId: 'seed-table-5', status: 'draft', kdsStatus: 'new', version: 1,
    subtotal: 54000, discountAmount: 0, total: 54000, cogs: 0,
    createdBy: 'seed-user-cashier', createdAt: NOW - 1 * 3600000, updatedAt: NOW - 1 * 3600000,
    lines: [
      orderLine('seed-line-4-1', 'seed-order-4', 'seed-item-tra-chanh', 'seed-var-tra-chanh', 'Trà chanh', 'Đá', 29000, 1),
      orderLine('seed-line-4-2', 'seed-order-4', 'seed-item-croissant', 'seed-var-croissant', 'Croissant', 'Phần', 25000, 1),
    ],
  },
  {
    id: 'seed-order-5', orderCode: 'POS-20260814-004', idempotencyKey: 'seed-ik-5', source: 'counter',
    status: 'paid', kdsStatus: 'served', version: 1, subtotal: 100000, discountAmount: 0,
    total: 100000, cogs: 22000, createdBy: 'seed-user-cashier', paidAt: NOW - 1 * DAY - 13 * 3600000,
    createdAt: NOW - 1 * DAY - 13 * 3600000, updatedAt: NOW - 1 * DAY - 13 * 3600000,
    lines: [
      orderLine('seed-line-5-1', 'seed-order-5', 'seed-item-bacxiu', 'seed-var-bacxiu', 'Bạc xỉu', 'Đá', 30000, 2),
      orderLine('seed-line-5-2', 'seed-order-5', 'seed-item-banh-mi', 'seed-var-banh-mi', 'Bánh mì bơ tỏi', 'Phần', 20000, 2),
    ],
  },
]

const displayByDate = new Map()
for (const order of orders) {
  order.businessDate = businessDate(order.createdAt)
  order.displayNumber = (displayByDate.get(order.businessDate) ?? 0) + 1
  displayByDate.set(order.businessDate, order.displayNumber)
}

const orderCounters = [...displayByDate.entries()].map(([date, maxNumber]) => ({
  businessDate: date,
  nextNumber: maxNumber + 1,
}))

const payments = orders
  .filter((order) => order.status !== 'draft')
  .map((order) => ({
    id: `seed-pay-${order.id}`,
    orderId: order.id,
    method: 'cash',
    amount: order.total,
    receivedAmount: order.total,
    changeAmount: 0,
    createdAt: order.paidAt,
  }))

const orderDiscounts = orders
  .filter((order) => order.discount)
  .map((order) => ({
    id: `seed-disc-${order.id}`,
    orderId: order.id,
    type: order.discount.type,
    value: order.discount.value,
    amount: order.discountAmount,
    reason: order.discount.reason,
    actorId: 'seed-user-cashier',
    createdAt: order.paidAt,
  }))

const offlineSyncRecords = orders
  .filter((order) => order.status !== 'draft')
  .map((order) => ({
    idempotencyKey: order.idempotencyKey,
    orderId: order.id,
    deviceId: 'seed-device-pos-1',
    syncedAt: order.paidAt,
  }))

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------
const reservations = [
  {
    id: 'seed-res-1', customerName: 'Nguyễn Văn An', customerPhone: '0911111111', partySize: 4,
    startsAt: NOW + 5 * 3600000, endsAt: NOW + 7 * 3600000, status: 'confirmed', note: 'Bàn gần cửa sổ',
    createdBy: 'seed-user-cashier', updatedBy: 'seed-user-cashier',
    createdAt: NOW - 1 * DAY, updatedAt: NOW - 1 * DAY,
    tableIds: ['seed-table-3'],
  },
  {
    id: 'seed-res-2', customerName: 'Trần Thị Bích', customerPhone: '0922222222', partySize: 2,
    startsAt: NOW + 1 * DAY + 5 * 3600000, endsAt: NOW + 1 * DAY + 7 * 3600000, status: 'pending', note: '',
    createdBy: 'seed-user-cashier', updatedBy: 'seed-user-cashier',
    createdAt: NOW - 5 * 3600000, updatedAt: NOW - 5 * 3600000,
    tableIds: ['seed-table-7'],
  },
  {
    id: 'seed-res-3', customerName: 'Lê Văn Hùng', customerPhone: '0933333333', partySize: 6,
    startsAt: NOW - 3 * DAY - 6 * 3600000, endsAt: NOW - 3 * DAY - 4 * 3600000, status: 'completed', note: 'Kỷ niệm',
    createdBy: 'seed-user-cashier', updatedBy: 'seed-user-cashier',
    createdAt: NOW - 5 * DAY, updatedAt: NOW - 3 * DAY - 4 * 3600000,
    tableIds: ['seed-table-4', 'seed-table-5'],
  },
]

const reservationTables = reservations.flatMap((reservation) =>
  reservation.tableIds.map((tableId) => ({ reservationId: reservation.id, tableId })),
)

// ---------------------------------------------------------------------------
// Staff: time entries, hourly rates, payroll
// ---------------------------------------------------------------------------
const timeEntries = [
  { id: 'seed-time-1', userId: 'seed-user-cashier', checkInAt: NOW - 5 * 3600000, note: '' },
  { id: 'seed-time-2', userId: 'seed-user-barista', checkInAt: NOW - 4.5 * 3600000, note: '' },
  {
    id: 'seed-time-3', userId: 'seed-user-stock', checkInAt: NOW - 4 * 3600000,
    checkOutAt: NOW - 1 * 3600000, approvedBy: 'seed-user-owner', approvedAt: NOW - 1 * 3600000, note: 'Đã duyệt',
  },
  {
    id: 'seed-time-4', userId: 'seed-user-cashier', checkInAt: NOW - 1 * DAY - 13 * 3600000,
    checkOutAt: NOW - 1 * DAY - 1 * 3600000, approvedBy: 'seed-user-owner', approvedAt: NOW - 1 * DAY, note: '',
  },
]

const hourlyRateHistory = [
  { id: 'seed-rate-1', userId: 'seed-user-cashier', hourlyRate: 25000, effectiveAt: NOW - 30 * DAY, createdBy: 'seed-user-owner' },
  { id: 'seed-rate-2', userId: 'seed-user-barista', hourlyRate: 26000, effectiveAt: NOW - 30 * DAY, createdBy: 'seed-user-owner' },
  { id: 'seed-rate-3', userId: 'seed-user-stock', hourlyRate: 28000, effectiveAt: NOW - 30 * DAY, createdBy: 'seed-user-owner' },
]

const payrollPeriods = [
  {
    id: 'seed-period-prev', startsOn: '2026-08-03', endsOn: '2026-08-09',
    status: 'closed', closedBy: 'seed-user-owner', closedAt: NOW - 6 * DAY,
  },
  { id: 'seed-period-open', startsOn: '2026-08-10', endsOn: '2026-08-16', status: 'open' },
]

const payrollEntries = [
  { id: 'seed-pe-1', periodId: 'seed-period-prev', userId: 'seed-user-cashier', minutesWorked: 2400, hourlyRateSnapshot: 25000, grossPay: 1000000 },
  { id: 'seed-pe-2', periodId: 'seed-period-prev', userId: 'seed-user-barista', minutesWorked: 2280, hourlyRateSnapshot: 26000, grossPay: 988000 },
]

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------
const auditLogs = [
  { id: 'seed-audit-1', actorId: 'seed-user-cashier', entityType: 'order', entityId: 'seed-order-1', action: 'cash_checkout', detailJson: JSON.stringify({ orderCode: 'POS-20260815-001', subtotal: 60000, discountAmount: 0, total: 60000, cogs: 16000, inventoryVariance: false }), createdAt: NOW - 4 * 3600000 },
  { id: 'seed-audit-2', actorId: 'seed-user-cashier', entityType: 'order', entityId: 'seed-order-2', action: 'cash_checkout', detailJson: JSON.stringify({ orderCode: 'POS-20260815-002', subtotal: 136000, discountAmount: 0, total: 136000, cogs: 28000, inventoryVariance: false }), createdAt: NOW - 3 * 3600000 },
  { id: 'seed-audit-3', actorId: 'seed-user-cashier', entityType: 'order', entityId: 'seed-order-3', action: 'cash_checkout', detailJson: JSON.stringify({ orderCode: 'POS-20260814-003', subtotal: 82000, discountAmount: 5000, total: 77000, cogs: 18000, inventoryVariance: false }), createdAt: NOW - 1 * DAY - 6 * 3600000 },
  { id: 'seed-audit-4', actorId: 'seed-user-cashier', entityType: 'order', entityId: 'seed-order-4', action: 'draft_created', detailJson: JSON.stringify({ source: 'table', tableId: 'seed-table-5', subtotal: 54000 }), createdAt: NOW - 1 * 3600000 },
  { id: 'seed-audit-5', actorId: 'seed-user-cashier', entityType: 'order', entityId: 'seed-order-2', action: 'kds_status_changed', detailJson: JSON.stringify({ orderCode: 'POS-20260815-002', from: 'new', to: 'making' }), createdAt: NOW - 2 * 3600000 },
  { id: 'seed-audit-6', actorId: 'seed-user-cashier', entityType: 'reservation', entityId: 'seed-res-1', action: 'reservation_created', detailJson: JSON.stringify({ customerName: 'Nguyễn Văn An', partySize: 4 }), createdAt: NOW - 1 * DAY },
]

// ---------------------------------------------------------------------------
// Cleanup (idempotent re-run) — delete seed rows in FK-safe order
// ---------------------------------------------------------------------------
const cleanup = `
DELETE FROM offline_sync_records;
DELETE FROM order_line_modifiers;
DELETE FROM order_discounts;
DELETE FROM order_lines;
DELETE FROM payments;
DELETE FROM order_refunds;
DELETE FROM orders;
DELETE FROM reservation_tables;
DELETE FROM reservations;
DELETE FROM table_blocks;
DELETE FROM inventory_movements;
DELETE FROM inventory_lots;
DELETE FROM combo_components;
DELETE FROM combos;
DELETE FROM variant_modifier_groups;
DELETE FROM modifiers;
DELETE FROM modifier_groups;
DELETE FROM menu_variant_price_history;
DELETE FROM menu_variants;
DELETE FROM menu_items;
DELETE FROM categories;
DELETE FROM suppliers;
DELETE FROM ingredients;
DELETE FROM time_entries;
DELETE FROM hourly_rate_history;
DELETE FROM payroll_entries;
DELETE FROM payroll_periods;
DELETE FROM user_permissions;
DELETE FROM permissions;
DELETE FROM users;
DELETE FROM "tables";
DELETE FROM zones;
DELETE FROM audit_logs;
DELETE FROM daily_order_counters;
`

// ---------------------------------------------------------------------------
// Assemble output
// ---------------------------------------------------------------------------
const output = async () => {
  const passwordHash = await hashPassword('123456')

  const sql = [
    '-- Tomny Coffee · local seed data',
    `-- Generated ${new Date().toISOString()}`,
    'PRAGMA foreign_keys = ON;',
    cleanup,
    insert('users', ['id', 'email', 'display_name', 'password_hash', 'active', 'created_at', 'updated_at'], users.map((user) => ({ ...user, passwordHash, active: true, createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY }))),
    insert('permissions', ['id', 'code', 'label'], permissions),
    insert('user_permissions', ['user_id', 'permission_id', 'granted_at'], userPermissions),
    insert('zones', ['id', 'name', 'active', 'sort_order'], zones.map((zone) => ({ ...zone, active: true }))),
    insert('"tables"', ['id', 'zone_id', 'name', 'pos_x', 'pos_y', 'shape', 'status', 'active', 'sort_order', 'status_override', 'public_code', 'note', 'created_at', 'updated_at'], tables.map((table) => ({ ...table, status: table.status ?? 'trong', active: true, note: table.note ?? '', createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY }))),
    insert('table_blocks', ['id', 'table_id', 'kind', 'reason', 'starts_at', 'ends_at', 'created_by', 'resolved_by', 'resolved_at', 'created_at'], tableBlocks),
    insert('categories', ['id', 'name', 'sort_order', 'active', 'updated_at'], categories.map((category) => ({ ...category, active: true }))),
    insert('menu_items', ['id', 'category_id', 'name', 'description', 'active', 'kind', 'sort_order', 'created_at', 'updated_at'], menuItems.map((item) => ({ ...item, active: true, kind: item.kind ?? 'standard' }))),
    insert('menu_variants', ['id', 'menu_item_id', 'name', 'price', 'active', 'sort_order', 'updated_at'], menuVariants.map((variant) => ({ ...variant, active: true }))),
    insert('modifier_groups', ['id', 'name', 'min_selections', 'max_selections', 'active', 'sort_order', 'updated_at'], modifierGroups.map((group) => ({ ...group, active: true }))),
    insert('modifiers', ['id', 'group_id', 'name', 'price_delta', 'active', 'sort_order', 'updated_at'], modifiers.map((modifier) => ({ ...modifier, active: true }))),
    insert('variant_modifier_groups', ['variant_id', 'group_id'], variantModifierGroups),
    insert('combos', ['id', 'menu_item_id', 'price', 'active'], combos.map((combo) => ({ ...combo, active: true }))),
    insert('combo_components', ['id', 'combo_id', 'variant_id', 'quantity'], comboComponents),
    insert('ingredients', ['id', 'name', 'unit', 'reorder_point', 'current_quantity', 'active'], ingredients.map((ingredient) => ({ ...ingredient, active: true }))),
    insert('suppliers', ['id', 'name', 'phone', 'note', 'active'], suppliers.map((supplier) => ({ ...supplier, active: true }))),
    insert('inventory_lots', ['id', 'ingredient_id', 'supplier_id', 'received_at', 'expires_at', 'original_quantity', 'remaining_quantity', 'unit_cost', 'note'], inventoryLots.map((lot) => ({ ...lot, note: '' }))),
    insert('inventory_movements', ['id', 'ingredient_id', 'lot_id', 'type', 'quantity_delta', 'unit_cost', 'reason', 'actor_id', 'created_at'], inventoryMovements),
    insert('orders', ['id', 'order_code', 'idempotency_key', 'source', 'table_id', 'note', 'status', 'kds_status', 'kds_updated_at', 'version', 'subtotal', 'discount_amount', 'total', 'cogs', 'created_by', 'paid_at', 'business_date', 'display_number', 'created_at', 'updated_at'], orders.map((order) => ({ ...order, note: order.note ?? '' }))),
    insert('daily_order_counters', ['business_date', 'next_number'], orderCounters),
    insert('order_lines', ['id', 'order_id', 'menu_item_id', 'variant_id', 'name_snapshot', 'variant_snapshot', 'recipe_snapshot', 'unit_price', 'quantity', 'line_total'], orders.flatMap((order) => order.lines)),
    insert('order_discounts', ['id', 'order_id', 'type', 'value', 'amount', 'reason', 'actor_id', 'created_at'], orderDiscounts),
    insert('payments', ['id', 'order_id', 'method', 'amount', 'received_amount', 'change_amount', 'created_at'], payments),
    insert('offline_sync_records', ['idempotency_key', 'order_id', 'device_id', 'synced_at'], offlineSyncRecords),
    insert('reservations', ['id', 'customer_name', 'customer_phone', 'party_size', 'starts_at', 'ends_at', 'status', 'note', 'created_by', 'updated_by', 'created_at', 'updated_at'], reservations.map((reservation) => ({ ...reservation, note: reservation.note ?? '' }))),
    insert('reservation_tables', ['reservation_id', 'table_id'], reservationTables),
    insert('time_entries', ['id', 'user_id', 'check_in_at', 'check_out_at', 'approved_by', 'approved_at', 'note'], timeEntries),
    insert('hourly_rate_history', ['id', 'user_id', 'hourly_rate', 'effective_at', 'created_by'], hourlyRateHistory),
    insert('payroll_periods', ['id', 'starts_on', 'ends_on', 'status', 'closed_by', 'closed_at'], payrollPeriods),
    insert('payroll_entries', ['id', 'period_id', 'user_id', 'minutes_worked', 'hourly_rate_snapshot', 'gross_pay', 'adjustment', 'note'], payrollEntries.map((entry) => ({ ...entry, adjustment: 0, note: '' }))),
    insert('audit_logs', ['id', 'actor_id', 'entity_type', 'entity_id', 'action', 'detail_json', 'created_at'], auditLogs),
  ].join('\n')

  process.stdout.write(sql + '\n')
}

output().catch((error) => {
  console.error(error)
  process.exit(1)
})