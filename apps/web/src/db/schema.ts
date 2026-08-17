import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email'),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})
export const permissions = sqliteTable('permissions', { id: text('id').primaryKey(), code: text('code').notNull().unique(), label: text('label').notNull() })
export const userPermissions = sqliteTable('user_permissions', { userId: text('user_id').notNull().references(() => users.id), permissionId: text('permission_id').notNull().references(() => permissions.id), grantedAt: integer('granted_at', { mode: 'timestamp' }).notNull() }, (table) => [uniqueIndex('user_permissions_unique').on(table.userId, table.permissionId)])
export const sessions = sqliteTable('sessions', { id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => users.id), tokenHash: text('token_hash').notNull().unique(), expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(), createdAt: integer('created_at', { mode: 'timestamp' }).notNull() }, (table) => [index('sessions_token_hash_idx').on(table.tokenHash)])
export const invites = sqliteTable('invites', { id: text('id').primaryKey(), email: text('email').notNull(), displayName: text('display_name').notNull().default(''), tokenHash: text('token_hash').notNull().unique(), permissionsJson: text('permissions_json').notNull(), expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(), acceptedAt: integer('accepted_at', { mode: 'timestamp' }), createdBy: text('created_by').notNull().references(() => users.id) })

// Zones are a lightweight grouping for the table list (for example, Tầng 1 or
// Sân vườn). They deliberately do not carry any visual-layout state.
export const zones = sqliteTable('zones', { id: text('id').primaryKey(), name: text('name').notNull(), active: integer('active', { mode: 'boolean' }).notNull().default(true), sortOrder: integer('sort_order').notNull().default(0) })
export const tables = sqliteTable('tables', { id: text('id').primaryKey(), zoneId: text('zone_id').references(() => zones.id), name: text('name').notNull(), posX: real('pos_x').notNull().default(0), posY: real('pos_y').notNull().default(0), shape: text('shape', { enum: ['square', 'round'] }).notNull().default('square'), status: text('status', { enum: ['trong', 'dang_phuc_vu', 'dat_truoc', 'can_don'] }).notNull().default('trong'), active: integer('active', { mode: 'boolean' }).notNull().default(true), sortOrder: integer('sort_order').notNull().default(0), statusOverride: text('status_override', { enum: ['dat_truoc', 'can_don'] }), publicCode: text('public_code'), note: text('note').notNull().default(''), createdAt: integer('created_at', { mode: 'timestamp' }), updatedAt: integer('updated_at', { mode: 'timestamp' }) }, (table) => [uniqueIndex('tables_zone_name_unique').on(table.zoneId, table.name), uniqueIndex('tables_public_code_unique').on(table.publicCode)])

