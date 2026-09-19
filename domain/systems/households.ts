import type {
  Category,
  CityConfig,
  CitizenPopulation,
  Role,
  Spending,
} from "../types";
import { SHAREHOLDER_SPENDING_CAP } from "./ownership";
export const CATEGORIES: Category[] = [
  "food",
  "restaurants",
  "housing",
  "transport",
  "health",
  "entertainment",
  "clothes",
  "other",
];
export const emptySpending = (): Spending => ({
  food: 0,
  restaurants: 0,
  housing: 0,
  transport: 0,
  health: 0,
  entertainment: 0,
  clothes: 0,
  other: 0,
});
/** Budgets cover an earner and their share of dependents, never another full household per child. */
export function consumptionProfile(
  config: CityConfig,
  role: Role,
  salary: number,
  unemployed = false,
): Spending {
  const weights = unemployed
    ? config.household.unemployed
    : config.household.employed;
  const denominator = Object.values(weights).reduce((a, b) => a + b, 0);
  const budget = unemployed
    ? config.policy.annualBenefit
    : salary *
      (1 - config.policy.incomeTax) *
      config.household.propensity[role];
  return Object.fromEntries(
    CATEGORIES.map((k) => [k, (budget * weights[k]) / denominator]),
  ) as Spending;
}
export function householdAccounts(config: CityConfig, p: CitizenPopulation) {
  const spending = emptySpending();
  const budgets = new Float64Array(p.laborForce);
  const incomes = new Float64Array(p.laborForce);
  const totals = [0, 0, 0]; // employed, unemployed, shareholder
  const profiles = [config.household.employed, config.household.unemployed, {
    ...config.household.employed,
    restaurants: config.household.employed.restaurants * 2,
    entertainment: config.household.employed.entertainment * 2,
    other: config.household.employed.other * 2,
  }].map((weights) => {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    return Object.fromEntries(CATEGORIES.map((k) => [k, weights[k] / sum])) as Spending;
  });
  let wageIncome = 0, unemployed = 0, disposableIncome = 0, liquidWealth = 0;
  for (let i = 0; i < p.laborForce; i++) {
    const outOfWork = p.employer[i] < 0;
    const owner = p.ownerCompany[i] >= 0;
    const role = p.role[i] === 1 ? "white" : "blue";
    if (outOfWork) unemployed++;
    wageIncome += p.salary[i];
    const netWage = p.salary[i] * (1 - config.policy.incomeTax);
    const income = netWage + p.dividends[i] + (outOfWork ? config.policy.annualBenefit : 0);
    const budget = owner
      ? Math.min(SHAREHOLDER_SPENDING_CAP, income + p.wealth[i],
          netWage * config.household.propensity[role] + p.dividends[i] * 0.9 + p.wealth[i] * 0.04)
      : outOfWork ? config.policy.annualBenefit : netWage * config.household.propensity[role];
    budgets[i] = budget;
    incomes[i] = income;
    totals[owner ? 2 : outOfWork ? 1 : 0] += budget;
    disposableIncome += income;
    liquidWealth += p.wealth[i];
  }
  for (const k of CATEGORIES)
    spending[k] = totals.reduce((sum, budget, i) => sum + budget * profiles[i][k], 0);
  return { spending, wageIncome, unemployed, budgets, incomes, profiles, totals,
    disposableIncome, liquidWealth, benefits: unemployed * config.policy.annualBenefit };
}

/** Realized purchases debit households once; undelivered demand stays in cash. */
export function settleHouseholds(p: CitizenPopulation, h: ReturnType<typeof householdAccounts>, realized: Spending) {
  const fulfillment = h.profiles.map((profile) => CATEGORIES.reduce((sum, k) =>
    sum + profile[k] * (h.spending[k] > 0 ? realized[k] / h.spending[k] : 1), 0));
  let shareholderConsumption = 0;
  for (let i = 0; i < p.laborForce; i++) {
    const owner = p.ownerCompany[i] >= 0;
    const spent = h.budgets[i] * fulfillment[owner ? 2 : p.employer[i] < 0 ? 1 : 0];
    p.wealth[i] = Math.max(0, p.wealth[i] + h.incomes[i] - spent);
    if (owner) shareholderConsumption += spent;
  }
  return shareholderConsumption;
}
