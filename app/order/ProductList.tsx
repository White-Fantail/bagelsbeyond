"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { CartItem, SelectedOption } from "@/types/cart";

const CART_KEY = "beyond_cart";

interface Option { id: string; name: string; priceDelta: number; }
interface OptionGroup {
  id: string; name: string; minSelect: number; maxSelect: number;
  isRequired: boolean; options: Option[];
}
interface Product {
  id: string; name: string; description: string | null; category: string | null;
  basePrice: number; isSubscriptionEligible: boolean; isSoldOut: boolean;
  optionGroups: OptionGroup[];
}

interface Props { products: Product[]; }

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CART_KEY) ?? "[]") as CartItem[]; }
  catch { return []; }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

function calcLineTotal(basePrice: number, options: SelectedOption[], qty: number) {
  const optionTotal = options.reduce((s, o) => s + o.priceDelta, 0);
  return Math.round((basePrice + optionTotal) * qty * 100) / 100;
}

export default function ProductList({ products }: Props) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selections, setSelections] = useState<Record<string, Record<string, string>>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  useEffect(() => { setCart(loadCart()); }, []);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const handleAddToCart = useCallback((product: Product) => {
    const qty = quantities[product.id] ?? 1;

    // Validate required groups
    for (const group of product.optionGroups) {
      if (!group.isRequired) continue;
      const sel = selections[product.id]?.[group.id];
      if (!sel) {
        setFeedback((f) => ({ ...f, [product.id]: `"${group.name}" 옵션을 선택해주세요` }));
        return;
      }
    }

    const selectedOptions: SelectedOption[] = product.optionGroups
      .map((g) => {
        const optId = selections[product.id]?.[g.id];
        if (!optId) return null;
        const opt = g.options.find((o) => o.id === optId);
        if (!opt) return null;
        return {
          optionGroupId: g.id,
          optionGroupName: g.name,
          optionId: opt.id,
          optionName: opt.name,
          priceDelta: opt.priceDelta,
        };
      })
      .filter(Boolean) as SelectedOption[];

    const newItem: CartItem = {
      id: `${product.id}-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      basePrice: product.basePrice,
      quantity: qty,
      selectedOptions,
      lineTotal: calcLineTotal(product.basePrice, selectedOptions, qty),
    };

    const updated = [...cart, newItem];
    setCart(updated);
    saveCart(updated);
    setFeedback((f) => ({ ...f, [product.id]: "장바구니에 담겼습니다 ✓" }));
    setTimeout(() => setFeedback((f) => ({ ...f, [product.id]: "" })), 2000);
  }, [cart, quantities, selections]);

  return (
    <div className="pb-24">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => {
          const qty = quantities[product.id] ?? 1;
          const fb = feedback[product.id] ?? "";
          const isSoldOut = product.isSoldOut;

          return (
            <div
              key={product.id}
              className={`bg-white rounded-xl border ${isSoldOut ? "border-gray-200 opacity-60" : "border-gray-200"} p-5 flex flex-col gap-3`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-gray-900">{product.name}</h2>
                  {product.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{product.description}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    {product.category ?? "기타"}
                  </span>
                  {product.isSubscriptionEligible && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">구독 가능</span>
                  )}
                  {isSoldOut && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">품절</span>
                  )}
                </div>
              </div>

              <p className="text-lg font-bold text-gray-900">
                ${product.basePrice.toFixed(2)}
              </p>

              {/* Option groups */}
              {product.optionGroups.map((group) => (
                <div key={group.id}>
                  <p className="text-xs font-medium text-gray-700 mb-1">
                    {group.name}{group.isRequired && <span className="text-red-500 ml-0.5">*</span>}
                  </p>
                  <select
                    disabled={isSoldOut}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white disabled:bg-gray-50"
                    value={selections[product.id]?.[group.id] ?? ""}
                    onChange={(e) =>
                      setSelections((s) => ({
                        ...s,
                        [product.id]: { ...(s[product.id] ?? {}), [group.id]: e.target.value },
                      }))
                    }
                  >
                    {!group.isRequired && <option value="">선택 안 함</option>}
                    {group.isRequired && <option value="">선택해주세요</option>}
                    {group.options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}{o.priceDelta !== 0 && ` (${o.priceDelta > 0 ? "+" : ""}$${o.priceDelta.toFixed(2)})`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              {/* Quantity + add */}
              <div className="flex items-center gap-2 mt-auto">
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    disabled={isSoldOut || qty <= 1}
                    className="px-3 py-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    onClick={() => setQuantities((q) => ({ ...q, [product.id]: Math.max(1, qty - 1) }))}
                  >−</button>
                  <span className="px-3 text-sm font-medium">{qty}</span>
                  <button
                    disabled={isSoldOut}
                    className="px-3 py-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    onClick={() => setQuantities((q) => ({ ...q, [product.id]: qty + 1 }))}
                  >+</button>
                </div>
                <button
                  disabled={isSoldOut}
                  onClick={() => handleAddToCart(product)}
                  className="flex-1 py-1.5 px-3 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isSoldOut ? "품절" : "장바구니 담기"}
                </button>
              </div>

              {fb && (
                <p className={`text-xs ${fb.includes("✓") ? "text-green-600" : "text-red-500"}`}>{fb}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticky cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-amber-600 text-white p-4 flex items-center justify-between z-50">
          <span className="font-medium">장바구니 {cartCount}개</span>
          <Link href="/order/cart" className="bg-white text-amber-700 font-semibold px-5 py-2 rounded-lg text-sm">
            장바구니 보기 →
          </Link>
        </div>
      )}
    </div>
  );
}
