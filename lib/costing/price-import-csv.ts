/**
 * Pure CSV parser and validator for price import flows.
 * No server-only import — safe to use in tests and shared contexts.
 */
import { UnitType } from "@/app/generated/prisma/enums";
import { getConversionFactor } from "@/lib/costing/unit-conversion";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PriceImportMode = "INGREDIENT" | "SUPPLIER_LINK";

export type PriceImportRowStatus = "READY" | "WARNING" | "ERROR" | "SKIPPED";

export type RawCsvRow = Record<string, string>;

export type ParsedIngredientRow = {
  rowNumber: number;
  raw: RawCsvRow;
  ingredientId?: string;
  ingredientName?: string;
  purchasePrice?: number;
  purchaseQuantity?: number;
  purchaseUnit?: string;
  baseUnit?: string;
  taxIncluded?: boolean;
  yieldPercent?: number;
  effectiveFrom?: Date;
  note?: string;
  parseErrors: string[];
};

export type ParsedSupplierLinkRow = {
  rowNumber: number;
  raw: RawCsvRow;
  supplierId?: string;
  supplierName?: string;
  supplierProductCode?: string;
  supplierProductName?: string;
  purchasePrice?: number;
  purchaseQuantity?: number;
  purchaseUnit?: string;
  effectiveFrom?: Date;
  note?: string;
  parseErrors: string[];
};

// ─── Column aliases ────────────────────────────────────────────────────────────

const INGREDIENT_COL_ALIASES: Record<string, string> = {
  ingredientid: "ingredientId",
  ingredient_id: "ingredientId",
  ingredientname: "ingredientName",
  ingredient_name: "ingredientName",
  name: "ingredientName",
  purchaseprice: "purchasePrice",
  purchase_price: "purchasePrice",
  price: "purchasePrice",
  purchasequantity: "purchaseQuantity",
  purchase_quantity: "purchaseQuantity",
  quantity: "purchaseQuantity",
  qty: "purchaseQuantity",
  purchaseunit: "purchaseUnit",
  purchase_unit: "purchaseUnit",
  unit: "purchaseUnit",
  baseunit: "baseUnit",
  base_unit: "baseUnit",
  taxincluded: "taxIncluded",
  tax_included: "taxIncluded",
  tax: "taxIncluded",
  yieldpercent: "yieldPercent",
  yield_percent: "yieldPercent",
  yield: "yieldPercent",
  effectivefrom: "effectiveFrom",
  effective_from: "effectiveFrom",
  date: "effectiveFrom",
  note: "note",
  notes: "note",
  changenote: "note",
  change_note: "note",
};

const SUPPLIER_COL_ALIASES: Record<string, string> = {
  supplierid: "supplierId",
  supplier_id: "supplierId",
  suppliername: "supplierName",
  supplier_name: "supplierName",
  supplier: "supplierName",
  supplierproductcode: "supplierProductCode",
  supplier_product_code: "supplierProductCode",
  productcode: "supplierProductCode",
  product_code: "supplierProductCode",
  code: "supplierProductCode",
  supplierproductname: "supplierProductName",
  supplier_product_name: "supplierProductName",
  productname: "supplierProductName",
  product_name: "supplierProductName",
  product: "supplierProductName",
  purchaseprice: "purchasePrice",
  purchase_price: "purchasePrice",
  price: "purchasePrice",
  purchasequantity: "purchaseQuantity",
  purchase_quantity: "purchaseQuantity",
  quantity: "purchaseQuantity",
  qty: "purchaseQuantity",
  purchaseunit: "purchaseUnit",
  purchase_unit: "purchaseUnit",
  unit: "purchaseUnit",
  effectivefrom: "effectiveFrom",
  effective_from: "effectiveFrom",
  date: "effectiveFrom",
  note: "note",
  notes: "note",
};

function normaliseHeader(raw: string, aliases: Record<string, string>): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return aliases[key] ?? aliases[raw.trim()] ?? raw.trim();
}

// ─── CSV line parser ───────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim()); current = "";
    } else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

function safeParsePositiveFloat(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") return null;
  const cleaned = raw.trim().replace(/[$,NZ\s]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function safeParseDate(raw: string | undefined): Date | null {
  if (!raw || raw.trim() === "") return null;
  const cleaned = raw.trim().replace(/\//g, "-");
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleaned)) {
    const [y, m, d] = cleaned.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (!isNaN(dt.getTime())) return dt;
  }
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(cleaned)) {
    const [d, m, y] = cleaned.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (!isNaN(dt.getTime())) return dt;
  }
  const dt = new Date(cleaned);
  return isNaN(dt.getTime()) ? null : dt;
}

function parseBool(raw: string | undefined): boolean | null {
  if (!raw || raw.trim() === "") return null;
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "yes" || v === "1") return true;
  if (v === "false" || v === "no" || v === "0") return false;
  return null;
}

