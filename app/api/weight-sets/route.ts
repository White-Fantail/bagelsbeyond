import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";

const createSetSchema = z.object({
  name: z.string().min(1, "Please enter a name"),
  description: z.string().optional(),
  source: z.enum(["manual", "auto_optimized"]).default("manual"),
  entries: z
    .array(
      z.object({
        factorKey: z.string().min(1),
        weightValue: z.coerce.number(),
        isActive: z.boolean().default(true),
        description: z.string().optional(),
      })
    )
    .optional(),
});

// GET /api/weight-sets – list all weight sets (without entries)
export async function GET() {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const sets = await prisma.weightSet.findMany({
      orderBy: { version: "desc" },
    });
    return NextResponse.json(sets);
  } catch (_error) {
    return NextResponse.json({ message: "Failed to load weight sets" }, { status: 500 });
  }
}

// POST /api/weight-sets – create a new weight set version
// If no entries are provided in the body the current PredictionWeight rows are snapshotted.
export async function POST(req: NextRequest) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const body = await req.json();
    const parsed = createSetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid input", errors: parsed.error.flatten() }, { status: 400 });
    }

    const { name, description, source, entries: bodyEntries } = parsed.data;

    // Determine entries to snapshot
    let entriesToSave: { factorKey: string; weightValue: number; isActive: boolean; description?: string }[] = [];

    if (bodyEntries && bodyEntries.length > 0) {
      entriesToSave = bodyEntries.map((e) => ({
        factorKey: e.factorKey,
        weightValue: e.weightValue,
        isActive: e.isActive,
        description: e.description,
      }));
    } else {
      // Snapshot current active weights
      const current = await prisma.predictionWeight.findMany({ orderBy: { factorKey: "asc" } });
      entriesToSave = current.map((w) => ({
        factorKey: w.factorKey,
        weightValue: w.weightValue,
        isActive: w.isActive,
        description: w.description ?? undefined,
      }));
    }

    // Determine next version number
    const latest = await prisma.weightSet.findFirst({ orderBy: { version: "desc" } });
    const nextVersion = (latest?.version ?? 0) + 1;

    const weightSet = await prisma.weightSet.create({
      data: {
        version: nextVersion,
        name,
        description,
        isActive: false,
        source,
        entries: { create: entriesToSave },
      },
      include: { entries: true },
    });

    return NextResponse.json(weightSet, { status: 201 });
  } catch (_error) {
    return NextResponse.json({ message: "Failed to create weight set" }, { status: 500 });
  }
}
