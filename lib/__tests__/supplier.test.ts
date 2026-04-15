import { describe, it, expect } from "vitest";
import { SupplierIntegrationType, SupplierSyncMode, UnitType } from "@/app/generated/prisma/enums";
import { supplierSchema, ingredientSupplierLinkSchema } from "@/lib/validations";

// ─── supplierSchema ───────────────────────────────────────────────────────────

describe("supplierSchema — name", () => {
  it("requires name", () => {
    const result = supplierSchema.safeParse({ name: "", slug: "test" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.name).toBeDefined();
    }
  });

  it("accepts valid name", () => {
    const result = supplierSchema.safeParse({ name: "BakeryDirect", slug: "bakerydirect" });
    expect(result.success).toBe(true);
  });
});

describe("supplierSchema — slug", () => {
  it("requires slug", () => {
    const result = supplierSchema.safeParse({ name: "Test", slug: "" });
    expect(result.success).toBe(false);
  });

  it("rejects slug with uppercase", () => {
    const result = supplierSchema.safeParse({ name: "Test", slug: "MySlug" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.slug).toBeDefined();
    }
  });

  it("rejects slug with spaces", () => {
    const result = supplierSchema.safeParse({ name: "Test", slug: "my slug" });
    expect(result.success).toBe(false);
  });

  it("rejects slug with special characters", () => {
    const result = supplierSchema.safeParse({ name: "Test", slug: "my_slug!" });
    expect(result.success).toBe(false);
  });

  it("accepts valid slug with hyphens", () => {
    const result = supplierSchema.safeParse({ name: "Test", slug: "my-supplier-123" });
    expect(result.success).toBe(true);
  });
});

describe("supplierSchema — defaults", () => {
  it("isActive defaults to true", () => {
    const result = supplierSchema.safeParse({ name: "Test", slug: "test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(true);
    }
  });

  it("integrationType defaults to MANUAL", () => {
    const result = supplierSchema.safeParse({ name: "Test", slug: "test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.integrationType).toBe(SupplierIntegrationType.MANUAL);
    }
  });

  it("accepts all integration types", () => {
    for (const type of Object.values(SupplierIntegrationType)) {
      const result = supplierSchema.safeParse({
        name: "Test",
        slug: "test",
        integrationType: type,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("supplierSchema — optional fields", () => {
  it("accepts null websiteUrl", () => {
    const result = supplierSchema.safeParse({ name: "Test", slug: "test", websiteUrl: null });
    expect(result.success).toBe(true);
  });

  it("rejects invalid URL for websiteUrl", () => {
    const result = supplierSchema.safeParse({
      name: "Test",
      slug: "test",
      websiteUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid URL for websiteUrl", () => {
    const result = supplierSchema.safeParse({
      name: "Test",
      slug: "test",
      websiteUrl: "https://example.com",
    });
    expect(result.success).toBe(true);
  });
});

// ─── ingredientSupplierLinkSchema ─────────────────────────────────────────────

describe("ingredientSupplierLinkSchema — required fields", () => {
  const base = {
    ingredientId: "ing_123",
    supplierId: "sup_456",
    supplierProductName: "Test Product",
  };

  it("requires ingredientId", () => {
    const result = ingredientSupplierLinkSchema.safeParse({ ...base, ingredientId: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.ingredientId).toBeDefined();
    }
  });

  it("requires supplierId", () => {
    const result = ingredientSupplierLinkSchema.safeParse({ ...base, supplierId: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.supplierId).toBeDefined();
    }
  });

  it("requires supplierProductName", () => {
    const result = ingredientSupplierLinkSchema.safeParse({
      ...base,
      supplierProductName: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.supplierProductName).toBeDefined();
    }
  });

  it("accepts all required fields", () => {
    const result = ingredientSupplierLinkSchema.safeParse(base);
    expect(result.success).toBe(true);
  });
});

describe("ingredientSupplierLinkSchema — packageQuantity", () => {
  const base = {
    ingredientId: "ing_123",
    supplierId: "sup_456",
    supplierProductName: "Test Product",
  };

  it("rejects negative packageQuantity", () => {
    const result = ingredientSupplierLinkSchema.safeParse({
      ...base,
      supplierPackageQuantity: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero packageQuantity", () => {
    const result = ingredientSupplierLinkSchema.safeParse({
      ...base,
      supplierPackageQuantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts positive packageQuantity", () => {
    const result = ingredientSupplierLinkSchema.safeParse({
      ...base,
      supplierPackageQuantity: 25.5,
    });
    expect(result.success).toBe(true);
  });

  it("accepts null packageQuantity", () => {
    const result = ingredientSupplierLinkSchema.safeParse({
      ...base,
      supplierPackageQuantity: null,
    });
    expect(result.success).toBe(true);
  });

  it("treats empty string as null", () => {
    const result = ingredientSupplierLinkSchema.safeParse({
      ...base,
      supplierPackageQuantity: "",
    });
    expect(result.success).toBe(true);
  });
});

describe("ingredientSupplierLinkSchema — supplierPackageUnit", () => {
  const base = {
    ingredientId: "ing_123",
    supplierId: "sup_456",
    supplierProductName: "Test Product",
  };

  it("accepts valid UnitType", () => {
    for (const unit of Object.values(UnitType)) {
      const result = ingredientSupplierLinkSchema.safeParse({
        ...base,
        supplierPackageUnit: unit,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid unit", () => {
    const result = ingredientSupplierLinkSchema.safeParse({
      ...base,
      supplierPackageUnit: "INVALID_UNIT",
    });
    expect(result.success).toBe(false);
  });

  it("accepts null unit", () => {
    const result = ingredientSupplierLinkSchema.safeParse({
      ...base,
      supplierPackageUnit: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("ingredientSupplierLinkSchema — defaults", () => {
  const base = {
    ingredientId: "ing_123",
    supplierId: "sup_456",
    supplierProductName: "Test Product",
  };

  it("isActive defaults to true", () => {
    const result = ingredientSupplierLinkSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(true);
    }
  });

  it("syncMode defaults to MANUAL_ONLY", () => {
    const result = ingredientSupplierLinkSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.syncMode).toBe(SupplierSyncMode.MANUAL_ONLY);
    }
  });

  it("isPrimary defaults to false", () => {
    const result = ingredientSupplierLinkSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isPrimary).toBe(false);
    }
  });
});
