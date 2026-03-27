import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { IntegrationSource } from "@/app/generated/prisma/enums";
import { z } from "zod";

const productPatchSchema = z.object({
  name: z.string().min(1, "Product Please enter your name").optional(),
  slug: z
    .string()
    .min(1, "Please enter a slug")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens")
    .optional(),
  description: z.string().optional().nullable(),
  loyverseCategoryId: z.string().optional().nullable(),
  basePrice: z.number().min(0, "Price must be 0 or more").optional(),
  isActive: z.boolean().optional(),
  isSubscriptionEligible: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

/** Fields that cannot be changed on a Loyverse-synced product */
const LOYVERSE_READONLY_FIELDS = ["name", "slug", "description", "basePrice"] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        optionGroups: {
          orderBy: { sortOrder: "asc" },
          include: {
            options: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ message: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (_error) {
    return NextResponse.json(
      { message: "Failed to load product info" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsed = productPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const existing = await prisma.product.findUnique({
    where: { id },
    include: {
      externalMappings: {
        where: { source: IntegrationSource.LOYVERSE },
        select: { id: true },
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ message: "Product not found" }, { status: 404 });
  }

  const isLoyverseSynced = existing.externalMappings.length > 0;

  // Block changes to Loyverse read-only fields
  if (isLoyverseSynced) {
    const attemptedReadOnly = LOYVERSE_READONLY_FIELDS.filter(
      (field) => field in data && data[field] !== undefined
    );
    if (attemptedReadOnly.length > 0) {
      return NextResponse.json(
        {
          message: `Loyverse-synced Product original fields cannot be edited: ${attemptedReadOnly.join(", ")}`,
          readOnlyFields: attemptedReadOnly,
        },
        { status: 403 }
      );
    }
  }

  if (data.slug && data.slug !== existing.slug) {
    const slugConflict = await prisma.product.findUnique({ where: { slug: data.slug } });
    if (slugConflict) {
      return NextResponse.json(
        { message: "Slug is already in use" },
        { status: 409 }
      );
    }
  }

  try {
    const product = await prisma.product.update({
      where: { id },
      data,
      include: {
        optionGroups: {
          orderBy: { sortOrder: "asc" },
          include: {
            options: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });

    return NextResponse.json({ product });
  } catch (_error) {
    return NextResponse.json(
      { message: "Products Edit failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const { id } = await params;

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: "Product not found" }, { status: 404 });
  }

  try {
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ message: "Product deleted" });
  } catch (_error) {
    return NextResponse.json(
      { message: "Products Delete failed" },
      { status: 500 }
    );
  }
}
