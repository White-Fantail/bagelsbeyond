-- AlterTable
ALTER TABLE "loyverse_full_sync_logs" ADD COLUMN "itemModifierLinksAttempted" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "loyverse_full_sync_logs" ADD COLUMN "itemModifierLinksPersisted" INTEGER NOT NULL DEFAULT 0;
