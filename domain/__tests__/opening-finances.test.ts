import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, DEFAULT_SCENARIO } from "../config";
import { CityFactory } from "../factories/city-factory";
import { demographicProfile } from "../systems/demographics";
import { simulate } from "../simulation";

const config = {
  ...DEFAULT_CONFIG, population: 20_000,
  sectors: DEFAULT_CONFIG.sectors.map(s => ({ ...s, companies: s.provider ? 1 : 10 })),
};
const zero = DEFAULT_SCENARIO.map(p => ({ ...p, white: 0, blue: 0 }));

test("opening history creates financial balances without changing initial ages, wages, jobs or labor force", () => {
  const city = CityFactory.create(config);
  const established = simulate(config, zero);
  const startup = simulate({ ...config, openingHistoryYears: 0 }, zero);
  const initial = established.initial;
  assert.deepEqual(initial.demographics, demographicProfile(city));
  assert.deepEqual(initial.employed, startup.initial.employed);
  assert.equal(initial.unemployed, startup.initial.unemployed);
  assert.equal(initial.laborForce, startup.initial.laborForce);
  assert.equal(initial.cumulativeBalance, 0, "cumulative fiscal balance measures forecast years only");
  initial.samples.forEach((sample, i) => {
    assert.equal(sample.age, startup.initial.samples[i].age);
    assert.equal(sample.annualSalary, startup.initial.samples[i].annualSalary);
  });
  assert.ok(initial.idleCapital > 0);
  assert.ok(initial.householdWealth > 0);
  assert.ok(initial.companies.some(c => c.operatingDebt > 0), "history retains losses as well as profits");
  assert.ok(initial.companies.some(c => c.dividend > 0));
  assert.ok(established.years[0].dividends > 0, "scheduled opening dividends are paid in the first forecast year");
  assert.equal(startup.initial.idleCapital, 0);
  assert.equal(startup.initial.householdWealth, 0);
  assert.equal(startup.years[0].dividends, 0);
});

test("opening balances are identical across future policies and configuration remains unchanged", () => {
  const before = structuredClone(config);
  assert.deepEqual(simulate(config, zero).initial, simulate(config, DEFAULT_SCENARIO).initial);
  assert.deepEqual(config, before);
  assert.throws(() => simulate({ ...config, openingHistoryYears: -1 }, zero));
  assert.throws(() => simulate({ ...config, openingHistoryYears: 1.5 }, zero));
  assert.throws(() => simulate({ ...config, openingHistoryYears: 11 }, zero));
});
