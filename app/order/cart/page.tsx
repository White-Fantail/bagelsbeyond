"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { CartItem } from "@/types/cart";

const CART_KEY = "beyond_cart";

function loadCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem(CART_KEY) ?? "[]") as CartItem[]; }
  catch { return []; }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCart(loadCart());
    setMounted(true);
  }, []);

  if (!mounted) return null;

  function updateQty(id: string, delta: number) {
    const updated = cart
      .map((item) => {
        if (item.id !== id) return item;
        const qty = item.quantity + delta;
        if (qty <= 0) return null;
        const optionTotal = item.selectedOptions.reduce((s, o) => s + o.priceDelta, 0);
        return { ...item, quantity: qty, lineTotal: Math.round((item.basePrice + optionTotal) * qty * 100) / 100 };
      })
      .filter(Boolean) as CartItem[];
    setCart(updated);
    saveCart(updated);
  }

  function remove(id: string) {
    const updated = cart.filter((i) => i.id !== id);
    setCart(updated);
    saveCart(updated);
  }

  const subtotal = Math.round(cart.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;

  if (cart.length === 0) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 space-y-4">
        <p className="text-4xl">🛒</p>
        <h1 className="text-xl font-semibold text-gray-800">Cart is empty</h1>
        <Link href="/order" className="inline-block px-5 py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600">
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cart</h1>
        <p className="text-gray-500 text-sm mt-1">Please check the contents before placing your order</p>
      </div>

      <div className="space-y-3">
        {cart.map((item) => (
          <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 flex gap-4">
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{item.productName}</p>
              {item.selectedOptions.length > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {item.selectedOptions.map((o) => o.optionName).join(", ")}
                </p>
              )}
              <p className="text-sm text-gray-700 mt-1">
                ${item.basePrice.toFixed(2)}
                {item.selectedOptions.some((o) => o.priceDelta !== 0) && (
                  <span className="text-gray-500">
                    {" + "}
                    ${item.selectedOptions.reduce((s, o) => s + o.priceDelta, 0).toFixed(2)} (Options)
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-col items-end justify-between gap-2">
              <p className="font-bold text-gray-900">${item.lineTotal.toFixed(2)}</p>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden text-sm">
                <button onClick={() => updateQty(item.id, -1)} className="px-2 py-1 hover:bg-gray-50">−</button>
                <span className="px-2">{item.quantity}</span>
                <button onClick={() => updateQty(item.id, 1)} className="px-2 py-1 hover:bg-gray-50">+</button>
              </div>
              <button onClick={() => remove(item.id)} className="text-xs text-red-500 hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex justify-between font-bold text-gray-900 text-lg">
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">Final amount will be recalculated on the server</p>
      </div>

      <div className="flex gap-3">
        <Link href="/order" className="flex-1 text-center py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50">
          ← Continue Shopping
        </Link>
        <Link href="/order/checkout" className="flex-1 text-center py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600">
          Checkout →
        </Link>
      </div>
    </div>
  );
}
