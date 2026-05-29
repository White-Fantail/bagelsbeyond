import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Public Menu API
 * GET /api/public/stores/[storeSlug]/menu
 * Returns menu items for a store, organized by category.
 * No authentication required.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ storeSlug: string }> }
) {
  try {
    const { storeSlug } = await params;

    // Find store by slug
    let store = await prisma.store.findUnique({
      where: { slug: storeSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        address: true,
        suburb: true,
        city: true,
        phone: true,
        bannerImageUrl: true,
        logoImageUrl: true,
        isOpen: true,
      },
    });

    // If slug is "bagels-beyond" and store not found, create from AppSetting
    if (!store && storeSlug === "bagels-beyond") {
      const appSetting = await prisma.appSetting.findFirst();
      if (appSetting) {
        store = await prisma.store.create({
          data: {
            slug: "bagels-beyond",
            name: appSetting.shopName || "Bagel's Beyond",
            city: appSetting.defaultCity || "Christchurch",
            isOpen: true,
          },
          select: {
            id: true,
            slug: true,
            name: true,
            address: true,
            suburb: true,
            city: true,
            phone: true,
            bannerImageUrl: true,
            logoImageUrl: true,
            isOpen: true,
          },
        });
      }
    }

    if (!store) {
      return NextResponse.json(
        { message: "Store not found" },
        { status: 404 }
      );
    }

    // Get all active categories with their active products
    const categories = await prisma.productCategory.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        sortOrder: true,
        products: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            sellingPrice: true,
            isPopular: true,
            isSoldOut: true,
            modifierGroups: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                description: true,
                isRequired: true,
                minSelections: true,
                maxSelections: true,
                sortOrder: true,
                options: {
                  where: { isActive: true },
                  orderBy: { sortOrder: "asc" },
                  select: {
                    id: true,
                    name: true,
                    priceDelta: true,
                    sortOrder: true,
                  },
                },
              },
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: [{ isPopular: "desc" }, { name: "asc" }],
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    // Filter out categories with no products
    const categoriesWithProducts = categories
      .filter((cat) => cat.products.length > 0)
      .map((cat) => ({
        ...cat,
        products: cat.products.map((prod) => ({
          ...prod,
          sellingPrice: prod.sellingPrice ? Number(prod.sellingPrice) : null,
          modifierGroups: prod.modifierGroups.map((group) => ({
            ...group,
            options: group.options.map((opt) => ({
              ...opt,
              priceDelta: Number(opt.priceDelta),
            })),
          })),
        })),
      }));

    return NextResponse.json({
      store,
      categories: categoriesWithProducts,
    });
  } catch (error) {
    console.error("Failed to load menu:", error);
    return NextResponse.json(
      { message: "Failed to load menu" },
      { status: 500 }
    );
  }
}
