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
        { message: "입력값이 올바르지 않습니다", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const weight = await prisma.predictionWeight.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(weight);
  } catch (_error) {
    return NextResponse.json({ message: "수정에 실패했습니다" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    await prisma.predictionWeight.delete({ where: { id } });
    return NextResponse.json({ message: "삭제되었습니다" });
  } catch (_error) {
    return NextResponse.json({ message: "삭제에 실패했습니다" }, { status: 500 });
  }
}
