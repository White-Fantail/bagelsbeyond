-- CreateTable
CREATE TABLE "loyverse_modifiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSelect" INTEGER,
    "maxSelect" INTEGER,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyverse_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyverse_modifier_options" (
    "id" TEXT NOT NULL,
    "modifierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyverse_modifier_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyverse_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "price" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyverse_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyverse_item_modifiers" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "modifierId" TEXT NOT NULL,

    CONSTRAINT "loyverse_item_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyverse_variants" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sku" TEXT,
    "price" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyverse_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyverse_inventory_levels" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "inStock" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyverse_inventory_levels_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "loyverse_item_modifiers_itemId_modifierId_key" ON "loyverse_item_modifiers"("itemId", "modifierId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "loyverse_inventory_levels_variantId_key" ON "loyverse_inventory_levels"("variantId");

-- AddForeignKey
ALTER TABLE "loyverse_modifier_options" ADD CONSTRAINT "loyverse_modifier_options_modifierId_fkey" FOREIGN KEY ("modifierId") REFERENCES "loyverse_modifiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyverse_item_modifiers" ADD CONSTRAINT "loyverse_item_modifiers_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "loyverse_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyverse_item_modifiers" ADD CONSTRAINT "loyverse_item_modifiers_modifierId_fkey" FOREIGN KEY ("modifierId") REFERENCES "loyverse_modifiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyverse_variants" ADD CONSTRAINT "loyverse_variants_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "loyverse_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyverse_inventory_levels" ADD CONSTRAINT "loyverse_inventory_levels_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "loyverse_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
