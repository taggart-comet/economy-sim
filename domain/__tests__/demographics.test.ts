import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, DEFAULT_SCENARIO } from "../config";
import { CityFactory } from "../factories/city-factory";
import { demographicProfile, transitionDemographics } from "../systems/demographics";
import { transitionLabor } from "../systems/labor";
import { householdAccounts } from "../systems/households";
import { payDividends } from "../systems/ownership";
import { simulate } from "../simulation";

const config = { ...DEFAULT_CONFIG, population: 10_000 };
test("age census conserves all residents, separates labor status, and includes the oldest tail", () => {
  const city = CityFactory.create(config), p = city.citizens;
  p.age.fill(30);
  p.role.fill(0);
  p.employer.fill(-1);
  p.retired.fill(0);
  [0, 4, 5, 19, 20, 64, 65, 85, 100].forEach((age, i) => { p.age[i] = age; });
  p.role[4] = 1; p.employer[4] = 0;
  p.role[5] = 2;
  const agesBefore = p.age.slice();
  const profile = demographicProfile(city);
  assert.deepEqual(p.age, agesBefore, "reporting must not advance ages");
  assert.equal(profile.ageGroups.reduce((n, g) => n + g.residents, 0), p.count);
  for (const group of profile.ageGroups)
    assert.equal(group.residents, group.employed + group.unemployed + group.inactive);
  assert.equal(profile.ageGroups[0].residents, 2);
  assert.equal(profile.ageGroups[1].residents, 1);
  assert.equal(profile.ageGroups[4].employed, 1);
  assert.equal(profile.ageGroups[12].unemployed, 1);
  assert.equal(profile.ageGroups[13].inactive, 1);
  assert.equal(profile.ageGroups[17].residents, 2);
  assert.equal(profile.upcomingEntrants, 1);
  assert.equal(profile.upcomingExits, 1);
});

test("aging independently retires employed and unemployed people, preserves owners, and admits young residents", () => {
  const city = CityFactory.create(config), p = city.citizens;
  p.age.fill(30); // Isolate exactly three age transitions.
  const worker = p.employer.findIndex(id => id >= 0);
  const unemployed = p.employer.findIndex((id, i) => id < 0 && p.role[i] !== 0);
  const entrant = p.role.findIndex(role => role === 0);
  p.age[worker] = p.age[unemployed] = 64;
  p.age[entrant] = 19;
  const c = city.companies[p.employer[worker]], role = p.role[worker] === 1 ? "white" : "blue";
  p.ownerCompany[worker] = c.id;
  c.shareholders[role] = c.shareholderCount = 1;
  p.wealth[worker] = 1000;
  c.retainedCapital = c.dividend = 100;
  const before = p.laborForce, workers = c.workers[role], vacancies = c.vacancies[role];
  assert.deepEqual(transitionDemographics(city), {
    workforceEntrants: 1, workforceExits: 2, employedExits: 1, unemployedExits: 1,
  });
  assert.equal(p.laborForce, before - 1);
  assert.equal(c.workers[role], workers - 1);
  assert.equal(c.vacancies[role], vacancies, "retirement does not authorize replacement hiring");
  assert.equal(c.shareholders[role], 0);
  assert.equal(c.shareholderCount, 1);
  assert.equal(p.wealth[worker], 1000);
  payDividends(city);
  assert.equal(p.dividends[worker], 100);
  assert.equal(p.pension[worker], p.referenceSalary[worker] * config.policy.pensionReplacementRate);
  assert.equal(householdAccounts(config, p).incomes[worker], 100 + p.pension[worker]);
  assert.equal(householdAccounts(config, p).incomes[unemployed], p.pension[unemployed]);
  assert.equal(householdAccounts(config, p).incomes[entrant], config.policy.annualBenefit);
  transitionLabor(city, { year: 2026, white: 0, blue: 0 }, 0);
  assert.equal(p.age[entrant], 20, "labor system must not age citizens");
  for (let year = 0; year < 3; year++) transitionDemographics(city);
  assert.equal(p.employer[worker], -1);
  assert.equal(p.role[worker], 0);
  assert.equal(p.retired[worker], 1);
  assert.equal(p.count, config.population);
});

test("entrants' role mix follows initial jobs and never depends on automation or unemployment composition", () => {
  const city = CityFactory.create(config), p = city.citizens;
  p.age.fill(30);
  for (let i = 0; i < p.count; i++) if (p.role[i] === 0 && !p.retired[i]) p.age[i] = 19;
  city.config = { ...config, unemployedWhiteShare: 0 };
  const result = transitionDemographics(city);
  let white = 0, total = 0;
  for (let i = 0; i < p.count; i++) if (p.age[i] === 20 && p.role[i] !== 0) {
    total++;
    if (p.role[i] === 1) white++;
  }
  const initialJobs = city.companies.reduce((n, c) => n + c.initialWorkers.white + c.initialWorkers.blue, 0);
  const whiteShare = city.companies.reduce((n, c) => n + c.initialWorkers.white, 0) / initialJobs;
  assert.equal(total, result.workforceEntrants);
  assert.ok(Math.abs(white / total - whiteShare) < 0.01);
});

test("demographic flows are policy-independent and annual labor-force denominators reconcile", () => {
  const zero = DEFAULT_SCENARIO.map(p => ({ ...p, white: 0, blue: 0 }));
  const baseline = simulate(config, zero), shock = simulate(config, DEFAULT_SCENARIO);
  assert.equal(baseline.initial.demographics.upcomingEntrants,
    baseline.years.reduce((n, y) => n + y.workforceEntrants, 0));
  assert.equal(baseline.initial.demographics.upcomingExits,
    baseline.years.reduce((n, y) => n + y.workforceExits, 0));
  let previous = baseline.initial.laborForce;
  baseline.years.forEach((year, i) => {
    assert.equal(year.workforceEntrants, shock.years[i].workforceEntrants);
    assert.equal(year.workforceExits, shock.years[i].workforceExits);
    assert.equal(year.laborForce, previous + year.workforceEntrants - year.workforceExits);
    assert.equal(year.employed.white + year.employed.blue + year.unemployed, year.laborForce);
    assert.equal(year.unemploymentRate, year.unemployed / year.laborForce);
    assert.equal(year.demographics.ageGroups.reduce((n, g) => n + g.residents, 0), config.population);
    assert.equal(year.demographics.ageGroups.reduce((n, g) => n + g.employed, 0), year.employed.white + year.employed.blue);
    assert.equal(year.demographics.ageGroups.reduce((n, g) => n + g.unemployed, 0), year.unemployed);
    assert.deepEqual(year.demographics.ageGroups.map(g => g.residents), shock.years[i].demographics.ageGroups.map(g => g.residents));
    previous = year.laborForce;
  });
});
