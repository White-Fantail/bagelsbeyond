/**
 * Weather icon utility
 *
 * Maps weatherSummary strings (from DailyExternalFactor) to emoji icons.
 * Supports Korean and English weather descriptions from Open-Meteo WMO codes.
 *
 * Mapping rules:
 * - sunny / clear → ☀️
 * - cloud / cloudy / overcast → ☁️
 * - rain / shower / drizzle → 🌧️
 * - snow → ❄️
 * - Wind / windy → 💨
 * - fog → 🌫️
 * - thunderstorm → ⛈️
 * - no info → null (not displayed)
 */

export type WeatherIconInfo = {
  icon: string;
  label: string;
};

const WEATHER_RULES: Array<{ patterns: RegExp; icon: string; label: string }> = [
  {
    patterns: /thunderstorm|storm/i,
    icon: "⛈️",
    label: "Thunderstorm",
  },
  {
    patterns: /snow|blizzard/i,
    icon: "❄️",
    label: "Snow",
  },
  {
    patterns: /rain|shower|drizzle/i,
    icon: "🌧️",
    label: "Rain",
  },
  {
    patterns: /fog|mist/i,
    icon: "🌫️",
    label: "Foggy",
  },
  {
    patterns: /Wind|windy/i,
    icon: "💨",
    label: "Wind",
  },
  {
    patterns: /overcast|cloudy|mostly cloudy/i,
    icon: "☁️",
    label: "Cloudy",
  },
  {
    patterns: /partly cloudy|slightlyCloudy|few clouds/i,
    icon: "⛅",
    label: "Partly Cloudy",
  },
  {
    patterns: /sunny|clear/i,
    icon: "☀️",
    label: "Clear",
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
