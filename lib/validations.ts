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

// Online ordering is retained and shares this validation module with Sales.
export const orderItemModifierSchema = z.object({
  modifierGroupId: z.string().min(1, "Modifier group ID is required"),
  modifierOptionId: z.string().min(1, "Modifier option ID is required"),
});

export const orderItemSchema = z.object({
  itemId: z.string().min(1, "Item ID is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  notes: z.string().optional(),
  selectedModifiers: z.array(orderItemModifierSchema).default([]),
});

export const createOrderSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().min(1, "Customer phone is required"),
  customerEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  pickupType: z.enum(["ASAP", "SCHEDULED"]),
  pickupTime: z.string().datetime({ offset: true }).optional().nullable(),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
});

export type CreateOrderSchema = z.infer<typeof createOrderSchema>;
export type OrderItemSchema = z.infer<typeof orderItemSchema>;
export type OrderItemModifierSchema = z.infer<typeof orderItemModifierSchema>;
