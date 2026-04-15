import { describe, it, expect } from "vitest";
import {
  parseIngredientCsvRows,
  parseSupplierLinkCsvRows,
  validateUnit,
  generateIngredientPriceCsvTemplate,
  generateSupplierLinkPriceCsvTemplate,
} from "@/lib/costing/price-import-csv";

// ─── Ingredient mode CSV parsing ───────────────────────────────────────────────

describe("parseIngredientCsvRows", () => {
  it("parses a valid row by ingredientName", () => {
    const csv = [
      "ingredientName,purchasePrice,purchaseQuantity,purchaseUnit,baseUnit,taxIncluded,yieldPercent,effectiveFrom,note",
      "Bread Flour,48.00,25,KG,G,true,100,2026-04-15,Test note",
    ].join("\n");

    const rows = parseIngredientCsvRows(csv);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.parseErrors).toHaveLength(0);
    expect(row.ingredientName).toBe("Bread Flour");
    expect(row.purchasePrice).toBe(48);
    expect(row.purchaseQuantity).toBe(25);
    expect(row.purchaseUnit).toBe("KG");
    expect(row.baseUnit).toBe("G");
    expect(row.taxIncluded).toBe(true);
    expect(row.yieldPercent).toBe(100);
    expect(row.effectiveFrom).toBeInstanceOf(Date);
    expect(row.note).toBe("Test note");
  });

  it("parses a valid row by ingredientId", () => {
    const csv = [
      "ingredientId,purchasePrice,purchaseUnit,baseUnit",
      "abc123,10.50,KG,G",
    ].join("\n");

    const rows = parseIngredientCsvRows(csv);
    expect(rows[0].parseErrors).toHaveLength(0);
    expect(rows[0].ingredientId).toBe("abc123");
    expect(rows[0].purchasePrice).toBe(10.5);
  });

  it("supports column aliases: name, price, qty, unit, base_unit", () => {
    const csv = [
      "name,price,qty,unit,base_unit",
      "Salt,5.00,1,KG,G",
    ].join("\n");

    const rows = parseIngredientCsvRows(csv);
    expect(rows[0].parseErrors).toHaveLength(0);
    expect(rows[0].ingredientName).toBe("Salt");
    expect(rows[0].purchasePrice).toBe(5);
    expect(rows[0].purchaseUnit).toBe("KG");
  });

  it("returns error when no identifier is present", () => {
    const csv = [
      "purchasePrice,purchaseQuantity,purchaseUnit,baseUnit",
      "10.00,1,KG,G",
    ].join("\n");

    const rows = parseIngredientCsvRows(csv);
    expect(rows[0].parseErrors).toContain("Row must have ingredientId or ingredientName");
  });

  it("returns error for negative price", () => {
    const csv = [
      "ingredientName,purchasePrice,purchaseUnit,baseUnit",
      "Salt,-5.00,KG,G",
    ].join("\n");

    const rows = parseIngredientCsvRows(csv);
    expect(rows[0].parseErrors.some((e) => e.includes("purchasePrice"))).toBe(true);
  });

  it("returns error for zero price", () => {
    const csv = [
      "ingredientName,purchasePrice,purchaseUnit,baseUnit",
      "Salt,0,KG,G",
    ].join("\n");

    const rows = parseIngredientCsvRows(csv);
    expect(rows[0].parseErrors.some((e) => e.includes("purchasePrice"))).toBe(true);
  });

  it("returns error for invalid purchaseUnit", () => {
    const csv = [
      "ingredientName,purchasePrice,purchaseUnit,baseUnit",
      "Salt,5.00,BUCKETS,G",
    ].join("\n");

    const rows = parseIngredientCsvRows(csv);
    expect(rows[0].parseErrors.some((e) => e.includes("purchaseUnit"))).toBe(true);
  });

  it("returns error for invalid baseUnit", () => {
    const csv = [
      "ingredientName,purchasePrice,purchaseUnit,baseUnit",
      "Salt,5.00,KG,SPOON",
    ].join("\n");

    const rows = parseIngredientCsvRows(csv);
    expect(rows[0].parseErrors.some((e) => e.includes("baseUnit"))).toBe(true);
  });

  it("returns error for out-of-range yieldPercent", () => {
    const csv = [
      "ingredientName,purchasePrice,purchaseUnit,baseUnit,yieldPercent",
      "Salt,5.00,KG,G,150",
    ].join("\n");

    const rows = parseIngredientCsvRows(csv);
    expect(rows[0].parseErrors.some((e) => e.includes("yieldPercent"))).toBe(true);
  });

  it("returns error for zero yieldPercent", () => {
    const csv = [
      "ingredientName,purchasePrice,purchaseUnit,baseUnit,yieldPercent",
      "Salt,5.00,KG,G,0",
    ].join("\n");

    const rows = parseIngredientCsvRows(csv);
    expect(rows[0].parseErrors.some((e) => e.includes("yieldPercent"))).toBe(true);
  });

  it("returns error for invalid taxIncluded value", () => {
    const csv = [
      "ingredientName,purchasePrice,purchaseUnit,baseUnit,taxIncluded",
      "Salt,5.00,KG,G,maybe",
    ].join("\n");

    const rows = parseIngredientCsvRows(csv);
    expect(rows[0].parseErrors.some((e) => e.includes("taxIncluded"))).toBe(true);
  });

  it("returns error for invalid effectiveFrom date", () => {
    const csv = [
      "ingredientName,purchasePrice,purchaseUnit,baseUnit,effectiveFrom",
      "Salt,5.00,KG,G,not-a-date",
    ].join("\n");

    const rows = parseIngredientCsvRows(csv);
    expect(rows[0].parseErrors.some((e) => e.includes("effectiveFrom"))).toBe(true);
  });

  it("returns an empty parseErrors array for an empty row (not an ERROR)", () => {
    const csv = [
      "ingredientName,purchasePrice,purchaseUnit,baseUnit",
      ",,,",
    ].join("\n");

    const rows = parseIngredientCsvRows(csv);
    expect(rows[0].parseErrors).toHaveLength(0);
    expect(rows[0].ingredientName).toBeUndefined();
  });

  it("handles BOM prefix", () => {
    const csv = "\uFEFFingredientName,purchasePrice,purchaseUnit,baseUnit\nSalt,5.00,KG,G";
    const rows = parseIngredientCsvRows(csv);
    expect(rows[0].ingredientName).toBe("Salt");
    expect(rows[0].parseErrors).toHaveLength(0);
  });

  it("accepts DD/MM/YYYY date format", () => {
    const csv = [
      "ingredientName,purchasePrice,purchaseUnit,baseUnit,effectiveFrom",
      "Salt,5.00,KG,G,15/04/2026",
    ].join("\n");

    const rows = parseIngredientCsvRows(csv);
    expect(rows[0].parseErrors).toHaveLength(0);
    expect(rows[0].effectiveFrom).toBeInstanceOf(Date);
  });

  it("strips dollar signs and commas from price", () => {
    const csv = [
      "ingredientName,purchasePrice,purchaseUnit,baseUnit",
      'Flour,"$1,200.50",KG,G',
    ].join("\n");

    const rows = parseIngredientCsvRows(csv);
    expect(rows[0].parseErrors).toHaveLength(0);
    expect(rows[0].purchasePrice).toBe(1200.5);
  });

  it("returns an empty array for CSV with only a header row", () => {
    const csv = "ingredientName,purchasePrice,purchaseUnit,baseUnit";
    const rows = parseIngredientCsvRows(csv);
    expect(rows).toHaveLength(0);
  });
});

