import { prisma } from "@/lib/db";
import type { OcrImportJob, OcrImportItem } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ParsedOcrRecord = {
  detectedDate?: string; // ISO date string
  extractedBagelsBaked?: number;
  extractedBagelsLeft?: number;
  extractedStoreSales?: number;
  extractedUberSales?: number;
  extractedDoordashSales?: number;
  extractedOtherSales?: number;
  extractedNotes?: string;
  confidenceScore?: number;
};

// ─── OCR Processing ───────────────────────────────────────────────────────────

/**
 * Runs OCR on an uploaded image file.
 * TODO: Replace with real OCR implementation (e.g., OpenAI Vision API, Google Cloud Vision)
 * Set OPENAI_API_KEY or GOOGLE_CLOUD_VISION_KEY in .env
 */
export async function runOcrOnImage(_file: Buffer | string): Promise<string> {
  // Placeholder: return empty raw text
  // TODO: Implement actual OCR call
  return "";
}

/**
 * Parses raw OCR text into structured records.
 * TODO: Replace with real parsing logic or LLM-based extraction (e.g., OpenAI GPT-4)
 */
export function parseOcrTextToRecords(rawText: string): ParsedOcrRecord[] {
  if (!rawText || rawText.trim() === "") return [];

  // TODO: Implement real parsing. For now, attempt basic line-by-line parsing.
  // Expected format per line (approximate): "YYYY-MM-DD baked=N left=N store=N uber=N doordash=N other=N"
  const records: ParsedOcrRecord[] = [];
  const lines = rawText.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;

    const extract = (key: string): number | undefined => {
      const match = line.match(new RegExp(`${key}[=:]\\s*(\\d+(?:\\.\\d+)?)`));
      return match ? parseFloat(match[1]) : undefined;
    };

    records.push({
      detectedDate: dateMatch[1],
      extractedBagelsBaked: extract("baked"),
      extractedBagelsLeft: extract("left"),
      extractedStoreSales: extract("store"),
      extractedUberSales: extract("uber"),
      extractedDoordashSales: extract("doordash"),
      extractedOtherSales: extract("other"),
      confidenceScore: 0.5, // Low confidence for basic parsing
    });
  }

  return records;
}

// ─── Job Management ───────────────────────────────────────────────────────────

export async function createOcrImportJob(data: {
  sourceFileName: string;
  sourceFileUrl?: string;
}): Promise<OcrImportJob> {
  const job = await prisma.ocrImportJob.create({
    data: {
      sourceFileName: data.sourceFileName,
      sourceFileUrl: data.sourceFileUrl ?? null,
      status: "pending",
    },
  });
  return job as OcrImportJob;
}

export async function processOcrJob(jobId: string): Promise<OcrImportJob> {
  // Update status to processing
  await prisma.ocrImportJob.update({
    where: { id: jobId },
    data: { status: "processing" },
  });

  try {
    const job = await prisma.ocrImportJob.findUniqueOrThrow({ where: { id: jobId } });

    // TODO: If sourceFileUrl is set, download file and run OCR
    // const fileBuffer = await downloadFile(job.sourceFileUrl);
    // const rawText = await runOcrOnImage(fileBuffer);
    const rawText = job.rawText ?? "";

    const parsedRecords = parseOcrTextToRecords(rawText);
    const parsedJson = JSON.stringify(parsedRecords);

    // Create import items
    await prisma.ocrImportItem.createMany({
      data: parsedRecords.map((r) => ({
        jobId,
        detectedDate: r.detectedDate ? new Date(r.detectedDate) : null,
        extractedBagelsBaked: r.extractedBagelsBaked ?? null,
        extractedBagelsLeft: r.extractedBagelsLeft ?? null,
        extractedStoreSales: r.extractedStoreSales ?? null,
        extractedUberSales: r.extractedUberSales ?? null,
        extractedDoordashSales: r.extractedDoordashSales ?? null,
        extractedOtherSales: r.extractedOtherSales ?? null,
        extractedNotes: r.extractedNotes ?? null,
        confidenceScore: r.confidenceScore ?? null,
        reviewStatus: "pending",
      })),
    });

    const updatedJob = await prisma.ocrImportJob.update({
      where: { id: jobId },
      data: { status: "completed", parsedJson, rawText },
      include: { items: true },
    });

    return updatedJob as OcrImportJob;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const updatedJob = await prisma.ocrImportJob.update({
      where: { id: jobId },
      data: { status: "failed", errorMessage },
      include: { items: true },
    });
    return updatedJob as OcrImportJob;
  }
}

export async function approveOcrImportItem(itemId: string): Promise<{ item: OcrImportItem; dailyRecordId?: string }> {
  const item = await prisma.ocrImportItem.findUniqueOrThrow({ where: { id: itemId } });

  if (!item.detectedDate) {
    throw new Error("날짜 정보가 없어 승인할 수 없습니다");
  }

  // Check if DailyRecord already exists for this date
  const existingRecord = await prisma.dailyRecord.findUnique({
    where: { date: item.detectedDate },
  });

  let dailyRecordId: string;

  if (existingRecord) {
    // Link to existing record without overwriting
    dailyRecordId = existingRecord.id;
  } else {
    // Create new DailyRecord from OCR item
    const newRecord = await prisma.dailyRecord.create({
      data: {
        date: item.detectedDate,
        bagelsBaked: item.extractedBagelsBaked ?? 0,
        bagelsLeft: item.extractedBagelsLeft ?? 0,
        storeSales: item.extractedStoreSales ?? 0,
        uberSales: item.extractedUberSales ?? 0,
        doordashSales: item.extractedDoordashSales ?? 0,
        otherSales: item.extractedOtherSales ?? 0,
        notes: item.extractedNotes ?? null,
      },
    });
    dailyRecordId = newRecord.id;
  }

  const updatedItem = await prisma.ocrImportItem.update({
    where: { id: itemId },
    data: { reviewStatus: "approved", linkedDailyRecordId: dailyRecordId },
  });

  return { item: updatedItem as OcrImportItem, dailyRecordId };
}

export async function rejectOcrImportItem(itemId: string): Promise<OcrImportItem> {
  const item = await prisma.ocrImportItem.update({
    where: { id: itemId },
    data: { reviewStatus: "rejected" },
  });
  return item as OcrImportItem;
}
