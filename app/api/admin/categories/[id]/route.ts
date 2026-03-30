import { NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiRequireAdmin();
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ category });
}