// ─── Unit validation ───────────────────────────────────────────────────────────

describe("validateUnit", () => {
  it("accepts valid units", () => {
    expect(validateUnit("KG")).toBe(true);
    expect(validateUnit("G")).toBe(true);
    expect(validateUnit("L")).toBe(true);
    expect(validateUnit("ML")).toBe(true);
    expect(validateUnit("EA")).toBe(true);
    expect(validateUnit("PACK")).toBe(true);
    expect(validateUnit("BOX")).toBe(true);
  });

  it("rejects invalid units", () => {
    expect(validateUnit("BUCKETS")).toBe(false);
    expect(validateUnit("LBS")).toBe(false);
    expect(validateUnit("")).toBe(false);
    expect(validateUnit("SPOON")).toBe(false);
  });
});

// ─── Unit pair validation ─────────────────────────────────────────────────────

describe("Unit pair validation in parseIngredientCsvRows", () => {
  it("accepts valid same-group unit pairs (KG/G)", () => {
    const csv = [
      "ingredientName,purchasePrice,purchaseQuantity,purchaseUnit,baseUnit",
      "Flour,48.00,25,KG,G",
    ].join("\n");
    const rows = parseIngredientCsvRows(csv);
    expect(rows[0].parseErrors).toHaveLength(0);
  });

  it("accepts valid same-group unit pairs (L/ML)", () => {
    const csv = [
      "ingredientName,purchasePrice,purchaseQuantity,purchaseUnit,baseUnit",
      "Oil,10.00,5,L,ML",
    ].join("\n");
    const rows = parseIngredientCsvRows(csv);
    expect(rows[0].parseErrors).toHaveLength(0);
  });

  it("rejects cross-group unit pairs (KG/ML)", () => {
    const csv = [
      "ingredientName,purchasePrice,purchaseQuantity,purchaseUnit,baseUnit",
      "Something,10.00,1,KG,ML",
    ].join("\n");
    const rows = parseIngredientCsvRows(csv);
    expect(rows[0].parseErrors.some((e) => e.includes("Unit combination invalid"))).toBe(true);
  });

  it("rejects cross-group unit pairs (L/G)", () => {
    const csv = [
      "ingredientName,purchasePrice,purchaseQuantity,purchaseUnit,baseUnit",
      "Something,10.00,1,L,G",
    ].join("\n");
    const rows = parseIngredientCsvRows(csv);
    expect(rows[0].parseErrors.some((e) => e.includes("Unit combination invalid"))).toBe(true);
  });
});

