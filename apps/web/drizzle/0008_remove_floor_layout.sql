-- Replace the draft/publish floor editor with the simpler zone + table list.
-- Table, order, reservation and audit identities are intentionally retained.

PRAGMA defer_foreign_keys = ON;

DROP TABLE IF EXISTS floor_layout_table_items;
DROP TABLE IF EXISTS floor_layout_zone_items;
DROP TABLE IF EXISTS floor_layout_versions;
DROP TABLE IF EXISTS floor_plans;
DROP TABLE IF EXISTS floor_plan_revisions;

DROP INDEX IF EXISTS zones_floor_plan_idx;
CREATE TABLE zones_without_floor_plan (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
INSERT INTO zones_without_floor_plan (id, name, active, sort_order)
SELECT id, name, active, sort_order FROM zones;
DROP TABLE zones;
ALTER TABLE zones_without_floor_plan RENAME TO zones;

UPDATE permissions
SET label = CASE code
  WHEN 'floor_plan.read' THEN 'Xem danh sách bàn'
  WHEN 'floor_plan.manage' THEN 'Quản lý bàn'
  ELSE label
END
WHERE code IN ('floor_plan.read', 'floor_plan.manage');

PRAGMA defer_foreign_keys = OFF;
