import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiRequireAuth, isNextResponse } from "@/lib/auth/dal";

const patchSchema = z.object({
  name: z
    .string()
    .min(1, "Please enter your name")
    .max(100, "Name is too long")
    .trim(),
});

export async function PATCH(req: NextRequest) {
  // Verify session — returns session or NextResponse error
  const authResult = await apiRequireAuth();
  if (isNextResponse(authResult)) return authResult;

  // Parse & validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name } = parsed.data;

  try {
    // Always update by session userId — never accept id from client
    const updated = await prisma.user.update({
      where: { id: authResult.userId },
      data: { name },
      select: { id: true, name: true, email: true, role: true, updatedAt: true },
    });

    return NextResponse.json({ user: updated });
  } catch {
    return NextResponse.json(
      { message: "Failed to update profile" },
      { status: 500 }
    );
  }
}
