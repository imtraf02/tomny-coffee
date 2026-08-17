-- Junction table: one order can span multiple physical tables
-- orders.table_id remains as the "primary table" for backward compat
CREATE TABLE IF NOT EXISTS order_tables (
  order_id TEXT NOT NULL REFERENCES orders(id),
  table_id TEXT NOT NULL REFERENCES tables(id),
  is_primary INTEGER NOT NULL DEFAULT 1,
  linked_at INTEGER NOT NULL,
  PRIMARY KEY (order_id, table_id)
);

CREATE INDEX IF NOT EXISTS order_tables_table_idx ON order_tables(table_id, order_id);
CREATE INDEX IF NOT EXISTS order_tables_order_idx ON order_tables(order_id);

-- Backfill: create junction entries from all existing single-table orders
INSERT OR IGNORE INTO order_tables (order_id, table_id, is_primary, linked_at)
SELECT id, table_id, 1, COALESCE(created_at, 0)
FROM orders
WHERE table_id IS NOT NULL;
