"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSubscriptionAction, type SubscriptionActionState } from "@/app/actions/subscription";
import { PICKUP_TIME_SLOTS } from "@/lib/order/pickup-slots";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface Product {
  id: string;
  name: string;
  basePrice: number;
  category: string;
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
    <form action={formAction} className="space-y-5">
      {state.message && !state.success && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      {/* Product selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold text-gray-800 text-sm">상품 선택</h2>
        {products.length === 0 ? (
          <p className="text-sm text-gray-500">구독 가능한 상품이 없습니다</p>
        ) : (
          <div className="space-y-3" id="product-list">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <label className="flex items-center gap-2 flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    name={`product_${p.id}`}
                    value={p.id}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm text-gray-900">{p.name}</span>
                  <span className="text-xs text-gray-400">${p.basePrice.toFixed(2)}</span>
                </label>
                <input
                  type="number"
                  name={`qty_${p.id}`}
                  min={1}
                  max={99}
                  defaultValue={1}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            ))}
          </div>
        )}
        <input type="hidden" name="itemsJson" id="itemsJson" />
      </div>

      {/* Weekday */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold text-gray-800 text-sm">픽업 요일 <span className="text-red-500">*</span></h2>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map((d) => (
            <label key={d} className="cursor-pointer">
              <input type="radio" name="pickupWeekday" value={d} className="sr-only peer" required />
              <span className="inline-block px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500 hover:bg-amber-50 transition-colors">
                {WEEKDAYS[d]}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Pickup time slot */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold text-gray-800 text-sm">픽업 시간 (선택)</h2>
        <select
          name="pickupTimeSlot"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="">시간 선택 안함</option>
          {PICKUP_TIME_SLOTS.map((slot) => (
            <option key={slot} value={slot}>{slot}</option>
          ))}
        </select>
      </div>

      {/* Start date */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold text-gray-800 text-sm">시작일 <span className="text-red-500">*</span></h2>
        <input
          type="date"
          name="startDate"
          min={today}
          defaultValue={today}
          required
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {/* End date (optional) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold text-gray-800 text-sm">종료일 (선택)</h2>
        <input
          type="date"
          name="endDate"
          min={today}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {/* Note */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold text-gray-800 text-sm">메모 (선택)</h2>
        <textarea
          name="note"
          rows={2}
          maxLength={500}
          placeholder="특별 요청사항 등"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      <SubscribeFormSubmit isPending={isPending} />
    </form>
  );
}

function SubscribeFormSubmit({ isPending }: { isPending: boolean }) {
  return (
    <div className="space-y-3">
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
        className="w-full py-3 rounded-xl bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 disabled:opacity-60 transition-colors"
      >
        {isPending ? "처리 중..." : "구독 신청하기"}
      </button>
    </div>
  );
}
