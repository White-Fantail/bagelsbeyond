// DELETE /api/admin/integrations/loyverse/option-maps/[id] — remove a mapping

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();

  const { id } = await params;

  const existing = await prisma.externalOptionMap.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
  }

  await prisma.externalOptionMap.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
