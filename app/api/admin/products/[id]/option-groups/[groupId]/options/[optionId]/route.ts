import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { z } from "zod";

const optionPatchSchema = z.object({
  name: z.string().min(1, "Please enter an option name").optional(),
  priceDelta: z.number().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  sku: z.string().optional().nullable(),
  tracksInventory: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string; optionId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id: productId, groupId, optionId } = await params;

  const option = await prisma.productOption.findFirst({
    where: { id: optionId, optionGroupId: groupId, optionGroup: { productId } },
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

  const parsed = optionPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.productOption.update({
      where: { id: optionId },
      data: parsed.data,
    });
    return NextResponse.json({ option: updated });
  } catch (_error) {
    return NextResponse.json({ message: "Options Edit failed" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string; optionId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id: productId, groupId, optionId } = await params;

  const option = await prisma.productOption.findFirst({
    where: { id: optionId, optionGroupId: groupId, optionGroup: { productId } },
  });
  if (!option) {
    return NextResponse.json({ message: "Option not found" }, { status: 404 });
  }

  try {
    await prisma.productOption.delete({ where: { id: optionId } });
    return NextResponse.json({ message: "Option deleted" });
  } catch (_error) {
    return NextResponse.json({ message: "Options Delete failed" }, { status: 500 });
  }
}
