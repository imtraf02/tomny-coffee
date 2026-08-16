ALTER TABLE categories ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE menu_variants ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX categories_name_unique ON categories(name);
CREATE UNIQUE INDEX menu_variants_item_name_unique ON menu_variants(menu_item_id, name);
