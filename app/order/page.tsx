export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import ProductList from "./ProductList";

export default async function OrderPage() {
  await requireAuth();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          options: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
      dailyInventory: {
        where: { date: { gte: today } },
        orderBy: { date: "asc" },
        take: 2,
      },
      loyverseCategory: { select: { name: true } },
    },
  });

  // Serialise for client
  const serialised = products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.loyverseCategory?.name ?? null,
    basePrice: p.basePrice,
    isSubscriptionEligible: p.isSubscriptionEligible,
    isSoldOut: p.dailyInventory.some((d) => d.isSoldOut),
    optionGroups: p.optionGroups.map((g) => ({
      id: g.id,
      name: g.name,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      isRequired: g.isRequired,
      options: g.options.map((o) => ({
        id: o.id,
        name: o.name,
        priceDelta: o.priceDelta,
      })),
    })),
  }));

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
