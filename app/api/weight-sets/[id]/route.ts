import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/weight-sets/[id] – fetch one set with entries
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const { id } = await params;
    const set = await prisma.weightSet.findUnique({
      where: { id },
      include: { entries: { orderBy: { factorKey: "asc" } } },
    });
    if (!set) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json(set);
  } catch (_error) {
    return NextResponse.json({ message: "Failed to load weight set" }, { status: 500 });
  }
}

// DELETE /api/weight-sets/[id] – delete a set (cannot delete active set)
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const { id } = await params;
    const set = await prisma.weightSet.findUnique({ where: { id } });
    if (!set) return NextResponse.json({ message: "Not found" }, { status: 404 });
    if (set.isActive) return NextResponse.json({ message: "Cannot delete the active weight set" }, { status: 400 });

    await prisma.weightSet.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
  } catch (_error) {
    return NextResponse.json({ message: "Delete failed" }, { status: 500 });
  }
}
