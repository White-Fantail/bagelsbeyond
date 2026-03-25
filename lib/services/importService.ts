import { prisma } from "@/lib/db";
import { parseCsvContent } from "@/lib/csv-parser";
import type { ImportJob, ImportRow } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportExecuteOptions = {
  overwrite?: boolean; // If true, overwrite existing DailyRecord for same date
};

export type ImportExecuteResult = {
  successRows: number;
  failedRows: number;
  skippedRows: number;
  errors: { rowNumber: number; error: string }[];
};

// ─── Job Creation ─────────────────────────────────────────────────────────────

export async function createImportJob(data: {
  fileName: string;
  csvText: string;
}): Promise<ImportJob> {
  const parsedRows = parseCsvContent(data.csvText);
  const totalRows = parsedRows.length;
  const failedRows = parsedRows.filter((r) => r.status === "invalid").length;
  const validRows = totalRows - failedRows;

  const status = totalRows === 0 ? "failed" : failedRows === totalRows ? "failed" : "ready";

  const job = await prisma.importJob.create({
    data: {
      fileName: data.fileName,
      status: totalRows === 0 ? "failed" : "validating",
      totalRows,
      successRows: 0,
      failedRows,
      errorMessage: totalRows === 0 ? "CSV 파일에 데이터 행이 없습니다" : null,
      rows: {
        create: parsedRows.map((r) => ({
          rowNumber: r.rowNumber,
          rawJson: r.rawJson,
          parsedDate: r.parsedDate ?? null,
          parsedBagelsBaked: r.parsedBagelsBaked ?? null,
          parsedBagelsLeft: r.parsedBagelsLeft ?? null,
          parsedStoreSales: r.parsedStoreSales ?? null,
          parsedUberSales: r.parsedUberSales ?? null,
          parsedDoordashSales: r.parsedDoordashSales ?? null,
          parsedOtherSales: r.parsedOtherSales ?? null,
          parsedNotes: r.parsedNotes ?? null,
          status: r.status,
          validationErrors:
            r.validationErrors.length > 0 ? r.validationErrors.join("; ") : null,
        })),
      },
    },
    include: { rows: true },
  });

  // Update to ready/failed after rows are created
  const updated = await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status,
      errorMessage:
        totalRows === 0
          ? "CSV 파일에 데이터 행이 없습니다"
          : validRows === 0
          ? "모든 행에 오류가 있습니다. CSV 형식을 확인해주세요"
          : null,
    },
    include: { rows: true },
  });

  return updated as ImportJob;
}

// ─── Execute Import ────────────────────────────────────────────────────────────

export async function executeImport(
  jobId: string,
  options: ImportExecuteOptions = {}
): Promise<ImportExecuteResult> {
  const job = await prisma.importJob.findUniqueOrThrow({
    where: { id: jobId },
    include: { rows: { where: { status: "valid" } } },
  });

  if (job.status === "imported") {
    throw new Error("이미 임포트가 완료된 작업입니다");
  }

  const result: ImportExecuteResult = {
    successRows: 0,
    failedRows: 0,
    skippedRows: 0,
    errors: [],
  };

  for (const row of job.rows) {
    if (!row.parsedDate) {
      await prisma.importRow.update({
        where: { id: row.id },
        data: { status: "invalid", validationErrors: "날짜 정보가 없습니다" },
      });
      result.failedRows++;
      result.errors.push({ rowNumber: row.rowNumber, error: "날짜 정보가 없습니다" });
      continue;
    }

    try {
      const existing = await prisma.dailyRecord.findUnique({
        where: { date: row.parsedDate },
      });

      if (existing && !options.overwrite) {
        // Skip: same date already exists
        await prisma.importRow.update({
          where: { id: row.id },
          data: { status: "skipped", linkedDailyRecordId: existing.id },
        });
        result.skippedRows++;
        continue;
      }

      let dailyRecordId: string;

      if (existing && options.overwrite) {
        const updated = await prisma.dailyRecord.update({
          where: { id: existing.id },
          data: {
            bagelsBaked: row.parsedBagelsBaked ?? 0,
            bagelsLeft: row.parsedBagelsLeft ?? 0,
            storeSales: row.parsedStoreSales ?? 0,
            uberSales: row.parsedUberSales ?? 0,
            doordashSales: row.parsedDoordashSales ?? 0,
            otherSales: row.parsedOtherSales ?? 0,
            notes: row.parsedNotes ?? null,
          },
        });
        dailyRecordId = updated.id;
      } else {
        const created = await prisma.dailyRecord.create({
          data: {
            date: row.parsedDate,
            bagelsBaked: row.parsedBagelsBaked ?? 0,
            bagelsLeft: row.parsedBagelsLeft ?? 0,
            storeSales: row.parsedStoreSales ?? 0,
            uberSales: row.parsedUberSales ?? 0,
            doordashSales: row.parsedDoordashSales ?? 0,
            otherSales: row.parsedOtherSales ?? 0,
            notes: row.parsedNotes ?? null,
          },
        });
        dailyRecordId = created.id;
      }

      await prisma.importRow.update({
        where: { id: row.id },
        data: { status: "imported", linkedDailyRecordId: dailyRecordId },
      });

      result.successRows++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "알 수 없는 오류";
      await prisma.importRow.update({
        where: { id: row.id },
        data: { status: "invalid", validationErrors: errorMsg },
      });
      result.failedRows++;
      result.errors.push({ rowNumber: row.rowNumber, error: errorMsg });
    }
  }

  // Update job summary
  const totalFailed = result.failedRows + job.rows.filter((r) => r.status === "invalid").length;
  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      status: "imported",
      successRows: result.successRows,
      failedRows: totalFailed,
    },
  });

  return result;
}

// ─── Queries ───────────────────────────────────────────────────────────────────

export async function getImportJobById(id: string): Promise<(ImportJob & { rows: ImportRow[] }) | null> {
  const job = await prisma.importJob.findUnique({
    where: { id },
    include: { rows: { orderBy: { rowNumber: "asc" } } },
  });
  return job as (ImportJob & { rows: ImportRow[] }) | null;
}

export async function listImportJobs(): Promise<ImportJob[]> {
  const jobs = await prisma.importJob.findMany({
    orderBy: { createdAt: "desc" },
    include: { rows: { select: { id: true, status: true } } },
  });
  return jobs as ImportJob[];
}
