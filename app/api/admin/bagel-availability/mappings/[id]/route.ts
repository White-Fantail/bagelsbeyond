import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma/client";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const mappingUpdateSchema = z.object({
  remoteEntityType: z
    .enum(["item", "option", "modifier_option", "category_item", "unknown"])
    .optional(),
  remoteEntityId: z.string().min(1).optional(),
  remoteMenuId: z.string().optional().nullable(),
  remoteStoreId: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  isEnabled: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await apiRequireAdmin();
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = mappingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid request", errors: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const mapping = await prisma.channelBagelMapping.update({
      where: { id },
      data: {
        ...parsed.data,
        // Prisma nullable JSON requires explicit cast for null values
        metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    return NextResponse.json(mapping);
  } catch (err) {
    console.error("[PATCH /api/admin/bagel-availability/mappings/[id]]", err);
    return NextResponse.json({ message: "Failed to update mapping" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await apiRequireAdmin();
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  try {
    await prisma.channelBagelMapping.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/admin/bagel-availability/mappings/[id]]", err);
    return NextResponse.json({ message: "Failed to delete mapping" }, { status: 500 });
  }
}
