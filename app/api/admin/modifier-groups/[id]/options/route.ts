import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Please enter an option name"),
  priceDelta: z.number().default(0),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  sku: z.string().nullable().optional(),
  tracksInventory: z.boolean().default(false),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id: groupId } = await params;

  const group = await prisma.productOptionGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    return NextResponse.json({ message: "Modifier group not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const option = await prisma.productOption.create({
      data: { optionGroupId: groupId, ...parsed.data },
    });
    return NextResponse.json({ option }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to create option" }, { status: 500 });
  }
}