// ─── Parse raw CSV into typed rows ────────────────────────────────────────────

function parseCsvToRaw(
  csvText: string,
  aliases: Record<string, string>
): { headers: string[]; rows: Array<{ rowNumber: number; raw: RawCsvRow }> } {
  const cleaned = csvText.startsWith("\uFEFF") ? csvText.slice(1) : csvText;
  const lines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((h) => normaliseHeader(h, aliases));
  const rows: Array<{ rowNumber: number; raw: RawCsvRow }> = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const raw: RawCsvRow = {};
    headers.forEach((h, idx) => { raw[h] = values[idx] ?? ""; });
    rows.push({ rowNumber: i, raw });
  }
  return { headers, rows };
}

// ─── Unit validation ───────────────────────────────────────────────────────────

const VALID_UNITS = Object.values(UnitType) as string[];

export function validateUnit(unit: string): boolean {
  return VALID_UNITS.includes(unit.toUpperCase());
}

// ─── Ingredient mode CSV parsing ───────────────────────────────────────────────

export function parseIngredientCsvRows(csvText: string): ParsedIngredientRow[] {
  const { rows } = parseCsvToRaw(csvText, INGREDIENT_COL_ALIASES);
  return rows.map(({ rowNumber, raw }) => {
    const parseErrors: string[] = [];

    const allEmpty = Object.values(raw).every((v) => v === "");
    if (allEmpty) {
      return { rowNumber, raw, parseErrors: [], note: undefined };
    }

    const ingredientId = raw["ingredientId"]?.trim() || undefined;
    const ingredientName = raw["ingredientName"]?.trim() || undefined;

    if (!ingredientId && !ingredientName) {
      parseErrors.push("Row must have ingredientId or ingredientName");
    }

    const purchasePriceRaw = safeParsePositiveFloat(raw["purchasePrice"]);
    if (raw["purchasePrice"] !== undefined && raw["purchasePrice"].trim() !== "") {
      if (purchasePriceRaw === null || purchasePriceRaw <= 0) {
        parseErrors.push("purchasePrice must be a number greater than 0");
      }
    }

    const purchaseQuantityRaw = safeParsePositiveFloat(raw["purchaseQuantity"]);
    if (raw["purchaseQuantity"] !== undefined && raw["purchaseQuantity"].trim() !== "") {
      if (purchaseQuantityRaw === null || purchaseQuantityRaw <= 0) {
        parseErrors.push("purchaseQuantity must be a number greater than 0");
      }
    }

    const purchaseUnitRaw = raw["purchaseUnit"]?.trim().toUpperCase() || undefined;
    if (purchaseUnitRaw && !validateUnit(purchaseUnitRaw)) {
      parseErrors.push(`purchaseUnit "${purchaseUnitRaw}" is not valid. Use: ${VALID_UNITS.join(", ")}`);
    }

    const baseUnitRaw = raw["baseUnit"]?.trim().toUpperCase() || undefined;
    if (baseUnitRaw && !validateUnit(baseUnitRaw)) {
      parseErrors.push(`baseUnit "${baseUnitRaw}" is not valid. Use: ${VALID_UNITS.join(", ")}`);
    }

    if (purchaseUnitRaw && baseUnitRaw && validateUnit(purchaseUnitRaw) && validateUnit(baseUnitRaw)) {
      const check = getConversionFactor(purchaseUnitRaw as UnitType, baseUnitRaw as UnitType);
      if (!check.canConvert) {
        parseErrors.push(`Unit combination invalid: ${check.errorMessage}`);
      }
    }

    const yieldPercentRaw = safeParsePositiveFloat(raw["yieldPercent"]);
    if (raw["yieldPercent"] !== undefined && raw["yieldPercent"].trim() !== "") {
      if (yieldPercentRaw === null || yieldPercentRaw <= 0 || yieldPercentRaw > 100) {
        parseErrors.push("yieldPercent must be between 0 (exclusive) and 100 (inclusive)");
      }
    }

    const taxIncludedRaw = parseBool(raw["taxIncluded"]);
    if (raw["taxIncluded"] !== undefined && raw["taxIncluded"].trim() !== "" && taxIncludedRaw === null) {
      parseErrors.push("taxIncluded must be true/false/yes/no/1/0");
    }

    const effectiveFromRaw = safeParseDate(raw["effectiveFrom"]);
    if (raw["effectiveFrom"] !== undefined && raw["effectiveFrom"].trim() !== "" && !effectiveFromRaw) {
      parseErrors.push("effectiveFrom must be a valid date (YYYY-MM-DD or DD-MM-YYYY)");
    }

    return {
      rowNumber,
      raw,
      ingredientId,
      ingredientName,
      purchasePrice: purchasePriceRaw ?? undefined,
      purchaseQuantity: purchaseQuantityRaw ?? undefined,
      purchaseUnit: purchaseUnitRaw,
      baseUnit: baseUnitRaw,
      taxIncluded: taxIncludedRaw ?? undefined,
      yieldPercent: yieldPercentRaw ?? undefined,
      effectiveFrom: effectiveFromRaw ?? undefined,
      note: raw["note"]?.trim() || undefined,
      parseErrors,
    };
  });
}

