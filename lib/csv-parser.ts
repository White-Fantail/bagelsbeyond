// ─── CSV Parser for Internal Sales Data ───────────────────────────────────────
// Supports CSV format only. No XLSX or other formats.

export type ParsedCsvRow = {
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
  status: "valid" | "invalid";
  validationErrors: string[];
};

// ─── Column Name Aliases ───────────────────────────────────────────────────────

const COLUMN_ALIASES: Record<string, string> = {
  date: "date",
  bagelsbaked: "bagelsBaked",
  bagels_baked: "bagelsBaked",
  bagelsleft: "bagelsLeft",
  bagels_left: "bagelsLeft",
  storesales: "storeSales",
  store_sales: "storeSales",
  store: "storeSales",
  ubersales: "uberSales",
  uber_sales: "uberSales",
  uber: "uberSales",
  doordashsales: "doordashSales",
  doorDashSales: "doordashSales",
  doordash_sales: "doordashSales",
  doordash: "doordashSales",
  othersales: "otherSales",
  other_sales: "otherSales",
  other: "otherSales",
  notes: "notes",
  note: "notes",
};

function normaliseHeader(raw: string): string {
  return COLUMN_ALIASES[raw.trim().toLowerCase()] ?? COLUMN_ALIASES[raw.trim()] ?? raw.trim();
}

// ─── CSV Line Parser ───────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── Safe Parsers ──────────────────────────────────────────────────────────────

function safeParseDate(raw: string | undefined): Date | null {
  if (!raw || raw.trim() === "") return null;
  const cleaned = raw.trim().replace(/\//g, "-");

  // Try YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleaned)) {
    const [y, m, d] = cleaned.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (!isNaN(dt.getTime())) return dt;
  }

  // Try DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(cleaned)) {
    const [d, m, y] = cleaned.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (!isNaN(dt.getTime())) return dt;
  }

  // Try MM/DD/YYYY style (already replaced / with -)
  const dt = new Date(cleaned);
  if (!isNaN(dt.getTime())) return dt;

  return null;
}

function safeParseInt(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") return null;
  const n = parseInt(raw.trim(), 10);
  return isNaN(n) ? null : n;
}

function safeParseFloat(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") return null;
  // Remove currency symbols and commas
  const cleaned = raw.trim().replace(/[$,NZ]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

// ─── Row Validator ─────────────────────────────────────────────────────────────

export function validateParsedRow(row: ParsedCsvRow): string[] {
  const errors: string[] = [];

  if (!row.parsedDate) {
    errors.push("날짜 필드가 없거나 파싱에 실패했습니다");
  }

  if (row.parsedBagelsBaked !== null && row.parsedBagelsBaked !== undefined && row.parsedBagelsBaked < 0) {
    errors.push("구운 베이글 수량은 0 이상이어야 합니다");
  }

  const salesFields = [
    { key: "storeSales", label: "매장 매출", value: row.parsedStoreSales },
    { key: "uberSales", label: "우버 매출", value: row.parsedUberSales },
    { key: "doordashSales", label: "도어대쉬 매출", value: row.parsedDoordashSales },
    { key: "otherSales", label: "기타 매출", value: row.parsedOtherSales },
  ];

  for (const f of salesFields) {
    if (f.value !== null && f.value !== undefined && f.value < 0) {
      errors.push(`${f.label}는 0 이상이어야 합니다`);
    }
  }

  return errors;
}

// ─── Main Parser ───────────────────────────────────────────────────────────────

export function parseCsvContent(csvText: string): ParsedCsvRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normaliseHeader);
  const rows: ParsedCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h] = values[idx] ?? "";
    });

    const rowNumber = i;
    const parsedDate = safeParseDate(raw["date"]);
    const parsedBagelsBaked = safeParseInt(raw["bagelsBaked"]);
    let parsedBagelsLeft = safeParseInt(raw["bagelsLeft"]);
    const parsedStoreSales = safeParseFloat(raw["storeSales"]);
    const parsedUberSales = safeParseFloat(raw["uberSales"]);
    const parsedDoordashSales = safeParseFloat(raw["doordashSales"]);
    const parsedOtherSales = safeParseFloat(raw["otherSales"]);
    let parsedNotes = raw["notes"] || null;

    // 남은 베이글 수량이 음수인 경우(전날 재고 사용 등) 0으로 보정하고 메모에 기록
    if (parsedBagelsLeft !== null && parsedBagelsLeft < 0) {
      const originalValue = parsedBagelsLeft;
      parsedBagelsLeft = 0;
      const adjustmentNote = `남은 베이글 수량이 음수(${originalValue})로 기록되어 0으로 처리됨`;
      parsedNotes = parsedNotes ? `${parsedNotes} / ${adjustmentNote}` : adjustmentNote;
    }

    const row: ParsedCsvRow = {
      rowNumber,
      rawJson: JSON.stringify(raw),
      parsedDate,
      parsedBagelsBaked,
      parsedBagelsLeft,
      parsedStoreSales,
      parsedUberSales,
      parsedDoordashSales,
      parsedOtherSales,
      parsedNotes,
      status: "pending" as "valid" | "invalid",
      validationErrors: [],
    };

    row.validationErrors = validateParsedRow(row);
    row.status = row.validationErrors.length === 0 ? "valid" : "invalid";

    rows.push(row);
  }

  return rows;
}

// ─── Template CSV Generator ────────────────────────────────────────────────────

export function generateCsvTemplate(): string {
  const headers = [
    "date",
    "bagelsBaked",
    "bagelsLeft",
    "storeSales",
    "uberSales",
    "doordashSales",
    "otherSales",
    "notes",
  ];

  const example1 = ["2024-01-15", "80", "5", "250.00", "80.00", "50.00", "10.00", "평일 보통"];
  const example2 = ["2024-01-20", "100", "3", "320.00", "110.00", "70.00", "15.00", "토요일 많음"];

  return [headers.join(","), example1.join(","), example2.join(",")].join("\n");
}
