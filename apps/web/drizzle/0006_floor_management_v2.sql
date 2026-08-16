-- Floor management v2: stable table identities, per-floor draft/published layouts,
-- reservations and operational blocks. Existing columns remain for one release so
-- the compatibility /api/floor-plan endpoint can keep serving legacy clients.

INSERT OR IGNORE INTO permissions (id, code, label)
VALUES ('tables.operate', 'tables.operate', 'Điều hành trạng thái và đặt bàn');
INSERT OR IGNORE INTO user_permissions (user_id, permission_id, granted_at)
SELECT u.id, 'tables.operate', unixepoch() * 1000
FROM users u
JOIN user_permissions up ON up.user_id = u.id
JOIN permissions p ON p.id = up.permission_id AND p.code = 'pos.read'
WHERE NOT EXISTS (
  SELECT 1 FROM user_permissions existing
  WHERE existing.user_id = u.id AND existing.permission_id = 'tables.operate'
);

ALTER TABLE zones ADD COLUMN floor_plan_id TEXT;
ALTER TABLE zones ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE zones ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "tables" ADD COLUMN public_code TEXT;
ALTER TABLE "tables" ADD COLUMN note TEXT NOT NULL DEFAULT '';
ALTER TABLE "tables" ADD COLUMN created_at INTEGER;
ALTER TABLE "tables" ADD COLUMN updated_at INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS tables_public_code_unique
  ON "tables"(public_code) WHERE public_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS zones_floor_plan_idx ON zones(floor_plan_id, active, sort_order);

