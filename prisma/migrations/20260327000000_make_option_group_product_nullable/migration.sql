-- AlterTable: make productId nullable on product_option_groups
-- This allows modifier groups to be managed independently from the modifier menu
-- before being assigned to any product.
ALTER TABLE "product_option_groups" DROP CONSTRAINT "product_option_groups_productId_fkey";

ALTER TABLE "product_option_groups" ALTER COLUMN "productId" DROP NOT NULL;

ALTER TABLE "product_option_groups" ADD CONSTRAINT "product_option_groups_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
