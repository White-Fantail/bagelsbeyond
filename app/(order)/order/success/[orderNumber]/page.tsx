"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CART_STORAGE_KEY } from "../../constants";

type SuccessPageProps = {
  params: Promise<{ orderNumber: string }>;
};

export default function SuccessPage({ params }: SuccessPageProps) {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState<string>("");

  useEffect(() => {
    params.then((p) => setOrderNumber(p.orderNumber));
  }, [params]);

  // Clear cart from localStorage on success
  useEffect(() => {
    localStorage.removeItem(CART_STORAGE_KEY);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-12 h-12 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {/* Success Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Order received!
        </h1>
        <p className="text-gray-600 mb-6">
          Please pay when you pick up your order.
        </p>

        {/* Order Number */}
        <div className="bg-indigo-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 mb-1">Order number</p>
          <p className="text-xl font-bold text-indigo-700">{orderNumber}</p>
        </div>

        {/* Estimated Time */}
        <div className="flex items-center justify-center gap-2 text-gray-700 mb-8">
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Estimated pickup: ~20 minutes</span>
        </div>

        {/* Back to Menu Button */}
        <button
          onClick={() => router.push("/order")}
          className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Back to menu
        </button>
      </div>
    </div>
  );
}
