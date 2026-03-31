"use client";

import { useCart } from "@/lib/customer/cart-context";
import Link from "next/link";
import Image from "next/image";

export default function CartClient() {
  const { lines, itemCount, subtotal, updateQuantity, removeLine } = useCart();

  if (itemCount === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">🛒</div>
        <h2 className="text-lg font-semibold text-gray-700">Your cart is empty</h2>
        <p className="text-gray-400 text-sm mt-1">Add some bagels to get started</p>
        <Link href="/menu" className="mt-6 inline-block px-6 py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700">
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Your Cart</h1>
      <div className="space-y-3">
        {lines.map(line => (
          <div key={line.id} className="bg-white rounded-xl border border-gray-100 p-3 flex gap-3">
            <div className="w-16 h-16 rounded-lg bg-amber-50 flex-shrink-0 flex items-center justify-center">
              {line.imageUrl ? (
                <Image src={line.imageUrl} alt={line.itemName} width={64} height={64} className="w-full h-full object-cover rounded-lg" />
              ) : (
                <span className="text-2xl">🥯</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 text-sm">{line.itemName}</h3>
              {line.modifiers.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">{line.modifiers.map(m => m.optionName).join(", ")}</p>
              )}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(line.id, line.quantity - 1)}
                    className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-amber-500 text-xs"
                  >–</button>
                  <span className="text-sm font-medium w-4 text-center">{line.quantity}</span>
                  <button
                    onClick={() => updateQuantity(line.id, line.quantity + 1)}
                    className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-amber-500 text-xs"
                  >+</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-amber-700">${line.lineTotal.toFixed(2)}</span>
                  <button
                    onClick={() => removeLine(line.id)}
                    className="text-gray-300 hover:text-red-400 text-xs"
                  >✕</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-gray-900 text-base">
          <span>Total</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
      </div>
      <Link href="/checkout" className="block w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-center">
        Proceed to Checkout
      </Link>
    </div>
  );
}
