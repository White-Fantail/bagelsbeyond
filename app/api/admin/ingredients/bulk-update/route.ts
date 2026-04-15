import { NextRequest, NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { bulkUpdateIngredients } from "@/lib/services/ingredientService";
import { z } from "zod";
import { UnitType } from "@/app/generated/prisma/enums";

const UNIT_VALUES = Object.values(UnitType) as [string, ...string[]];

const bulkUpdateItemSchema = z.object({
  ingredientId: z.string().min(1),
  purchasePrice: z.coerce.number().positive().optional(),
  purchaseQuantity: z.coerce.number().positive().optional(),
  purchaseUnit: z.enum(UNIT_VALUES).optional(),
  baseUnit: z.enum(UNIT_VALUES).optional(),
  yieldPercent: z.coerce.number().gt(0).max(100).optional(),
  taxIncluded: z.boolean().optional(),
  effectiveFrom: z.string().datetime({ offset: true }).optional().nullable(),
  changeNote: z.string().optional().nullable(),
});

const bulkUpdateSchema = z.object({
  items: z.array(bulkUpdateItemSchema).min(1, "At least one item is required"),
});

export async function POST(req: NextRequest) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = bulkUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await bulkUpdateIngredients(
      parsed.data.items.map((item) => ({
        ...item,
        purchaseUnit: item.purchaseUnit as UnitType | undefined,
        baseUnit: item.baseUnit as UnitType | undefined,
      })),
      authResult.userId
    );
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ message: "Failed to process bulk update" }, { status: 500 });
  }
}
