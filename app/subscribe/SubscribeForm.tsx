"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSubscriptionAction, type SubscriptionActionState } from "@/app/actions/subscription";
import { PICKUP_TIME_SLOTS } from "@/lib/order/pickup-slots";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Product {
  id: string;
  name: string;
  basePrice: number;
}

interface Props {
  products: Product[];
}

const initialState: SubscriptionActionState = {};

export default function SubscribeForm({ products }: Props) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createSubscriptionAction, initialState);

  useEffect(() => {
    if (state.success && state.subscriptionId) {
      router.push(`/account/subscriptions/${state.subscriptionId}`);
    }
  }, [state, router]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-6">
      {state.message && !state.success && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <span className="text-base mt-0.5" aria-hidden="true">⚠️</span>
          {state.message}
        </div>
      )}

      {/* Product selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">🥯</span>
          <h2 className="font-bold text-gray-900 text-base">Choose Your Bagels</h2>
        </div>
        {products.length === 0 ? (
          <div className="bg-amber-50 rounded-2xl border border-amber-100 p-6 text-center">
            <p className="text-2xl mb-2" aria-hidden="true">😔</p>
            <p className="text-sm text-gray-500">No subscribable products available at the moment</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="product-list">
            {products.map((p) => (
              <label
                key={p.id}
                className="group flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4 cursor-pointer hover:border-amber-300 hover:shadow-sm transition-all has-[:checked]:border-amber-400 has-[:checked]:bg-amber-50 has-[:checked]:shadow-sm"
              >
                <input
                  type="checkbox"
                  name={`product_${p.id}`}
                  value={p.id}
                  className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-amber-600 font-medium mt-0.5">${p.basePrice.toFixed(2)}/item</p>
                </div>
                <div className="shrink-0">
                  <input
                    type="number"
                    name={`qty_${p.id}`}
                    min={1}
                    max={99}
                    defaultValue={1}
                    className="w-14 border border-gray-200 rounded-xl px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400 group-has-[:checked]:border-amber-300"
                    aria-label={`Quantity for ${p.name}`}
                  />
                </div>
              </label>
            ))}
          </div>
        )}
        <input type="hidden" name="itemsJson" id="itemsJson" />
      </div>

      {/* Pickup day */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">📅</span>
          <h2 className="font-bold text-gray-900 text-base">
            Pickup Day <span className="text-red-500">*</span>
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map((d) => (
            <label key={d} className="cursor-pointer">
              <input type="radio" name="pickupWeekday" value={d} className="sr-only peer" required />
              <span className="inline-block px-5 py-2.5 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-700 peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500 hover:border-amber-300 hover:bg-amber-50 transition-all">
                {WEEKDAYS[d]}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Pickup time */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">🕐</span>
          <h2 className="font-bold text-gray-900 text-base">
            Pickup Time{" "}
            <span className="text-gray-400 font-normal text-sm">· Optional</span>
          </h2>
        </div>
        <select
          name="pickupTimeSlot"
          className="border border-gray-200 rounded-2xl px-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white appearance-none"
        >
          <option value="">No time preference</option>
          {PICKUP_TIME_SLOTS.map((slot) => (
            <option key={slot} value={slot}>{slot}</option>
          ))}
        </select>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">🗓️</span>
            <h2 className="font-bold text-gray-900 text-base">
              Start Date <span className="text-red-500">*</span>
            </h2>
          </div>
          <input
            type="date"
            name="startDate"
            min={today}
            defaultValue={today}
            required
            className="border border-gray-200 rounded-2xl px-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">🏁</span>
            <h2 className="font-bold text-gray-900 text-base">
              End Date{" "}
              <span className="text-gray-400 font-normal text-sm">· Optional</span>
            </h2>
          </div>
          <input
            type="date"
            name="endDate"
            min={today}
            className="border border-gray-200 rounded-2xl px-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Note */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">📝</span>
          <h2 className="font-bold text-gray-900 text-base">
            Notes{" "}
            <span className="text-gray-400 font-normal text-sm">· Optional</span>
          </h2>
        </div>
        <textarea
          name="note"
          rows={3}
          maxLength={500}
          placeholder="Allergies, special requests, cream cheese preferences…"
          className="border border-gray-200 rounded-2xl px-4 py-3 text-sm w-full resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      <SubscribeFormSubmit isPending={isPending} />
    </form>
  );
}

function SubscribeFormSubmit({ isPending }: { isPending: boolean }) {
  return (
    <button
      type="submit"
      disabled={isPending}
      onClick={(e) => {
        const form = (e.currentTarget as HTMLButtonElement).closest("form")!;
        const products: { productId: string; quantity: number }[] = [];
        form.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach((cb) => {
          if (!cb.checked) return;
          const productId = cb.value;
          const qtyInput = form.querySelector<HTMLInputElement>(`input[name="qty_${productId}"]`);
          const quantity = qtyInput ? parseInt(qtyInput.value, 10) : 1;
          if (quantity > 0) products.push({ productId, quantity });
        });
        const hiddenInput = form.querySelector<HTMLInputElement>("#itemsJson");
        if (hiddenInput) hiddenInput.value = JSON.stringify(products);
      }}
      className="w-full py-4 rounded-2xl bg-amber-500 text-white font-bold text-base hover:bg-amber-600 disabled:opacity-60 transition-colors shadow-sm hover:shadow-md"
    >
      {isPending ? "Setting up your subscription…" : "🥯 Start Subscription"}
    </button>
  );
}
