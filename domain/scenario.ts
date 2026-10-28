import type { YearPolicy } from "./types";

export const SCENARIO_DURATIONS = [5, 7, 10] as const;

export type LayoffPreset = "normal" | "ai-projection";

// A gradual adoption wave: office displacement rises first; robotics follows.
// Whole percentages are deliberate scenario assumptions, not measured layoff rates.
const NORMAL_WHITE = [1, 1, 2, 2, 3, 3, 3, 2, 2, 2];
const NORMAL_BLUE = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2];
const AI_PROJECTION = [5, 7, 9, 10, 12, 15, 15, 15, 15, 15];

/** Illustrative annual automation assumptions, not predictions of unemployment. */
export function createLayoffPreset(preset: LayoffPreset, startYear: number, years: number): YearPolicy[] {
  return Array.from({ length: years }, (_, i) => {
    return {
      year: startYear + i,
      white: preset === "normal" ? NORMAL_WHITE[i] / 100 : AI_PROJECTION[i] / 100,
      blue: preset === "normal" ? NORMAL_BLUE[i] / 100 : (AI_PROJECTION[i] - 2) / 100,
    };
  });
}

/** Retain policies within the horizon and initialize additional years without layoffs. */
export function resizeScenario(
  scenario: YearPolicy[],
  startYear: number,
  years: number,
): YearPolicy[] {
  return Array.from({ length: years }, (_, i) => {
    const year = startYear + i;
    const existing = scenario.find((policy) => policy.year === year);
    return existing ? { ...existing } : { year, white: 0, blue: 0 };
  });
}
