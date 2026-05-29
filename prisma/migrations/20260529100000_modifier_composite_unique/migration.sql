-- Drop the global unique constraints on loyverseId (they prevented shared modifier sets across products)
DROP INDEX IF EXISTS "menu_modifier_groups_loyverseId_key";
DROP INDEX IF EXISTS "menu_modifier_options_loyverseId_key";

-- Add composite unique constraints instead: (productId, loyverseId) and (groupId, loyverseId)
-- NULL values are excluded from uniqueness checks in PostgreSQL, so rows without a loyverseId are unaffected.
CREATE UNIQUE INDEX "menu_modifier_groups_productId_loyverseId_key"
  ON "menu_modifier_groups"("productId", "loyverseId")
  WHERE "loyverseId" IS NOT NULL;

CREATE UNIQUE INDEX "menu_modifier_options_groupId_loyverseId_key"
  ON "menu_modifier_options"("groupId", "loyverseId")
  WHERE "loyverseId" IS NOT NULL;
