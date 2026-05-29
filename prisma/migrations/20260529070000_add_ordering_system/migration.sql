-- CreateEnum
CREATE TYPE "CustomerOrderStatus" AS ENUM ('DRAFT', 'PENDING', 'SENT_TO_LOYVERSE', 'FAILED_TO_SEND', 'ACCEPTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PickupType" AS ENUM ('ASAP', 'SCHEDULED');

-- AlterTable: Add online ordering fields to menu_products
ALTER TABLE "menu_products" ADD COLUMN     "description" TEXT,
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "is_popular" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_sold_out" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: stores
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "suburb" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "banner_image_url" TEXT,
    "logo_image_url" TEXT,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable: menu_modifier_groups
CREATE TABLE "menu_modifier_groups" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "min_selections" INTEGER NOT NULL DEFAULT 0,
    "max_selections" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_modifier_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable: menu_modifier_options
CREATE TABLE "menu_modifier_options" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_delta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_modifier_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable: customer_orders
CREATE TABLE "customer_orders" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "store_id" TEXT,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "customer_email" TEXT,
    "pickup_type" "PickupType" NOT NULL DEFAULT 'ASAP',
    "pickup_time" TIMESTAMP(3),
    "status" "CustomerOrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "loyverse_receipt_id" TEXT,
    "loyverse_sync_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable: customer_order_items
CREATE TABLE "customer_order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "item_id" TEXT,
    "item_name_snapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: customer_order_item_modifiers
CREATE TABLE "customer_order_item_modifiers" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "modifier_group_id" TEXT,
    "modifier_group_name" TEXT NOT NULL,
    "modifier_option_id" TEXT,
    "modifier_option_name" TEXT NOT NULL,
    "price_delta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_order_item_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");

-- CreateIndex
CREATE INDEX "menu_modifier_groups_product_id_idx" ON "menu_modifier_groups"("product_id");

-- CreateIndex
CREATE INDEX "menu_modifier_groups_sort_order_idx" ON "menu_modifier_groups"("sort_order");

-- CreateIndex
CREATE INDEX "menu_modifier_options_group_id_idx" ON "menu_modifier_options"("group_id");

-- CreateIndex
CREATE INDEX "menu_modifier_options_sort_order_idx" ON "menu_modifier_options"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "customer_orders_order_number_key" ON "customer_orders"("order_number");

-- CreateIndex
CREATE INDEX "customer_orders_status_idx" ON "customer_orders"("status");

-- CreateIndex
CREATE INDEX "customer_orders_created_at_idx" ON "customer_orders"("created_at");

-- CreateIndex
CREATE INDEX "customer_orders_store_id_idx" ON "customer_orders"("store_id");

-- CreateIndex
CREATE INDEX "customer_order_items_order_id_idx" ON "customer_order_items"("order_id");

-- CreateIndex
CREATE INDEX "customer_order_item_modifiers_order_item_id_idx" ON "customer_order_item_modifiers"("order_item_id");

-- AddForeignKey
ALTER TABLE "menu_modifier_groups" ADD CONSTRAINT "menu_modifier_groups_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "menu_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_modifier_options" ADD CONSTRAINT "menu_modifier_options_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "menu_modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_items" ADD CONSTRAINT "customer_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "customer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_item_modifiers" ADD CONSTRAINT "customer_order_item_modifiers_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "customer_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
