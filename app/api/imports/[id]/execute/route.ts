import { NextRequest, NextResponse } from "next/server";
import { executeImport } from "@/lib/services/importService";
import { triggerPostImportTasks } from "@/lib/services/schedulerService";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const { id } = await params;
    const body = await req.json() as { overwrite?: boolean };
    const result = await executeImport(id, { overwrite: body.overwrite ?? false });

    // Fire-and-forget: schedule external-factor collection for imported dates
    triggerPostImportTasks(id).catch(() => {/* never block response */});

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "import failed to execute";
    return NextResponse.json({ message }, { status: 500 });
  }
}
