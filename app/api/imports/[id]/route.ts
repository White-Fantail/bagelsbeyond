import { NextRequest, NextResponse } from "next/server";
import { getImportJobById } from "@/lib/services/importService";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const { id } = await params;
    const job = await getImportJobById(id);

    if (!job) {
      return NextResponse.json({ message: "Import task not found" }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (_error) {
    return NextResponse.json({ message: "Failed to load import task" }, { status: 500 });
  }
}
