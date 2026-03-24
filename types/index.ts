export type DailyRecord = {
  id: string;
  date: Date;
  bagelsBaked: number;
  bagelsLeft: number;
  storeSales: number;
  uberSales: number;
  doordashSales: number;
  otherSales: number;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  externalFactor?: DailyExternalFactor | null;
};

export type DailyExternalFactor = {
  id: string;
  dailyRecordId: string;
  weatherSummary?: string | null;
  minTemp?: number | null;
  maxTemp?: number | null;
  rainMm?: number | null;
  windKph?: number | null;
  holidayName?: string | null;
  localEventName?: string | null;
  schoolHoliday: boolean;
  nzNewsSummary?: string | null;
  worldNewsSummary?: string | null;
};

export type PredictionWeight = {
  id: string;
  factorKey: string;
  weightValue: number;
  isActive: boolean;
  description?: string | null;
};

export type AppSetting = {
  id: string;
  shopName: string;
  defaultTargetWasteRatio: number;
  defaultSafetyBuffer: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SalesFormData = {
  date: string;
  bagelsBaked: number;
  bagelsLeft: number;
  storeSales: number;
  uberSales: number;
  doordashSales: number;
  otherSales: number;
  notes?: string;
  weatherSummary?: string;
  minTemp?: number;
  maxTemp?: number;
  rainMm?: number;
  windKph?: number;
  holidayName?: string;
  localEventName?: string;
  schoolHoliday?: boolean;
  nzNewsSummary?: string;
  worldNewsSummary?: string;
};
