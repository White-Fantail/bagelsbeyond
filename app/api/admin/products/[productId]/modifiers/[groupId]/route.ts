import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { menuModifierGroupSchema } from "@/lib/validations";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string; groupId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { productId, groupId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = menuModifierGroupSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const group = await prisma.menuModifierGroup.update({
      where: { id: groupId, productId },
      data: parsed.data,
      include: { options: true },
    });
    return NextResponse.json({ group });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Record to update not found")) {
      return NextResponse.json({ message: "Modifier group not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Failed to update modifier group" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string; groupId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { productId, groupId } = await params;

  try {
    await prisma.menuModifierGroup.delete({
      where: { id: groupId, productId },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Record to delete does not exist")) {
      return NextResponse.json({ message: "Modifier group not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Failed to delete modifier group" }, { status: 500 });
  }
}
