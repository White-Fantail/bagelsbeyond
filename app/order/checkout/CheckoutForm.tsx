"use client";

import { useState, useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createOrderAction, type CreateOrderState } from "@/app/actions/order";
import { PICKUP_TIME_SLOTS, getMinPickupDate } from "@/lib/order/pickup-slots";
import type { CartItem } from "@/types/cart";

const CART_KEY = "beyond_cart";

interface Props {
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
}

const initialState: CreateOrderState = {};

export default function CheckoutForm({ customerName, customerEmail, customerPhone }: Props) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [state, formAction, isPending] = useActionState(createOrderAction, initialState);

  useEffect(() => {
    try {
      setCart(JSON.parse(localStorage.getItem(CART_KEY) ?? "[]") as CartItem[]);
    } catch {
      setCart([]);
    }
    setMounted(true);
  }, []);

  // Redirect on success and clear cart
  useEffect(() => {
    if (state.success && state.orderNumber) {
      localStorage.removeItem(CART_KEY);
      router.push(`/order/success/${state.orderNumber}`);
    }
  }, [state, router]);

  const subtotal = Math.round(cart.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;
  const minDate = getMinPickupDate();

  if (!mounted) return null;

  if (cart.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-gray-500">장바구니가 비어 있습니다</p>
        <Link href="/order" className="inline-block px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium">
          상품 보러 가기
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {/* Hidden cart data */}
      <input type="hidden" name="cartJson" value={JSON.stringify(cart)} />

      {/* Customer info (display only) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
        <h2 className="font-semibold text-gray-800 text-sm">주문자 정보</h2>
        <div className="text-sm space-y-1 text-gray-700">
          <p><span className="text-gray-500 w-16 inline-block">이름</span>{customerName}</p>
          <p><span className="text-gray-500 w-16 inline-block">이메일</span>{customerEmail}</p>
          {customerPhone && <p><span className="text-gray-500 w-16 inline-block">전화</span>{customerPhone}</p>}
        </div>
      </div>

      {/* Pickup date */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold text-gray-800 text-sm">픽업 정보</h2>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">픽업 날짜 <span className="text-red-500">*</span></label>
          <input
            type="date"
            name="pickupDate"
            min={minDate}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <p className="text-xs text-gray-400 mt-1">영업일(월~토) 기준, 최소 1일 전 주문</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">픽업 시간 <span className="text-red-500">*</span></label>
          <select
            name="pickupTimeSlot"
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">시간 선택</option>
            {PICKUP_TIME_SLOTS.map((slot) => (
              <option key={slot} value={slot}>{slot}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Note */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
        <label className="block text-xs font-medium text-gray-700">주문 메모 (선택)</label>
        <textarea
          name="note"
          rows={2}
          placeholder="특별 요청사항을 입력해주세요"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {/* Order summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
        <h2 className="font-semibold text-gray-800 text-sm">주문 요약</h2>
        {cart.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-gray-700">{item.productName} × {item.quantity}
              {item.selectedOptions.length > 0 && (
                <span className="text-gray-400 text-xs"> ({item.selectedOptions.map((o) => o.optionName).join(", ")})</span>
              )}
            </span>
            <span className="font-medium">${item.lineTotal.toFixed(2)}</span>
          </div>
        ))}
        <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-900">
          <span>예상 합계</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <p className="text-xs text-gray-400">최종 금액은 서버에서 재계산됩니다. 결제는 현장에서 이루어집니다.</p>
      </div>

      {state.message && !state.success && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 disabled:opacity-60 transition-colors"
      >
        {isPending ? "주문 처리 중…" : "주문하기"}
      </button>
    </form>
  );
}
