import { NextRequest, NextResponse } from "next/server";
import { refreshExternalFactorsForRecord } from "@/lib/services/externalFactorService";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await refreshExternalFactorsForRecord(id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "외부 데이터 수집에 실패했습니다";
    return NextResponse.json({ message }, { status: 500 });
  }
}