// ─── Supplier link mode CSV parsing ───────────────────────────────────────────

export function parseSupplierLinkCsvRows(csvText: string): ParsedSupplierLinkRow[] {
  const { rows } = parseCsvToRaw(csvText, SUPPLIER_COL_ALIASES);
  return rows.map(({ rowNumber, raw }) => {
    const parseErrors: string[] = [];

    const allEmpty = Object.values(raw).every((v) => v === "");
    if (allEmpty) {
      return { rowNumber, raw, parseErrors: [], note: undefined };
    }

    const supplierId = raw["supplierId"]?.trim() || undefined;
    const supplierName = raw["supplierName"]?.trim() || undefined;
    const supplierProductCode = raw["supplierProductCode"]?.trim() || undefined;
    const supplierProductName = raw["supplierProductName"]?.trim() || undefined;

    if (!supplierId && !supplierName) {
      parseErrors.push("Row must have supplierId or supplierName");
    }
    if (!supplierProductCode && !supplierProductName) {
      parseErrors.push("Row must have supplierProductCode or supplierProductName");
    }

    const purchasePriceRaw = safeParsePositiveFloat(raw["purchasePrice"]);
    if (raw["purchasePrice"] !== undefined && raw["purchasePrice"].trim() !== "") {
      if (purchasePriceRaw === null || purchasePriceRaw <= 0) {
        parseErrors.push("purchasePrice must be a number greater than 0");
      }
    }

    const purchaseQuantityRaw = safeParsePositiveFloat(raw["purchaseQuantity"]);
    if (raw["purchaseQuantity"] !== undefined && raw["purchaseQuantity"].trim() !== "") {
      if (purchaseQuantityRaw === null || purchaseQuantityRaw <= 0) {
        parseErrors.push("purchaseQuantity must be a number greater than 0");
      }
    }

    const purchaseUnitRaw = raw["purchaseUnit"]?.trim().toUpperCase() || undefined;
    if (purchaseUnitRaw && !validateUnit(purchaseUnitRaw)) {
      parseErrors.push(`purchaseUnit "${purchaseUnitRaw}" is not valid. Use: ${VALID_UNITS.join(", ")}`);
    }

    const effectiveFromRaw = safeParseDate(raw["effectiveFrom"]);
    if (raw["effectiveFrom"] !== undefined && raw["effectiveFrom"].trim() !== "" && !effectiveFromRaw) {
      parseErrors.push("effectiveFrom must be a valid date (YYYY-MM-DD or DD-MM-YYYY)");
    }

    return {
      rowNumber,
      raw,
      supplierId,
      supplierName,
      supplierProductCode,
      supplierProductName,
      purchasePrice: purchasePriceRaw ?? undefined,
      purchaseQuantity: purchaseQuantityRaw ?? undefined,
      purchaseUnit: purchaseUnitRaw,
      effectiveFrom: effectiveFromRaw ?? undefined,
      note: raw["note"]?.trim() || undefined,
      parseErrors,
    };
  });
}

// ─── Template CSV generators ──────────────────────────────────────────────────

export function generateIngredientPriceCsvTemplate(): string {
  const headers = [
    "ingredientId",
    "ingredientName",
    "purchasePrice",
    "purchaseQuantity",
    "purchaseUnit",
    "baseUnit",
    "taxIncluded",
    "yieldPercent",
    "effectiveFrom",
    "note",
  ];
  const example = [
    "",
    "Bread Flour",
    "48.00",
    "25",
    "KG",
    "G",
    "true",
    "100",
    "2026-04-15",
    "Supplier price increase",
  ];
  return [headers.join(","), example.join(",")].join("\n");
}

export function generateSupplierLinkPriceCsvTemplate(): string {
  const headers = [
    "supplierId",
    "supplierName",
    "supplierProductCode",
    "supplierProductName",
    "purchasePrice",
    "purchaseQuantity",
    "purchaseUnit",
    "effectiveFrom",
    "note",
  ];
  const example = [
    "",
    "Allied Pinnacle",
    "AP-FLOUR-25KG",
    "Bread Flour 25kg",
    "48.00",
    "25",
    "KG",
    "2026-04-15",
    "Regular delivery price",
  ];
  return [headers.join(","), example.join(",")].join("\n");
}
