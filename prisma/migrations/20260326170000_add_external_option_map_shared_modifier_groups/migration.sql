-- AddColumn: productOptionId to order_item_options
ALTER TABLE "order_item_options" ADD COLUMN "productOptionId" TEXT;

-- CreateTable: external_option_maps
CREATE TABLE "external_option_maps" (
    "id" TEXT NOT NULL,
    "source" "IntegrationSource" NOT NULL,
    "productOptionId" TEXT NOT NULL,
    "externalOptionId" TEXT NOT NULL,
    "externalName" TEXT,
    "externalGroupId" TEXT,
    "externalGroupName" TEXT,
    "mappingType" TEXT NOT NULL DEFAULT 'MODIFIER',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_option_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable: product_option_group_assignments
CREATE TABLE "product_option_group_assignments" (
    "productId" TEXT NOT NULL,
    "optionGroupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_option_group_assignments_pkey" PRIMARY KEY ("productId","optionGroupId")
);

-- CreateIndex
CREATE INDEX "external_option_maps_productOptionId_idx" ON "external_option_maps"("productOptionId");
CREATE UNIQUE INDEX "external_option_maps_source_externalOptionId_key" ON "external_option_maps"("source", "externalOptionId");
CREATE UNIQUE INDEX "external_option_maps_source_productOptionId_key" ON "external_option_maps"("source", "productOptionId");

-- CreateIndex
CREATE INDEX "product_option_group_assignments_productId_idx" ON "product_option_group_assignments"("productId");
CREATE INDEX "product_option_group_assignments_optionGroupId_idx" ON "product_option_group_assignments"("optionGroupId");

-- CreateIndex
CREATE INDEX "order_item_options_productOptionId_idx" ON "order_item_options"("productOptionId");

-- AddForeignKey: order_item_options.productOptionId -> product_options.id
ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_productOptionId_fkey"
    FOREIGN KEY ("productOptionId") REFERENCES "product_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: external_option_maps.productOptionId -> product_options.id
ALTER TABLE "external_option_maps" ADD CONSTRAINT "external_option_maps_productOptionId_fkey"
    FOREIGN KEY ("productOptionId") REFERENCES "product_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: product_option_group_assignments.productId -> products.id
ALTER TABLE "product_option_group_assignments" ADD CONSTRAINT "product_option_group_assignments_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: product_option_group_assignments.optionGroupId -> product_option_groups.id
ALTER TABLE "product_option_group_assignments" ADD CONSTRAINT "product_option_group_assignments_optionGroupId_fkey"
    FOREIGN KEY ("optionGroupId") REFERENCES "product_option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