CREATE TABLE IF NOT EXISTS floor_plans (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  grid_columns INTEGER NOT NULL DEFAULT 24,
  grid_rows INTEGER NOT NULL DEFAULT 16,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  published_version_id TEXT,
  draft_version_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS floor_layout_versions (
  id TEXT PRIMARY KEY NOT NULL,
  floor_plan_id TEXT NOT NULL,
  version_no INTEGER NOT NULL,
  edit_version INTEGER NOT NULL DEFAULT 1,
  base_version_id TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  published_by TEXT,
  published_at INTEGER,
  UNIQUE(floor_plan_id, version_no)
);
CREATE INDEX IF NOT EXISTS floor_layout_versions_plan_idx
  ON floor_layout_versions(floor_plan_id, published_at);

CREATE TABLE IF NOT EXISTS floor_layout_zone_items (
  id TEXT PRIMARY KEY NOT NULL,
  version_id TEXT NOT NULL,
  zone_id TEXT NOT NULL,
  name TEXT NOT NULL,
  grid_x INTEGER NOT NULL DEFAULT 0,
  grid_y INTEGER NOT NULL DEFAULT 0,
  grid_width INTEGER NOT NULL DEFAULT 12,
  grid_height INTEGER NOT NULL DEFAULT 8,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(version_id, zone_id)
);
CREATE INDEX IF NOT EXISTS floor_layout_zone_version_idx
  ON floor_layout_zone_items(version_id, sort_order);

CREATE TABLE IF NOT EXISTS floor_layout_table_items (
  id TEXT PRIMARY KEY NOT NULL,
  version_id TEXT NOT NULL,
  table_id TEXT NOT NULL,
  zone_id TEXT,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  note TEXT NOT NULL DEFAULT '',
  grid_x INTEGER NOT NULL DEFAULT 0,
  grid_y INTEGER NOT NULL DEFAULT 0,
  col_span INTEGER NOT NULL DEFAULT 2,
  row_span INTEGER NOT NULL DEFAULT 2,
  shape TEXT NOT NULL DEFAULT 'square',
  orientation TEXT NOT NULL DEFAULT 'horizontal',
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(version_id, table_id)
);
CREATE INDEX IF NOT EXISTS floor_layout_table_version_idx
  ON floor_layout_table_items(version_id, sort_order);
CREATE INDEX IF NOT EXISTS floor_layout_table_zone_idx
  ON floor_layout_table_items(version_id, zone_id);

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  party_size INTEGER NOT NULL DEFAULT 2,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reservations_window_idx
  ON reservations(starts_at, ends_at, status);
CREATE INDEX IF NOT EXISTS reservations_status_idx
  ON reservations(status, starts_at);

CREATE TABLE IF NOT EXISTS reservation_tables (
  reservation_id TEXT NOT NULL,
  table_id TEXT NOT NULL,
  UNIQUE(reservation_id, table_id)
);
CREATE INDEX IF NOT EXISTS reservation_tables_table_idx
  ON reservation_tables(table_id, reservation_id);

CREATE TABLE IF NOT EXISTS table_blocks (
  id TEXT PRIMARY KEY NOT NULL,
  table_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  starts_at INTEGER NOT NULL,
  ends_at INTEGER,
  created_by TEXT NOT NULL,
  resolved_by TEXT,
  resolved_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS table_blocks_active_idx
  ON table_blocks(table_id, ends_at, resolved_at);
CREATE INDEX IF NOT EXISTS table_blocks_kind_idx
  ON table_blocks(kind, starts_at);

-- Preserve stable IDs and provide a deterministic QR/public identifier for
-- existing tables. The code is an identifier only; no customer route is opened.
UPDATE "tables"
SET public_code = 'T-' || upper(substr(replace(id, '-', ''), 1, 12))
WHERE public_code IS NULL;

-- A single initial floor keeps current data reachable. Admin can create and
-- publish additional floors after the migration.
INSERT OR IGNORE INTO floor_plans
  (id, name, grid_columns, grid_rows, sort_order, active, published_version_id, draft_version_id, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Mặt bằng chính', 24, 16, 0, 1, '00000000-0000-4000-8000-000000000002', NULL, unixepoch() * 1000, unixepoch() * 1000);

INSERT OR IGNORE INTO floor_layout_versions
  (id, floor_plan_id, version_no, edit_version, base_version_id, created_by, created_at, published_by, published_at)
VALUES
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 1, 1, NULL,
   (SELECT id FROM users ORDER BY created_at LIMIT 1), unixepoch() * 1000,
   (SELECT id FROM users ORDER BY created_at LIMIT 1), unixepoch() * 1000);

UPDATE zones
SET floor_plan_id = '00000000-0000-4000-8000-000000000001'
WHERE floor_plan_id IS NULL;

-- Arrange legacy zones in a predictable 3-column grid. Table positions are
-- translated from each zone's former percentage canvas into its new zone box.
WITH ranked AS (
  SELECT id, name, sort_order,
         ((ROW_NUMBER() OVER (ORDER BY sort_order, name) - 1) % 3) * 8 AS grid_x,
         CAST((ROW_NUMBER() OVER (ORDER BY sort_order, name) - 1) / 3 AS INTEGER) * 8 AS grid_y
  FROM zones
  WHERE floor_plan_id = '00000000-0000-4000-8000-000000000001'
)
INSERT OR IGNORE INTO floor_layout_zone_items
  (id, version_id, zone_id, name, grid_x, grid_y, grid_width, grid_height, sort_order)
SELECT 'legacy-zone-' || id, '00000000-0000-4000-8000-000000000002', id, name,
       grid_x, grid_y, 8, 8, sort_order
FROM ranked;

-- Keep every migrated zone inside the logical grid even when an older shop
-- already had more than six zones.
UPDATE floor_plans
SET grid_rows = MAX(16, CAST(((SELECT COUNT(*) FROM floor_layout_zone_items WHERE version_id = '00000000-0000-4000-8000-000000000002') + 2) / 3 AS INTEGER) * 8)
WHERE id = '00000000-0000-4000-8000-000000000001';

WITH ranked AS (
  SELECT id,
         ((ROW_NUMBER() OVER (ORDER BY sort_order, name) - 1) % 3) * 8 AS zone_x,
         CAST((ROW_NUMBER() OVER (ORDER BY sort_order, name) - 1) / 3 AS INTEGER) * 8 AS zone_y
  FROM zones
  WHERE floor_plan_id = '00000000-0000-4000-8000-000000000001'
), mapped AS (
  SELECT t.id, t.zone_id, t.name, t.capacity, t.note, t.shape, t.sort_order,
         r.zone_x, r.zone_y,
         MAX(0, MIN(6, CAST(COALESCE(t.pos_x, 50) / 100.0 * 8 AS INTEGER))) AS local_x,
         MAX(0, MIN(6, CAST(COALESCE(t.pos_y, 50) / 100.0 * 8 AS INTEGER))) AS local_y
  FROM "tables" t
  JOIN ranked r ON r.id = t.zone_id
  WHERE t.active = 1
)
INSERT OR IGNORE INTO floor_layout_table_items
  (id, version_id, table_id, zone_id, name, capacity, note, grid_x, grid_y, col_span, row_span, shape, orientation, sort_order)
SELECT 'legacy-table-' || id, '00000000-0000-4000-8000-000000000002', id, zone_id, name, capacity, note,
       zone_x + local_x, zone_y + local_y, 2, 2,
       CASE WHEN shape = 'round' THEN 'round' ELSE 'square' END, 'horizontal', sort_order
FROM mapped;

-- Carry forward the two legacy manual states as explicit operational blocks.
INSERT INTO table_blocks (id, table_id, kind, reason, starts_at, created_by, created_at)
SELECT 'legacy-block-' || id, id,
       CASE WHEN status_override = 'can_don' THEN 'cleaning' ELSE 'reserved_hold' END,
       'Chuyển từ trạng thái sơ đồ cũ', unixepoch() * 1000,
       (SELECT id FROM users ORDER BY created_at LIMIT 1), unixepoch() * 1000
FROM "tables"
WHERE status_override IN ('dat_truoc', 'can_don')
  AND EXISTS (SELECT 1 FROM users);

-- The explicit v2 block is now the source of truth; retaining the old
-- override would make a resolved block look locked to legacy order APIs.
UPDATE "tables"
SET status_override = NULL
WHERE status_override IN ('dat_truoc', 'can_don')
  AND EXISTS (SELECT 1 FROM table_blocks b WHERE b.id = 'legacy-block-' || "tables".id);
