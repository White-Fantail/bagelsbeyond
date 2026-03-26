-- Phase 5B: Add ExternalOptionGroupMap for rename-safe modifier group sync

CREATE TABLE "external_option_group_maps" (
    "id"                    TEXT NOT NULL,
    "source"                "IntegrationSource" NOT NULL,
    "externalOptionGroupId" TEXT NOT NULL,
    "optionGroupId"         TEXT NOT NULL,
    "lastSyncedAt"          TIMESTAMP(3),
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_option_group_maps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_option_group_maps_optionGroupId_key"
    ON "external_option_group_maps"("optionGroupId");

CREATE UNIQUE INDEX "external_option_group_maps_source_externalOptionGroupId_key"
    ON "external_option_group_maps"("source", "externalOptionGroupId");

CREATE INDEX "external_option_group_maps_optionGroupId_idx"
    ON "external_option_group_maps"("optionGroupId");

ALTER TABLE "external_option_group_maps"
    ADD CONSTRAINT "external_option_group_maps_optionGroupId_fkey"
    FOREIGN KEY ("optionGroupId")
    REFERENCES "product_option_groups"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
