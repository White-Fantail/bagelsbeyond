-- AlterTable
ALTER TABLE "product_categories"
ADD COLUMN "isFreshnessManaged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "freshnessSortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "product_categories_freshnessSortOrder_idx" ON "product_categories"("freshnessSortOrder");

-- CreateIndex
CREATE INDEX "product_categories_isFreshnessManaged_idx" ON "product_categories"("isFreshnessManaged");
