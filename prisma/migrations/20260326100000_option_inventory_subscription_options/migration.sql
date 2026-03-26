-- AlterTable: Add sku and tracksInventory to product_options
ALTER TABLE "product_options" ADD COLUMN "sku" TEXT;
ALTER TABLE "product_options" ADD COLUMN "tracksInventory" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: DailyOptionInventory
CREATE TABLE "daily_option_inventory" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "plannedQty" INTEGER NOT NULL DEFAULT 0,
    "reservedQty" INTEGER NOT NULL DEFAULT 0,
    "soldQty" INTEGER NOT NULL DEFAULT 0,
    "isSoldOut" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_option_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SubscriptionItemOption
CREATE TABLE "subscription_item_options" (
    "id" TEXT NOT NULL,
    "subscriptionItemId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "optionGroupNameSnapshot" TEXT NOT NULL,
    "optionNameSnapshot" TEXT NOT NULL,
    "priceDeltaSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_item_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_option_inventory_date_idx" ON "daily_option_inventory"("date");
CREATE UNIQUE INDEX "daily_option_inventory_optionId_date_key" ON "daily_option_inventory"("optionId", "date");

-- CreateIndex
CREATE INDEX "subscription_item_options_subscriptionItemId_idx" ON "subscription_item_options"("subscriptionItemId");
CREATE INDEX "subscription_item_options_optionId_idx" ON "subscription_item_options"("optionId");

-- AddForeignKey
ALTER TABLE "daily_option_inventory" ADD CONSTRAINT "daily_option_inventory_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "product_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_item_options" ADD CONSTRAINT "subscription_item_options_subscriptionItemId_fkey" FOREIGN KEY ("subscriptionItemId") REFERENCES "subscription_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_item_options" ADD CONSTRAINT "subscription_item_options_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "product_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
