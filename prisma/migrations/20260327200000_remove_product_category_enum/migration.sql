-- Remove internal ProductCategory enum column from products table.
-- Products are now linked to Loyverse categories via loyverseCategoryId only.

ALTER TABLE "products" DROP COLUMN IF EXISTS "category";

DROP TYPE IF EXISTS "ProductCategory";
