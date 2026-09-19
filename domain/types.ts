/** Monetary amounts are annual, constant 2026 USD; rates are fractions, not percentages. */
export type Role = "white" | "blue";
export type Pair = Record<Role, number>;
export type Category =
  | "food"
  | "restaurants"
  | "housing"
  | "transport"
  | "health"
  | "entertainment"
  | "clothes"
  | "other";
export type Spending = Record<Category, number>;
export interface SectorConfig {
  id: string;
  name: string;
  companies: number;
  employmentShare: number;
  whiteShare: number;
  wages: Pair;
  vacancyRate: number;
  /** Where this sector buys its ordinary intermediate inputs. Shares sum to one. */
  suppliers: Record<string, number>;
  provider?: Role;
}
export interface CityConfig {
  population: number;
  startYear: number;
  years: number;
  seed: number;
  adultShare: number;
  participationRate: number;
  initialUnemployment: number;
  unemployedWhiteShare: number;
  sectors: SectorConfig[];
  household: { employed: Spending; unemployed: Spending; propensity: Pair };
  policy: {
    annualBenefit: number;
    incomeTax: number;
    profitTax: number;
    matchingRate: number;
    demandAdjustment: number;
    productivityGrowth: number;
    automationEfficiency: Pair;
    automationFee: Pair;
    baseServiceFee: Pair;
    intermediateShare: number;
    investmentShare: number;
    governmentPerResident: number;
  };
  /** Category → sector → fraction of spending, including dependents in earners' budgets. */
  consumptionLinks: Record<Category, Record<string, number>>;
  governmentLinks: Record<string, number>;
  investmentLinks: Record<string, number>;
}
export interface Company {
  id: number;
  name: string;
  sector: string;
  provider?: Role;
  closed: boolean;
  shareholders: Pair;
  shareholderCount: number;
  retainedCapital: number;
  operatingDebt: number;
  investedCapital: number;
  dividend: number;
  workers: Pair;
  initialWorkers: Pair;
  vacancies: Pair;
  automated: Pair;
  wages: Pair;
  revenue: number;
  initialRevenue: number;
  previousRevenue: number;
  intermediateCosts: number;
  automationCosts: number;
  payroll: number;
  profit: number;
}
/** One row per real simulated citizen. Columnar storage avoids a million JS object allocations. */
export interface CitizenPopulation {
  count: number;
  laborForce: number;
  role: Uint8Array; // 0 = outside labor force; 1 = white; 2 = blue
  employer: Int32Array; // -1 = unemployed / outside labor force
  lastEmployer: Int32Array;
  salary: Float64Array;
  ownerCompany: Int32Array; // Persistent ownership; -1 for non-shareholders
  dividends: Float64Array;
  wealth: Float64Array; // Liquid savings accumulated since simulation start
  investedWealth: Float64Array;
  incomeFactor: Float32Array; // Stable, seeded wage heterogeneity.
  unemployedYears: Uint8Array;
  spendingProfile: Uint8Array; // 0 = dependent; 1 = employed white; 2 = employed blue; 3 = unemployed
}
export interface Citizen {
  id: number;
  role: Role | "dependent";
  employerId: number | null;
  lastEmployerId: number | null;
  annualSalary: number;
  shareholderOf: number | null;
  wealth: number;
  dividend: number;
  unemployedYears: number;
  spendingProfile: number;
}
export interface City {
  config: CityConfig;
  companies: Company[];
  citizens: CitizenPopulation;
  initialSpending: Spending;
  initialFinalDemand: Record<string, number>;
}
export interface YearPolicy {
  year: number;
  white: number;
  blue: number;
}
export interface SectorResult {
  id: string;
  name: string;
  companies: number;
  closedCompanies: number;
  workers: Pair;
  vacancies: number;
  revenue: number;
  valueAdded: number;
  initialRevenue: number;
  payroll: number;
}
export interface YearResult {
  year: number;
  gdp: number;
  unemploymentRate: number;
  unemployed: number;
  employed: Pair;
  eligible: Pair;
  layoffs: Pair;
  demandLayoffs: number;
  closureLayoffs: number;
  newClosures: number;
  closedCompanies: number;
  shareholders: number;
  dividends: number;
  shareholderConsumption: number;
  wealthGini: number;
  topOnePercentWealthShare: number;
  shareholderWealthShare: number;
  householdWealth: number;
  idleCapital: number;
  demandBlockedInvestment: number;
  lorenz: { population: number; wealth: number }[];
  hires: Pair;
  vacancies: number;
  spending: Spending;
  plannedConsumption: number;
  consumption: number;
  unmetDemand: number;
  benefitCost: number;
  taxRevenue: number;
  governmentPurchases: number;
  investment: number;
  budgetBalance: number;
  cumulativeBalance: number;
  aiRevenue: number;
  roboticsRevenue: number;
  aiAutomationRevenue: number;
  roboticsAutomationRevenue: number;
  sectors: SectorResult[];
  companies: Company[];
  samples: Citizen[];
}
export interface SimulationResult {
  initial: YearResult;
  years: YearResult[];
  population: number;
  laborForce: number;
  companyCount: number;
}
