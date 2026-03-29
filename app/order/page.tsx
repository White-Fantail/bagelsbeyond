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
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8">
      {/* Hero banner */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-400 px-6 py-10 sm:py-14 text-white">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl" aria-hidden="true">🥯</span>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Bagels Beyond</h1>
          </div>
          <p className="text-amber-100 text-sm sm:text-base mt-2">
            Fresh hand-rolled bagels for pickup. Choose your favourites and we&apos;ll have them ready.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <span className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium">
              📍 In-store pickup
            </span>
            <span className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium">
              💳 Pay on-site
            </span>
            <span className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium">
              ✨ Made fresh daily
            </span>
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="px-4 sm:px-6 lg:px-8 mt-0">
        <ProductList products={serialised} />
      </div>
    </div>
  );
}
