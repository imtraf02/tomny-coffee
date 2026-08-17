-- Clean wipe and seed only admin user for production database

DELETE FROM offline_sync_records;
DELETE FROM order_line_modifiers;
DELETE FROM order_lines;
DELETE FROM order_tables;
DELETE FROM order_refunds;
DELETE FROM order_discounts;
DELETE FROM payments;
DELETE FROM orders;
DELETE FROM daily_order_counters;
DELETE FROM inventory_movements;
DELETE FROM inventory_lots;
DELETE FROM ingredients;
DELETE FROM suppliers;
DELETE FROM combo_components;
DELETE FROM combos;
DELETE FROM variant_modifier_groups;
DELETE FROM modifiers;
DELETE FROM modifier_groups;
DELETE FROM menu_variant_price_history;
DELETE FROM menu_variants;
DELETE FROM menu_items;
DELETE FROM categories;
DELETE FROM table_blocks;
DELETE FROM reservation_tables;
DELETE FROM reservations;
DELETE FROM tables;
DELETE FROM zones;
DELETE FROM time_entries;
DELETE FROM hourly_rate_history;
DELETE FROM payroll_entries;
DELETE FROM payroll_periods;
DELETE FROM audit_logs;
DELETE FROM login_attempts;
DELETE FROM invites;
DELETE FROM sessions;
DELETE FROM user_permissions;
DELETE FROM users;

-- Ensure all permissions exist
INSERT OR IGNORE INTO permissions (id, code, label) VALUES
  ('pos.read', 'pos.read', 'Xem POS'),
  ('pos.checkout', 'pos.checkout', 'Thanh toán tiền mặt'),
  ('pos.discount', 'pos.discount', 'Giảm giá đơn'),
  ('pos.cancel', 'pos.cancel', 'Hủy đơn'),
  ('pos.reprint', 'pos.reprint', 'In lại hóa đơn'),
  ('menu.read', 'menu.read', 'Xem menu'),
  ('menu.manage', 'menu.manage', 'Quản lý menu'),
  ('floor_plan.read', 'floor_plan.read', 'Xem sơ đồ bàn'),
  ('floor_plan.manage', 'floor_plan.manage', 'Quản lý sơ đồ bàn'),
  ('inventory.read', 'inventory.read', 'Xem kho'),
  ('inventory.manage', 'inventory.manage', 'Quản lý kho'),
  ('inventory.stocktake', 'inventory.stocktake', 'Kiểm kho'),
  ('staff.read', 'staff.read', 'Xem nhân viên'),
  ('staff.manage', 'staff.manage', 'Quản lý nhân viên'),
  ('payroll.manage', 'payroll.manage', 'Chốt lương'),
  ('reports.read', 'reports.read', 'Xem báo cáo'),
  ('reports.export', 'reports.export', 'Xuất báo cáo'),
  ('settings.manage', 'settings.manage', 'Quản trị hệ thống'),
  ('timeclock.use', 'timeclock.use', 'Chấm công cá nhân'),
  ('timeclock.manage', 'timeclock.manage', 'Duyệt và sửa chấm công'),
  ('audit.read', 'audit.read', 'Xem audit log'),
  ('kds.read', 'kds.read', 'Xem màn hình pha chế'),
  ('kds.manage', 'kds.manage', 'Cập nhật trạng thái pha chế'),
  ('orders.read', 'orders.read', 'Xem lịch sử đơn hàng'),
  ('orders.manage', 'orders.manage', 'Quản lý lịch sử đơn hàng'),
  ('tables.operate', 'tables.operate', 'Điều hành trạng thái và đặt bàn');

-- Insert single admin user (Password: 123456)
INSERT INTO users (id, username, email, display_name, password_hash, active, created_at, updated_at)
VALUES (
  'admin-user-0000-0000-000000000001',
  'admin',
  NULL,
  'Quản trị viên',
  'pbkdf2$100000$SYcjU49zgOUvmHdPeYC-vA$fRtlRky6hVg8dhOySEo9FJ75jqIT0WjL77NlXLcLw0c',
  1,
  1771142400000,
  1771142400000
);

-- Grant all permissions to admin
INSERT INTO user_permissions (user_id, permission_id, granted_at)
SELECT 'admin-user-0000-0000-000000000001', id, 1771142400000
FROM permissions;
