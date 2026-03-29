import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { z } from "zod";

// ─── GET /api/admin/categories ────────────────────────────────────────────────
// Returns canonical categories. Falls back to LoyverseCategory if no canonical
// categories exist yet (for backward compatibility before migration is run).

export async function GET() {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    // Prefer canonical Category table (new architecture)
    const canonicalCount = await prisma.category.count();

    if (canonicalCount > 0) {
      const categories = await prisma.category.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          isVisible: true,
          displayOrder: true,
          isActive: true,
          updatedAt: true,
          channelMapping: {
            where: { channel: "LOYVERSE" },
            select: { status: true, lastSyncAt: true },
          },
        },
      });
      return NextResponse.json({ categories, source: "canonical" });
    }

    // Fallback: use LoyverseCategory (legacy — before backfill is run)
    const categories = await prisma.loyverseCategory.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, color: true, isVisible: true, displayOrder: true, updatedAt: true },
    });
    return NextResponse.json({ categories, source: "loyverse_legacy" });
  } catch {
    return NextResponse.json(
      { message: "Failed to load categories list" },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/admin/categories/:id ─────────────────────────────────────────
// Update a canonical category's display order and visibility.

const patchSchema = z.object({
  displayOrder: z.number().int().optional(),
  isVisible: z.boolean().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "Missing category id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid input", errors: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const category = await prisma.category.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ category });
  } catch {
    return NextResponse.json({ message: "Failed to update category" }, { status: 500 });
  }
}

