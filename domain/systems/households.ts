import type {
  Category,
  CityConfig,
  CitizenPopulation,
  Role,
  Spending,
} from "../types";
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
  let wageIncome = 0,
    unemployed = 0;
  const budgets = { white: 0, blue: 0 };
  for (let i = 0; i < p.laborForce; i++) {
    if (p.employer[i] < 0) {
      unemployed++;
      continue;
    }
    const role = p.role[i] === 1 ? "white" : "blue";
    wageIncome += p.salary[i];
    budgets[role] += p.salary[i];
  }
  for (const role of ["white", "blue"] as const) {
    const profile = consumptionProfile(config, role, budgets[role]);
    for (const k of CATEGORIES) spending[k] += profile[k];
  }
  const benefitProfile = consumptionProfile(config, "white", 0, true);
  for (const k of CATEGORIES) spending[k] += benefitProfile[k] * unemployed;
  return {
    spending,
    wageIncome,
    unemployed,
    benefits: unemployed * config.policy.annualBenefit,
  };
}
