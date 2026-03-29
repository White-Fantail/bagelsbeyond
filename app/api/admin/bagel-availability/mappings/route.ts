import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma/client";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await apiRequireAdmin();
  if (isNextResponse(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const bagelTypeId = searchParams.get("bagelTypeId") ?? undefined;

  try {
    const mappings = await prisma.channelBagelMapping.findMany({
      where: bagelTypeId ? { bagelTypeId } : undefined,
      orderBy: [{ bagelTypeId: "asc" }, { channel: "asc" }],
      include: { bagelType: { select: { name: true, code: true } } },
    });
    return NextResponse.json(mappings);
  } catch (err) {
    console.error("[GET /api/admin/bagel-availability/mappings]", err);
    return NextResponse.json({ message: "Failed to load mappings" }, { status: 500 });
  }
}

const mappingCreateSchema = z.object({
  bagelTypeId: z.string(),
  channel: z.enum(["loyverse", "uber_eats", "doordash"]),
  remoteEntityType: z
    .enum(["item", "option", "modifier_option", "category_item", "unknown"])
    .default("unknown"),
  remoteEntityId: z.string().min(1),
  remoteMenuId: z.string().optional().nullable(),
  remoteStoreId: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  isEnabled: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const auth = await apiRequireAdmin();
  if (isNextResponse(auth)) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = mappingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid request", errors: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const mapping = await prisma.channelBagelMapping.create({
      data: {
        ...parsed.data,
        // Prisma nullable JSON requires explicit cast for null values
        metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    return NextResponse.json(mapping, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/bagel-availability/mappings]", err);
    return NextResponse.json({ message: "Failed to create mapping" }, { status: 500 });
  }
}
