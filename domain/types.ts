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
  workforceEntryAge: number;
  retirementAge: number;
  openingHistoryYears: number; // Accounting periods at initial jobs/wages, before the forecast.
  sectors: SectorConfig[];
  household: { employed: Spending; unemployed: Spending; propensity: Pair };
  policy: {
    annualBenefit: number;
    incomeTax: number;
    profitTax: number;
    matchingRate: number;
    demandAdjustment: number;
    productivityGrowth: number;
    productivityWageShare: number;
    pensionReplacementRate: number;
    pensionContributionRate: number;
    savingsDrawdownRate: number;
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
  initialPayroll: number;
  initialOperatingIncome: number; // Sales net of intermediate inputs and service fees.
  expectedOrders: number; // Funded orders used in the latest staffing decision.
  desiredWorkers: Pair;
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
  age: Uint16Array;
  retired: Uint8Array; // Permanent labor-force exit
  role: Uint8Array; // 0 = outside labor force; 1 = white; 2 = blue
  employer: Int32Array; // -1 = unemployed / outside labor force
  lastEmployer: Int32Array;
  salary: Float64Array;
  referenceSalary: Float64Array; // Most recent earnings; retained through unemployment.
  pension: Float64Array; // Annual retirement entitlement, funded by the city budget.
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
  age: number;
  retired: boolean;
  role: Role | "dependent";
  employerId: number | null;
  lastEmployerId: number | null;
  annualSalary: number;
  annualPension: number;
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
  /** Actual job separations in this year, before any subsequent rehiring. */
  directLayoffs: number;
  demandLayoffs: number;
  companies: number;
  closedCompanies: number;
  workers: Pair;
  vacancies: number;
  revenue: number;
  valueAdded: number;
  initialRevenue: number;
  payroll: number;
}
export interface AgeGroup {
  label: string;
  minAge: number;
  maxAge: number | null;
  residents: number;
  employed: number;
  unemployed: number;
  inactive: number;
}
export interface DemographicProfile {
  ageGroups: AgeGroup[];
  horizonYears: number;
  upcomingEntrants: number;
  upcomingExits: number;
}
export interface YearResult {
  demographics: DemographicProfile;
  laborForce: number;
  workforceEntrants: number;
  workforceExits: number;
  employedExits: number;
  unemployedExits: number;
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
  pensionCost: number;
  pensionContributions: number;
  taxRevenue: number;
  governmentPurchases: number;
  investment: number;
  investmentFunding: { households: number; companies: number };
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
