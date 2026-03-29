import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { z } from "zod";

const patchSchema = z.object({
  isVisible: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
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
    // Try canonical Category first (new architecture)
    const canonicalCategory = await prisma.category.findUnique({ where: { id } });
    if (canonicalCategory) {
      const updated = await prisma.category.update({
        where: { id },
        data,
        select: { id: true, name: true, isVisible: true, displayOrder: true, isActive: true },
      });
      return NextResponse.json({ category: updated });
    }

    // Fallback: update LoyverseCategory (legacy — before backfill is run)
    const updated = await prisma.loyverseCategory.update({
      where: { id },
      data: { isVisible: data.isVisible, displayOrder: data.displayOrder, updatedAt: new Date() },
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

