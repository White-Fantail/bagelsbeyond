"use client";

import { useState, useEffect } from "react";
import type { CustomerMenuItem } from "@/lib/customer/catalog";
import type { CartModifier } from "@/lib/customer/cart-context";
import ModifierSelector from "./modifier-selector";
import { useCart } from "@/lib/customer/cart-context";

interface ItemDetailSheetProps {
  item: CustomerMenuItem | null;
  onClose: () => void;
}

export default function ItemDetailSheet({ item, onClose }: ItemDetailSheetProps) {
  const { addLine } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, CartModifier[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (item) {
      setQuantity(1);
      setSelectedModifiers({});
      setErrors({});
    }
  }, [item]);

  if (!item) return null;

  const basePrice = Number(item.basePrice ?? 0);
  const selectedMods = Object.values(selectedModifiers).flat();
  const modTotal = selectedMods.reduce((s, m) => s + m.priceDelta, 0);
  const unitPrice = basePrice + modTotal;
  const total = unitPrice * quantity;

  function handleModifierChange(groupId: string, mods: CartModifier[]) {
    setSelectedModifiers(prev => ({ ...prev, [groupId]: mods }));
    setErrors(prev => ({ ...prev, [groupId]: "" }));
  }

  function handleAddToCart() {
    const newErrors: Record<string, string> = {};
    let valid = true;
    for (const group of item.modifierGroups ?? []) {
      if (group.isRequired && (!selectedModifiers[group.id] || selectedModifiers[group.id].length === 0)) {
        newErrors[group.id] = `Please select ${group.name}`;
        valid = false;
      }
    }
    if (!valid) {
      setErrors(newErrors);
      return;
    }
    addLine({
      itemId: item.id,
      itemName: item.name,
      unitPrice: basePrice,
      quantity,
      modifiers: selectedMods,
      imageUrl: item.imageUrl,
    });
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        <div className="px-4 pb-6">
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 pr-8">{item.name}</h2>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {item.description && <p className="text-sm text-gray-500 mb-4">{item.description}</p>}

          {(item.modifierGroups ?? []).map(group => (
            <ModifierSelector
              key={group.id}
              group={group}
              selected={selectedModifiers[group.id] ?? []}
              onChange={(mods) => handleModifierChange(group.id, mods)}
              error={errors[group.id]}
            />
          ))}

          <div className="flex items-center justify-between mt-4 mb-6">
            <span className="text-sm font-medium text-gray-700">Quantity</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-700 hover:border-amber-500"
              >–</button>
              <span className="w-6 text-center font-semibold text-gray-900">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-700 hover:border-amber-500"
              >+</button>
            </div>
          </div>

          <button
            onClick={handleAddToCart}
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl flex items-center justify-between px-4"
          >
            <span>Add to Cart</span>
            <span>${total.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </>
  );
}
