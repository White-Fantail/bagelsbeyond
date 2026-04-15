import { z } from "zod";
import { UnitType, PricingTargetType, RecommendedPriceRounding, SupplierIntegrationType, SupplierSyncMode, RecipeItemSourceType } from "@/app/generated/prisma/enums";
import { getConversionFactor } from "@/lib/costing/unit-conversion";

export const salesFormSchema = z.object({
  date: z.string().min(1, "Please enter a date"),
  bagelsBaked: z.coerce.number().int().min(0, "Please enter an integer of 0 or more"),
  bagelsLeft: z.coerce.number().int().min(0, "Please enter an integer of 0 or more"),
  storeSales: z.coerce.number().min(0, "Please enter a value of 0 or more"),
  uberSales: z.coerce.number().min(0, "Please enter a value of 0 or more"),
  doordashSales: z.coerce.number().min(0, "Please enter a value of 0 or more"),
  otherSales: z.coerce.number().min(0, "Please enter a value of 0 or more"),
  notes: z.string().optional(),
  weatherSummary: z.string().optional(),
  minTemp: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().optional()),
  maxTemp: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().optional()),
  rainMm: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().min(0).optional()),
  windKph: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().min(0).optional()),
  holidayName: z.string().optional(),
  localEventName: z.string().optional(),
  schoolHoliday: z.boolean().optional(),
  nzNewsSummary: z.string().optional(),
  worldNewsSummary: z.string().optional(),
// Business rule: leftover bagels cannot exceed total baked bagels
}).refine((data) => data.bagelsLeft <= data.bagelsBaked, {
  message: "Bagels Left cannot be greater than Bagels Baked",
  path: ["bagelsLeft"],
});

export type SalesFormSchema = z.infer<typeof salesFormSchema>;

export const settingsSchema = z.object({
  shopName: z.string().min(1, "Please enter a store name"),
  defaultTargetWasteRatio: z.coerce.number().min(0).max(1, "Please enter a value between 0 and 1"),
  defaultSafetyBuffer: z.coerce.number().min(1, "Please enter a value of 1 or more"),
  defaultRegion: z.string().optional(),
  defaultCity: z.string().optional(),
  defaultCountry: z.string().optional(),
  defaultEventRegion: z.string().optional(),
  autoCollectExternalData: z.boolean().optional(),
  predictionLookbackDays: z.coerce.number().int().min(1, "Lookback period must be at least 1 day").optional(),
  defaultPricingTargetType: z.nativeEnum(PricingTargetType).optional(),
  defaultPricingTargetPercent: z.coerce
    .number()
    .gt(0, "Target percent must be greater than 0")
    .lt(100, "Target percent must be less than 100")
    .optional(),
  defaultPriceRounding: z.nativeEnum(RecommendedPriceRounding).optional(),
});

export type SettingsSchema = z.infer<typeof settingsSchema>;

export const weightSchema = z.object({
  factorKey: z.string().min(1, "Please enter a key"),
  weightValue: z.coerce.number(),
  isActive: z.boolean().default(true),
  description: z.string().optional(),
});
export type WeightSchema = z.infer<typeof weightSchema>;

export const createPredictionSchema = z.object({
  targetDate: z.string().min(1, "Please enter a date"),
  autoCollect: z.boolean().optional().default(true),
  externalFactors: z.object({
    weatherSummary: z.string().optional().nullable(),
    minTemp: z.number().optional().nullable(),
    maxTemp: z.number().optional().nullable(),
    rainMm: z.number().optional().nullable(),
    windKph: z.number().optional().nullable(),
    holidayName: z.string().optional().nullable(),
    localEventName: z.string().optional().nullable(),
    schoolHoliday: z.boolean().optional(),
    nzNewsSummary: z.string().optional().nullable(),
    worldNewsSummary: z.string().optional().nullable(),
  }).optional(),
});
export type CreatePredictionSchema = z.infer<typeof createPredictionSchema>;

// ─── Ingredient Category ───────────────────────────────────────────────────────

export const ingredientCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export type IngredientCategorySchema = z.infer<typeof ingredientCategorySchema>;

// ─── Ingredient ────────────────────────────────────────────────────────────────

const UNIT_VALUES = Object.values(UnitType) as [string, ...string[]];

const ingredientBaseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  categoryId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  purchasePrice: z.coerce
    .number()
    .positive("Purchase price must be greater than 0"),
  purchaseQuantity: z.coerce
    .number()
    .positive("Purchase quantity must be greater than 0"),
  purchaseUnit: z.enum(UNIT_VALUES, "Purchase unit is required"),
  baseUnit: z.enum(UNIT_VALUES, "Base unit is required"),
  yieldPercent: z.coerce
    .number()
    .gt(0, "Yield % must be greater than 0")
    .max(100, "Yield % must be 100 or less")
    .default(100),
  taxIncluded: z.boolean().default(true),
  isActive: z.boolean().default(true),
  notes: z.string().optional().nullable(),
  // Phase 6: price history metadata
  effectiveFrom: z.string().datetime({ offset: true }).optional().nullable(),
  changeNote: z.string().optional().nullable(),
});

