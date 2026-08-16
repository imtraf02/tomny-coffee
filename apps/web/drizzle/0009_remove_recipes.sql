-- Recipe/BOM is no longer part of the operational model. Historical order-line
-- snapshots remain untouched for auditability, but future sales do not derive
-- stock or COGS from product recipes.

DROP TABLE IF EXISTS recipe_lines;
DROP TABLE IF EXISTS recipes;
