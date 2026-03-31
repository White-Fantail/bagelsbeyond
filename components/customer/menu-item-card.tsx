"use client";

import Image from "next/image";
import type { CustomerMenuItem } from "@/lib/customer/catalog";

interface MenuItemCardProps {
  item: CustomerMenuItem;
  onClick: (item: CustomerMenuItem) => void;
}

export default function MenuItemCard({ item, onClick }: MenuItemCardProps) {
  const isSoldOut = !item.isAvailable;

  return (
    <button
      onClick={() => !isSoldOut && onClick(item)}
      disabled={isSoldOut}
      className={`w-full flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3 text-left transition-all hover:border-amber-200 hover:shadow-sm active:scale-[0.99] ${isSoldOut ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug">{item.name}</h3>
          {isSoldOut && (
            <span className="flex-shrink-0 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Sold Out</span>
          )}
          {item.isSubscribable && !isSoldOut && (
            <span className="flex-shrink-0 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">Subscribe</span>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{item.description}</p>
        )}
        <p className="text-sm font-bold text-amber-700 mt-1.5">
          ${Number(item.basePrice ?? 0).toFixed(2)}
        </p>
      </div>
      <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-amber-50">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt={item.name} width={80} height={80} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">🥯</div>
        )}
      </div>
    </button>
  );
}
