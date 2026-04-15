import "server-only";
import { prisma } from "@/lib/db";
import { UnitType, PriceHistorySourceType, PriceImportMode, PriceImportRowStatus } from "@/app/generated/prisma/enums";
import { calculateStandardUnitCost } from "@/lib/costing/ingredient-cost";
import { createIngredientHistorySnapshot } from "@/lib/costing/ingredient-price-history";
import {
  parseIngredientCsvRows,
  parseSupplierLinkCsvRows,
} from "@/lib/costing/price-import-csv";

// ─── Preview row types ────────────────────────────────────────────────────────

export type PriceImportPreviewRow = {
  rowNumber: number;
  status: PriceImportRowStatus;
  message: string | null;
  ingredientId: string | null;
  ingredientName: string | null;
  ingredientSupplierLinkId: string | null;
  currentPurchasePrice: string | null;
  currentPurchaseUnit: string | null;
  currentStandardUnitCost: string | null;
  currentStandardUnitDisplay: string | null;
  newPurchasePrice: string | null;
  newPurchaseQuantity: string | null;
  newPurchaseUnit: string | null;
  newBaseUnit: string | null;
  newStandardUnitCost: string | null;
  newStandardUnitDisplay: string | null;
  deltaPercent: string | null;
  effectiveFrom: string | null;
  note: string | null;
  raw: Record<string, string>;
};

export type PriceImportPreviewResult = {
  mode: PriceImportMode;
  fileName: string | null;
  totalRows: number;
  readyRows: number;
  warningRows: number;
  errorRows: number;
  skippedRows: number;
  rows: PriceImportPreviewRow[];
};

export type PriceImportApplyResult = {
  batchId: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  skippedRows: number;
  errors: Array<{ rowNumber: number; message: string }>;
};

// ─── Standard cost helper ─────────────────────────────────────────────────────

function computeStandardCost(
  price: number,
  qty: number,
  purchaseUnit: UnitType,
  baseUnit: UnitType
): { cost: string | null; display: string | null } {
  const result = calculateStandardUnitCost(price, qty, purchaseUnit, baseUnit);
  if (!result.isConvertible) return { cost: null, display: null };
  return { cost: result.standardUnitCost.toFixed(6), display: result.displayLabel };
}

// ─── Ingredient mode preview ───────────────────────────────────────────────────

