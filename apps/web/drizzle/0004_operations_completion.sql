-- Forward-only operational completion migration.
-- Existing history is retained; new columns are additive and safe for staged rollout.
ALTER TABLE "tables" ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "tables" ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tables" ADD COLUMN status_override TEXT;
UPDATE "tables" SET status_override = CASE WHEN status IN ('dat_truoc', 'can_don') THEN status ELSE NULL END;

ALTER TABLE menu_items ADD COLUMN kind TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE menu_items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE modifier_groups ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE modifier_groups ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE modifier_groups ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE modifiers ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE modifiers ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_line_modifiers ADD COLUMN modifier_id TEXT;
ALTER TABLE order_line_modifiers ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;

ALTER TABLE orders ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE orders ADD COLUMN cancel_reason TEXT;
ALTER TABLE orders ADD COLUMN cancelled_by TEXT;
ALTER TABLE orders ADD COLUMN cancelled_at INTEGER;
ALTER TABLE orders ADD COLUMN merged_into_order_id TEXT;
CREATE INDEX orders_open_table_idx ON orders(table_id, status, updated_at);

ALTER TABLE ingredients ADD COLUMN current_quantity REAL NOT NULL DEFAULT 0;
ALTER TABLE invites ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE audit_logs ADD COLUMN request_id TEXT;
ALTER TABLE audit_logs ADD COLUMN device_id TEXT;

CREATE TABLE login_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  identity_key TEXT NOT NULL,
  succeeded INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX login_attempts_identity_idx ON login_attempts(identity_key, created_at);

INSERT OR IGNORE INTO permissions (id, code, label) VALUES
  ('timeclock.use', 'timeclock.use', 'Chấm công cá nhân'),
  ('timeclock.manage', 'timeclock.manage', 'Duyệt và sửa chấm công'),
  ('audit.read', 'audit.read', 'Xem audit log');
