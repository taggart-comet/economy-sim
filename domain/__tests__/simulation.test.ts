import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, DEFAULT_SCENARIO } from "../config";
import { CityFactory } from "../factories/city-factory";
import { CitizenFactory } from "../factories/citizen-factory";
import { simulate } from "../simulation";
import { transitionLabor } from "../systems/labor";
import { productionAccounts } from "../systems/production";
import { assignShareholders, payDividends } from "../systems/ownership";
import { consumptionProfile, householdAccounts, settleHouseholds } from "../systems/households";
import type { CityConfig } from "../types";
// A smaller, proportionally identical fixture keeps accounting tests fast.
const config: CityConfig = {
  ...DEFAULT_CONFIG,
  population: 100_000,
  sectors: DEFAULT_CONFIG.sectors.map((s) => ({
    ...s,
    companies: s.provider ? 1 : Math.max(1, Math.round(s.companies / 10)),
  })),
};
const zero = DEFAULT_SCENARIO.map((p) => ({ ...p, white: 0, blue: 0 }));
const noLayoffs = simulate(config, zero),
  shock = simulate(config, DEFAULT_SCENARIO);
test("factories conserve population and employment; citizen employer links match company counts", () => {
  const c = CityFactory.create(config),
    counts = c.companies.map(() => ({ white: 0, blue: 0 }));
  let employed = 0,
    unemployed = 0;
  for (let i = 0; i < c.citizens.count; i++) {
    const p = CitizenFactory.at(c.citizens, i);
    if (p.role === "dependent") {
      assert.equal(p.employerId, null);
      continue;
    }
    if (p.employerId === null) unemployed++;
    else {
      counts[p.employerId][p.role]++;
      employed++;
    }
  }
  assert.equal(employed + unemployed, c.citizens.laborForce);
  assert.equal(
    unemployed,
    Math.round(c.citizens.laborForce * config.initialUnemployment),
  );
  c.companies.forEach((v, i) => assert.deepEqual(v.workers, counts[i]));
  assert.equal(c.companies.filter((x) => x.provider === "white").length, 1);
  assert.equal(c.companies.filter((x) => x.provider === "blue").length, 1);
});
test("every forecast year conserves people, employment transitions and GDP accounting", () => {
  for (const result of [noLayoffs, shock]) {
    let prior = result.initial;
    for (const y of result.years) {
      assert.equal(
        y.employed.white + y.employed.blue + y.unemployed,
        result.laborForce,
      );
      assert.equal(
        y.unemployed,
        prior.unemployed +
          y.layoffs.white +
          y.layoffs.blue +
          y.demandLayoffs -
          y.hires.white -
          y.hires.blue,
      );
      assert.ok(
        Math.abs(y.gdp - y.consumption - y.investment - y.governmentPurchases) <
          0.01,
      );
      assert.ok(
        Math.abs(y.gdp - y.sectors.reduce((n, s) => n + s.valueAdded, 0)) <
          0.01,
      );
      assert.ok(
        Math.abs(
          y.budgetBalance -
            (y.taxRevenue - y.benefitCost - y.governmentPurchases),
        ) < 0.01,
      );
      assert.equal(y.benefitCost, y.unemployed * config.policy.annualBenefit);
      for (const c of y.companies)
        for (const r of ["white", "blue"] as const) {
          assert.ok(Number.isInteger(c.workers[r]) && c.workers[r] >= 0);
          assert.ok(Number.isInteger(c.vacancies[r]) && c.vacancies[r] >= 0);
        }
      prior = y;
    }
  }
});
test("white/blue automation pay the correct provider exactly and persist into subsequent years", () => {
  const whiteOnly = simulate(
    config,
    zero.map((p, i) => ({ ...p, white: i === 0 ? 0.3 : 0 })),
  );
  const blueOnly = simulate(
    config,
    zero.map((p, i) => ({ ...p, blue: i === 0 ? 0.3 : 0 })),
  );
  assert.equal(
    whiteOnly.years[0].aiAutomationRevenue,
    whiteOnly.years[0].layoffs.white * config.policy.automationFee.white,
  );
  assert.equal(whiteOnly.years[0].roboticsAutomationRevenue, 0);
  assert.equal(blueOnly.years[0].aiAutomationRevenue, 0);
  assert.equal(
    blueOnly.years[0].roboticsAutomationRevenue,
    blueOnly.years[0].layoffs.blue * config.policy.automationFee.blue,
  );
  assert.equal(
    whiteOnly.years[1].aiAutomationRevenue,
    whiteOnly.years[1].companies.reduce((sum, c) => sum + c.automated.white * config.policy.automationFee.white, 0),
  );
  for (const c of whiteOnly.years[1].companies) {
    const prior = whiteOnly.years[0].companies[c.id];
    if (!c.closed) assert.equal(c.automated.white, prior.automated.white);
    else assert.equal(c.automated.white, 0);
  }
  assert.ok(whiteOnly.years[0].aiRevenue > noLayoffs.years[0].aiRevenue);
  assert.ok(
    blueOnly.years[0].roboticsRevenue > noLayoffs.years[0].roboticsRevenue,
  );
});
test("layoffs cut discretionary spending and vacancies can absorb displaced workers", () => {
  assert.ok(shock.years[0].hires.white + shock.years[0].hires.blue > 0);
  assert.ok(
    shock.years[0].spending.restaurants <
      noLayoffs.years[0].spending.restaurants,
  );
  assert.ok(
    shock.years[0].unemploymentRate > noLayoffs.years[0].unemploymentRate,
  );
  const unemployed = consumptionProfile(config, "white", 85000, true),
    employed = consumptionProfile(config, "white", 85000);
  assert.ok(unemployed.restaurants < employed.restaurants * 0.2);
  assert.ok(
    Math.abs(
      Object.values(unemployed).reduce((a, b) => a + b, 0) -
        config.policy.annualBenefit,
    ) < 1e-8,
  );
});
test("full automation is bounded and zero benefits / zero matching remain finite", () => {
  const c = {
    ...config,
    policy: { ...config.policy, annualBenefit: 0, matchingRate: 0 },
  };
  const r = simulate(
    c,
    zero.map((p) => ({ ...p, white: 1, blue: 1 })),
  );
  for (const y of r.years) {
    assert.ok(Number.isFinite(y.gdp) && y.gdp >= 0);
    assert.ok(y.unemploymentRate >= 0 && y.unemploymentRate <= 1);
    assert.equal(y.benefitCost, 0);
    assert.equal(y.hires.white + y.hires.blue, 0);
  }
  assert.equal(r.years[1].layoffs.white + r.years[1].layoffs.blue, 0);
});
test("same seed replays exactly without modifying input; future policies cannot change earlier years", () => {
  const before = JSON.stringify(config),
    r = simulate(config, DEFAULT_SCENARIO);
  assert.deepEqual(r, shock);
  assert.equal(JSON.stringify(config), before);
  const late = simulate(
    config,
    zero.map((p, i) => ({ ...p, white: i === 4 ? 0.5 : 0 })),
  );
  assert.deepEqual(late.years.slice(0, 4), noLayoffs.years.slice(0, 4));
});
test("reject invalid configuration, unknown suppliers, and invalid annual rates", () => {
  assert.throws(() =>
    simulate(
      config,
      zero.map((p) => ({ ...p, white: NaN })),
    ),
  );
  assert.throws(() =>
    CityFactory.create({ ...config, sectors: config.sectors.slice(1) }),
  );
  assert.throws(() =>
    CityFactory.create({
      ...config,
      consumptionLinks: { ...config.consumptionLinks, food: { unknown: 1 } },
    }),
  );
  assert.throws(() => simulate(config, zero.slice(1)));
});

