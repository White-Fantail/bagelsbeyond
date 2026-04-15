-- Add product categories (separate from ingredient categories)

-- CreateTable: product_categories
CREATE TABLE "product_categories" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_name_key" ON "product_categories"("name");
CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories"("slug");
CREATE INDEX "product_categories_sortOrder_idx" ON "product_categories"("sortOrder");
CREATE INDEX "product_categories_isActive_idx" ON "product_categories"("isActive");

-- AlterTable: add categoryId to menu_products
ALTER TABLE "menu_products" ADD COLUMN "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "menu_products_categoryId_idx" ON "menu_products"("categoryId");

-- AddForeignKey
ALTER TABLE "menu_products" ADD CONSTRAINT "menu_products_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
