import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { z } from "zod";

const reorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      displayOrder: z.number().int().min(0),
    })
  ),
});

export async function POST(request: Request) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid request", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { items } = parsed.data;

  try {
    await prisma.$transaction(
      items.map(({ id, displayOrder }) =>
        prisma.loyverseCategory.update({
          where: { id },
          data: { displayOrder, updatedAt: new Date() },
        })
      )
    );
    return NextResponse.json({ success: true, updated: items.length });
  } catch {
    return NextResponse.json(
      { message: "Failed to save order" },
      { status: 500 }
    );
  }
}
