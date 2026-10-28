import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../config";
import { CityFactory } from "../factories/city-factory";
import { growWages } from "../systems/earnings";
import { householdAccounts, settleHouseholds } from "../systems/households";

test("productivity wage sharing changes purchasing power and new-hire pay without mutating config", () => {
  const config = structuredClone(DEFAULT_CONFIG);
  config.population = 10_000;
  const city = CityFactory.create(config), p = city.citizens;
  const before = householdAccounts(config, p);
  const wages = city.companies.map(c => ({ ...c.wages }));
  const salaries = p.salary.slice(), pensions = p.pension.slice();
  const savedConfig = structuredClone(config);
  growWages(city);
  assert.deepEqual(config, savedConfig);
  for (let i = 0; i < p.count; i++) {
    assert.equal(p.salary[i], salaries[i] * 1.015);
    assert.equal(p.pension[i], pensions[i], "existing pensions stay fixed in real dollars");
    if (p.employer[i] >= 0) assert.equal(p.referenceSalary[i], p.salary[i]);
  }
  city.companies.forEach((c, i) => assert.equal(c.wages.white, wages[i].white * 1.015));
  assert.ok(householdAccounts(config, p).disposableIncome > before.disposableIncome);
  config.policy.productivityWageShare = 0;
  const fixed = p.salary.slice();
  growWages(city);
  assert.deepEqual(p.salary, fixed);
});

test("savings drawdowns spend existing cash and pensions are recorded as transfers", () => {
  const config = structuredClone(DEFAULT_CONFIG);
  config.population = 10_000;
  const city = CityFactory.create(config), p = city.citizens;
  const worker = p.employer.findIndex(id => id >= 0);
  const pensioner = p.pension.findIndex(v => v > 0);
  p.wealth[worker] = p.wealth[pensioner] = 100_000;
  const h = householdAccounts(config, p);
  const noDrawdown = householdAccounts({ ...config, policy: { ...config.policy, savingsDrawdownRate: 0 } }, p);
  assert.equal(h.budgets[worker] - noDrawdown.budgets[worker], 4000);
  assert.equal(h.budgets[pensioner], p.pension[pensioner] + 4000);
  assert.equal(h.incomes[pensioner], p.pension[pensioner]);
  assert.equal(h.pensions, p.pension.reduce((sum, v) => sum + v, 0));
  const wealthBefore = p.wealth.slice();
  settleHouseholds(p, h, h.spending);
  for (const i of [worker, pensioner])
    assert.ok(Math.abs(p.wealth[i] - (wealthBefore[i] + h.incomes[i] - h.budgets[i])) < 0.01);
});
