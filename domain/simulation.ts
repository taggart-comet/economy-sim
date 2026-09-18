import type {
  City,
  CityConfig,
  SimulationResult,
  YearPolicy,
  YearResult,
} from "./types";
import { CityFactory } from "./factories/city-factory";
import { CitizenFactory } from "./factories/citizen-factory";
import { householdAccounts } from "./systems/households";
import { transitionLabor } from "./systems/labor";
import { productionAccounts } from "./systems/production";
import { validateScenario } from "./validation";
const emptyLabor = () => ({
  eligible: { white: 0, blue: 0 },
  layoffs: { white: 0, blue: 0 },
  hires: { white: 0, blue: 0 },
  demandLayoffs: 0,
});
function snapshot(
  city: City,
  year: number,
  index: number,
  labor: ReturnType<typeof transitionLabor>,
  balance: number,
  initialize = false,
): YearResult {
  const h = householdAccounts(city.config, city.citizens),
    production = productionAccounts(city, h.spending, index, initialize),
    cs = city.companies;
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
      companies: companies.length,
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