export const ingredientSchema = ingredientBaseSchema.superRefine((data, ctx) => {
  const purchaseUnit = data.purchaseUnit as UnitType | undefined;
  const baseUnit = data.baseUnit as UnitType | undefined;
  // Only validate if both units are present (full create or update with both fields)
  if (!purchaseUnit || !baseUnit) return;
  const check = getConversionFactor(purchaseUnit, baseUnit);
  if (!check.canConvert) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: check.errorMessage,
      path: ["baseUnit"],
    });
  }
});

export type IngredientSchema = z.infer<typeof ingredientBaseSchema>;

// ─── Menu Product ──────────────────────────────────────────────────────────────

export const menuProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  notes: z.string().optional().nullable(),
  sellingPrice: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().positive("Selling price must be greater than 0").nullable().optional()
  ),
  pricingTargetType: z.nativeEnum(PricingTargetType).nullable().optional(),
  pricingTargetPercent: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce
      .number()
      .gt(0, "Target percent must be greater than 0")
      .lt(100, "Target percent must be less than 100")
      .nullable()
      .optional()
  ),
  canBeUsedAsRecipeComponent: z.boolean().default(false).optional(),
});

export type MenuProductSchema = z.infer<typeof menuProductSchema>;

// ─── Recipe ────────────────────────────────────────────────────────────────────

export const recipeSchema = z.object({
  name: z.string().min(1, "Recipe name is required"),
  outputQuantity: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 1 : v),
    z.coerce.number().positive("Output quantity must be greater than 0").default(1)
  ),
  outputUnit: z.nativeEnum(UnitType).default(UnitType.EA),
});

export type RecipeSchema = z.infer<typeof recipeSchema>;

// ─── Recipe Item ──────────────────────────────────────────────────────────────

export const recipeItemSchema = z
  .object({
    sourceType: z.nativeEnum(RecipeItemSourceType).default(RecipeItemSourceType.INGREDIENT),
    ingredientId: z.string().optional().nullable(),
    componentProductId: z.string().optional().nullable(),
    quantity: z.coerce.number().positive("Quantity must be greater than 0"),
    unit: z.enum(Object.values(UnitType) as [string, ...string[]], {
      message: "Unit is required",
    }),
    notes: z.string().optional().nullable(),
    sortOrder: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === RecipeItemSourceType.INGREDIENT) {
      if (!data.ingredientId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ingredient is required for INGREDIENT source type",
          path: ["ingredientId"],
        });
      }
      if (data.componentProductId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "componentProductId must be null for INGREDIENT source type",
          path: ["componentProductId"],
        });
      }
    } else {
      if (!data.componentProductId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Component product is required for PRODUCT source type",
          path: ["componentProductId"],
        });
      }
      if (data.ingredientId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ingredientId must be null for PRODUCT source type",
          path: ["ingredientId"],
        });
      }
    }
  });

export type RecipeItemSchema = z.infer<typeof recipeItemSchema>;

// Update schema only covers editable fields (quantity, notes, sortOrder)
export const updateRecipeItemSchema = z.object({
  quantity: z.coerce.number().positive("Quantity must be greater than 0").optional(),
  notes: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export type UpdateRecipeItemSchema = z.infer<typeof updateRecipeItemSchema>;

// ─── Supplier ──────────────────────────────────────────────────────────────────

export const supplierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  integrationType: z.nativeEnum(SupplierIntegrationType).default(SupplierIntegrationType.MANUAL),
  websiteUrl: z.string().url("Must be a valid URL").optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type SupplierSchema = z.infer<typeof supplierSchema>;

// ─── IngredientSupplierLink ────────────────────────────────────────────────────

export const ingredientSupplierLinkSchema = z.object({
  ingredientId: z.string().min(1, "Ingredient is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  supplierProductName: z.string().min(1, "Supplier product name is required"),
  supplierProductCode: z.string().optional().nullable(),
  supplierProductUrl: z.string().url("Must be a valid URL").optional().nullable(),
  supplierPackageQuantity: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().positive("Package quantity must be greater than 0").nullable().optional()
  ),
  supplierPackageUnit: z.enum(UNIT_VALUES).optional().nullable(),
  supplierBaseUnit: z.enum(UNIT_VALUES).optional().nullable(),
  isPrimary: z.boolean().default(false),
  isActive: z.boolean().default(true),
  syncMode: z.nativeEnum(SupplierSyncMode).default(SupplierSyncMode.MANUAL_ONLY),
  notes: z.string().optional().nullable(),
});

export type IngredientSupplierLinkSchema = z.infer<typeof ingredientSupplierLinkSchema>;

// ─── Supplier API Credentials (Phase 9) ───────────────────────────────────────

export const supplierCredentialsSchema = z.object({
  adapterKey: z.string().min(1, "Adapter is required"),
  credentials: z.record(z.string(), z.string()),
  notes: z.string().optional().nullable(),
});

export type SupplierCredentialsSchema = z.infer<typeof supplierCredentialsSchema>;

// ─── Supplier product search (Phase 9) ────────────────────────────────────────

export const supplierSearchSchema = z.object({
  query: z.string().optional().default(""),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type SupplierSearchSchema = z.infer<typeof supplierSearchSchema>;
