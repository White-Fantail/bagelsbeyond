import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await apiRequireAdmin();
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation error", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { isActive } = parsed.data;
  if (isActive === undefined) {
    return NextResponse.json({ message: "Nothing to update" }, { status: 400 });
  }

  const existing = await prisma.modifierGroup.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: "Modifier group not found" }, { status: 404 });
  }

  const updated = await prisma.modifierGroup.update({
    where: { id },
    data: { isActive },
    select: {
      id: true,
      name: true,
      isActive: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(updated);
}
