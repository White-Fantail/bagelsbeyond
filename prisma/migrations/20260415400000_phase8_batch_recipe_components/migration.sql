-- Phase 8: Batch recipe output and intermediate product components
-- Adds outputQuantity/outputUnit to Recipe, canBeUsedAsRecipeComponent to MenuProduct,
-- RecipeItemSourceType enum, and refactors RecipeItem to support ingredient or product sources.

-- CreateEnum
CREATE TYPE "RecipeItemSourceType" AS ENUM ('INGREDIENT', 'PRODUCT');

-- AlterTable: add canBeUsedAsRecipeComponent to menu_products
ALTER TABLE "menu_products" ADD COLUMN "canBeUsedAsRecipeComponent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: add batch output fields to recipes
ALTER TABLE "recipes" ADD COLUMN "outputQuantity" DECIMAL(10,3) NOT NULL DEFAULT 1;
ALTER TABLE "recipes" ADD COLUMN "outputUnit" "UnitType" NOT NULL DEFAULT 'EA';

-- AlterTable: refactor recipe_items
-- 1. Drop the old unique constraint on (recipeId, ingredientId)
DROP INDEX IF EXISTS "recipe_items_recipeId_ingredientId_key";

-- 2. Add new columns
ALTER TABLE "recipe_items" ADD COLUMN "sourceType" "RecipeItemSourceType" NOT NULL DEFAULT 'INGREDIENT';
ALTER TABLE "recipe_items" ADD COLUMN "componentProductId" TEXT;

-- 3. Make ingredientId nullable (existing rows keep their value via DEFAULT handling)
ALTER TABLE "recipe_items" ALTER COLUMN "ingredientId" DROP NOT NULL;

-- 4. Add foreign key for componentProductId
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_componentProductId_fkey"
    FOREIGN KEY ("componentProductId") REFERENCES "menu_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "menu_products_canBeUsedAsRecipeComponent_idx" ON "menu_products"("canBeUsedAsRecipeComponent");

-- CreateIndex
CREATE INDEX "recipe_items_componentProductId_idx" ON "recipe_items"("componentProductId");
