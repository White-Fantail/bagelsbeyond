-- CreateEnum
CREATE TYPE "CustomerOrderStatus" AS ENUM ('DRAFT', 'PENDING', 'SENT_TO_LOYVERSE', 'FAILED_TO_SEND', 'ACCEPTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PickupType" AS ENUM ('ASAP', 'SCHEDULED');

-- AlterTable: Add online ordering fields to menu_products
ALTER TABLE "menu_products" ADD COLUMN     "description" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "isPopular" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSoldOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: stores
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "suburb" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "bannerImageUrl" TEXT,
    "logoImageUrl" TEXT,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable: menu_modifier_groups
CREATE TABLE "menu_modifier_groups" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "minSelections" INTEGER NOT NULL DEFAULT 0,
    "maxSelections" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_modifier_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable: menu_modifier_options
CREATE TABLE "menu_modifier_options" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDelta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_modifier_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable: customer_orders
CREATE TABLE "customer_orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "storeId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "pickupType" "PickupType" NOT NULL DEFAULT 'ASAP',
    "pickupTime" TIMESTAMP(3),
    "status" "CustomerOrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "loyverseReceiptId" TEXT,
    "loyverseSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable: customer_order_items
CREATE TABLE "customer_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT,
    "itemNameSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: customer_order_item_modifiers
CREATE TABLE "customer_order_item_modifiers" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "modifierGroupId" TEXT,
    "modifierGroupName" TEXT NOT NULL,
    "modifierOptionId" TEXT,
    "modifierOptionName" TEXT NOT NULL,
    "priceDelta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_order_item_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");

-- CreateIndex
CREATE INDEX "menu_modifier_groups_productId_idx" ON "menu_modifier_groups"("productId");

-- CreateIndex
CREATE INDEX "menu_modifier_groups_sortOrder_idx" ON "menu_modifier_groups"("sortOrder");

-- CreateIndex
CREATE INDEX "menu_modifier_options_groupId_idx" ON "menu_modifier_options"("groupId");

-- CreateIndex
CREATE INDEX "menu_modifier_options_sortOrder_idx" ON "menu_modifier_options"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "customer_orders_orderNumber_key" ON "customer_orders"("orderNumber");

-- CreateIndex
CREATE INDEX "customer_orders_status_idx" ON "customer_orders"("status");

-- CreateIndex
CREATE INDEX "customer_orders_createdAt_idx" ON "customer_orders"("createdAt");

-- CreateIndex
CREATE INDEX "customer_orders_storeId_idx" ON "customer_orders"("storeId");

-- CreateIndex
CREATE INDEX "customer_order_items_orderId_idx" ON "customer_order_items"("orderId");

-- CreateIndex
CREATE INDEX "customer_order_item_modifiers_orderItemId_idx" ON "customer_order_item_modifiers"("orderItemId");

-- AddForeignKey
ALTER TABLE "menu_modifier_groups" ADD CONSTRAINT "menu_modifier_groups_productId_fkey" FOREIGN KEY ("productId") REFERENCES "menu_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_modifier_options" ADD CONSTRAINT "menu_modifier_options_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "menu_modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_items" ADD CONSTRAINT "customer_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "customer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_item_modifiers" ADD CONSTRAINT "customer_order_item_modifiers_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "customer_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