// ─── Supplier link CSV parsing ────────────────────────────────────────────────

describe("parseSupplierLinkCsvRows", () => {
  it("parses a valid row by supplierName and supplierProductCode", () => {
    const csv = [
      "supplierName,supplierProductCode,purchasePrice,purchaseQuantity,purchaseUnit,effectiveFrom,note",
      "Allied Pinnacle,AP-FLOUR-25KG,48.00,25,KG,2026-04-15,Test",
    ].join("\n");

    const rows = parseSupplierLinkCsvRows(csv);
    expect(rows[0].parseErrors).toHaveLength(0);
    expect(rows[0].supplierName).toBe("Allied Pinnacle");
    expect(rows[0].supplierProductCode).toBe("AP-FLOUR-25KG");
    expect(rows[0].purchasePrice).toBe(48);
    expect(rows[0].purchaseUnit).toBe("KG");
  });

  it("returns error when neither supplierId nor supplierName is present", () => {
    const csv = [
      "supplierProductCode,purchasePrice,purchaseUnit",
      "AP-FLOUR-25KG,48.00,KG",
    ].join("\n");

    const rows = parseSupplierLinkCsvRows(csv);
    expect(rows[0].parseErrors.some((e) => e.includes("supplierId or supplierName"))).toBe(true);
  });

  it("returns error when neither supplierProductCode nor supplierProductName is present", () => {
    const csv = [
      "supplierName,purchasePrice,purchaseUnit",
      "Allied Pinnacle,48.00,KG",
    ].join("\n");

    const rows = parseSupplierLinkCsvRows(csv);
    expect(rows[0].parseErrors.some((e) => e.includes("supplierProductCode or supplierProductName"))).toBe(true);
  });

  it("returns error for invalid purchaseUnit", () => {
    const csv = [
      "supplierName,supplierProductCode,purchasePrice,purchaseUnit",
      "Allied Pinnacle,AP-FLOUR,48.00,TONS",
    ].join("\n");

    const rows = parseSupplierLinkCsvRows(csv);
    expect(rows[0].parseErrors.some((e) => e.includes("purchaseUnit"))).toBe(true);
  });

  it("handles column aliases: supplier, code, price, qty, unit", () => {
    const csv = [
      "supplier,code,price,qty,unit",
      "Allied Pinnacle,AP-FLOUR-25KG,48.00,25,KG",
    ].join("\n");

    const rows = parseSupplierLinkCsvRows(csv);
    expect(rows[0].parseErrors).toHaveLength(0);
    expect(rows[0].supplierName).toBe("Allied Pinnacle");
    expect(rows[0].supplierProductCode).toBe("AP-FLOUR-25KG");
  });

  it("skips completely empty rows", () => {
    const csv = [
      "supplierName,supplierProductCode,purchasePrice,purchaseUnit",
      ",,,",
    ].join("\n");

    const rows = parseSupplierLinkCsvRows(csv);
    expect(rows[0].parseErrors).toHaveLength(0);
    expect(rows[0].supplierName).toBeUndefined();
  });
});

// ─── Template generators ──────────────────────────────────────────────────────

describe("generateIngredientPriceCsvTemplate", () => {
  it("produces a CSV with correct headers", () => {
    const csv = generateIngredientPriceCsvTemplate();
    const lines = csv.split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const headers = lines[0].split(",");
    expect(headers).toContain("ingredientId");
    expect(headers).toContain("ingredientName");
    expect(headers).toContain("purchasePrice");
    expect(headers).toContain("purchaseQuantity");
    expect(headers).toContain("purchaseUnit");
    expect(headers).toContain("baseUnit");
    expect(headers).toContain("effectiveFrom");
  });

  it("example row is parseable without errors", () => {
    const csv = generateIngredientPriceCsvTemplate();
    const rows = parseIngredientCsvRows(csv);
    // Example row has ingredientName but no ingredientId — should parse without error
    expect(rows[0].parseErrors).toHaveLength(0);
    expect(rows[0].ingredientName).toBe("Bread Flour");
  });
});

describe("generateSupplierLinkPriceCsvTemplate", () => {
  it("produces a CSV with correct headers", () => {
    const csv = generateSupplierLinkPriceCsvTemplate();
    const lines = csv.split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const headers = lines[0].split(",");
    expect(headers).toContain("supplierId");
    expect(headers).toContain("supplierName");
    expect(headers).toContain("supplierProductCode");
    expect(headers).toContain("supplierProductName");
    expect(headers).toContain("purchasePrice");
    expect(headers).toContain("purchaseUnit");
  });

  it("example row is parseable without errors", () => {
    const csv = generateSupplierLinkPriceCsvTemplate();
    const rows = parseSupplierLinkCsvRows(csv);
    expect(rows[0].parseErrors).toHaveLength(0);
    expect(rows[0].supplierName).toBe("Allied Pinnacle");
  });
});
