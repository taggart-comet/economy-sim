import assert from "node:assert/strict";
import { DEFAULT_CONFIG, DEFAULT_SCENARIO } from "../domain/config";
import { simulate } from "../domain/simulation";
import type { CityConfig } from "../domain/types";

const zero = DEFAULT_SCENARIO.map(p => ({ ...p, white: 0, blue: 0 }));
const baseline = simulate(structuredClone(DEFAULT_CONFIG), zero);
console.table(baseline.years.map((year, i) => {
  const prior = i ? baseline.years[i - 1] : baseline.initial;
  const hires = year.hires.white + year.hires.blue;
  assert.equal(year.unemployed, prior.unemployed + year.workforceEntrants - year.unemployedExits +
    year.layoffs.white + year.layoffs.blue + year.demandLayoffs - hires);
  return {
    year: year.year,
    unemployment: `${(year.unemploymentRate * 100).toFixed(2)}%`,
    entrants: year.workforceEntrants,
    employedRetirements: year.employedExits,
    unemployedRetirements: year.unemployedExits,
    hires,
    demandLayoffs: year.demandLayoffs,
    vacancies: year.vacancies,
    openingsBeforeHiring: hires + year.vacancies,
    unfilledShare: `${(100 * year.vacancies / Math.max(1, hires + year.vacancies)).toFixed(2)}%`,
    pensionOutlayBillions: +(year.pensionCost / 1e9).toFixed(3),
    pensionContributionsBillions: +(year.pensionContributions / 1e9).toFixed(3),
  };
}));

const alternatives: [string, Partial<CityConfig["policy"]>][] = [
  ["No matching", { matchingRate: 0 }],
  ["Full matching", { matchingRate: 1 }],
  ["Fixed real wages", { productivityWageShare: 0 }],
  ["No pension system", { pensionReplacementRate: 0, pensionContributionRate: 0 }],
  ["No savings drawdown", { savingsDrawdownRate: 0 }],
];
const comparisons = alternatives.map(([name, changes]) => {
  const config = structuredClone(DEFAULT_CONFIG);
  Object.assign(config.policy, changes);
  return { name, result: simulate(config, zero) };
});
comparisons.unshift({ name: "Default baseline", result: baseline });
comparisons.push({ name: "Default automation shock", result: simulate(structuredClone(DEFAULT_CONFIG), DEFAULT_SCENARIO) });
comparisons.push({ name: "10% automation in both roles", result: simulate(structuredClone(DEFAULT_CONFIG), zero.map(p => ({ ...p, white: 0.1, blue: 0.1 }))) });
for (const openingHistoryYears of [0, 1, 5])
  comparisons.push({ name: `${openingHistoryYears} opening accounting years`, result: simulate({ ...structuredClone(DEFAULT_CONFIG), openingHistoryYears }, zero) });
console.table(comparisons.map(({ name, result }) => ({
  scenario: name,
  openingIdleBillions: +(result.initial.idleCapital / 1e9).toFixed(3),
  initialInvestmentBillions: +(result.initial.investment / 1e9).toFixed(3),
  firstYearDividendsBillions: +(result.years[0].dividends / 1e9).toFixed(3),
  unemploymentByYear: result.years.map(y => `${(y.unemploymentRate * 100).toFixed(2)}%`).join(" → "),
  finalGDPBillions: +(result.years.at(-1)!.gdp / 1e9).toFixed(3),
  closures: result.years.at(-1)!.closedCompanies,
})));