export const reservations = sqliteTable('reservations', {
  id: text('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone'),
  partySize: integer('party_size').notNull().default(2),
  startsAt: integer('starts_at', { mode: 'timestamp' }).notNull(),
  endsAt: integer('ends_at', { mode: 'timestamp' }).notNull(),
  status: text('status', { enum: ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'] }).notNull().default('confirmed'),
  note: text('note').notNull().default(''),
  createdBy: text('created_by').notNull().references(() => users.id),
  updatedBy: text('updated_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [index('reservations_window_idx').on(table.startsAt, table.endsAt, table.status), index('reservations_status_idx').on(table.status, table.startsAt)])

export const reservationTables = sqliteTable('reservation_tables', {
  reservationId: text('reservation_id').notNull().references(() => reservations.id),
  tableId: text('table_id').notNull().references(() => tables.id),
}, (table) => [uniqueIndex('reservation_tables_unique').on(table.reservationId, table.tableId), index('reservation_tables_table_idx').on(table.tableId, table.reservationId)])

export const orderTables = sqliteTable('order_tables', {
  orderId: text('order_id').notNull().references(() => orders.id),
  tableId: text('table_id').notNull().references(() => tables.id),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(true),
  linkedAt: integer('linked_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.orderId, table.tableId] }),
  index('order_tables_table_idx').on(table.tableId, table.orderId),
  index('order_tables_order_idx').on(table.orderId),
])


export const tableBlocks = sqliteTable('table_blocks', {
  id: text('id').primaryKey(),
  tableId: text('table_id').notNull().references(() => tables.id),
  kind: text('kind', { enum: ['reserved_hold', 'cleaning', 'maintenance'] }).notNull(),
  reason: text('reason').notNull().default(''),
  startsAt: integer('starts_at', { mode: 'timestamp' }).notNull(),
  endsAt: integer('ends_at', { mode: 'timestamp' }),
  createdBy: text('created_by').notNull().references(() => users.id),
  resolvedBy: text('resolved_by').references(() => users.id),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [index('table_blocks_active_idx').on(table.tableId, table.endsAt, table.resolvedAt), index('table_blocks_kind_idx').on(table.kind, table.startsAt)])

export const categories = sqliteTable('categories', { id: text('id').primaryKey(), name: text('name').notNull(), sortOrder: integer('sort_order').notNull().default(0), active: integer('active', { mode: 'boolean' }).notNull().default(true), updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull() }, (table) => [uniqueIndex('categories_name_unique').on(table.name)])
export const menuItems = sqliteTable('menu_items', { id: text('id').primaryKey(), categoryId: text('category_id').references(() => categories.id), name: text('name').notNull(), description: text('description').notNull().default(''), imageKey: text('image_key'), active: integer('active', { mode: 'boolean' }).notNull().default(true), kind: text('kind', { enum: ['standard', 'combo'] }).notNull().default('standard'), sortOrder: integer('sort_order').notNull().default(0), createdAt: integer('created_at', { mode: 'timestamp' }).notNull(), updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull() })
export const menuVariants = sqliteTable('menu_variants', { id: text('id').primaryKey(), menuItemId: text('menu_item_id').notNull().references(() => menuItems.id), name: text('name').notNull(), price: integer('price').notNull(), active: integer('active', { mode: 'boolean' }).notNull().default(true), sortOrder: integer('sort_order').notNull().default(0), updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull() }, (table) => [uniqueIndex('menu_variants_item_name_unique').on(table.menuItemId, table.name), index('menu_variants_item_idx').on(table.menuItemId)])
export const modifierGroups = sqliteTable('modifier_groups', { id: text('id').primaryKey(), name: text('name').notNull(), minSelections: integer('min_selections').notNull().default(0), maxSelections: integer('max_selections').notNull().default(1), active: integer('active', { mode: 'boolean' }).notNull().default(true), sortOrder: integer('sort_order').notNull().default(0), updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date(0)) })
export const modifiers = sqliteTable('modifiers', { id: text('id').primaryKey(), groupId: text('group_id').notNull().references(() => modifierGroups.id), name: text('name').notNull(), priceDelta: integer('price_delta').notNull().default(0), active: integer('active', { mode: 'boolean' }).notNull().default(true), sortOrder: integer('sort_order').notNull().default(0), updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date(0)) }, (table) => [index('modifiers_group_idx').on(table.groupId)])
export const variantModifierGroups = sqliteTable('variant_modifier_groups', { variantId: text('variant_id').notNull().references(() => menuVariants.id), groupId: text('group_id').notNull().references(() => modifierGroups.id) }, (table) => [uniqueIndex('variant_modifier_groups_unique').on(table.variantId, table.groupId), index('variant_modifier_groups_group_idx').on(table.groupId)])
export const combos = sqliteTable('combos', { id: text('id').primaryKey(), menuItemId: text('menu_item_id').notNull().references(() => menuItems.id), price: integer('price').notNull(), active: integer('active', { mode: 'boolean' }).notNull().default(true) })
export const comboComponents = sqliteTable('combo_components', { id: text('id').primaryKey(), comboId: text('combo_id').notNull().references(() => combos.id), variantId: text('variant_id').notNull().references(() => menuVariants.id), quantity: integer('quantity').notNull().default(1) })

export const ingredients = sqliteTable('ingredients', { id: text('id').primaryKey(), name: text('name').notNull().unique(), unit: text('unit').notNull(), reorderPoint: real('reorder_point').notNull().default(0), currentQuantity: real('current_quantity').notNull().default(0), active: integer('active', { mode: 'boolean' }).notNull().default(true) })
export const suppliers = sqliteTable('suppliers', { id: text('id').primaryKey(), name: text('name').notNull().unique(), phone: text('phone'), note: text('note').notNull().default(''), active: integer('active', { mode: 'boolean' }).notNull().default(true) })
export const inventoryLots = sqliteTable('inventory_lots', { id: text('id').primaryKey(), ingredientId: text('ingredient_id').notNull().references(() => ingredients.id), supplierId: text('supplier_id').references(() => suppliers.id), receivedAt: integer('received_at', { mode: 'timestamp' }).notNull(), expiresAt: integer('expires_at', { mode: 'timestamp' }), originalQuantity: real('original_quantity').notNull(), remainingQuantity: real('remaining_quantity').notNull(), unitCost: integer('unit_cost').notNull(), note: text('note').notNull().default('') }, (table) => [index('inventory_lots_fifo_idx').on(table.ingredientId, table.receivedAt)])
export const inventoryMovements = sqliteTable('inventory_movements', { id: text('id').primaryKey(), ingredientId: text('ingredient_id').notNull().references(() => ingredients.id), lotId: text('lot_id').references(() => inventoryLots.id), orderId: text('order_id'), type: text('type', { enum: ['receipt', 'sale', 'stocktake', 'adjustment', 'variance'] }).notNull(), quantityDelta: real('quantity_delta').notNull(), unitCost: integer('unit_cost'), reason: text('reason').notNull().default(''), actorId: text('actor_id').notNull().references(() => users.id), createdAt: integer('created_at', { mode: 'timestamp' }).notNull() }, (table) => [index('inventory_movements_ingredient_idx').on(table.ingredientId, table.createdAt)])

export const orders = sqliteTable('orders', { id: text('id').primaryKey(), orderCode: text('order_code').notNull().unique(), businessDate: text('business_date').notNull(), displayNumber: integer('display_number').notNull(), idempotencyKey: text('idempotency_key').notNull().unique(), source: text('source', { enum: ['counter', 'takeaway', 'table'] }).notNull(), tableId: text('table_id').references(() => tables.id), note: text('note').notNull().default(''), status: text('status', { enum: ['draft', 'paid', 'cancelled'] }).notNull(), kdsStatus: text('kds_status', { enum: ['new', 'making', 'ready', 'served'] }).notNull().default('new'), kdsUpdatedAt: integer('kds_updated_at', { mode: 'timestamp' }), version: integer('version').notNull().default(1), subtotal: integer('subtotal').notNull(), discountAmount: integer('discount_amount').notNull().default(0), total: integer('total').notNull(), cogs: integer('cogs').notNull().default(0), createdBy: text('created_by').notNull().references(() => users.id), paidAt: integer('paid_at', { mode: 'timestamp' }), cancelReason: text('cancel_reason'), cancelledBy: text('cancelled_by').references(() => users.id), cancelledAt: integer('cancelled_at', { mode: 'timestamp' }), mergedIntoOrderId: text('merged_into_order_id'), createdAt: integer('created_at', { mode: 'timestamp' }).notNull(), updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull() }, (table) => [uniqueIndex('orders_business_display_unique').on(table.businessDate, table.displayNumber), index('orders_table_status_idx').on(table.tableId, table.status), index('orders_status_updated_idx').on(table.status, table.updatedAt), index('orders_created_at_idx').on(table.createdAt), index('orders_kds_idx').on(table.kdsStatus, table.updatedAt)])
export const orderLines = sqliteTable('order_lines', { id: text('id').primaryKey(), orderId: text('order_id').notNull().references(() => orders.id), menuItemId: text('menu_item_id'), variantId: text('variant_id'), nameSnapshot: text('name_snapshot').notNull(), variantSnapshot: text('variant_snapshot').notNull(), recipeSnapshot: text('recipe_snapshot').notNull(), comboSnapshot: text('combo_snapshot').notNull().default('[]'), unitPrice: integer('unit_price').notNull(), quantity: integer('quantity').notNull(), lineTotal: integer('line_total').notNull(), lineStatus: text('line_status', { enum: ['active', 'cancelled', 'transferred'] }).notNull().default('active'), replacedLineId: text('replaced_line_id'), cancelReason: text('cancel_reason'), cancelledBy: text('cancelled_by').references(() => users.id), cancelledAt: integer('cancelled_at', { mode: 'timestamp' }), approvedBy: text('approved_by').references(() => users.id) }, (table) => [index('order_lines_order_status_idx').on(table.orderId, table.lineStatus)])
export const dailyOrderCounters = sqliteTable('daily_order_counters', { businessDate: text('business_date').primaryKey(), nextNumber: integer('next_number').notNull() })
export const menuVariantPriceHistory = sqliteTable('menu_variant_price_history', { id: text('id').primaryKey(), variantId: text('variant_id').notNull(), menuItemId: text('menu_item_id').notNull(), productNameSnapshot: text('product_name_snapshot').notNull(), variantNameSnapshot: text('variant_name_snapshot').notNull(), oldPrice: integer('old_price'), newPrice: integer('new_price').notNull(), changedBy: text('changed_by').references(() => users.id), changeKind: text('change_kind').notNull(), createdAt: integer('created_at', { mode: 'timestamp' }).notNull() }, (table) => [index('menu_variant_price_history_variant_idx').on(table.variantId, table.createdAt)])
export const orderRefunds = sqliteTable('order_refunds', { id: text('id').primaryKey(), orderId: text('order_id').notNull().unique().references(() => orders.id), amount: integer('amount').notNull(), reason: text('reason').notNull(), actorId: text('actor_id').notNull().references(() => users.id), approvedBy: text('approved_by').notNull().references(() => users.id), createdAt: integer('created_at', { mode: 'timestamp' }).notNull() })
export const orderLineModifiers = sqliteTable('order_line_modifiers', { id: text('id').primaryKey(), orderLineId: text('order_line_id').notNull().references(() => orderLines.id), modifierId: text('modifier_id'), nameSnapshot: text('name_snapshot').notNull(), priceDelta: integer('price_delta').notNull(), quantity: integer('quantity').notNull().default(1) }, (table) => [index('order_line_modifiers_line_idx').on(table.orderLineId)])
export const orderDiscounts = sqliteTable('order_discounts', { id: text('id').primaryKey(), orderId: text('order_id').notNull().references(() => orders.id), type: text('type', { enum: ['percent', 'fixed'] }).notNull(), value: integer('value').notNull(), amount: integer('amount').notNull(), reason: text('reason').notNull(), actorId: text('actor_id').notNull().references(() => users.id), createdAt: integer('created_at', { mode: 'timestamp' }).notNull() })
export const payments = sqliteTable('payments', { id: text('id').primaryKey(), orderId: text('order_id').notNull().references(() => orders.id).unique(), method: text('method', { enum: ['cash'] }).notNull().default('cash'), amount: integer('amount').notNull(), receivedAmount: integer('received_amount').notNull(), changeAmount: integer('change_amount').notNull(), createdAt: integer('created_at', { mode: 'timestamp' }).notNull() })
export const offlineSyncRecords = sqliteTable('offline_sync_records', { idempotencyKey: text('idempotency_key').primaryKey(), orderId: text('order_id').notNull().references(() => orders.id), deviceId: text('device_id').notNull(), syncedAt: integer('synced_at', { mode: 'timestamp' }).notNull() })

export const timeEntries = sqliteTable('time_entries', { id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => users.id), checkInAt: integer('check_in_at', { mode: 'timestamp' }).notNull(), checkOutAt: integer('check_out_at', { mode: 'timestamp' }), approvedBy: text('approved_by').references(() => users.id), approvedAt: integer('approved_at', { mode: 'timestamp' }), note: text('note').notNull().default('') })
export const hourlyRateHistory = sqliteTable('hourly_rate_history', { id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => users.id), hourlyRate: integer('hourly_rate').notNull(), effectiveAt: integer('effective_at', { mode: 'timestamp' }).notNull(), createdBy: text('created_by').notNull().references(() => users.id) })
export const payrollPeriods = sqliteTable('payroll_periods', { id: text('id').primaryKey(), startsOn: text('starts_on').notNull(), endsOn: text('ends_on').notNull(), status: text('status', { enum: ['open', 'closed'] }).notNull().default('open'), closedBy: text('closed_by').references(() => users.id), closedAt: integer('closed_at', { mode: 'timestamp' }) })
export const payrollEntries = sqliteTable('payroll_entries', { id: text('id').primaryKey(), periodId: text('period_id').notNull().references(() => payrollPeriods.id), userId: text('user_id').notNull().references(() => users.id), minutesWorked: integer('minutes_worked').notNull(), hourlyRateSnapshot: integer('hourly_rate_snapshot').notNull(), grossPay: integer('gross_pay').notNull(), adjustment: integer('adjustment').notNull().default(0), note: text('note').notNull().default('') }, (table) => [uniqueIndex('payroll_entries_period_user_unique').on(table.periodId, table.userId)])

export const auditLogs = sqliteTable('audit_logs', { id: text('id').primaryKey(), actorId: text('actor_id').references(() => users.id), entityType: text('entity_type').notNull(), entityId: text('entity_id').notNull(), action: text('action').notNull(), detailJson: text('detail_json').notNull(), createdAt: integer('created_at', { mode: 'timestamp' }).notNull() }, (table) => [index('audit_logs_entity_idx').on(table.entityType, table.entityId), index('audit_logs_created_idx').on(table.createdAt)])
