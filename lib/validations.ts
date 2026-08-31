import { z } from "zod";

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
