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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Order</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Order fresh bagels for scheduled pickup. Payment is made on-site.
        </p>
      </div>
      <ProductList products={serialised} />
    </div>
  );
}
