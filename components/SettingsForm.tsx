"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { settingsSchema, type SettingsSchema } from "@/lib/validations";

type Props = {
  initialData: {
    shopName: string;
    defaultTargetWasteRatio: number;
    defaultSafetyBuffer: number;
    defaultRegion?: string;
    defaultCity?: string;
    defaultCountry?: string;
    defaultEventRegion?: string;
    autoCollectExternalData?: boolean;
  };
};

export default function SettingsForm({ initialData }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsSchema>({
    resolver: zodResolver(settingsSchema) as Resolver<SettingsSchema>,
    defaultValues: initialData,
  });

  const onSubmit = async (data: SettingsSchema) => {
    setStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "저장에 실패했습니다");
      }
      setStatus("success");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (e) {
      setStatus("error");
      setErrorMessage(e instanceof Error ? e.message : "저장에 실패했습니다");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {status === "success" && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          ✅ 설정이 저장되었습니다.
        </div>
      )}
      {status === "error" && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          ❌ {errorMessage}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">가게 정보</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">상점 이름</label>
          <input
            type="text"
            {...register("shopName")}
            className={`w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              errors.shopName ? "border-red-300 bg-red-50" : "border-gray-300"
            }`}
          />
          {errors.shopName && <p className="mt-1 text-xs text-red-600">{errors.shopName.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            기본 폐기 허용 비율 (0~1)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            {...register("defaultTargetWasteRatio")}
            className={`w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              errors.defaultTargetWasteRatio ? "border-red-300 bg-red-50" : "border-gray-300"
            }`}
          />
          <p className="mt-1 text-xs text-gray-400">예: 0.05 = 5% 폐기 허용</p>
          {errors.defaultTargetWasteRatio && (
            <p className="mt-1 text-xs text-red-600">{errors.defaultTargetWasteRatio.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">기본 생산 버퍼</label>
          <input
            type="number"
            step="0.01"
            min="1"
            {...register("defaultSafetyBuffer")}
            className={`w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              errors.defaultSafetyBuffer ? "border-red-300 bg-red-50" : "border-gray-300"
            }`}
          />
          <p className="mt-1 text-xs text-gray-400">예: 1.1 = 예측 수량의 10% 추가 생산</p>
          {errors.defaultSafetyBuffer && (
            <p className="mt-1 text-xs text-red-600">{errors.defaultSafetyBuffer.message}</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">지역 설정 (외부 데이터 수집용)</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">기본 지역 (Region)</label>
            <input
              type="text"
              {...register("defaultRegion")}
              placeholder="Canterbury"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="mt-1 text-xs text-gray-400">예: Canterbury, Auckland</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">기본 도시 (City)</label>
            <input
              type="text"
              {...register("defaultCity")}
              placeholder="Christchurch"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">국가 코드 (Country Code)</label>
            <input
              type="text"
              {...register("defaultCountry")}
              placeholder="NZ"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="mt-1 text-xs text-gray-400">공휴일 조회에 사용됩니다 (예: NZ, AU)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이벤트 검색 지역</label>
            <input
              type="text"
              {...register("defaultEventRegion")}
              placeholder="Christchurch"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register("autoCollectExternalData")}
              className="rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-700">예측/매출 생성 시 외부 데이터 자동 수집</span>
          </label>
          <p className="mt-1 text-xs text-gray-400 ml-5">활성화 시 새 매출/예측 생성 때 외부 데이터를 자동으로 수집합니다.</p>
        </div>
      </div>

      <button
        type="submit"
        disabled={status === "loading"}
        className="px-6 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors font-medium disabled:opacity-50"
      >
        {status === "loading" ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
