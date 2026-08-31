"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { salesFormSchema, type SalesFormSchema } from "@/lib/validations";

export default function SalesForm({ initialData, recordId }: { initialData?: SalesFormSchema; recordId?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<SalesFormSchema>({
    resolver: zodResolver(salesFormSchema) as Resolver<SalesFormSchema>,
    defaultValues: initialData ?? {
      date: new Date().toISOString().split("T")[0],
      bagelsBaked: 0,
      bagelsLeft: 0,
      storeSales: 0,
      uberSales: 0,
      doordashSales: 0,
      otherSales: 0,
      notes: "",
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
      if (res.status === 409 && !recordId) {
        const err = await res.json();
        if (err.existingId) {
          router.push(`/sales/${err.existingId}/edit`);
          return;
        }
        throw new Error(err.message || "Save failed");
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Save failed");
      }
      setStatus("success");
      setTimeout(() => router.push(recordId ? `/sales/${recordId}` : "/sales"), 800);
    } catch (e) {
      setStatus("error");
      setErrorMessage(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {status === "success" && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">Saved.</div>}
      {status === "error" && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{errorMessage}</div>}

      <Section title="Sales Record">
        <Field label="Date *" error={errors.date?.message}><input type="date" {...register("date")} className={inputClass(!!errors.date)} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Bagels Baked *" error={errors.bagelsBaked?.message}><input type="number" min="0" {...register("bagelsBaked")} onFocus={(e) => e.target.select()} className={inputClass(!!errors.bagelsBaked)} /></Field>
          <Field label="Bagels Left *" error={errors.bagelsLeft?.message}><input type="number" min="0" {...register("bagelsLeft")} onFocus={(e) => e.target.select()} className={inputClass(!!errors.bagelsLeft)} /></Field>
        </div>
      </Section>

      <Section title="Sales (NZD)">
        <Field label="Store Sales *" error={errors.storeSales?.message}><input type="number" step="0.01" min="0" {...register("storeSales")} onFocus={(e) => e.target.select()} className={inputClass(!!errors.storeSales)} /></Field>
        <Field label="Uber Sales *" error={errors.uberSales?.message}><input type="number" step="0.01" min="0" {...register("uberSales")} onFocus={(e) => e.target.select()} className={inputClass(!!errors.uberSales)} /></Field>
        <Field label="DoorDash Sales *" error={errors.doordashSales?.message}><input type="number" step="0.01" min="0" {...register("doordashSales")} onFocus={(e) => e.target.select()} className={inputClass(!!errors.doordashSales)} /></Field>
        <Field label="Other Sales *" error={errors.otherSales?.message}><input type="number" step="0.01" min="0" {...register("otherSales")} onFocus={(e) => e.target.select()} className={inputClass(!!errors.otherSales)} /></Field>
      </Section>

      <Section title="Notes">
        <Field label="Notes" error={errors.notes?.message}><textarea rows={3} {...register("notes")} className={inputClass(false)} /></Field>
      </Section>

      <div className="flex gap-3">
        <button type="submit" disabled={status === "loading" || status === "success"} className="px-6 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 font-medium disabled:opacity-50">{status === "loading" ? "Saving..." : "Save"}</button>
        <button type="button" onClick={() => router.back()} className="px-6 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 font-medium">Cancel</button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4"><h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">{title}</h2>{children}</div>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>{children}{error && <p className="mt-1 text-xs text-red-600">{error}</p>}</div>;
}

function inputClass(hasError: boolean) {
  return `w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 ${hasError ? "border-red-300 bg-red-50" : "border-gray-300"}`;
}