test("shareholder qualification is strict, rounded to people, persistent and includes providers", () => {
  const city = CityFactory.create({ ...config, population: 200_000 });
  const h = householdAccounts(city.config, city.citizens);
  productionAccounts(city, h.spending, -1, true);
  assignShareholders(city);
  for (const c of city.companies) if (c.shareholderCount) {
    assert.ok(c.workers.white + c.workers.blue > 50);
    assert.equal(c.shareholderCount, Math.round((c.workers.white + c.workers.blue) * 0.01));
  }
  assert.ok(city.companies.filter((c) => c.provider).every((c) => c.shareholderCount > 0));
  const owners = Array.from(city.citizens.ownerCompany);
  const labor = transitionLabor(city, { year: 2026, white: 1, blue: 1 }, 0);
  assert.equal(labor.layoffs.white, labor.eligible.white);
  assert.equal(labor.layoffs.blue, labor.eligible.blue);
  owners.forEach((id, i) => {
    if (id >= 0) assert.equal(city.citizens.employer[i], id);
  });
  const existing = city.companies.map((c) => c.shareholderCount);
  assignShareholders(city);
  assert.deepEqual(city.companies.map((c) => c.shareholderCount), existing);
});

test("shareholder consumption is capped, while unspent dividends accumulate and transfers balance", () => {
  const city = CityFactory.create(config);
  const p = city.citizens, c = city.companies[p.employer[0]];
  p.ownerCompany[0] = c.id;
  c.shareholderCount = 1;
  c.shareholders[p.role[0] === 1 ? "white" : "blue"] = 1;
  c.retainedCapital = 10_000_000;
  c.dividend = 10_000_000;
  payDividends(city);
  assert.equal(p.dividends[0], 10_000_000);
  assert.equal(c.retainedCapital, 0);
  const h = householdAccounts(config, p);
  assert.equal(h.budgets[0], 500_000);
  const spending = settleHouseholds(p, h, h.spending);
  assert.ok(Math.abs(spending - 500_000) < 1e-6);
  assert.ok(Math.abs(p.wealth[0] - (h.incomes[0] - 500_000)) < 1e-6);
  assert.ok(p.wealth[0] > 9_500_000);
  payDividends(city);
  assert.equal(p.dividends[0], 0, "dividends cannot be paid twice");
  const next = householdAccounts(config, p);
  assert.ok(next.budgets[0] <= 500_000);
});

