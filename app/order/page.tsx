export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import ProductList from "./ProductList";

export default async function OrderPage() {
  await requireAuth();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Nested include for options within a group (reused in both contexts)
  const optionGroupOptionsInclude = {
    options: {
      where: { isActive: true },
      orderBy: { sortOrder: "asc" } as const,
      include: {
        dailyOptionInventory: {
          where: { date: { gte: today } },
          orderBy: { date: "asc" } as const,
          take: 1,
        },
      },
    },
  };

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { loyverseCategoryId: null },
        { loyverseCategory: { isVisible: true } },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      // Direct groups (productId FK on ProductOptionGroup)
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        include: optionGroupOptionsInclude,
      },
      // Shared groups linked via the many-to-many assignment table
      optionGroupAssignments: {
        include: {
          optionGroup: {
            include: optionGroupOptionsInclude,
          },
        },
      },
      dailyInventory: {
        where: { date: { gte: today } },
        orderBy: { date: "asc" },
        take: 2,
      },
      loyverseCategory: { select: { name: true, displayOrder: true } },
    },
  });

  // Helper to serialise a raw option group row
  function serialiseGroup(g: {
    id: string;
    name: string;
    minSelect: number;
    maxSelect: number;
    isRequired: boolean;
    sortOrder: number;
    options: Array<{
      id: string;
      name: string;
      priceDelta: number;
      dailyOptionInventory: Array<{ isSoldOut: boolean }>;
    }>;
  }) {
    return {
      id: g.id,
      name: g.name,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      isRequired: g.isRequired,
      sortOrder: g.sortOrder,
      options: g.options.map((o) => ({
        id: o.id,
        name: o.name,
        priceDelta: o.priceDelta,
        isSoldOut: o.dailyOptionInventory?.[0]?.isSoldOut ?? false,
      })),
    };
  }

  // Serialise for client
  const serialised = products.map((p) => {
    // Merge direct groups and assignment-linked groups, deduplicating by id.
    const seen = new Set<string>();
    const allGroups: ReturnType<typeof serialiseGroup>[] = [];

    for (const g of p.optionGroups) {
      if (!seen.has(g.id)) { seen.add(g.id); allGroups.push(serialiseGroup(g)); }
    }
    for (const a of p.optionGroupAssignments) {
      const g = a.optionGroup;
      if (!seen.has(g.id)) { seen.add(g.id); allGroups.push(serialiseGroup(g)); }
    }

    // Sort merged list by sortOrder, then name for stability
    allGroups.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.loyverseCategory?.name ?? null,
      categoryOrder: p.loyverseCategory?.displayOrder ?? 9999,
      basePrice: p.basePrice,
      isSubscriptionEligible: p.isSubscriptionEligible,
      isSoldOut: p.dailyInventory.some((d) => d.isSoldOut),
      optionGroups: allGroups,
    };
  });

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 bg-stone-50 min-h-screen">
      {/* Store header */}
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl" aria-hidden="true">🥯</span>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Bagels Beyond</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1 ml-9">
            Fresh hand-rolled bagels · In-store pickup · Pay on-site · Made fresh daily
          </p>
        </div>
      </div>

      {/* Products */}
      <ProductList products={serialised} />
    </div>
  );
}
