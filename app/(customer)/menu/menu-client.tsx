"use client";

import { useState } from "react";
import CategoryTabs from "@/components/customer/category-tabs";
import MenuItemCard from "@/components/customer/menu-item-card";
import ItemDetailSheet from "@/components/customer/item-detail-sheet";
import type { CustomerCategory, CustomerMenuItem } from "@/lib/customer/catalog";

interface MenuClientProps {
  categories: CustomerCategory[];
  items: CustomerMenuItem[];
}

export default function MenuClient({ categories, items }: MenuClientProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<CustomerMenuItem | null>(null);

  const filtered = activeCategoryId ? items.filter(i => i.categoryId === activeCategoryId) : items;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Our Menu</h1>
      <CategoryTabs categories={categories} activeId={activeCategoryId} onSelect={setActiveCategoryId} />
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">🥯</div>
          <p>No items available</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <MenuItemCard key={item.id} item={item} onClick={setSelectedItem} />
          ))}
        </div>
      )}
      {selectedItem && (
        <ItemDetailSheet item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
