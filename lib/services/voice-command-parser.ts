// ─── Voice Command Parser ─────────────────────────────────────────────────────
// Parses Korean and English voice commands for bagel availability control.
//
// Supported formats:
//   English: "sesame off", "plain on", "turn sesame off", "enable blueberry"
//   Korean:  "세사미 꺼", "세사미 베이글 꺼", "플레인 꺼", "블루베리 다시 켜"

import { prisma } from "@/lib/db";

export interface ParsedVoiceCommand {
  bagelTypeId: string;
  bagelCode: string;
  bagelName: string;
  isAvailable: boolean;
  preview: string;
}

// Static alias map: alias -> bagelCode
const BAGEL_ALIASES: Record<string, string> = {
  // English
  plain: "plain",
  "plain bagel": "plain",
  sesame: "sesame",
  "sesame bagel": "sesame",
  everything: "everything",
  "everything bagel": "everything",
  blueberry: "blueberry",
  "blueberry bagel": "blueberry",
  // Korean
  플레인: "plain",
  "플레인 베이글": "plain",
  세사미: "sesame",
  "세사미 베이글": "sesame",
  에브리띵: "everything",
  "에브리띵 베이글": "everything",
  블루베리: "blueberry",
  "블루베리 베이글": "blueberry",
};

// ON actions (sorted longest first to match greedily)
const ON_TOKENS = ["enable", "turn on", "다시 켜", "켜줘", "활성화", "켜"];
// OFF actions
const OFF_TOKENS = ["disable", "turn off", "꺼줘", "비활성화", "꺼"];

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function extractAction(text: string): { action: "on" | "off"; remainder: string } | null {
  for (const token of ON_TOKENS) {
    if (text.includes(token)) {
      return { action: "on", remainder: text.replace(token, "").trim() };
    }
  }
  for (const token of OFF_TOKENS) {
    if (text.includes(token)) {
      return { action: "off", remainder: text.replace(token, "").trim() };
    }
  }
  return null;
}

function extractBagelCode(text: string): string | null {
  // Try longest alias match first
  const sorted = Object.keys(BAGEL_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of sorted) {
    if (text.includes(alias)) {
      return BAGEL_ALIASES[alias];
    }
  }
  return null;
}

// Cache bagel type IDs (expires after 60 seconds)
let _bagelTypeCache: Map<string, { id: string; name: string }> | null = null;
let _bagelTypeCacheTimer: ReturnType<typeof setTimeout> | null = null;

async function getBagelTypeByCode(code: string): Promise<{ id: string; name: string } | null> {
  if (!_bagelTypeCache) {
    const types = await prisma.bagelType.findMany({ where: { isActive: true } });
    _bagelTypeCache = new Map(types.map((t) => [t.code, { id: t.id, name: t.name }]));
    if (_bagelTypeCacheTimer) clearTimeout(_bagelTypeCacheTimer);
    _bagelTypeCacheTimer = setTimeout(() => {
      _bagelTypeCache = null;
      _bagelTypeCacheTimer = null;
    }, 60_000);
  }
  return _bagelTypeCache.get(code) ?? null;
}

export async function parseVoiceCommandAsync(text: string): Promise<ParsedVoiceCommand | null> {
  const normalized = normalize(text);
  const actionResult = extractAction(normalized);
  if (!actionResult) return null;

  const bagelCode =
    extractBagelCode(actionResult.remainder) ?? extractBagelCode(normalized);
  if (!bagelCode) return null;

  const bagelType = await getBagelTypeByCode(bagelCode);
  if (!bagelType) return null;

  const isAvailable = actionResult.action === "on";
  const stateLabel = isAvailable ? "ON" : "OFF";

  return {
    bagelTypeId: bagelType.id,
    bagelCode,
    bagelName: bagelType.name,
    isAvailable,
    preview: `Turn ${bagelType.name} ${stateLabel}?`,
  };
}
