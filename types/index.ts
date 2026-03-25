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

export type OcrImportJob = {
  id: string;
  sourceFileName: string;
  sourceFileUrl?: string | null;
  status: string;
  rawText?: string | null;
  parsedJson?: string | null;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
  items?: OcrImportItem[];
};

export type OcrImportItem = {
  id: string;
  jobId: string;
  detectedDate?: Date | null;
  extractedBagelsBaked?: number | null;
  extractedBagelsLeft?: number | null;
  extractedStoreSales?: number | null;
  extractedUberSales?: number | null;
  extractedDoordashSales?: number | null;
  extractedOtherSales?: number | null;
  extractedNotes?: string | null;
  confidenceScore?: number | null;
  reviewStatus: string;
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
