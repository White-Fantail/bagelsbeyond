import { z } from "zod";
import { UnitType } from "@/app/generated/prisma/enums";

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

export const ingredientSchema = z.object({
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
  taxIncluded: z.boolean().default(true),
  isActive: z.boolean().default(true),
  notes: z.string().optional().nullable(),
});

export type IngredientSchema = z.infer<typeof ingredientSchema>;
