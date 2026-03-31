-- CreateTable
CREATE TABLE "weight_sets" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weight_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weight_set_entries" (
    "id" TEXT NOT NULL,
    "weightSetId" TEXT NOT NULL,
    "factorKey" TEXT NOT NULL,
    "weightValue" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weight_set_entries_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "weight_set_entries" ADD CONSTRAINT "weight_set_entries_weightSetId_fkey" FOREIGN KEY ("weightSetId") REFERENCES "weight_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
