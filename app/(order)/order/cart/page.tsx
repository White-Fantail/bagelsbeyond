"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CheckoutModal from "./components/CheckoutModal";

type CartItem = {
  cartItemId: string;
  itemId: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  selectedModifiers: Array<{
    modifierGroupId: string;
    modifierGroupName: string;
    modifierOptionId: string;
    modifierOptionName: string;
    priceDelta: number;
  }>;
  notes?: string;
  itemTotal: number;
};

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);

  // Load cart from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("bagelsbeyond-cart");
    if (saved) {
      try {
        setCart(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load cart:", e);
      }
    }
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem("bagelsbeyond-cart", JSON.stringify(cart));
  }, [cart]);

  const cartTotal = cart.reduce((sum, item) => sum + item.itemTotal, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const updateQuantity = (cartItemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeItem(cartItemId);
      return;
    }

    setCart((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId
          ? {
              ...item,
              quantity: newQuantity,
              itemTotal: item.unitPrice * newQuantity,
            }
          : item
      )
    );
  };

  const removeItem = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto px-4 py-8">
          <div className="text-center py-12">
            <svg
              className="w-20 h-20 text-gray-300 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Your cart is empty
            </h2>
            <p className="text-gray-500 mb-6">
              Add some delicious items to get started!
            </p>
            <button
              onClick={() => router.push("/order")}
              className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700"
            >
              Browse menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push("/order")}
            className="p-2 text-gray-600 hover:text-gray-900"
            aria-label="Back"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Your Order</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 pb-32">
        {/* Store Info Card */}
        <div className="bg-white rounded-lg border p-4 mb-4">
          <h2 className="font-semibold text-gray-900 mb-1">Bagel's Beyond</h2>
          <p className="text-sm text-gray-600">Pick-up • ASAP (20 mins)</p>
        </div>

        {/* Cart Items */}
        <div className="bg-white rounded-lg border">
          <div className="divide-y">
            {cart.map((item) => (
              <div key={item.cartItemId} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {item.itemName}
                    </h3>
                    {item.selectedModifiers.length > 0 && (
                      <ul className="mt-1 text-sm text-gray-600 space-y-0.5">
                        {item.selectedModifiers.map((mod, idx) => (
                          <li key={idx}>
                            • {mod.modifierOptionName}
                            {mod.priceDelta !== 0 &&
                              ` (+$${mod.priceDelta.toFixed(2)})`}
                          </li>
                        ))}
                      </ul>
                    )}
                    {item.notes && (
                      <p className="mt-1 text-sm text-gray-500 italic">
                        Note: {item.notes}
                      </p>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 ml-4">
                    ${item.itemTotal.toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        updateQuantity(item.cartItemId, item.quantity - 1)
                      }
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-indigo-500 hover:text-indigo-600"
                    >
                      <svg
                        className="w-4 h-4"
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
                    <span className="font-medium text-gray-900 min-w-[2rem] text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity(item.cartItemId, item.quantity + 1)
                      }
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-indigo-500 hover:text-indigo-600"
                    >
                      <svg
                        className="w-4 h-4"
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
                  <button
                    onClick={() => removeItem(item.cartItemId)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-lg border p-4 mt-4">
          <div className="flex justify-between text-base">
            <span className="text-gray-700">Subtotal</span>
            <span className="font-semibold text-gray-900">
              ${cartTotal.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-lg font-bold mt-2 pt-2 border-t">
            <span className="text-gray-900">Total</span>
            <span className="text-indigo-600">${cartTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => setShowCheckout(true)}
            className="w-full py-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Place order • {cartItemCount} {cartItemCount === 1 ? "item" : "items"}
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <CheckoutModal
          cart={cart}
          total={cartTotal}
          onClose={() => setShowCheckout(false)}
          onSuccess={() => setCart([])}
        />
      )}
    </div>
  );
}
