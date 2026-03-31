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
    predictionLookbackDays?: number;
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
        throw new Error(err.message || "Save failed");
      }
      setStatus("success");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (e) {
      setStatus("error");
      setErrorMessage(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {status === "success" && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          ✅ Settings saved..
        </div>
      )}
      {status === "error" && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          ❌ {errorMessage}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">Store Info</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
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
            Default Waste Allowance (0~1)
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
          <p className="mt-1 text-xs text-gray-400">e.g. 0.05 = 5% waste allowance</p>
          {errors.defaultTargetWasteRatio && (
            <p className="mt-1 text-xs text-red-600">{errors.defaultTargetWasteRatio.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Production Buffer</label>
          <input
            type="number"
            step="0.01"
            min="1"
            {...register("defaultSafetyBuffer")}
            className={`w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              errors.defaultSafetyBuffer ? "border-red-300 bg-red-50" : "border-gray-300"
            }`}
          />
          <p className="mt-1 text-xs text-gray-400">e.g. 1.1 = produce 10% more than predicted qty</p>
          {errors.defaultSafetyBuffer && (
            <p className="mt-1 text-xs text-red-600">{errors.defaultSafetyBuffer.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prediction Data Lookback Period (days)</label>
          <input
            type="number"
            step="1"
            min="1"
            {...register("predictionLookbackDays")}
            className={`w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              errors.predictionLookbackDays ? "border-red-300 bg-red-50" : "border-gray-300"
            }`}
          />
          <p className="mt-1 text-xs text-gray-400">Only sales records within this many days are used for predictions and weight optimization (e.g. 365 = last 1 year)</p>
          {errors.predictionLookbackDays && (
            <p className="mt-1 text-xs text-red-600">{errors.predictionLookbackDays.message}</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">Local Settings (for External Data Collection)</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Local (Region)</label>
            <input
              type="text"
              {...register("defaultRegion")}
              placeholder="Canterbury"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="mt-1 text-xs text-gray-400">e.g. Canterbury, Auckland</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default City</label>
            <input
              type="text"
              {...register("defaultCity")}
              placeholder="Christchurch"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country Code</label>
            <input
              type="text"
              {...register("defaultCountry")}
              placeholder="NZ"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="mt-1 text-xs text-gray-400">Used for Holiday lookup (e.g. NZ, AU)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Search Local</label>
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
            <span className="text-sm font-medium text-gray-700">Automatic External Data Collection on Predictions/Sales Create</span>
          </label>
          <p className="mt-1 text-xs text-gray-400 ml-5">When activated, External Data is automatically collected on new Sales/Predictions.</p>
        </div>
      </div>

      <button
        type="submit"
        disabled={status === "loading"}
        className="px-6 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors font-medium disabled:opacity-50"
      >
        {status === "loading" ? "Saving......" : "Save"}
      </button>
    </form>
  );
}
