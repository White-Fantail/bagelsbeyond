-- AlterTable
ALTER TABLE "loyverse_categories" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "loyverse_categories" ADD COLUMN "isVisible" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "loyverse_categories_isVisible_idx" ON "loyverse_categories"("isVisible");
