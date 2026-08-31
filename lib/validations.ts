import { z } from "zod";
import { StorageType } from "@/app/generated/prisma/enums";

export const salesFormSchema = z
  .object({
    date: z.string().min(1, "Please enter a date"),
    bagelsBaked: z.coerce.number().int().min(0, "Please enter an integer of 0 or more"),
    bagelsLeft: z.coerce.number().int().min(0, "Please enter an integer of 0 or more"),
    storeSales: z.coerce.number().min(0, "Please enter a value of 0 or more"),
    uberSales: z.coerce.number().min(0, "Please enter a value of 0 or more"),
    doordashSales: z.coerce.number().min(0, "Please enter a value of 0 or more"),
    otherSales: z.coerce.number().min(0, "Please enter a value of 0 or more"),
    notes: z.string().optional(),
  })
  .refine((data) => data.bagelsLeft <= data.bagelsBaked, {
    message: "Bagels Left cannot be greater than Bagels Baked",
    path: ["bagelsLeft"],
  });

export type SalesFormSchema = z.infer<typeof salesFormSchema>;

export const productCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().default(true),
  isFreshnessManaged: z.boolean().default(false),
  freshnessSortOrder: z.coerce.number().int().min(0).default(0),
});

export type ProductCategorySchema = z.infer<typeof productCategorySchema>;

export const menuProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  notes: z.string().optional().nullable(),
  categoryId: z.string().nullable().optional(),
  shelfLifeDays: z.preprocess(
    (value) => value === "" || value === null || value === undefined ? null : value,
    z.coerce.number().int().positive("Shelf life must be a positive integer").nullable().optional()
  ),
  storageType: z.nativeEnum(StorageType).nullable().optional(),
});

export type MenuProductSchema = z.infer<typeof menuProductSchema>;
