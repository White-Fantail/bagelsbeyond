"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import Link from "next/link";

const productFormSchema = z.object({
  name: z.string().min(1, "상품명을 입력해주세요"),
  slug: z
    .string()
    .min(1, "슬러그를 입력해주세요")
    .regex(/^[a-z0-9-]+$/, "슬러그는 소문자, 숫자, 하이픈만 사용할 수 있습니다"),
  description: z.string().optional(),
  category: z.enum(["BAGEL", "SANDWICH", "SPREAD", "DRINK", "OTHER"]),
  basePrice: z.coerce.number().min(0, "가격은 0 이상이어야 합니다"),
  isActive: z.boolean(),
  isSubscriptionEligible: z.boolean(),
  sortOrder: z.coerce.number().int(),
});

type ProductFormSchema = z.infer<typeof productFormSchema>;

export type ProductFormData = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  category: "BAGEL" | "SANDWICH" | "SPREAD" | "DRINK" | "OTHER";
  basePrice: number;
  isActive: boolean;
  isSubscriptionEligible: boolean;
  sortOrder: number;
};

const CATEGORY_OPTIONS = [
  { value: "BAGEL", label: "베이글" },
  { value: "SANDWICH", label: "샌드위치" },
  { value: "SPREAD", label: "스프레드" },
  { value: "DRINK", label: "음료" },
  { value: "OTHER", label: "기타" },
] as const;

export default function ProductForm({
  product,
  mode,
}: {
  product?: ProductFormData;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormSchema>({
    resolver: zodResolver(productFormSchema) as Resolver<ProductFormSchema>,
    defaultValues: product
      ? {
          name: product.name,
          slug: product.slug,
          description: product.description ?? "",
          category: product.category,
          basePrice: product.basePrice,
          isActive: product.isActive,
          isSubscriptionEligible: product.isSubscriptionEligible,
          sortOrder: product.sortOrder,
        }
      : {
          name: "",
          slug: "",
          description: "",
          category: "BAGEL",
          basePrice: 0,
          isActive: true,
          isSubscriptionEligible: false,
          sortOrder: 0,
        },
  });

  const onSubmit = async (data: ProductFormSchema) => {
    setStatus("loading");
    setErrorMessage("");
    try {
      const url =
        mode === "edit" && product
          ? `/api/admin/products/${product.id}`
          : "/api/admin/products";
      const method = mode === "edit" ? "PATCH" : "POST";
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
        router.push("/admin/products");
      }, 1200);
    } catch (e) {
      setStatus("error");
      setErrorMessage(e instanceof Error ? e.message : "저장에 실패했습니다");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {status === "success" && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          ✅ 저장되었습니다. 상품 목록으로 이동합니다...
        </div>
      )}
      {status === "error" && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ❌ {errorMessage}
        </div>
      )}

      {/* 기본 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">
          기본 정보
        </h2>

        <Field label="상품명 *" error={errors.name?.message}>
          <input
            type="text"
            placeholder="예: 플레인 베이글"
            {...register("name")}
            className={inputClass(!!errors.name)}
          />
        </Field>

        <Field
          label="슬러그 *"
          error={errors.slug?.message}
          hint="영소문자, 숫자, 하이픈만 사용 (예: plain-bagel)"
        >
          <input
            type="text"
            placeholder="plain-bagel"
            {...register("slug")}
            className={inputClass(!!errors.slug)}
          />
        </Field>

        <Field label="설명" error={errors.description?.message}>
          <textarea
            rows={3}
            placeholder="상품 설명을 입력하세요 (선택)"
            {...register("description")}
            className={inputClass(false)}
          />
        </Field>

        <Field label="카테고리 *" error={errors.category?.message}>
          <select {...register("category")} className={inputClass(!!errors.category)}>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* 가격 및 상태 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">
          가격 및 상태
        </h2>

        <Field label="기본가격 *" error={errors.basePrice?.message}>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register("basePrice")}
            onFocus={(e) => e.target.select()}
            className={inputClass(!!errors.basePrice)}
          />
        </Field>

        <Field label="정렬 순서" error={errors.sortOrder?.message}>
          <input
            type="number"
            step="1"
            {...register("sortOrder")}
            onFocus={(e) => e.target.select()}
            className={inputClass(!!errors.sortOrder)}
          />
        </Field>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register("isActive")}
              className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm font-medium text-gray-700">활성 상태</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register("isSubscriptionEligible")}
              className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm font-medium text-gray-700">구독 가능 상품</span>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={status === "loading" || status === "success"}
          className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {status === "loading" ? "저장 중..." : "저장"}
        </button>
        <Link
          href="/admin/products"
          className="px-6 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          취소
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function inputClass(hasError: boolean) {
  return `w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
    hasError ? "border-red-300 bg-red-50" : "border-gray-300"
  }`;
}
