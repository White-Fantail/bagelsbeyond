import { NextRequest, NextResponse } from "next/server";
import { listImportJobs, createImportJob } from "@/lib/services/importService";
import { apiRequireStaffOrAdmin, isNextResponse } from "@/lib/auth/dal";

export async function GET() {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const jobs = await listImportJobs();
    return NextResponse.json(jobs);
  } catch (_error) {
    return NextResponse.json({ message: "Failed to load imports list" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await apiRequireStaffOrAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const body = await req.json() as { fileName?: string; csvText?: string };
    const { csvText } = body;

    if (!csvText || !csvText.trim()) {
      return NextResponse.json({ message: "CSV content is required" }, { status: 400 });
    }

    // Auto-generate a file name when only paste text is provided
    const fileName =
      body.fileName?.trim() ||
      `paste_${new Date().toISOString().slice(0, 10)}.csv`;

    const job = await createImportJob({ fileName, csvText });
    return NextResponse.json(job, { status: 201 });
  } catch (_error) {
    console.error(_error);
    return NextResponse.json({ message: "Failed to create import task" }, { status: 500 });
  }
}