export async function previewIngredientModeCsv(
  csvText: string,
  fileName?: string
): Promise<PriceImportPreviewResult> {
  const parsed = parseIngredientCsvRows(csvText);

  const allIngredients = await prisma.ingredient.findMany({
    select: {
      id: true,
      name: true,
      purchasePrice: true,
      purchaseQuantity: true,
      purchaseUnit: true,
      baseUnit: true,
      isActive: true,
    },
  });

  const ingredientById = new Map(allIngredients.map((i) => [i.id, i]));
  const ingredientByName = new Map<string, typeof allIngredients[number][]>();
  for (const ing of allIngredients) {
    const key = ing.name.toLowerCase().trim();
    if (!ingredientByName.has(key)) ingredientByName.set(key, []);
    ingredientByName.get(key)!.push(ing);
  }

  const rows: PriceImportPreviewRow[] = [];

  for (const parsedRow of parsed) {
    const allEmpty = Object.values(parsedRow.raw).every((v) => v === "");
    if (allEmpty) {
      rows.push({
        rowNumber: parsedRow.rowNumber,
        status: PriceImportRowStatus.SKIPPED,
        message: "Empty row",
        ingredientId: null, ingredientName: null, ingredientSupplierLinkId: null,
        currentPurchasePrice: null, currentPurchaseUnit: null, currentStandardUnitCost: null, currentStandardUnitDisplay: null,
        newPurchasePrice: null, newPurchaseQuantity: null, newPurchaseUnit: null, newBaseUnit: null,
        newStandardUnitCost: null, newStandardUnitDisplay: null,
        deltaPercent: null, effectiveFrom: null, note: null, raw: parsedRow.raw,
      });
      continue;
    }

    if (parsedRow.parseErrors.length > 0) {
      rows.push({
        rowNumber: parsedRow.rowNumber,
        status: PriceImportRowStatus.ERROR,
        message: parsedRow.parseErrors.join("; "),
        ingredientId: null, ingredientName: null, ingredientSupplierLinkId: null,
        currentPurchasePrice: null, currentPurchaseUnit: null, currentStandardUnitCost: null, currentStandardUnitDisplay: null,
        newPurchasePrice: parsedRow.purchasePrice?.toString() ?? null,
        newPurchaseQuantity: parsedRow.purchaseQuantity?.toString() ?? null,
        newPurchaseUnit: parsedRow.purchaseUnit ?? null,
        newBaseUnit: parsedRow.baseUnit ?? null,
        newStandardUnitCost: null, newStandardUnitDisplay: null,
        deltaPercent: null,
        effectiveFrom: parsedRow.effectiveFrom?.toISOString() ?? null,
        note: parsedRow.note ?? null,
        raw: parsedRow.raw,
      });
      continue;
    }

    let matched: typeof allIngredients[number] | null = null;
    let matchError: string | null = null;

    if (parsedRow.ingredientId) {
      matched = ingredientById.get(parsedRow.ingredientId) ?? null;
      if (!matched) matchError = `No ingredient found with id "${parsedRow.ingredientId}"`;
    } else if (parsedRow.ingredientName) {
      const key = parsedRow.ingredientName.toLowerCase().trim();
      const candidates = ingredientByName.get(key) ?? [];
      if (candidates.length === 0) {
        matchError = `No ingredient found with name "${parsedRow.ingredientName}"`;
      } else if (candidates.length > 1) {
        matchError = `Ambiguous: ${candidates.length} ingredients match name "${parsedRow.ingredientName}"`;
      } else {
        matched = candidates[0];
      }
    }

    if (matchError) {
      rows.push({
        rowNumber: parsedRow.rowNumber,
        status: PriceImportRowStatus.ERROR,
        message: matchError,
        ingredientId: null, ingredientName: parsedRow.ingredientName ?? null, ingredientSupplierLinkId: null,
        currentPurchasePrice: null, currentPurchaseUnit: null, currentStandardUnitCost: null, currentStandardUnitDisplay: null,
        newPurchasePrice: parsedRow.purchasePrice?.toString() ?? null,
        newPurchaseQuantity: parsedRow.purchaseQuantity?.toString() ?? null,
        newPurchaseUnit: parsedRow.purchaseUnit ?? null,
        newBaseUnit: parsedRow.baseUnit ?? null,
        newStandardUnitCost: null, newStandardUnitDisplay: null,
        deltaPercent: null,
        effectiveFrom: parsedRow.effectiveFrom?.toISOString() ?? null,
        note: parsedRow.note ?? null,
        raw: parsedRow.raw,
      });
      continue;
    }

    const ing = matched!;
    const currentPrice = parseFloat(ing.purchasePrice.toString());
    const currentQty = parseFloat(ing.purchaseQuantity.toString());
    const currentCost = computeStandardCost(currentPrice, currentQty, ing.purchaseUnit, ing.baseUnit);

    const newPrice = parsedRow.purchasePrice ?? currentPrice;
    const newQty = parsedRow.purchaseQuantity ?? currentQty;
    const newPurchaseUnit = (parsedRow.purchaseUnit ?? ing.purchaseUnit) as UnitType;
    const newBaseUnit = (parsedRow.baseUnit ?? ing.baseUnit) as UnitType;
    const newCost = computeStandardCost(newPrice, newQty, newPurchaseUnit, newBaseUnit);

    let deltaPercent: string | null = null;
    if (parsedRow.purchasePrice !== undefined && currentPrice !== 0) {
      deltaPercent = (((newPrice - currentPrice) / currentPrice) * 100).toFixed(2);
    }

    const warnings: string[] = [];
    if (!ing.isActive) warnings.push("Ingredient is inactive");
    if (
      parsedRow.purchasePrice !== undefined &&
      parsedRow.purchasePrice === currentPrice &&
      (parsedRow.purchaseQuantity === undefined || parsedRow.purchaseQuantity === currentQty)
    ) {
      warnings.push("New price is the same as current price");
    }

    rows.push({
      rowNumber: parsedRow.rowNumber,
      status: warnings.length > 0 ? PriceImportRowStatus.WARNING : PriceImportRowStatus.READY,
      message: warnings.length > 0 ? warnings.join("; ") : null,
      ingredientId: ing.id,
      ingredientName: ing.name,
      ingredientSupplierLinkId: null,
      currentPurchasePrice: ing.purchasePrice.toString(),
      currentPurchaseUnit: ing.purchaseUnit,
      currentStandardUnitCost: currentCost.cost,
      currentStandardUnitDisplay: currentCost.display,
      newPurchasePrice: newPrice.toString(),
      newPurchaseQuantity: newQty.toString(),
      newPurchaseUnit: newPurchaseUnit,
      newBaseUnit: newBaseUnit,
      newStandardUnitCost: newCost.cost,
      newStandardUnitDisplay: newCost.display,
      deltaPercent,
      effectiveFrom: parsedRow.effectiveFrom?.toISOString() ?? null,
      note: parsedRow.note ?? null,
      raw: parsedRow.raw,
    });
  }

  return {
    mode: PriceImportMode.INGREDIENT,
    fileName: fileName ?? null,
    totalRows: rows.length,
    readyRows: rows.filter((r) => r.status === PriceImportRowStatus.READY).length,
    warningRows: rows.filter((r) => r.status === PriceImportRowStatus.WARNING).length,
    errorRows: rows.filter((r) => r.status === PriceImportRowStatus.ERROR).length,
    skippedRows: rows.filter((r) => r.status === PriceImportRowStatus.SKIPPED).length,
    rows,
  };
}

