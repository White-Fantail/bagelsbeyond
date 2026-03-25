"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { salesFormSchema, type SalesFormSchema } from "@/lib/validations";

export default function SalesForm({
  initialData,
  recordId,
}: {
  initialData?: SalesFormSchema;
  recordId?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SalesFormSchema>({
    resolver: zodResolver(salesFormSchema) as Resolver<SalesFormSchema>,
    defaultValues: initialData ?? {
      date: new Date().toISOString().split("T")[0],
      bagelsBaked: 0,
      bagelsLeft: 0,
      storeSales: 0,
      uberSales: 0,
      doordashSales: 0,
      otherSales: 0,
      schoolHoliday: false,
    },
  });

  const onSubmit = async (data: SalesFormSchema) => {
    setStatus("loading");
    setErrorMessage("");
    try {
      const url = recordId ? `/api/sales/${recordId}` : "/api/sales";
      const method = recordId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "저장에 실패했습니다");
      }
      setStatus("success");
      setTimeout(() => {
        if (recordId) {
          router.push(`/sales/${recordId}`);
        } else {
          router.push("/sales");
        }
      }, 1500);
    } catch (e) {
      setStatus("error");
      setErrorMessage(e instanceof Error ? e.message : "저장에 실패했습니다");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {status === "success" && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          ✅ 저장되었습니다. 목록 페이지로 이동합니다...
        </div>
      )}
      {status === "error" && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          ❌ {errorMessage}
        </div>
      )}

      {/* 기본 정보 */}
      <Section title="기본 정보">
        <Field label="날짜 *" error={errors.date?.message}>
          <input type="date" {...register("date")} className={inputClass(!!errors.date)} />
        </Field>
        <Field label="구운 베이글 수 *" error={errors.bagelsBaked?.message}>
          <input type="number" min="0" {...register("bagelsBaked")} onFocus={(e) => e.target.select()} className={inputClass(!!errors.bagelsBaked)} />
        </Field>
        <Field label="남은 베이글 수 *" error={errors.bagelsLeft?.message}>
          <input type="number" min="0" {...register("bagelsLeft")} onFocus={(e) => e.target.select()} className={inputClass(!!errors.bagelsLeft)} />
        </Field>
      </Section>

      {/* 매출 정보 */}
      <Section title="매출 정보 (NZD)">
        <Field label="매장 매출 *" error={errors.storeSales?.message}>
          <input type="number" step="0.01" min="0" {...register("storeSales")} onFocus={(e) => e.target.select()} className={inputClass(!!errors.storeSales)} />
        </Field>
        <Field label="우버 매출 *" error={errors.uberSales?.message}>
          <input type="number" step="0.01" min="0" {...register("uberSales")} onFocus={(e) => e.target.select()} className={inputClass(!!errors.uberSales)} />
        </Field>
        <Field label="도어대쉬 매출 *" error={errors.doordashSales?.message}>
          <input type="number" step="0.01" min="0" {...register("doordashSales")} onFocus={(e) => e.target.select()} className={inputClass(!!errors.doordashSales)} />
        </Field>
        <Field label="기타 매출 *" error={errors.otherSales?.message}>
          <input type="number" step="0.01" min="0" {...register("otherSales")} onFocus={(e) => e.target.select()} className={inputClass(!!errors.otherSales)} />
        </Field>
      </Section>

      {/* 외부 요인 */}
      <Section title="외부 요인 (선택)">
        <Field label="날씨 요약" error={errors.weatherSummary?.message}>
          <input type="text" placeholder="예: 맑음, 비, 흐림" {...register("weatherSummary")} className={inputClass(false)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="최저 기온 (°C)" error={errors.minTemp?.message}>
            <input type="number" step="0.1" {...register("minTemp")} onFocus={(e) => e.target.select()} className={inputClass(!!errors.minTemp)} />
          </Field>
          <Field label="최고 기온 (°C)" error={errors.maxTemp?.message}>
            <input type="number" step="0.1" {...register("maxTemp")} onFocus={(e) => e.target.select()} className={inputClass(!!errors.maxTemp)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="강수량 (mm)" error={errors.rainMm?.message}>
            <input type="number" step="0.1" min="0" {...register("rainMm")} onFocus={(e) => e.target.select()} className={inputClass(!!errors.rainMm)} />
          </Field>
          <Field label="바람 (kph)" error={errors.windKph?.message}>
            <input type="number" step="0.1" min="0" {...register("windKph")} onFocus={(e) => e.target.select()} className={inputClass(!!errors.windKph)} />
          </Field>
        </div>
        <Field label="공휴일명" error={errors.holidayName?.message}>
          <input type="text" placeholder="예: Christmas Day" {...register("holidayName")} className={inputClass(false)} />
        </Field>
        <Field label="인근 이벤트명" error={errors.localEventName?.message}>
          <input type="text" placeholder="예: 지역 마켓" {...register("localEventName")} className={inputClass(false)} />
        </Field>
        <Field label="학교 방학 여부" error={errors.schoolHoliday?.message}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register("schoolHoliday")} className="w-4 h-4 rounded border-gray-300" />
            <span className="text-sm text-gray-700">학교 방학 기간입니다</span>
          </label>
        </Field>
      </Section>

      {/* 뉴스 요약 */}
      <Section title="뉴스 요약 (선택)">
        <Field label="뉴질랜드 뉴스 요약" error={errors.nzNewsSummary?.message}>
          <textarea
            rows={2}
            placeholder="주요 뉴질랜드 뉴스..."
            {...register("nzNewsSummary")}
            className={inputClass(false)}
          />
        </Field>
        <Field label="국제 뉴스 요약" error={errors.worldNewsSummary?.message}>
          <textarea
            rows={2}
            placeholder="주요 국제 뉴스..."
            {...register("worldNewsSummary")}
            className={inputClass(false)}
          />
        </Field>
      </Section>

      {/* 메모 */}
      <Section title="메모 (선택)">
        <Field label="메모" error={errors.notes?.message}>
          <textarea
            rows={3}
            placeholder="기타 메모..."
            {...register("notes")}
            className={inputClass(false)}
          />
        </Field>
      </Section>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={status === "loading" || status === "success"}
          className="px-6 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors font-medium disabled:opacity-50"
        >
          {status === "loading" ? "저장 중..." : "저장"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-medium"
        >
          취소
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function inputClass(hasError: boolean) {
  return `w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
    hasError ? "border-red-300 bg-red-50" : "border-gray-300"
  }`;
}
