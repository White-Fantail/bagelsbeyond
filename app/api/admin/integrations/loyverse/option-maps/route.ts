// GET  /api/admin/integrations/loyverse/option-maps  — list all ExternalOptionMap rows
// POST /api/admin/integrations/loyverse/option-maps  — create or update a mapping

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { IntegrationSource } from "@/app/generated/prisma/enums";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ── GET: list all option mappings (with option + group info) ──────────────────

export async function GET() {
  await requireAdmin();

  const mappings = await prisma.externalOptionMap.findMany({
    where: { source: IntegrationSource.LOYVERSE },
    include: {
      option: {
        select: {
          id: true,
          name: true,
          isActive: true,
          tracksInventory: true,
          priceDelta: true,
          optionGroup: {
            select: {
              id: true,
              name: true,
              product: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(mappings);
}

// ── POST: create or update a mapping ─────────────────────────────────────────

const createSchema = z.object({
  productOptionId: z.string().min(1),
  externalOptionId: z.string().min(1),
  externalName: z.string().optional(),
  externalGroupId: z.string().optional(),
  externalGroupName: z.string().optional(),
});

export async function POST(request: Request) {
  await requireAdmin();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error" },
      { status: 400 }
    );
  }

  const { productOptionId, externalOptionId, externalName, externalGroupId, externalGroupName } =
    parsed.data;

  // Verify the option exists
  const option = await prisma.productOption.findUnique({
    where: { id: productOptionId },
  });
  if (!option) {
    return NextResponse.json({ error: "ProductOption not found" }, { status: 404 });
  }

  // Check for conflicting externalOptionId mapping (different option)
  const conflictByExternal = await prisma.externalOptionMap.findUnique({
    where: {
      source_externalOptionId: {
        source: IntegrationSource.LOYVERSE,
        externalOptionId,
      },
    },
  });
  if (conflictByExternal && conflictByExternal.productOptionId !== productOptionId) {
    return NextResponse.json(
      {
        error: `externalOptionId "${externalOptionId}" is already mapped to a different internal option`,
      },
      { status: 409 }
    );
  }

  const mapping = await prisma.externalOptionMap.upsert({
    where: {
      source_productOptionId: {
        source: IntegrationSource.LOYVERSE,
        productOptionId,
      },
    },
    update: {
      externalOptionId,
      externalName: externalName ?? null,
      externalGroupId: externalGroupId ?? null,
      externalGroupName: externalGroupName ?? null,
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    },
    create: {
      source: IntegrationSource.LOYVERSE,
      productOptionId,
      externalOptionId,
      externalName: externalName ?? null,
      externalGroupId: externalGroupId ?? null,
      externalGroupName: externalGroupName ?? null,
      mappingType: "MODIFIER",
      lastSyncedAt: new Date(),
    },
    include: {
      option: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json(mapping, { status: 201 });
}
