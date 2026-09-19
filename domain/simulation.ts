import type {
  City,
  CityConfig,
  SimulationResult,
  YearPolicy,
  YearResult,
} from "./types";
import { CityFactory } from "./factories/city-factory";
import { CitizenFactory } from "./factories/citizen-factory";
import { assignShareholders, wealthAccounts } from "./systems/ownership";
import { householdAccounts, settleHouseholds } from "./systems/households";
import { transitionLabor } from "./systems/labor";
import { productionAccounts } from "./systems/production";
import { validateScenario } from "./validation";
const emptyLabor = () => ({
  eligible: { white: 0, blue: 0 },
  layoffs: { white: 0, blue: 0 },
  hires: { white: 0, blue: 0 },
  demandLayoffs: 0,
  closureLayoffs: 0,
  newClosures: 0,
});
function snapshot(
  city: City,
  year: number,
  index: number,
  labor: ReturnType<typeof transitionLabor>,
  balance: number,
  initialize = false,
): YearResult {
  const h = householdAccounts(city.config, city.citizens), cs = city.companies;
  const planned = Object.values(h.spending).reduce((a, b) => a + b, 0);
  const available = Math.max(0, h.liquidWealth + h.disposableIncome - planned +
    cs.reduce((sum, c) => sum + c.retainedCapital, 0));
  const production = productionAccounts(city, h.spending, index, initialize, available);
  let shareholderConsumption = 0;
  if (initialize) assignShareholders(city);
  else {
    shareholderConsumption = settleHouseholds(city.citizens, h, production.spending);
    // Investment exchanges cash for productive assets. It never destroys household wealth.
    const p = city.citizens;
    const householdCash = p.wealth.subarray(0, p.laborForce).reduce((sum, v) => sum + v, 0);
    const companyCash = cs.reduce((sum, c) => sum + c.retainedCapital, 0);
    // Households finance first; firms contribute only their remaining cash.
    const householdRate = householdCash > 0 ? Math.min(1, production.investment / householdCash) : 0;
    for (let i = 0; i < p.laborForce; i++) {
      const invested = p.wealth[i] * householdRate;
      p.wealth[i] -= invested;
      p.investedWealth[i] += invested;
    }
    const companyRate = companyCash > 0 ? Math.min(1, Math.max(0, production.investment - householdCash) / companyCash) : 0;
    for (const c of cs) {
      const invested = c.retainedCapital * companyRate;
      c.retainedCapital -= invested;
      c.investedCapital += invested;
      const cash = c.retainedCapital + c.profit - Math.max(0, c.profit) * city.config.policy.profitTax;
      if (cash < 0) { c.operatingDebt -= cash; c.retainedCapital = 0; }
      else {
        const repayment = Math.min(c.operatingDebt, cash);
        c.operatingDebt -= repayment;
        c.retainedCapital = cash - repayment;
      }
      c.dividend = c.shareholderCount ? Math.min(c.retainedCapital, Math.max(0, c.profit) * (1 - city.config.policy.profitTax)) : 0;
    }
  }
  const taxRevenue =
    h.wageIncome * city.config.policy.incomeTax +
    cs.reduce(
      (n, c) => n + Math.max(0, c.profit) * city.config.policy.profitTax,
      0,
    );
  const budgetBalance =
    taxRevenue - h.benefits - production.governmentPurchases;
  const sectors = city.config.sectors.map((s) => {
    const companies = cs.filter((c) => c.sector === s.id);
    return {
      id: s.id,
      name: s.name,
      companies: companies.filter((c) => !c.closed).length,
      closedCompanies: companies.filter((c) => c.closed).length,
      workers: {
        white: companies.reduce((n, c) => n + c.workers.white, 0),
        blue: companies.reduce((n, c) => n + c.workers.blue, 0),
      },
      vacancies: companies.reduce(
        (n, c) => n + c.vacancies.white + c.vacancies.blue,
        0,
      ),
      revenue: companies.reduce((n, c) => n + c.revenue, 0),
      valueAdded: companies.reduce(
        (n, c) => n + c.revenue - c.intermediateCosts - c.automationCosts,
        0,
      ),
      initialRevenue: companies.reduce((n, c) => n + c.initialRevenue, 0),
      payroll: companies.reduce((n, c) => n + c.payroll, 0),
    };
  });
  return {
    year,
    ...labor,
    ...production,
    ...wealthAccounts(city),
    shareholderConsumption,
    closedCompanies: cs.filter((c) => c.closed).length,
    unemploymentRate: h.unemployed / city.citizens.laborForce,
    unemployed: h.unemployed,
    employed: {
      white: cs.reduce((n, c) => n + c.workers.white, 0),
      blue: cs.reduce((n, c) => n + c.workers.blue, 0),
    },
    vacancies: cs.reduce((n, c) => n + c.vacancies.white + c.vacancies.blue, 0),
    benefitCost: h.benefits,
    taxRevenue,
    budgetBalance,
    cumulativeBalance: initialize ? 0 : balance + budgetBalance,
    aiRevenue: cs.find((c) => c.provider === "white")!.revenue,
    roboticsRevenue: cs.find((c) => c.provider === "blue")!.revenue,
    aiAutomationRevenue: production.automationRevenue.white,
    roboticsAutomationRevenue: production.automationRevenue.blue,
    sectors,
    companies: cs.map((c) => ({
      ...c,
      workers: { ...c.workers },
      shareholders: { ...c.shareholders },
      vacancies: { ...c.vacancies },
      automated: { ...c.automated },
    })),
    samples: Array.from({ length: 10 }, (_, i) =>
      CitizenFactory.at(
        city.citizens,
        Math.floor((i * city.citizens.laborForce) / 10),
      ),
    ),
  };
}
/** Pure public entry point: always constructs a fresh city; caller configuration is never mutated. */
export function simulate(
  config: CityConfig,
  scenario: YearPolicy[],
): SimulationResult {
  validateScenario(config, scenario);
  const city = CityFactory.create(config),
    initial = snapshot(city, config.startYear - 1, -1, emptyLabor(), 0, true),
    years: YearResult[] = [];
  for (let i = 0; i < scenario.length; i++) {
    const labor = transitionLabor(city, scenario[i], i);
    years.push(
      snapshot(
        city,
        scenario[i].year,
        i,
        labor,
        years.at(-1)?.cumulativeBalance ?? 0,
      ),
    );
  }
  return {
    initial,
    years,
    population: config.population,
    laborForce: city.citizens.laborForce,
    companyCount: city.companies.length,
  };
}
