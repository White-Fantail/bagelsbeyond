import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { menuModifierOptionSchema } from "@/lib/validations";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string; groupId: string; optionId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { groupId, optionId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = menuModifierOptionSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const option = await prisma.menuModifierOption.update({
      where: { id: optionId, groupId },
      data: parsed.data,
    });
    return NextResponse.json({ option });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Record to update not found")) {
      return NextResponse.json({ message: "Modifier option not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Failed to update modifier option" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string; groupId: string; optionId: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { groupId, optionId } = await params;

  try {
    await prisma.menuModifierOption.delete({
      where: { id: optionId, groupId },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Record to delete does not exist")) {
      return NextResponse.json({ message: "Modifier option not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Failed to delete modifier option" }, { status: 500 });
  }
}
