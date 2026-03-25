import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createOcrImportJob, processOcrJob } from "@/lib/services/ocrService";

export async function GET() {
  try {
    const jobs = await prisma.ocrImportJob.findMany({
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });
    return NextResponse.json(jobs);
  } catch (_error) {
    return NextResponse.json({ message: "가져오기 목록을 불러오는데 실패했습니다" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sourceFileName, rawText } = body as { sourceFileName: string; rawText?: string };

    if (!sourceFileName) {
      return NextResponse.json({ message: "파일명을 입력해주세요" }, { status: 400 });
    }

    const job = await createOcrImportJob({ sourceFileName });

    // If rawText is provided (e.g., from client-side text input), update job and process
    if (rawText) {
      await prisma.ocrImportJob.update({
        where: { id: job.id },
        data: { rawText },
      });
    }

    // Process the job (parse OCR text into items)
    const processed = await processOcrJob(job.id);

    return NextResponse.json(processed, { status: 201 });
  } catch (_error) {
    console.error(_error);
    return NextResponse.json({ message: "가져오기 작업 생성에 실패했습니다" }, { status: 500 });
  }
}
