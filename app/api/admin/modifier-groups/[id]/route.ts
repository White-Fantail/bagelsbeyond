import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { z } from "zod";
import { IntegrationSource } from "@/app/generated/prisma/enums";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  minSelect: z.number().int().min(0).optional(),
  maxSelect: z.number().int().min(1).optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;

  const group = await prisma.productOptionGroup.findUnique({
    where: { id },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
      externalMapping: { select: { externalOptionGroupId: true, lastSyncedAt: true } },
    },
  });

  if (!group) {
    return NextResponse.json({ message: "Modifier group not found" }, { status: 404 });
  }

  return NextResponse.json({ group });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;

  const group = await prisma.productOptionGroup.findUnique({
    where: { id },
    include: { externalMapping: { select: { externalOptionGroupId: true } } },
  });
  if (!group) {
    return NextResponse.json({ message: "Modifier group not found" }, { status: 404 });
  }

  // Loyverse-synced groups: name is read-only
  const isLoyverseSynced = group.externalMapping !== null;

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

  const data = { ...parsed.data };
  if (isLoyverseSynced) {
    delete data.name;
  }

  try {
    const updated = await prisma.productOptionGroup.update({
      where: { id },
      data,
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json({ group: updated });
  } catch {
    return NextResponse.json({ message: "Failed to edit modifier group" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;

  const group = await prisma.productOptionGroup.findUnique({
    where: { id },
    include: { externalMapping: { select: { externalOptionGroupId: true } } },
  });
  if (!group) {
    return NextResponse.json({ message: "Modifier group not found" }, { status: 404 });
  }

  if (group.externalMapping !== null) {
    return NextResponse.json(
      { message: "Cannot delete Loyverse-synced groups" },
      { status: 403 }
    );
  }

  try {
    // Clean up any external option maps associated with options in this group
    const options = await prisma.productOption.findMany({
      where: { optionGroupId: id },
      select: { id: true },
    });
    if (options.length > 0) {
      await prisma.externalOptionMap.deleteMany({
        where: {
          option: { optionGroupId: id },
          source: IntegrationSource.LOYVERSE,
        },
      });
    }

    await prisma.productOptionGroup.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Failed to delete modifier group" }, { status: 500 });
  }
}
