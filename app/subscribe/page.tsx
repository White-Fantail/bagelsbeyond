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
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8">
      {/* Hero banner */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-400 px-6 py-10 sm:py-14 text-white">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl" aria-hidden="true">🔄</span>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Weekly Subscription</h1>
          </div>
          <p className="text-amber-100 text-sm sm:text-base mt-2">
            Subscribe to regular weekly pickups and never miss your favourite bagels.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <span className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium">
              📅 Flexible pickup day
            </span>
            <span className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium">
              ✏️ Cancel anytime
            </span>
            <span className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium">
              🥯 Fresh every week
            </span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl space-y-2">
          <SubscribeForm products={products} />
        </div>
      </div>
    </div>
  );
}
