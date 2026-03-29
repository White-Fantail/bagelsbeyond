"use client";

import { useState } from "react";

type ProductOption = {
  id: string;
  name: string;
  priceDelta: number;
  isActive: boolean;
  sortOrder: number;
  sku: string | null;
  tracksInventory: boolean;
};

type ProductOptionGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  sortOrder: number;
  externalMapping?: { externalOptionGroupId: string } | null;
  options: ProductOption[];
};

type Props = {
  initialGroups: ProductOptionGroup[];
};

export default function OptionGroupManager({ initialGroups }: Props) {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="border-b border-gray-100 pb-2">
        <h2 className="text-base font-semibold text-gray-900">Modifier Groups</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Loyverse에서 동기화됩니다. 전체 동기화 시 자동 반영됩니다.
        </p>
      </div>

      {initialGroups.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-6">
          <p>연결된 모디파이어가 없습니다. 이 정보는 Loyverse 전체 동기화 시 자동 반영됩니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {initialGroups.map((group) => {
            const isExpanded = expandedGroupId === group.id;

            return (
              <div key={group.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Group header */}
                <button
                  type="button"
                  className="w-full flex items-center gap-3 flex-wrap text-left px-4 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
                  onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                >
                  <span className="text-gray-400 text-xs">{isExpanded ? "▼" : "▶"}</span>
                  <span className="font-medium text-gray-900 text-sm flex-1">{group.name}</span>
                  {group.isRequired && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                      Required
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {group.options.length} options
                  </span>
                </button>

                {/* Options list (collapsible) */}
                {isExpanded && (
                  <div className="divide-y divide-gray-100">
                    {group.options.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-gray-400">No options</p>
                    ) : (
                      group.options.map((option) => (
                        <div
                          key={option.id}
                          className="flex items-center justify-between px-4 py-2.5 text-sm"
                        >
                          <div className="flex items-center gap-3 flex-wrap">
                            <span
                              className={
                                option.isActive ? "text-gray-800" : "text-gray-400 line-through"
                              }
                            >
                              {option.name}
                            </span>
                            <span className="text-gray-500 tabular-nums">
                              {option.priceDelta === 0
                                ? "Free"
                                : option.priceDelta > 0
                                ? `+$${option.priceDelta.toFixed(2)}`
                                : `-$${Math.abs(option.priceDelta).toFixed(2)}`}
                            </span>
                            {!option.isActive && (
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 text-xs rounded-full">
                                Inactive
                              </span>
                            )}
                            {option.tracksInventory && (
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
                                Inventory Tracking
                              </span>
                            )}
                            {option.sku && (
                              <span className="text-xs text-gray-400">SKU: {option.sku}</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

