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
};
