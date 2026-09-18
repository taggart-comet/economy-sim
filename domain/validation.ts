import type { CityConfig, YearPolicy } from "./types";
function rate(v: number, label: string) {
  if (!Number.isFinite(v) || v < 0 || v > 1)
    throw new Error(`${label} must be between 0 and 1`);
}
export function validateConfig(c: CityConfig) {
  if (!Number.isInteger(c.startYear) || !Number.isInteger(c.seed))
    throw new Error("Start year and seed must be integers");
  if (
    !Number.isInteger(c.population) ||
    c.population < 1000 ||
    c.population > 2_000_000
  )
    throw new Error(
      "Population must be an integer between 1,000 and 2,000,000",
    );
  if (!Number.isInteger(c.years) || c.years < 1 || c.years > 10)
    throw new Error("Forecast must span 1–10 years");
  for (const k of [
    "adultShare",
    "participationRate",
    "initialUnemployment",
    "unemployedWhiteShare",
  ] as const)
    rate(c[k], k);
  if (c.adultShare * c.participationRate === 0)
    throw new Error("City requires a labor force");
  if (Math.abs(c.sectors.reduce((n, s) => n + s.employmentShare, 0) - 1) > 1e-9)
    throw new Error("Sector employment shares must sum to one");
  const ids = new Set(c.sectors.map((s) => s.id));
  if (ids.size !== c.sectors.length)
    throw new Error("Sector IDs must be unique");
  for (const role of ["white", "blue"] as const)
    if (
      c.sectors.filter((s) => s.provider === role).length !== 1 ||
      c.sectors.find((s) => s.provider === role)?.companies !== 1
    )
      throw new Error("Exactly one AI and one robotics company required");
  for (const s of c.sectors) {
    if (!Number.isInteger(s.companies) || s.companies < 1)
      throw new Error("Invalid company count");
    rate(s.employmentShare, "Employment share");
    rate(s.whiteShare, "Role share");
    rate(s.vacancyRate, "Vacancy rate");
    for (const wage of Object.values(s.wages))
      if (!Number.isFinite(wage) || wage < 0) throw new Error("Invalid wage");
    validateLinks(s.suppliers, ids);
  }
  for (const links of Object.values(c.consumptionLinks))
    validateLinks(links, ids);
  validateLinks(c.governmentLinks, ids);
  validateLinks(c.investmentLinks, ids);
  if (c.policy.intermediateShare > 0.95)
    throw new Error(
      "Intermediate share must not exceed 95% for a stable supplier network",
    );
  for (const key of [
    "incomeTax",
    "profitTax",
    "matchingRate",
    "demandAdjustment",
    "productivityGrowth",
    "intermediateShare",
    "investmentShare",
  ] as const)
    rate(c.policy[key], key);
  for (const role of ["white", "blue"] as const) {
    rate(c.policy.automationEfficiency[role], "Automation efficiency");
    rate(c.household.propensity[role], "Spending propensity");
  }
  for (const n of [
    c.policy.annualBenefit,
    c.policy.governmentPerResident,
    ...Object.values(c.policy.automationFee),
    ...Object.values(c.policy.baseServiceFee),
    ...Object.values(c.household.employed),
    ...Object.values(c.household.unemployed),
  ])
    if (!Number.isFinite(n) || n < 0)
      throw new Error("Amounts must be finite and nonnegative");
  if (
    Object.values(c.household.employed).reduce((a, b) => a + b, 0) <= 0 ||
    Object.values(c.household.unemployed).reduce((a, b) => a + b, 0) <= 0
  )
    throw new Error("Spending profiles must have positive weights");
}
function validateLinks(links: Record<string, number>, ids: Set<string>) {
  if (Math.abs(Object.values(links).reduce((a, b) => a + b, 0) - 1) > 1e-9)
    throw new Error("Spending links must sum to one");
  for (const [id, value] of Object.entries(links)) {
    if (!ids.has(id)) throw new Error(`Unknown sector ${id}`);
    rate(value, "Link share");
  }
}
export function validateScenario(config: CityConfig, years: YearPolicy[]) {
  if (years.length !== config.years)
    throw new Error("One policy is required for each forecast year");
  years.forEach((p, i) => {
    if (p.year !== config.startYear + i)
      throw new Error("Forecast years must be sequential");
    rate(p.white, "White-collar layoffs");
    rate(p.blue, "Blue-collar layoffs");
  });
}
