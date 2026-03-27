"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  targetDate: z.string().min(1, "Please select a date"),
  weatherSummary: z.string().optional(),
  minTemp: z.string().optional(),
  maxTemp: z.string().optional(),
  rainMm: z.string().optional(),
  windKph: z.string().optional(),
  holidayName: z.string().optional(),
  localEventName: z.string().optional(),
  schoolHoliday: z.boolean().optional(),
  nzNewsSummary: z.string().optional(),
  worldNewsSummary: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewPredictionPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      targetDate: (() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split("T")[0];
      })(),
      schoolHoliday: false,
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const toNum = (v: string | undefined) => (v === "" || v === undefined ? null : parseFloat(v));

      // Check if any external factors were manually entered
      const hasManualFactors = !!(
        data.weatherSummary || data.minTemp || data.maxTemp ||
        data.rainMm || data.windKph || data.holidayName ||
        data.localEventName || data.nzNewsSummary || data.worldNewsSummary
      );

      const externalFactors = hasManualFactors ? {
        weatherSummary: data.weatherSummary || null,
        minTemp: toNum(data.minTemp),
        maxTemp: toNum(data.maxTemp),
        rainMm: toNum(data.rainMm),
        windKph: toNum(data.windKph),
        holidayName: data.holidayName || null,
        localEventName: data.localEventName || null,
        schoolHoliday: data.schoolHoliday ?? false,
        nzNewsSummary: data.nzNewsSummary || null,
        worldNewsSummary: data.worldNewsSummary || null,
      } : undefined;

      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetDate: data.targetDate,
          autoCollect: true, // Always try auto-collect for missing external data
          externalFactors,
        }),
      });

      if (!res.ok) {
        const json = await res.json() as { message?: string };
        throw new Error(json.message ?? "Failed to create prediction");
      }

      const saved = await res.json() as { id: string };
      router.push(`/predictions/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create New Prediction</h1>
        <p className="text-gray-500 mt-1">External factors will be automatically collected when you enter a date. You can also enter them manually if needed.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Date */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Predictions Date</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input
              type="date"
              {...register("targetDate")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.targetDate && (
              <p className="text-red-500 text-xs mt-1">{errors.targetDate.message}</p>
            )}
          </div>
        </div>

        {/* External Factors */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">External Factors (Select)</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Weather Summary</label>
              <input
                type="text"
                {...register("weatherSummary")}
                placeholder="e.g. Clear, Cloudy, Rain"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Temp (°C)</label>
              <input
                type="number"
                step="0.1"
                {...register("minTemp")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Temp (°C)</label>
              <input
                type="number"
                step="0.1"
                {...register("maxTemp")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rainfall (mm)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                {...register("rainMm")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wind Speed (kph)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                {...register("windKph")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Holiday Name</label>
              <input
                type="text"
                {...register("holidayName")}
                placeholder="e.g. Christmas"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Local Event</label>
              <input
                type="text"
                {...register("localEventName")}
                placeholder="e.g. Local Market"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register("schoolHoliday")}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">School Holiday</span>
              </label>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">NZ News Summary</label>
              <textarea
                {...register("nzNewsSummary")}
                rows={2}
                placeholder="Main NZ news..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">World News Summary</label>
              <textarea
                {...register("worldNewsSummary")}
                rows={2}
                placeholder="Main world news..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
          >
            {isSubmitting ? "Predictions Running..." : "🔮 Run Predictions"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
