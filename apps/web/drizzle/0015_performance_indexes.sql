CREATE INDEX IF NOT EXISTS `order_line_modifiers_line_idx` ON `order_line_modifiers` (`order_line_id`);
CREATE INDEX IF NOT EXISTS `orders_status_updated_idx` ON `orders` (`status`, `updated_at`);
CREATE INDEX IF NOT EXISTS `menu_variants_item_idx` ON `menu_variants` (`menu_item_id`);
CREATE INDEX IF NOT EXISTS `modifiers_group_idx` ON `modifiers` (`group_id`);
CREATE INDEX IF NOT EXISTS `variant_modifier_groups_group_idx` ON `variant_modifier_groups` (`group_id`);
