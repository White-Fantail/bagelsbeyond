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

export type SalesPrediction = {
  id: string;
  targetDate: Date;
  predictedSales: number;
  predictedBagelsSold: number;
  recommendedBagelsToBake: number;
  predictedLeftovers: number;
  confidenceScore?: number | null;
  method: string;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  factorSnapshots?: PredictionFactorSnapshot[];
};

export type PredictionFactorSnapshot = {
  id: string;
  salesPredictionId: string;
  factorKey: string;
  factorLabel: string;
  factorValue: string;
  appliedWeight: number;
  impactScore: number;
  createdAt: Date;
};

export type ImportJob = {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
  rows?: ImportRow[];
};

export type ImportRow = {
  id: string;
  jobId: string;
  rowNumber: number;
  rawJson: string;
  parsedDate?: Date | null;
  parsedBagelsBaked?: number | null;
  parsedBagelsLeft?: number | null;
  parsedStoreSales?: number | null;
  parsedUberSales?: number | null;
  parsedDoordashSales?: number | null;
  parsedOtherSales?: number | null;
  parsedNotes?: string | null;
  status: string;
  validationErrors?: string | null;
  linkedDailyRecordId?: string | null;
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
