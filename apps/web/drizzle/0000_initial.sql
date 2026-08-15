PRAGMA foreign_keys = ON;

CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE permissions (id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE, label TEXT NOT NULL);
CREATE TABLE user_permissions (user_id TEXT NOT NULL, permission_id TEXT NOT NULL, granted_at INTEGER NOT NULL, UNIQUE(user_id, permission_id));
CREATE TABLE sessions (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX sessions_token_hash_idx ON sessions(token_hash);
CREATE TABLE invites (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, permissions_json TEXT NOT NULL, expires_at INTEGER NOT NULL, accepted_at INTEGER, created_by TEXT NOT NULL);

CREATE TABLE areas (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE cafe_tables (id TEXT PRIMARY KEY NOT NULL, area_id TEXT NOT NULL, name TEXT NOT NULL, capacity INTEGER NOT NULL DEFAULT 2, x REAL NOT NULL, y REAL NOT NULL, width REAL NOT NULL DEFAULT 0.12, height REAL NOT NULL DEFAULT 0.12, shape TEXT NOT NULL DEFAULT 'round', updated_at INTEGER NOT NULL, UNIQUE(area_id, name));
CREATE TABLE floor_plan_revisions (id TEXT PRIMARY KEY NOT NULL, actor_id TEXT NOT NULL, change_json TEXT NOT NULL, created_at INTEGER NOT NULL);

CREATE TABLE categories (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE menu_items (id TEXT PRIMARY KEY NOT NULL, category_id TEXT, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', image_key TEXT, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE menu_variants (id TEXT PRIMARY KEY NOT NULL, menu_item_id TEXT NOT NULL, name TEXT NOT NULL, price INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE modifier_groups (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, min_selections INTEGER NOT NULL DEFAULT 0, max_selections INTEGER NOT NULL DEFAULT 1);
CREATE TABLE modifiers (id TEXT PRIMARY KEY NOT NULL, group_id TEXT NOT NULL, name TEXT NOT NULL, price_delta INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE variant_modifier_groups (variant_id TEXT NOT NULL, group_id TEXT NOT NULL, UNIQUE(variant_id, group_id));
CREATE TABLE combos (id TEXT PRIMARY KEY NOT NULL, menu_item_id TEXT NOT NULL, price INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE combo_components (id TEXT PRIMARY KEY NOT NULL, combo_id TEXT NOT NULL, variant_id TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1);

CREATE TABLE ingredients (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL UNIQUE, unit TEXT NOT NULL, reorder_point REAL NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE recipes (id TEXT PRIMARY KEY NOT NULL, variant_id TEXT NOT NULL UNIQUE, revision INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
CREATE TABLE recipe_lines (id TEXT PRIMARY KEY NOT NULL, recipe_id TEXT NOT NULL, ingredient_id TEXT NOT NULL, quantity REAL NOT NULL, UNIQUE(recipe_id, ingredient_id));
CREATE TABLE suppliers (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL UNIQUE, phone TEXT, note TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE inventory_lots (id TEXT PRIMARY KEY NOT NULL, ingredient_id TEXT NOT NULL, supplier_id TEXT, received_at INTEGER NOT NULL, expires_at INTEGER, original_quantity REAL NOT NULL, remaining_quantity REAL NOT NULL, unit_cost INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '');
CREATE INDEX inventory_lots_fifo_idx ON inventory_lots(ingredient_id, received_at);
CREATE TABLE inventory_movements (id TEXT PRIMARY KEY NOT NULL, ingredient_id TEXT NOT NULL, lot_id TEXT, order_id TEXT, type TEXT NOT NULL, quantity_delta REAL NOT NULL, unit_cost INTEGER, reason TEXT NOT NULL DEFAULT '', actor_id TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX inventory_movements_ingredient_idx ON inventory_movements(ingredient_id, created_at);

CREATE TABLE orders (id TEXT PRIMARY KEY NOT NULL, order_code TEXT NOT NULL UNIQUE, idempotency_key TEXT NOT NULL UNIQUE, source TEXT NOT NULL, table_id TEXT, note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, subtotal INTEGER NOT NULL, discount_amount INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL, cogs INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL, paid_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX orders_table_status_idx ON orders(table_id, status);
CREATE INDEX orders_created_at_idx ON orders(created_at);
CREATE TABLE order_lines (id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL, menu_item_id TEXT, variant_id TEXT, name_snapshot TEXT NOT NULL, variant_snapshot TEXT NOT NULL, recipe_snapshot TEXT NOT NULL, unit_price INTEGER NOT NULL, quantity INTEGER NOT NULL, line_total INTEGER NOT NULL);
CREATE TABLE order_line_modifiers (id TEXT PRIMARY KEY NOT NULL, order_line_id TEXT NOT NULL, name_snapshot TEXT NOT NULL, price_delta INTEGER NOT NULL);
CREATE TABLE order_discounts (id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL, type TEXT NOT NULL, value INTEGER NOT NULL, amount INTEGER NOT NULL, reason TEXT NOT NULL, actor_id TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE payments (id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL UNIQUE, method TEXT NOT NULL DEFAULT 'cash', amount INTEGER NOT NULL, received_amount INTEGER NOT NULL, change_amount INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE offline_sync_records (idempotency_key TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL, device_id TEXT NOT NULL, synced_at INTEGER NOT NULL);

CREATE TABLE time_entries (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, check_in_at INTEGER NOT NULL, check_out_at INTEGER, approved_by TEXT, approved_at INTEGER, note TEXT NOT NULL DEFAULT '');
CREATE TABLE hourly_rate_history (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, hourly_rate INTEGER NOT NULL, effective_at INTEGER NOT NULL, created_by TEXT NOT NULL);
CREATE TABLE payroll_periods (id TEXT PRIMARY KEY NOT NULL, starts_on TEXT NOT NULL, ends_on TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', closed_by TEXT, closed_at INTEGER);
CREATE TABLE payroll_entries (id TEXT PRIMARY KEY NOT NULL, period_id TEXT NOT NULL, user_id TEXT NOT NULL, minutes_worked INTEGER NOT NULL, hourly_rate_snapshot INTEGER NOT NULL, gross_pay INTEGER NOT NULL, adjustment INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', UNIQUE(period_id, user_id));

CREATE TABLE audit_logs (id TEXT PRIMARY KEY NOT NULL, actor_id TEXT, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL, detail_json TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
CREATE INDEX audit_logs_created_idx ON audit_logs(created_at);