test("demand closures remove small firms first, release employees and cancel supplier contracts", () => {
  const city = CityFactory.create({ ...config, policy: { ...config.policy, matchingRate: 0 } });
  const h = householdAccounts(city.config, city.citizens);
  productionAccounts(city, h.spending, -1, true);
  const retail = city.companies.filter((c) => c.sector === "retail");
  for (const c of retail) {
    const size = c.initialWorkers.white + c.initialWorkers.blue;
    c.initialRevenue = size * 100_000;
    c.previousRevenue = c.initialRevenue;
    c.revenue = c.initialRevenue * 0.1;
    c.profit = -100_000;
  }
  const labor = transitionLabor(city, { year: 2027, white: 0, blue: 0 }, 1);
  const closed = retail.filter((c) => c.closed), active = retail.filter((c) => !c.closed);
  assert.ok(closed.length > 0 && active.length > 0);
  const size = (c: typeof retail[number]) => c.initialWorkers.white + c.initialWorkers.blue;
  assert.ok(Math.max(...closed.map(size)) <= Math.min(...active.map(size)));
  assert.equal(labor.closureLayoffs, closed.reduce((sum, c) => sum + size(c), 0));
  for (const c of closed) {
    assert.equal(c.workers.white + c.workers.blue, 0);
    assert.equal(c.vacancies.white + c.vacancies.blue, 0);
    assert.equal(c.automated.white + c.automated.blue, 0);
  }
  const after = householdAccounts(city.config, city.citizens);
  assert.ok(after.spending.clothes < h.spending.clothes);
  const production = productionAccounts(city, after.spending, 1);
  assert.ok(Math.abs(production.gdp - city.companies.reduce((sum, c) => sum + c.revenue - c.intermediateCosts - c.automationCosts, 0)) < 0.01);
  for (const c of closed) assert.equal(c.revenue + c.automationCosts + c.payroll, 0);
  transitionLabor(city, { year: 2028, white: 0, blue: 0 }, 2);
  for (const c of closed) assert.equal(c.workers.white + c.workers.blue, 0);
});

test("wealth metrics are bounded and a demand shock produces secondary layoffs and blocked investment", () => {
  for (const y of shock.years) {
    assert.ok(y.wealthGini >= 0 && y.wealthGini <= 1);
    assert.ok(y.topOnePercentWealthShare >= 0 && y.topOnePercentWealthShare <= 1);
    assert.ok(y.shareholderWealthShare >= 0 && y.shareholderWealthShare <= 1);
    assert.ok(y.idleCapital >= 0 && Number.isFinite(y.idleCapital));
    assert.ok(y.shareholderConsumption <= y.shareholders * 500_000 + 0.01);
    assert.deepEqual(y.lorenz[0], { population: 0, wealth: 0 });
    assert.ok(Math.abs(y.lorenz.at(-1)!.wealth - 1) < 1e-9);
    for (let i = 1; i < y.lorenz.length; i++) assert.ok(y.lorenz[i].wealth >= y.lorenz[i - 1].wealth);
    assert.ok(y.closureLayoffs <= y.demandLayoffs);
    for (const c of y.companies) {
      assert.ok(c.workers.white >= c.shareholders.white);
      assert.ok(c.workers.blue >= c.shareholders.blue);
    }
  }
  assert.ok(shock.years.at(-1)!.closedCompanies > noLayoffs.years.at(-1)!.closedCompanies);
  assert.ok(shock.years.slice(1).some((y) => y.closureLayoffs > 0 && y.demandBlockedInvestment > 0));
  assert.ok(shock.years.at(-1)!.idleCapital > shock.years[0].idleCapital);
});

test("zero incomes and benefits leave no wealth, NaNs or unfunded investment", () => {
  const c = { ...config, sectors: config.sectors.map((s) => ({ ...s, wages: { white: 0, blue: 0 } })), policy: { ...config.policy, annualBenefit: 0, governmentPerResident: 0, automationFee: { white: 0, blue: 0 }, baseServiceFee: { white: 0, blue: 0 } } };
  const r = simulate(c, zero);
  for (const y of r.years) {
    assert.equal(y.investment, 0);
    assert.equal(y.idleCapital, 0);
    assert.equal(y.wealthGini, 0);
    assert.equal(y.householdWealth, 0);
  }
});
