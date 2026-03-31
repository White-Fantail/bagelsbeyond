"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CustomerMenuItem } from "@/lib/customer/catalog";

const WEEKDAYS = [
  { key: "MON", label: "Mon" },
  { key: "TUE", label: "Tue" },
  { key: "WED", label: "Wed" },
  { key: "THU", label: "Thu" },
  { key: "FRI", label: "Fri" },
  { key: "SAT", label: "Sat" },
] as const;

type WeekdayKey = (typeof WEEKDAYS)[number]["key"];

interface SubscriptionSignupClientProps {
  item: CustomerMenuItem;
  session: { userId: string; name: string } | null;
  minStartDate: string;
  pickupTimeSlots: string[];
}

export default function SubscriptionSignupClient({
  item,
  session,
  minStartDate,
  pickupTimeSlots,
}: SubscriptionSignupClientProps) {
  const router = useRouter();
  const [frequency, setFrequency] = useState<"WEEKLY" | "BIWEEKLY" | "MONTHLY">("WEEKLY");
  const [pickupDays, setPickupDays] = useState<WeekdayKey[]>(["MON"]);
  const [pickupTime, setPickupTime] = useState(pickupTimeSlots[0] ?? "");
  const [startDate, setStartDate] = useState(minStartDate);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDay(day: WeekdayKey) {
    setPickupDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    if (pickupDays.length === 0) {
      setError("Please select at least one pickup day.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frequency,
          pickupDays,
          pickupTime,
          startDate,
          note: note.trim() || undefined,
          items: [{ itemId: item.id, itemName: item.name, unitPrice: item.basePrice, quantity }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError("Failed to create subscription. Please try again.");
        return;
      }
      router.push(`/subscription-success/${data.subscriptionId}`);
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/subscriptions" className="text-xs text-amber-600 hover:underline">← Back to subscriptions</Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Subscribe to {item.name}</h1>
        <p className="text-sm text-gray-500 mt-1">${item.basePrice.toFixed(2)} / item</p>
      </div>

      {!session ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-gray-700 font-medium mb-4">Please log in to set up a subscription</p>
          <Link
            href={`/login?next=/subscriptions/${item.id}`}
            className="inline-block px-6 py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700"
          >
            Log In
          </Link>
          <p className="text-sm text-gray-500 mt-3">
            No account?{" "}
            <Link href={`/signup?next=/subscriptions/${item.id}`} className="text-amber-600 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            {/* Frequency */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Frequency</label>
              <div className="flex gap-2">
                {(["WEEKLY", "BIWEEKLY", "MONTHLY"] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${frequency === f ? "bg-amber-600 text-white border-amber-600" : "border-gray-200 text-gray-600 hover:border-amber-300"}`}
                  >
                    {f === "WEEKLY" ? "Weekly" : f === "BIWEEKLY" ? "Bi-weekly" : "Monthly"}
                  </button>
                ))}
              </div>
            </div>

            {/* Pickup days */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Pickup Days</label>
              <div className="flex gap-1.5 flex-wrap">
                {WEEKDAYS.map(d => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleDay(d.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${pickupDays.includes(d.key) ? "bg-amber-600 text-white border-amber-600" : "border-gray-200 text-gray-600 hover:border-amber-300"}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pickup time */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pickup Time</label>
              <select
                value={pickupTime}
                onChange={e => setPickupTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {pickupTimeSlots.map(slot => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            </div>

            {/* Start date */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                min={minStartDate}
                onChange={e => setStartDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Quantity per pickup</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-700 hover:border-amber-500"
                >–</button>
                <span className="w-6 text-center font-semibold text-gray-900">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(q => q + 1)}
                  className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-700 hover:border-amber-500"
                >+</button>
                <span className="text-sm text-gray-500">× ${item.basePrice.toFixed(2)} = ${(item.basePrice * quantity).toFixed(2)}</span>
              </div>
            </div>

            {/* Note */}
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
            disabled={isSubmitting || pickupDays.length === 0}
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold rounded-xl"
          >
            {isSubmitting ? "Setting up…" : "Start Subscription"}
          </button>
        </form>
      )}
    </div>
  );
}
