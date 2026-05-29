"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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

type CheckoutModalProps = {
  cart: CartItem[];
  total: number;
  onClose: () => void;
  onSuccess: () => void;
};

export default function CheckoutModal({
  cart,
  total,
  onClose,
  onSuccess,
}: CheckoutModalProps) {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [pickupType, setPickupType] = useState<"ASAP" | "SCHEDULED">("ASAP");
  const [pickupTime, setPickupTime] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const orderData = {
        customerName,
        customerPhone,
        customerEmail: customerEmail || undefined,
        pickupType,
        pickupTime:
          pickupType === "SCHEDULED" && pickupTime
            ? new Date(pickupTime).toISOString()
            : undefined,
        notes: notes || undefined,
        items: cart.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          notes: item.notes,
          selectedModifiers: item.selectedModifiers.map((mod) => ({
            modifierGroupId: mod.modifierGroupId,
            modifierOptionId: mod.modifierOptionId,
          })),
        })),
      };

      const response = await fetch(
        "/api/public/stores/bagels-beyond/orders",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderData),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to place order");
      }

      // Clear cart and redirect to success page
      onSuccess();
      router.push(`/order/success/${result.orderNumber}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-md h-auto max-h-[90vh] sm:rounded-t-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b z-10 px-4 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Checkout
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 disabled:opacity-50"
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

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Customer Name */}
          <div>
            <label
              htmlFor="customerName"
              className="block text-sm font-medium text-gray-900 mb-1"
            >
              Your name <span className="text-red-600">*</span>
            </label>
            <input
              id="customerName"
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
            />
          </div>

          {/* Customer Phone */}
          <div>
            <label
              htmlFor="customerPhone"
              className="block text-sm font-medium text-gray-900 mb-1"
            >
              Phone number <span className="text-red-600">*</span>
            </label>
            <input
              id="customerPhone"
              type="tel"
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="021 123 4567"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
            />
          </div>

          {/* Customer Email */}
          <div>
            <label
              htmlFor="customerEmail"
              className="block text-sm font-medium text-gray-900 mb-1"
            >
              Email (optional)
            </label>
            <input
              id="customerEmail"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="john@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
            />
          </div>

          {/* Pickup Type */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Pickup time
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-indigo-300">
                <input
                  type="radio"
                  name="pickupType"
                  value="ASAP"
                  checked={pickupType === "ASAP"}
                  onChange={(e) => setPickupType(e.target.value as "ASAP")}
                  className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-medium text-gray-900">ASAP</div>
                  <div className="text-sm text-gray-600">Ready in ~20 mins</div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-indigo-300">
                <input
                  type="radio"
                  name="pickupType"
                  value="SCHEDULED"
                  checked={pickupType === "SCHEDULED"}
                  onChange={(e) => setPickupType(e.target.value as "SCHEDULED")}
                  className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Later today</div>
                  {pickupType === "SCHEDULED" && (
                    <input
                      type="datetime-local"
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                      required
                      className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                    />
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-gray-900 mb-1"
            >
              Order notes (optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions?"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
            />
          </div>

          {/* Order Summary */}
          <div className="p-4 bg-gray-50 rounded-lg border">
            <div className="flex justify-between text-lg font-bold">
              <span className="text-gray-900">Total</span>
              <span className="text-indigo-600">${total.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Pay when you pick up your order
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Placing order..." : "Place order"}
          </button>
        </form>
      </div>
    </div>
  );
}
