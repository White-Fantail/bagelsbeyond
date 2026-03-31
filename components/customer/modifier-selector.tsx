"use client";

import type { CartModifier } from "@/lib/customer/cart-context";

interface ModifierGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  options: {
    id: string;
    name: string;
    priceDelta: number;
    isDefault: boolean;
  }[];
}

interface ModifierSelectorProps {
  group: ModifierGroup;
  selected: CartModifier[];
  onChange: (mods: CartModifier[]) => void;
  error?: string;
}

export default function ModifierSelector({ group, selected, onChange, error }: ModifierSelectorProps) {
  const isMulti = group.maxSelect !== 1;

  function toggle(option: ModifierGroup["options"][0]) {
    const existing = selected.find(s => s.modifierOptionId === option.id);
    if (existing) {
      onChange(selected.filter(s => s.modifierOptionId !== option.id));
    } else {
      const mod: CartModifier = {
        modifierOptionId: option.id,
        optionName: option.name,
        priceDelta: Number(option.priceDelta),
      };
      if (!isMulti) {
        onChange([mod]);
      } else {
        const max = group.maxSelect;
        if (max && selected.length >= max) return;
        onChange([...selected, mod]);
      }
    }
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-gray-800">{group.name}</span>
        {group.isRequired ? (
          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Required</span>
        ) : (
          <span className="text-xs text-gray-400">Optional</span>
        )}
      </div>
      <div className="space-y-1.5">
        {group.options.map(opt => {
          const isSelected = selected.some(s => s.modifierOptionId === opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                isSelected
                  ? "border-amber-500 bg-amber-50 text-amber-900"
                  : "border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "border-amber-500 bg-amber-500" : "border-gray-300"}`}>
                  {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
                <span>{opt.name}</span>
              </div>
              {Number(opt.priceDelta) > 0 && (
                <span className="text-gray-500">+${Number(opt.priceDelta).toFixed(2)}</span>
              )}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
