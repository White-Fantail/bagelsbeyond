"use client";

import { useState, useEffect } from "react";

type ModifierOption = {
  id: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
};

type ModifierGroup = {
  id: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  options: ModifierOption[];
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sellingPrice: number | null;
  isPopular: boolean;
  isSoldOut: boolean;
  modifierGroups: ModifierGroup[];
};

type SelectedModifier = {
  modifierGroupId: string;
  modifierGroupName: string;
  modifierOptionId: string;
  modifierOptionName: string;
  priceDelta: number;
};

type ProductDetailModalProps = {
  product: Product;
  onClose: () => void;
  onAddToCart: (
    product: Product,
    quantity: number,
    selectedModifiers: SelectedModifier[],
    notes?: string
  ) => void;
};

export default function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [selectedModifiers, setSelectedModifiers] = useState<
    Map<string, string[]>
  >(new Map());

  // Calculate if all required modifiers are selected
  const canAddToCart = () => {
    for (const group of product.modifierGroups) {
      if (group.isRequired) {
        const selections = selectedModifiers.get(group.id) || [];
        if (selections.length < group.minSelections) {
          return false;
        }
      }
    }
    return true;
  };

  // Calculate total price
  const calculateTotal = () => {
    const basePrice = product.sellingPrice || 0;
    let modifierPrice = 0;

    product.modifierGroups.forEach((group) => {
      const selections = selectedModifiers.get(group.id) || [];
      selections.forEach((optionId) => {
        const option = group.options.find((opt) => opt.id === optionId);
        if (option) {
          modifierPrice += option.priceDelta;
        }
      });
    });

    return (basePrice + modifierPrice) * quantity;
  };

  const handleModifierChange = (
    groupId: string,
    optionId: string,
    group: ModifierGroup
  ) => {
    setSelectedModifiers((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(groupId) || [];

      if (group.maxSelections === 1) {
        // Radio behavior: replace selection
        newMap.set(groupId, [optionId]);
      } else {
        // Checkbox behavior: toggle
        if (current.includes(optionId)) {
          const updated = current.filter((id) => id !== optionId);
          if (updated.length === 0) {
            newMap.delete(groupId);
          } else {
            newMap.set(groupId, updated);
          }
        } else {
          if (current.length < group.maxSelections) {
            newMap.set(groupId, [...current, optionId]);
          }
        }
      }

      return newMap;
    });
  };

  const handleAddToCart = () => {
    const modifiers: SelectedModifier[] = [];

    product.modifierGroups.forEach((group) => {
      const selections = selectedModifiers.get(group.id) || [];
      selections.forEach((optionId) => {
        const option = group.options.find((opt) => opt.id === optionId);
        if (option) {
          modifiers.push({
            modifierGroupId: group.id,
            modifierGroupName: group.name,
            modifierOptionId: option.id,
            modifierOptionName: option.name,
            priceDelta: option.priceDelta,
          });
        }
      });
    });

    onAddToCart(product, quantity, modifiers, notes || undefined);
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-md h-full sm:h-auto sm:max-h-[90vh] sm:rounded-t-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b z-10 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {product.name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Image */}
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
            <svg
              className="w-16 h-16 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Product Info */}
          <div>
            <div className="flex items-start gap-2 mb-2">
              <h3 className="text-xl font-bold text-gray-900 flex-1">
                {product.name}
              </h3>
              {product.isPopular && (
                <span className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 rounded">
                  Popular
                </span>
              )}
            </div>
            {product.description && (
              <p className="text-gray-600 mb-3">{product.description}</p>
            )}
            <p className="text-xl font-bold text-indigo-600">
              ${(product.sellingPrice || 0).toFixed(2)}
            </p>
          </div>

          {/* Modifier Groups */}
          {product.modifierGroups.map((group) => (
            <div key={group.id} className="border-t pt-4">
              <div className="mb-3">
                <h4 className="font-semibold text-gray-900">
                  {group.name}
                  {group.isRequired && (
                    <span className="ml-2 text-sm text-red-600">*</span>
                  )}
                </h4>
                {group.description && (
                  <p className="text-sm text-gray-600 mt-1">
                    {group.description}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {group.maxSelections === 1
                    ? "Choose 1"
                    : `Choose up to ${group.maxSelections}`}
                </p>
              </div>

              <div className="space-y-2">
                {group.options.map((option) => {
                  const selections = selectedModifiers.get(group.id) || [];
                  const isSelected = selections.includes(option.id);

                  return (
                    <label
                      key={option.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type={group.maxSelections === 1 ? "radio" : "checkbox"}
                        name={group.id}
                        checked={isSelected}
                        onChange={() =>
                          handleModifierChange(group.id, option.id, group)
                        }
                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <span className="flex-1 text-gray-900">
                        {option.name}
                      </span>
                      {option.priceDelta !== 0 && (
                        <span className="text-sm font-medium text-gray-600">
                          {option.priceDelta > 0 ? "+" : ""}$
                          {option.priceDelta.toFixed(2)}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Special Instructions */}
          <div className="border-t pt-4">
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-gray-900 mb-2"
            >
              Special instructions
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specific requests? (optional)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t p-4 space-y-4">
          {/* Quantity Stepper */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-600 hover:border-indigo-500 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 12H4"
                />
              </svg>
            </button>
            <span className="text-xl font-semibold text-gray-900 min-w-[2rem] text-center">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-600 hover:border-indigo-500 hover:text-indigo-600"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            disabled={!canAddToCart()}
            className="w-full py-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Add to order • ${calculateTotal().toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}
