import { NextRequest, NextResponse } from "next/server";
import { approveOcrImportItem, rejectOcrImportItem } from "@/lib/services/ocrService";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const body = await req.json() as { action: string };

    if (body.action === "approve") {
      const result = await approveOcrImportItem(itemId);
      return NextResponse.json(result);
    } else if (body.action === "reject") {
      const item = await rejectOcrImportItem(itemId);
      return NextResponse.json({ item });
    }

    return NextResponse.json({ message: "잘못된 액션입니다" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "처리에 실패했습니다";
    return NextResponse.json({ message }, { status: 500 });
  }
}
