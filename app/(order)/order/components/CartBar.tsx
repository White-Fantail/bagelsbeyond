"use client";

import { useRouter } from "next/navigation";

type CartBarProps = {
  itemCount: number;
  total: number;
};

export default function CartBar({ itemCount, total }: CartBarProps) {
  const router = useRouter();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-indigo-600 text-white shadow-lg border-t-4 border-indigo-700">
      <div className="max-w-md mx-auto px-4 py-4">
        <button
          onClick={() => router.push("/order/cart")}
          className="w-full flex items-center justify-between"
        >
          <span className="font-medium">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </span>
          <span className="font-semibold">View order</span>
          <span className="font-bold text-lg">${total.toFixed(2)}</span>
        </button>
      </div>
    </div>
  );
}
