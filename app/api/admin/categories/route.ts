import { NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

export async function GET() {
  const auth = await apiRequireAdmin();
  if (isNextResponse(auth)) return auth;

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ categories });
}
