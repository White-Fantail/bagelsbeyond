import { NextRequest, NextResponse } from "next/server";
import { executeImport } from "@/lib/services/importService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json() as { overwrite?: boolean };
    const result = await executeImport(id, { overwrite: body.overwrite ?? false });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "임포트 실행에 실패했습니다";
    return NextResponse.json({ message }, { status: 500 });
  }
}
