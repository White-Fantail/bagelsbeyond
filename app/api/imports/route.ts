import { NextRequest, NextResponse } from "next/server";
import { listImportJobs, createImportJob } from "@/lib/services/importService";

export async function GET() {
  try {
    const jobs = await listImportJobs();
    return NextResponse.json(jobs);
  } catch (_error) {
    return NextResponse.json({ message: "가져오기 목록을 불러오는데 실패했습니다" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { fileName?: string; csvText?: string };
    const { csvText } = body;

    if (!csvText || !csvText.trim()) {
      return NextResponse.json({ message: "CSV 내용이 필요합니다" }, { status: 400 });
    }

    // Auto-generate a file name when only paste text is provided
    const fileName =
      body.fileName?.trim() ||
      `paste_${new Date().toISOString().slice(0, 10)}.csv`;

    const job = await createImportJob({ fileName, csvText });
    return NextResponse.json(job, { status: 201 });
  } catch (_error) {
    console.error(_error);
    return NextResponse.json({ message: "가져오기 작업 생성에 실패했습니다" }, { status: 500 });
  }
}
