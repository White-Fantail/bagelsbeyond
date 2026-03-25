import { z } from "zod";

export const salesFormSchema = z.object({
  date: z.string().min(1, "날짜를 입력해주세요"),
  bagelsBaked: z.coerce.number().int().min(0, "0 이상의 정수를 입력해주세요"),
  bagelsLeft: z.coerce.number().int().min(0, "0 이상의 정수를 입력해주세요"),
  storeSales: z.coerce.number().min(0, "0 이상의 값을 입력해주세요"),
  uberSales: z.coerce.number().min(0, "0 이상의 값을 입력해주세요"),
  doordashSales: z.coerce.number().min(0, "0 이상의 값을 입력해주세요"),
  otherSales: z.coerce.number().min(0, "0 이상의 값을 입력해주세요"),
  notes: z.string().optional(),
  weatherSummary: z.string().optional(),
  minTemp: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().optional()),
  maxTemp: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().optional()),
  rainMm: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().min(0).optional()),
  windKph: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().min(0).optional()),
  holidayName: z.string().optional(),
  localEventName: z.string().optional(),
  schoolHoliday: z.boolean().optional(),
  nzNewsSummary: z.string().optional(),
  worldNewsSummary: z.string().optional(),
// Business rule: leftover bagels cannot exceed total baked bagels
}).refine((data) => data.bagelsLeft <= data.bagelsBaked, {
  message: "남은 베이글 수는 구운 베이글 수보다 클 수 없습니다",
  path: ["bagelsLeft"],
});

export type SalesFormSchema = z.infer<typeof salesFormSchema>;

export const settingsSchema = z.object({
  shopName: z.string().min(1, "상점 이름을 입력해주세요"),
  defaultTargetWasteRatio: z.coerce.number().min(0).max(1, "0~1 사이의 값을 입력해주세요"),
  defaultSafetyBuffer: z.coerce.number().min(1, "1 이상의 값을 입력해주세요"),
  defaultRegion: z.string().optional(),
  defaultCity: z.string().optional(),
  defaultCountry: z.string().optional(),
  defaultEventRegion: z.string().optional(),
  autoCollectExternalData: z.boolean().optional(),
});

export type SettingsSchema = z.infer<typeof settingsSchema>;

export const weightSchema = z.object({
  factorKey: z.string().min(1, "키를 입력해주세요"),
  weightValue: z.coerce.number(),
  isActive: z.boolean().default(true),
  description: z.string().optional(),
});
export type WeightSchema = z.infer<typeof weightSchema>;
