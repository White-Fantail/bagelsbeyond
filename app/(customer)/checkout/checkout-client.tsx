"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/customer/cart-context";

interface CheckoutClientProps {
  session: { userId: string; name: string; email: string } | null;
  minPickupDate: string;
  pickupTimeSlots: string[];
}

export default function CheckoutClient({ session, minPickupDate, pickupTimeSlots }: CheckoutClientProps) {
  const router = useRouter();
  const { lines, subtotal, clearCart } = useCart();
  const [pickupDate, setPickupDate] = useState(minPickupDate);
  const [pickupTime, setPickupTime] = useState(pickupTimeSlots[0] ?? "");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (lines.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">🛒</div>
        <h2 className="text-lg font-semibold text-gray-700">Your cart is empty</h2>
        <Link href="/menu" className="mt-6 inline-block px-6 py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700">
          Browse Menu
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupDate,
          pickupTime,
          note: note.trim() || undefined,
          lines: lines.map(l => ({
            itemId: l.itemId,
            itemName: l.itemName,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            modifiers: l.modifiers,
            note: l.note,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ? JSON.stringify(data.error) : "Order failed. Please try again.");
        return;
      }
      clearCart();
      router.push(`/order-success/${data.orderId}`);
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Checkout</h1>

      {/* Cart summary */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
        <h2 className="font-semibold text-gray-800 text-sm mb-3">Order Summary</h2>
        {lines.map(line => (
          <div key={line.id} className="flex justify-between text-sm">
            <span className="text-gray-700">{line.itemName} × {line.quantity}</span>
            <span className="font-medium text-gray-900">${line.lineTotal.toFixed(2)}</span>
          </div>
        ))}
        <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between font-bold text-gray-900">
          <span>Total</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
      </div>

      {!session ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-gray-700 font-medium mb-4">Please log in to complete your order</p>
          <Link
            href="/login?next=/checkout"
            className="inline-block px-6 py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700"
          >
            Log In
          </Link>
          <p className="text-sm text-gray-500 mt-3">
            No account?{" "}
            <Link href="/signup?next=/checkout" className="text-amber-600 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pickup date */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <h2 className="font-semibold text-gray-800 text-sm">Pickup Details</h2>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pickup Date</label>
              <input
                type="date"
                value={pickupDate}
                min={minPickupDate}
                onChange={e => setPickupDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pickup Time</label>
              <select
                value={pickupTime}
                onChange={e => setPickupTime(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {pickupTimeSlots.map(slot => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                placeholder="Any special requests..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold rounded-xl"
          >
            {isSubmitting ? "Placing Order…" : `Place Order · $${subtotal.toFixed(2)}`}
          </button>
        </form>
      )}
    </div>
  );
}
