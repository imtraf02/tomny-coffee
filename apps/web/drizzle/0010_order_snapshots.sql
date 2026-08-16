-- Immutable order snapshots, daily display numbers and cash-cancellation audit.
ALTER TABLE orders ADD COLUMN business_date TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN display_number INTEGER NOT NULL DEFAULT 0;

-- Existing orders predate display numbers. Backfill deterministically before
-- enforcing uniqueness; the presentation layer keeps their original code too.
UPDATE orders
SET business_date = strftime('%Y-%m-%d', created_at / 1000, 'unixepoch', '+7 hours');
UPDATE orders
SET display_number = (
  SELECT COUNT(*)
  FROM orders AS previous
  WHERE previous.business_date = orders.business_date
    AND (previous.created_at < orders.created_at OR (previous.created_at = orders.created_at AND previous.id <= orders.id))
);

ALTER TABLE order_lines ADD COLUMN line_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE order_lines ADD COLUMN combo_snapshot TEXT NOT NULL DEFAULT '[]';
ALTER TABLE order_lines ADD COLUMN replaced_line_id TEXT;
ALTER TABLE order_lines ADD COLUMN cancel_reason TEXT;
ALTER TABLE order_lines ADD COLUMN cancelled_by TEXT;
ALTER TABLE order_lines ADD COLUMN cancelled_at INTEGER;
ALTER TABLE order_lines ADD COLUMN approved_by TEXT;

CREATE TABLE daily_order_counters (
  business_date TEXT PRIMARY KEY NOT NULL,
  next_number INTEGER NOT NULL
);
CREATE UNIQUE INDEX orders_business_display_unique ON orders(business_date, display_number);
CREATE INDEX order_lines_order_status_idx ON order_lines(order_id, line_status);

CREATE TABLE menu_variant_price_history (
  id TEXT PRIMARY KEY NOT NULL,
  variant_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  variant_name_snapshot TEXT NOT NULL,
  old_price INTEGER,
  new_price INTEGER NOT NULL,
  changed_by TEXT,
  change_kind TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX menu_variant_price_history_variant_idx ON menu_variant_price_history(variant_id, created_at DESC);

CREATE TABLE order_refunds (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO permissions (id, code, label) VALUES
  ('orders.cancel.paid.approve', 'orders.cancel.paid.approve', 'Duyệt hủy và hoàn tiền đơn đã thanh toán');
INSERT OR IGNORE INTO user_permissions (user_id, permission_id, granted_at)
SELECT up.user_id, 'orders.cancel.paid.approve', CAST(strftime('%s','now') AS INTEGER) * 1000
FROM user_permissions up
JOIN permissions p ON p.id = up.permission_id
WHERE p.code = 'orders.manage';

-- Historical prices before this migration are unknown; make the first entry an explicit baseline.
INSERT INTO menu_variant_price_history (id, variant_id, menu_item_id, product_name_snapshot, variant_name_snapshot, old_price, new_price, changed_by, change_kind, created_at)
SELECT 'baseline-' || v.id, v.id, v.menu_item_id, i.name, v.name, NULL, v.price, NULL, 'baseline', CAST(strftime('%s','now') AS INTEGER) * 1000
FROM menu_variants v JOIN menu_items i ON i.id = v.menu_item_id;
