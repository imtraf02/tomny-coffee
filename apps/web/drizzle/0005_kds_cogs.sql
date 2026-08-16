-- KDS state is independent from payment/order lifecycle so kitchen can work
-- on a draft table ticket and mark it served after payment.
ALTER TABLE orders ADD COLUMN kds_status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE orders ADD COLUMN kds_updated_at INTEGER;
CREATE INDEX orders_kds_idx ON orders(kds_status, updated_at);

INSERT OR IGNORE INTO permissions (id, code, label) VALUES
  ('kds.read', 'kds.read', 'Xem màn hình pha chế'),
  ('kds.manage', 'kds.manage', 'Cập nhật trạng thái pha chế'),
  ('orders.read', 'orders.read', 'Xem lịch sử đơn hàng'),
  ('orders.manage', 'orders.manage', 'Quản lý lịch sử đơn hàng');
