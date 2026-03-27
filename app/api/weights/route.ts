import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { weightSchema } from "@/lib/validations";

export async function GET() {
  try {
    const weights = await prisma.predictionWeight.findMany({
      orderBy: { factorKey: "asc" },
    });
    return NextResponse.json(weights);
  } catch (_error) {
    return NextResponse.json({ message: "Failed to load data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = weightSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid input", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const weight = await prisma.predictionWeight.create({ data: parsed.data });
    return NextResponse.json(weight, { status: 201 });
  } catch (_error) {
    return NextResponse.json({ message: "Save failed" }, { status: 500 });
  }
}
