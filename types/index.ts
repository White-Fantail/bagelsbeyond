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
  date: Date;
  dailyRecordId?: string | null;
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
  sourceWeather?: string | null;
  sourceHoliday?: string | null;
  sourceEvents?: string | null;
  sourceNews?: string | null;
  collectedAt?: Date | null;
  lastRefreshedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
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
  defaultRegion: string;
  defaultCity: string;
  defaultCountry: string;
  defaultEventRegion: string;
  autoCollectExternalData: boolean;
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
  // Extended fields
  projectedWasteRate?: number | null;
  projectedSellThroughRate?: number | null;
  baselineSales?: number | null;
  baselineBagelsSold?: number | null;
  adjustmentSummary?: string | null;
  explanationJson?: string | null;
  createdAt: Date;
  updatedAt: Date;
  factorSnapshots?: PredictionFactorSnapshot[];
};

export type PredictionExplanationItem = {
  type: "baseline" | "weekday" | "weather" | "holiday" | "event" | "school" | "news" | "production" | "info";
  text: string;
};

export type PredictionExplanation = {
  items: PredictionExplanationItem[];
  summary: string;
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

// ─── Scheduled Task & TaskLog ─────────────────────────────────────────────────

export type TaskStatus = "pending" | "running" | "success" | "partial" | "failed" | "skipped";
export type TaskType = "collect_external_factors" | "generate_prediction";
export type TaskLogLevel = "info" | "warning" | "error";

export type ScheduledTask = {
  id: string;
  taskType: TaskType;
  targetDate?: Date | null;
  status: TaskStatus;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  errorMessage?: string | null;
  resultSummary?: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  logs?: TaskLog[];
};

export type TaskLog = {
  id: string;
  scheduledTaskId: string;
  message: string;
  level: TaskLogLevel;
  createdAt: Date;
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
