import { getSubscribableItems } from "@/lib/customer/catalog";
import Link from "next/link";

export default async function SubscriptionsPage() {
  const items = await getSubscribableItems();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Subscribe & Save</h1>
        <p className="text-sm text-gray-500 mt-1">Set up recurring bagel orders</p>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">🔄</div>
          <p>No subscription items available</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <Link
              key={item.id}
              href={`/subscriptions/${item.id}`}
              className="block bg-white rounded-xl border border-gray-100 p-4 hover:border-amber-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                  {item.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                  )}
                  <p className="text-sm font-bold text-amber-700 mt-2">${item.basePrice.toFixed(2)} / item</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">Subscribe</span>
                  <span className="text-xs text-amber-600 font-medium">Set up →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