// ─── Supplier link mode preview ────────────────────────────────────────────────

export async function previewSupplierLinkModeCsv(
  csvText: string,
  fileName?: string
): Promise<PriceImportPreviewResult> {
  const parsed = parseSupplierLinkCsvRows(csvText);

  const allLinks = await prisma.ingredientSupplierLink.findMany({
    where: { isActive: true },
    select: {
      id: true,
      supplierId: true,
      ingredientId: true,
      supplierProductCode: true,
      supplierProductName: true,
      isPrimary: true,
      isActive: true,
      supplier: { select: { id: true, name: true } },
      ingredient: {
        select: {
          id: true,
          name: true,
          purchasePrice: true,
          purchaseQuantity: true,
          purchaseUnit: true,
          baseUnit: true,
          isActive: true,
        },
      },
    },
  });

  const rows: PriceImportPreviewRow[] = [];

  for (const parsedRow of parsed) {
    const allEmpty = Object.values(parsedRow.raw).every((v) => v === "");
    if (allEmpty) {
      rows.push({
        rowNumber: parsedRow.rowNumber,
        status: PriceImportRowStatus.SKIPPED,
        message: "Empty row",
        ingredientId: null, ingredientName: null, ingredientSupplierLinkId: null,
        currentPurchasePrice: null, currentPurchaseUnit: null, currentStandardUnitCost: null, currentStandardUnitDisplay: null,
        newPurchasePrice: null, newPurchaseQuantity: null, newPurchaseUnit: null, newBaseUnit: null,
        newStandardUnitCost: null, newStandardUnitDisplay: null,
        deltaPercent: null, effectiveFrom: null, note: null, raw: parsedRow.raw,
      });
      continue;
    }

    if (parsedRow.parseErrors.length > 0) {
      rows.push({
        rowNumber: parsedRow.rowNumber,
        status: PriceImportRowStatus.ERROR,
        message: parsedRow.parseErrors.join("; "),
        ingredientId: null, ingredientName: null, ingredientSupplierLinkId: null,
        currentPurchasePrice: null, currentPurchaseUnit: null, currentStandardUnitCost: null, currentStandardUnitDisplay: null,
        newPurchasePrice: parsedRow.purchasePrice?.toString() ?? null,
        newPurchaseQuantity: parsedRow.purchaseQuantity?.toString() ?? null,
        newPurchaseUnit: parsedRow.purchaseUnit ?? null,
        newBaseUnit: null,
        newStandardUnitCost: null, newStandardUnitDisplay: null,
        deltaPercent: null,
        effectiveFrom: parsedRow.effectiveFrom?.toISOString() ?? null,
        note: parsedRow.note ?? null,
        raw: parsedRow.raw,
      });
      continue;
    }

    let candidates = allLinks;

    if (parsedRow.supplierId) {
      candidates = candidates.filter((l) => l.supplierId === parsedRow.supplierId);
      if (candidates.length === 0) {
        rows.push({
          rowNumber: parsedRow.rowNumber,
          status: PriceImportRowStatus.ERROR,
          message: `No supplier links found for supplierId "${parsedRow.supplierId}"`,
          ingredientId: null, ingredientName: null, ingredientSupplierLinkId: null,
          currentPurchasePrice: null, currentPurchaseUnit: null, currentStandardUnitCost: null, currentStandardUnitDisplay: null,
          newPurchasePrice: parsedRow.purchasePrice?.toString() ?? null,
          newPurchaseQuantity: parsedRow.purchaseQuantity?.toString() ?? null,
          newPurchaseUnit: parsedRow.purchaseUnit ?? null,
          newBaseUnit: null,
          newStandardUnitCost: null, newStandardUnitDisplay: null,
          deltaPercent: null, effectiveFrom: parsedRow.effectiveFrom?.toISOString() ?? null,
          note: parsedRow.note ?? null, raw: parsedRow.raw,
        });
        continue;
      }
    } else if (parsedRow.supplierName) {
      candidates = candidates.filter((l) => l.supplier.name.toLowerCase() === parsedRow.supplierName!.toLowerCase());
      if (candidates.length === 0) {
        rows.push({
          rowNumber: parsedRow.rowNumber,
          status: PriceImportRowStatus.ERROR,
          message: `No supplier found with name "${parsedRow.supplierName}"`,
          ingredientId: null, ingredientName: null, ingredientSupplierLinkId: null,
          currentPurchasePrice: null, currentPurchaseUnit: null, currentStandardUnitCost: null, currentStandardUnitDisplay: null,
          newPurchasePrice: parsedRow.purchasePrice?.toString() ?? null,
          newPurchaseQuantity: parsedRow.purchaseQuantity?.toString() ?? null,
          newPurchaseUnit: parsedRow.purchaseUnit ?? null,
          newBaseUnit: null,
          newStandardUnitCost: null, newStandardUnitDisplay: null,
          deltaPercent: null, effectiveFrom: parsedRow.effectiveFrom?.toISOString() ?? null,
          note: parsedRow.note ?? null, raw: parsedRow.raw,
        });
        continue;
      }
    }

    if (parsedRow.supplierProductCode) {
      candidates = candidates.filter((l) => l.supplierProductCode?.toLowerCase() === parsedRow.supplierProductCode!.toLowerCase());
    } else if (parsedRow.supplierProductName) {
      candidates = candidates.filter((l) => l.supplierProductName.toLowerCase() === parsedRow.supplierProductName!.toLowerCase());
    }

    if (candidates.length === 0) {
      rows.push({
        rowNumber: parsedRow.rowNumber,
        status: PriceImportRowStatus.ERROR,
        message: `No supplier link found matching product "${parsedRow.supplierProductCode ?? parsedRow.supplierProductName}"`,
        ingredientId: null, ingredientName: null, ingredientSupplierLinkId: null,
        currentPurchasePrice: null, currentPurchaseUnit: null, currentStandardUnitCost: null, currentStandardUnitDisplay: null,
        newPurchasePrice: parsedRow.purchasePrice?.toString() ?? null,
        newPurchaseQuantity: parsedRow.purchaseQuantity?.toString() ?? null,
        newPurchaseUnit: parsedRow.purchaseUnit ?? null,
        newBaseUnit: null,
        newStandardUnitCost: null, newStandardUnitDisplay: null,
        deltaPercent: null, effectiveFrom: parsedRow.effectiveFrom?.toISOString() ?? null,
        note: parsedRow.note ?? null, raw: parsedRow.raw,
      });
      continue;
    }

    if (candidates.length > 1) {
      rows.push({
        rowNumber: parsedRow.rowNumber,
        status: PriceImportRowStatus.ERROR,
        message: `Ambiguous: ${candidates.length} supplier links matched — provide more specific identifiers`,
        ingredientId: null, ingredientName: null, ingredientSupplierLinkId: null,
        currentPurchasePrice: null, currentPurchaseUnit: null, currentStandardUnitCost: null, currentStandardUnitDisplay: null,
        newPurchasePrice: parsedRow.purchasePrice?.toString() ?? null,
        newPurchaseQuantity: parsedRow.purchaseQuantity?.toString() ?? null,
        newPurchaseUnit: parsedRow.purchaseUnit ?? null,
        newBaseUnit: null,
        newStandardUnitCost: null, newStandardUnitDisplay: null,
        deltaPercent: null, effectiveFrom: parsedRow.effectiveFrom?.toISOString() ?? null,
        note: parsedRow.note ?? null, raw: parsedRow.raw,
      });
      continue;
    }

    const link = candidates[0];
    const ing = link.ingredient;
    const currentPrice = parseFloat(ing.purchasePrice.toString());
    const currentQty = parseFloat(ing.purchaseQuantity.toString());
    const currentCost = computeStandardCost(currentPrice, currentQty, ing.purchaseUnit, ing.baseUnit);

    const newPrice = parsedRow.purchasePrice ?? currentPrice;
    const newQty = parsedRow.purchaseQuantity ?? currentQty;
    const newPurchaseUnit = (parsedRow.purchaseUnit ?? ing.purchaseUnit) as UnitType;
    const newCost = computeStandardCost(newPrice, newQty, newPurchaseUnit, ing.baseUnit);

    let deltaPercent: string | null = null;
    if (parsedRow.purchasePrice !== undefined && currentPrice !== 0) {
      deltaPercent = (((newPrice - currentPrice) / currentPrice) * 100).toFixed(2);
    }

    const warnings: string[] = [];
    if (!ing.isActive) warnings.push("Ingredient is inactive");
    if (!link.isPrimary) warnings.push("Supplier link is not the primary link for this ingredient");
    if (parsedRow.purchasePrice !== undefined && newPrice === currentPrice && newQty === currentQty) {
      warnings.push("New price is the same as current price");
    }

    rows.push({
      rowNumber: parsedRow.rowNumber,
      status: warnings.length > 0 ? PriceImportRowStatus.WARNING : PriceImportRowStatus.READY,
      message: warnings.length > 0 ? warnings.join("; ") : null,
      ingredientId: ing.id,
      ingredientName: ing.name,
      ingredientSupplierLinkId: link.id,
      currentPurchasePrice: ing.purchasePrice.toString(),
      currentPurchaseUnit: ing.purchaseUnit,
      currentStandardUnitCost: currentCost.cost,
      currentStandardUnitDisplay: currentCost.display,
      newPurchasePrice: newPrice.toString(),
      newPurchaseQuantity: newQty.toString(),
      newPurchaseUnit: newPurchaseUnit,
      newBaseUnit: ing.baseUnit,
      newStandardUnitCost: newCost.cost,
      newStandardUnitDisplay: newCost.display,
      deltaPercent,
      effectiveFrom: parsedRow.effectiveFrom?.toISOString() ?? null,
      note: parsedRow.note ?? null,
      raw: parsedRow.raw,
    });
  }

  return {
    mode: PriceImportMode.SUPPLIER_LINK,
    fileName: fileName ?? null,
    totalRows: rows.length,
    readyRows: rows.filter((r) => r.status === PriceImportRowStatus.READY).length,
    warningRows: rows.filter((r) => r.status === PriceImportRowStatus.WARNING).length,
    errorRows: rows.filter((r) => r.status === PriceImportRowStatus.ERROR).length,
    skippedRows: rows.filter((r) => r.status === PriceImportRowStatus.SKIPPED).length,
    rows,
  };
}

