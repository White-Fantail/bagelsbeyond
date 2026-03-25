import { NextRequest, NextResponse } from "next/server";
import { getImportJobById } from "@/lib/services/importService";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await getImportJobById(id);

    if (!job) {
      return NextResponse.json({ message: "가져오기 작업을 찾을 수 없습니다" }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (_error) {
    return NextResponse.json({ message: "가져오기 작업을 불러오는데 실패했습니다" }, { status: 500 });
  }
}
