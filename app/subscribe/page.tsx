export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import SubscribeForm from "./SubscribeForm";

export default async function SubscribePage() {
  await requireAuth();

  const products = await prisma.product.findMany({
    where: { isActive: true, isSubscriptionEligible: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, basePrice: true },
  });

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscribe to Regular Orders</h1>
        <p className="text-gray-500 mt-1">Subscribe to products for weekly pickup on your chosen day</p>
      </div>
      <SubscribeForm products={products} />
    </div>
  );
}
