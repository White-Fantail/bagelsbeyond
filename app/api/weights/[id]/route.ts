import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { weightSchema } from "@/lib/validations";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = weightSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid input", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const weight = await prisma.predictionWeight.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(weight);
  } catch (_error) {
    return NextResponse.json({ message: "Edit failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    await prisma.predictionWeight.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
  } catch (_error) {
    return NextResponse.json({ message: "Delete failed" }, { status: 500 });
  }
}
