import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { z } from "zod";

const assignSchema = z.object({
  groupId: z.string().min(1, "Please enter a Modifier Group ID"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id: productId } = await params;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ message: "Product not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { groupId } = parsed.data;

  const group = await prisma.productOptionGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    return NextResponse.json({ message: "Modifier group not found" }, { status: 404 });
  }

  try {
    await prisma.productOptionGroupAssignment.upsert({
      where: { productId_optionGroupId: { productId, optionGroupId: groupId } },
      create: { productId, optionGroupId: groupId },
      update: {},
    });

    const updatedGroup = await prisma.productOptionGroup.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        minSelect: true,
        maxSelect: true,
        isRequired: true,
        sortOrder: true,
        options: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            priceDelta: true,
            isActive: true,
            sortOrder: true,
            sku: true,
            tracksInventory: true,
          },
        },
      },
    });

    return NextResponse.json({ group: updatedGroup }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to link modifier group" }, { status: 500 });
  }
}
