import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, DEFAULT_SCENARIO } from "../config";
import { CityFactory } from "../factories/city-factory";
import { CitizenFactory } from "../factories/citizen-factory";
import { simulate } from "../simulation";
import { consumptionProfile } from "../systems/households";
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
    whiteOnly.years[0].aiAutomationRevenue,
  );
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
