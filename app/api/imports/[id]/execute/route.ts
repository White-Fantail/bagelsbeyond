import { NextRequest, NextResponse } from "next/server";
import { executeImport } from "@/lib/services/importService";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const { id } = await params;
    const body = (await req.json()) as { overwrite?: boolean };
    const result = await executeImport(id, { overwrite: body.overwrite ?? false });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "import failed to execute";
    return NextResponse.json({ message }, { status: 500 });
  }
}
