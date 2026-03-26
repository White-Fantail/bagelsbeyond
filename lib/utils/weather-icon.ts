/**
 * Weather icon utility
 *
 * Maps weatherSummary strings (from DailyExternalFactor) to emoji icons.
 * Supports Korean and English weather descriptions from Open-Meteo WMO codes.
 *
 * Mapping rules:
 * - 맑음 / sunny / clear → ☀️
 * - 구름 / cloudy / overcast → ☁️
 * - 비 / rain / shower / drizzle → 🌧️
 * - 눈 / snow → ❄️
 * - 바람 / windy → 💨
 * - 안개 / fog → 🌫️
 * - 뇌우 / thunderstorm → ⛈️
 * - 정보 없음 → null (표시 안 함)
 */

export type WeatherIconInfo = {
  icon: string;
  label: string;
};

const WEATHER_RULES: Array<{ patterns: RegExp; icon: string; label: string }> = [
  {
    patterns: /뇌우|thunderstorm|storm/i,
    icon: "⛈️",
    label: "뇌우",
  },
  {
    patterns: /눈|snow|blizzard/i,
    icon: "❄️",
    label: "눈",
  },
  {
    patterns: /비|rain|shower|drizzle|소나기|이슬비/i,
    icon: "🌧️",
    label: "비",
  },
  {
    patterns: /안개|fog|mist/i,
    icon: "🌫️",
    label: "안개",
  },
  {
    patterns: /바람|windy|강풍/i,
    icon: "💨",
    label: "바람",
  },
  {
    patterns: /흐림|overcast|cloudy|구름많음|대체로흐림|mostly cloudy/i,
    icon: "☁️",
    label: "흐림",
  },
  {
    patterns: /구름조금|partly cloudy|약간흐림|few clouds/i,
    icon: "⛅",
    label: "구름 조금",
  },
  {
    patterns: /맑음|sunny|clear|화창/i,
    icon: "☀️",
    label: "맑음",
  },
];

/**
 * Returns a weather icon emoji and label for the given weatherSummary string.
 * Returns null if no match is found (no icon will be displayed).
 */
export function getWeatherIcon(weatherSummary?: string | null): WeatherIconInfo | null {
  if (!weatherSummary || weatherSummary.trim() === "") return null;

  for (const rule of WEATHER_RULES) {
    if (rule.patterns.test(weatherSummary)) {
      return { icon: rule.icon, label: rule.label };
    }
  }

  return null;
}