// ─── Apply ────────────────────────────────────────────────────────────────────

export async function applyPriceImport(
  preview: PriceImportPreviewResult,
  options: {
    includeWarnings?: boolean;
    createdByUserId?: string | null;
  } = {}
): Promise<PriceImportApplyResult> {
  const { includeWarnings = true, createdByUserId = null } = options;

  const toApply = preview.rows.filter(
    (r) =>
      r.status === PriceImportRowStatus.READY ||
      (includeWarnings && r.status === PriceImportRowStatus.WARNING)
  );

  const skippedRows = preview.rows.filter(
    (r) =>
      r.status === PriceImportRowStatus.SKIPPED ||
      r.status === PriceImportRowStatus.ERROR ||
      (!includeWarnings && r.status === PriceImportRowStatus.WARNING)
  ).length;

  let successRows = 0;
  const applyErrors: Array<{ rowNumber: number; message: string }> = [];

  const batch = await prisma.priceImportBatch.create({
    data: {
      mode: preview.mode,
      sourceType: PriceHistorySourceType.CSV_IMPORT,
      fileName: preview.fileName,
      totalRows: preview.totalRows,
      successRows: 0,
      errorRows: 0,
      createdByUserId,
    },
  });

  for (const row of toApply) {
    if (!row.ingredientId) {
      applyErrors.push({ rowNumber: row.rowNumber, message: "No matched ingredient" });
      continue;
    }

    try {
      const effectiveFrom = row.effectiveFrom ? new Date(row.effectiveFrom) : new Date();
      const newPrice = parseFloat(row.newPurchasePrice!);
      const newQty = parseFloat(row.newPurchaseQuantity!);
      const newPurchaseUnit = row.newPurchaseUnit as UnitType;
      const newBaseUnit = row.newBaseUnit as UnitType;

      await prisma.$transaction(async (tx) => {
        const current = await tx.ingredient.findUnique({ where: { id: row.ingredientId! } });
        if (!current) throw new Error("Ingredient not found");

        await tx.ingredient.update({
          where: { id: row.ingredientId! },
          data: {
            purchasePrice: String(newPrice),
            purchaseQuantity: String(newQty),
            purchaseUnit: newPurchaseUnit,
            baseUnit: newBaseUnit,
          },
        });

        await createIngredientHistorySnapshot(
          {
            ingredientId: row.ingredientId!,
            purchasePrice: newPrice,
            purchaseQuantity: newQty,
            purchaseUnit: newPurchaseUnit,
            baseUnit: newBaseUnit,
            taxIncluded: current.taxIncluded,
            yieldPercent: parseFloat(current.yieldPercent.toString()),
            sourceType: PriceHistorySourceType.CSV_IMPORT,
            notes: row.note,
            effectiveFrom,
            createdByUserId,
            ingredientSupplierLinkId: row.ingredientSupplierLinkId,
          },
          tx
        );

        await tx.priceImportRow.create({
          data: {
            batchId: batch.id,
            rowNumber: row.rowNumber,
            rawPayload: row.raw,
            status: PriceImportRowStatus.READY,
            ingredientId: row.ingredientId,
            ingredientSupplierLinkId: row.ingredientSupplierLinkId,
            message: null,
          },
        });
      });

      successRows++;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      applyErrors.push({ rowNumber: row.rowNumber, message });
      await prisma.priceImportRow.create({
        data: {
          batchId: batch.id,
          rowNumber: row.rowNumber,
          rawPayload: row.raw,
          status: PriceImportRowStatus.ERROR,
          ingredientId: row.ingredientId,
          ingredientSupplierLinkId: row.ingredientSupplierLinkId,
          message,
        },
      });
    }
  }

  await prisma.priceImportBatch.update({
    where: { id: batch.id },
    data: { successRows, errorRows: applyErrors.length },
  });

  return {
    batchId: batch.id,
    totalRows: preview.totalRows,
    successRows,
    errorRows: applyErrors.length,
    skippedRows,
    errors: applyErrors,
  };
}
