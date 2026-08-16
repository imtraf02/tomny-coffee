-- Advanced floor editor: versioned canvas dimensions and capacity removal.
-- Keep stable table IDs and historical order/reservation references intact.

PRAGMA defer_foreign_keys = ON;

ALTER TABLE floor_layout_versions ADD COLUMN grid_columns INTEGER NOT NULL DEFAULT 24;
ALTER TABLE floor_layout_versions ADD COLUMN grid_rows INTEGER NOT NULL DEFAULT 16;

UPDATE floor_layout_versions
SET grid_columns = (
  SELECT grid_columns FROM floor_plans WHERE floor_plans.id = floor_layout_versions.floor_plan_id
),
grid_rows = (
  SELECT grid_rows FROM floor_plans WHERE floor_plans.id = floor_layout_versions.floor_plan_id
);

-- Rebuild tables because D1/SQLite deployments can differ in ALTER TABLE DROP
-- COLUMN support. The table identity and every operational column are copied.
DROP INDEX IF EXISTS tables_public_code_unique;
CREATE TABLE tables_without_capacity (
  id TEXT PRIMARY KEY NOT NULL,
  zone_id TEXT,
  name TEXT NOT NULL,
  pos_x REAL NOT NULL DEFAULT 0,
  pos_y REAL NOT NULL DEFAULT 0,
  shape TEXT NOT NULL DEFAULT 'square',
  status TEXT NOT NULL DEFAULT 'trong',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status_override TEXT,
  public_code TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER,
  updated_at INTEGER,
  UNIQUE(zone_id, name)
);
INSERT INTO tables_without_capacity
  (id, zone_id, name, pos_x, pos_y, shape, status, active, sort_order, status_override, public_code, note, created_at, updated_at)
SELECT id, zone_id, name, pos_x, pos_y, shape, status, active, sort_order, status_override, public_code, note, created_at, updated_at
FROM "tables";
DROP TABLE "tables";
ALTER TABLE tables_without_capacity RENAME TO "tables";
CREATE UNIQUE INDEX tables_public_code_unique
  ON "tables"(public_code) WHERE public_code IS NOT NULL;

CREATE TABLE floor_layout_table_items_without_capacity (
  id TEXT PRIMARY KEY NOT NULL,
  version_id TEXT NOT NULL,
  table_id TEXT NOT NULL,
  zone_id TEXT,
  name TEXT NOT NULL,
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
INSERT INTO floor_layout_table_items_without_capacity
  (id, version_id, table_id, zone_id, name, note, grid_x, grid_y, col_span, row_span, shape, orientation, sort_order)
SELECT id, version_id, table_id, zone_id, name, note, grid_x, grid_y, col_span, row_span, shape, orientation, sort_order
FROM floor_layout_table_items;
DROP TABLE floor_layout_table_items;
ALTER TABLE floor_layout_table_items_without_capacity RENAME TO floor_layout_table_items;
CREATE INDEX floor_layout_table_version_idx
  ON floor_layout_table_items(version_id, sort_order);
CREATE INDEX floor_layout_table_zone_idx
  ON floor_layout_table_items(version_id, zone_id);

PRAGMA defer_foreign_keys = OFF;
