import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { IntegrationSource } from "@/app/generated/prisma/enums";
import { z } from "zod";

const modifierPatchSchema = z.object({
  tracksInventory: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  sku: z.string().optional().nullable(),
});

/** Fields that cannot be changed on a Loyverse-synced modifier */
const LOYVERSE_READONLY_FIELDS = ["name", "priceDelta"] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;

  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const option = await prisma.productOption.findUnique({
      where: { id },
      include: {
        optionGroup: {
          include: {
            product: { select: { id: true, name: true } },
            assignments: {
              include: {
                product: { select: { id: true, name: true } },
              },
            },
          },
        },
        externalOptionMappings: {
          where: { source: IntegrationSource.LOYVERSE },
          select: {
            id: true,
            externalOptionId: true,
            externalName: true,
            externalGroupId: true,
            externalGroupName: true,
            lastSyncedAt: true,
          },
        },
        dailyOptionInventory: {
          where: { date: today },
          select: {
            id: true,
            date: true,
            plannedQty: true,
            reservedQty: true,
            soldQty: true,
            isSoldOut: true,
            note: true,
          },
        },
      },
    });

    if (!option) {
      return NextResponse.json({ message: "Modifier not found" }, { status: 404 });
    }

    return NextResponse.json({ option });
  } catch (_error) {
    return NextResponse.json(
      { message: "Failed to load modifier info" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = modifierPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const existing = await prisma.productOption.findUnique({
    where: { id },
    include: {
      externalOptionMappings: {
        where: { source: IntegrationSource.LOYVERSE },
        select: { id: true },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ message: "Modifier not found" }, { status: 404 });
  }

  const isLoyverseSynced = existing.externalOptionMappings.length > 0;

  // Block changes to Loyverse read-only fields (schema-level safety, schema already restricts via modifierPatchSchema)
  if (isLoyverseSynced) {
    const reqBody = body as Record<string, unknown>;
    const attemptedReadOnly = LOYVERSE_READONLY_FIELDS.filter(
      (field) => field in reqBody && reqBody[field] !== undefined
    );
    if (attemptedReadOnly.length > 0) {
      return NextResponse.json(
        {
          message: `Loyverse-synced Modifier original fields cannot be edited: ${attemptedReadOnly.join(", ")}`,
          readOnlyFields: attemptedReadOnly,
        },
        { status: 403 }
      );
    }
  }

  try {
    const option = await prisma.productOption.update({
      where: { id },
      data,
    });

    return NextResponse.json({ option });
  } catch (_error) {
    return NextResponse.json(
      { message: "Failed to edit modifier" },
      { status: 500 }
    );
  }
}
