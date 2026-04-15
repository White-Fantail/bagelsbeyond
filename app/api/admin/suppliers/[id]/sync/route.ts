import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import {
  executeSuppilerSync,
  listSyncLogs,
} from "@/lib/services/supplierSyncService";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id: supplierId } = await params;

  const url = new URL(req.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "20", 10),
    100
  );

  try {
    const syncLogs = await listSyncLogs(supplierId, limit);
    return NextResponse.json({ syncLogs });
  } catch {
    return NextResponse.json(
      { message: "Failed to fetch sync logs" },
      { status: 500 }
    );
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id: supplierId } = await params;

  try {
    const result = await executeSuppilerSync(supplierId, authResult.userId);
    return NextResponse.json({ result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to execute sync";
    return NextResponse.json({ message }, { status: 500 });
  }
}
