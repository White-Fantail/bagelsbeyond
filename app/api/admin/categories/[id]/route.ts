import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { z } from "zod";

const patchSchema = z.object({
  isVisible: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid request", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: "Nothing to update" }, { status: 400 });
  }

  try {
    const updated = await prisma.loyverseCategory.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
      select: { id: true, name: true, isVisible: true, displayOrder: true },
    });
    return NextResponse.json({ category: updated });
  } catch {
    return NextResponse.json(
      { message: "Category not found or update failed" },
      { status: 404 }
    );
  }
}
