import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { menuModifierOptionSchema } from "@/lib/validations";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string; groupId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { productId, groupId } = await params;

  const group = await prisma.menuModifierGroup.findUnique({
    where: { id: groupId, productId },
    select: { id: true },
  });
  if (!group) {
    return NextResponse.json({ message: "Modifier group not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = menuModifierOptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const option = await prisma.menuModifierOption.create({
    data: { ...parsed.data, groupId },
  });

  return NextResponse.json({ option }, { status: 201 });
}
