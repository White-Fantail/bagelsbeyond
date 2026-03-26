"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  today: string;
}

export default function ProductionDatePicker({ today }: Props) {
  const router = useRouter();
  const [date, setDate] = useState(today);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (date) router.push(`/admin/production/${date}`);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md">
      <h2 className="font-semibold text-gray-900 mb-4">날짜를 선택하세요</h2>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="submit"
          className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
        >
          조회
        </button>
      </form>
      <p className="text-xs text-gray-400 mt-3">
        날짜를 선택하면 해당 날짜의 확정 주문, 구독, 예측 수요, 재고를 분석하여 생산량을 추천합니다.
      </p>
    </div>
  );
}
