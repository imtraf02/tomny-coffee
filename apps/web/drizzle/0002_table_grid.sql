-- Keep the original free-layout tables untouched for recoverability. New data
-- follows the grid-first model and preserves IDs already referenced by orders.
CREATE TABLE zones (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE "tables" (
  id TEXT PRIMARY KEY NOT NULL,
  zone_id TEXT,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  pos_x REAL NOT NULL DEFAULT 0,
  pos_y REAL NOT NULL DEFAULT 0,
  shape TEXT NOT NULL DEFAULT 'square',
  status TEXT NOT NULL DEFAULT 'trong',
  UNIQUE(zone_id, name)
);

INSERT INTO zones (id, name)
SELECT id, name FROM areas;

INSERT INTO "tables" (id, zone_id, name, capacity, pos_x, pos_y, shape, status)
SELECT id, area_id, name, capacity, x * 100, y * 100,
  CASE WHEN shape = 'round' THEN 'round' ELSE 'square' END,
  'trong'
FROM cafe_tables;
