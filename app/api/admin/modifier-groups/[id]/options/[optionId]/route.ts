import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { z } from "zod";
import { IntegrationSource } from "@/app/generated/prisma/enums";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  priceDelta: z.number().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  sku: z.string().nullable().optional(),
  tracksInventory: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id: groupId, optionId } = await params;

  const option = await prisma.productOption.findFirst({
    where: { id: optionId, optionGroupId: groupId },
    include: {
      externalOptionMappings: {
        where: { source: IntegrationSource.LOYVERSE },
        select: { id: true },
      },
    },
  });
  if (!option) {
    return NextResponse.json({ message: "Option not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const isLoyverseSynced = option.externalOptionMappings.length > 0;
  const data = { ...parsed.data };
  // Loyverse-synced options: name and priceDelta are read-only
  if (isLoyverseSynced) {
    delete data.name;
    delete data.priceDelta;
  }

  try {
    const updated = await prisma.productOption.update({ where: { id: optionId }, data });
    return NextResponse.json({ option: updated });
  } catch {
    return NextResponse.json({ message: "Failed to edit option" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id: groupId, optionId } = await params;

  const option = await prisma.productOption.findFirst({
    where: { id: optionId, optionGroupId: groupId },
    include: {
      externalOptionMappings: {
        where: { source: IntegrationSource.LOYVERSE },
        select: { id: true },
      },
    },
  });
  if (!option) {
    return NextResponse.json({ message: "Option not found" }, { status: 404 });
  }

  if (option.externalOptionMappings.length > 0) {
    return NextResponse.json(
      { message: "Cannot delete Loyverse-synced options" },
      { status: 403 }
    );
  }

  try {
    await prisma.productOption.delete({ where: { id: optionId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Failed to delete option" }, { status: 500 });
  }
}
