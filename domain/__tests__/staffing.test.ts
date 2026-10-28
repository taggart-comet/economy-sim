import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../config";
import { CityFactory } from "../factories/city-factory";
import { householdAccounts } from "../systems/households";
import { productionAccounts } from "../systems/production";
import { planDemand, supplierDemand } from "../systems/demand";
import { planStaffing } from "../systems/staffing";
import { transitionLabor } from "../systems/labor";
import { matchWorkers } from "../systems/matching";

function fixture() {
  const config = structuredClone(DEFAULT_CONFIG);
  config.population = 20_000;
  config.sectors = config.sectors.map(s => ({ ...s, companies: s.provider ? 1 : 5 }));
  config.policy.matchingRate = 1;
  config.policy.demandAdjustment = 1;
  config.policy.productivityGrowth = 0;
  const city = CityFactory.create(config);
  const h = householdAccounts(config, city.citizens);
  const spending = Object.values(h.spending).reduce((sum, v) => sum + v, 0);
  const capital = Math.max(0, h.liquidWealth + h.disposableIncome - spending);
  productionAccounts(city, h.spending, -1, true, capital);
  return { city, final: planDemand(city, h.spending, capital).final };
}
const total = (plans: ReturnType<typeof planStaffing>) =>
  plans.reduce((sum, p) => sum + p.target.white + p.target.blue, 0);

test("industry counters attribute actual direct and indirect separations to the employer's sector", () => {
  const { city } = fixture();
  city.config.policy.matchingRate = 0;
  city.config.household.propensity.white *= 0.2;
  city.config.household.propensity.blue *= 0.2;
  for (const c of city.companies) c.profit = 1; // Isolate resizing from closures.
  const before = city.companies.map(c => c.workers.white + c.workers.blue);
  const result = transitionLabor(city, { year: 2026, white: 0.1, blue: 0.05 }, 0);
  assert.ok(result.demandLayoffs > 0);
  assert.equal(result.hires.white + result.hires.blue, 0);
  for (const sector of city.config.sectors) {
    const firms = city.companies.filter(c => c.sector === sector.id);
    const direct = firms.reduce((sum, c) => sum + c.automated.white + c.automated.blue, 0);
    const allLosses = firms.reduce((sum, c) => sum + before[c.id] - c.workers.white - c.workers.blue, 0);
    assert.equal(result.sectorLayoffs[sector.id].directLayoffs, direct, sector.name);
    assert.equal(result.sectorLayoffs[sector.id].demandLayoffs, allLosses - direct, sector.name);
  }
});

test("unchanged orders and wages preserve every firm's calibrated workforce, including loss-making firms", () => {
  const { city, final } = fixture();
  const plans = planStaffing(city, final, 0);
  assert.ok(city.companies.some(c => c.profit < 0), "exercise the synthetic baseline mismatch");
  for (const c of city.companies) {
    assert.deepEqual(plans[c.id].target, c.initialWorkers, c.name);
  }
});

test("one staffing target grows with funded orders, shrinks with lower orders, and falls with productivity", () => {
  const { city, final } = fixture();
  const baseline = planStaffing(city, final, 0);
  const high = planStaffing(city, Object.fromEntries(Object.entries(final).map(([id, v]) => [id, v * 2])), 0);
  const low = planStaffing(city, Object.fromEntries(Object.entries(final).map(([id, v]) => [id, v * 0.4])), 0);
  assert.ok(total(high) > total(baseline));
  assert.ok(total(low) < total(baseline));
  for (const c of city.companies) for (const role of ["white", "blue"] as const)
    assert.ok(baseline[c.id].target[role] <= c.workers[role], "unchanged demand cannot authorize perpetual growth");
  city.config.policy.productivityGrowth = 0.1;
  assert.ok(total(planStaffing(city, final, 1)) < total(baseline));
});

test("unfilled orders inform staffing; adding employees does not manufacture orders", () => {
  const { city, final } = fixture();
  const before = planStaffing(city, final, 0);
  for (const c of city.companies) {
    c.workers.white += 10;
    c.workers.blue += 10;
    c.revenue = 0; // Realized sales cannot erase observable purchasing power.
  }
  const after = planStaffing(city, final, 0);
  assert.deepEqual(after.map(p => p.orders), before.map(p => p.orders));
  const ordinary = Object.values(supplierDemand(city, final)).reduce((sum, v) => sum + v, 0);
  const contracts = city.companies.filter(c => !c.provider).reduce((sum, c) => sum +
    c.initialWorkers.white * city.config.policy.baseServiceFee.white +
    c.initialWorkers.blue * city.config.policy.baseServiceFee.blue, 0);
  assert.ok(Math.abs(before.reduce((sum, p) => sum + p.orders, 0) - ordinary - contracts) < 0.01);
});

test("business responses cancel stale vacancies and use the same role target for cuts and hiring", () => {
  const { city } = fixture();
  city.config.household.propensity.white *= 0.2;
  city.config.household.propensity.blue *= 0.2;
  city.config.policy.governmentPerResident *= 0.2;
  for (const c of city.companies) {
    c.profit = 1; // Isolate resizing from the persistent-loss closure condition.
    c.vacancies = { white: 100_000, blue: 100_000 };
  }
  const before = city.companies.map(c => ({ ...c.workers }));
  const result = transitionLabor(city, { year: 2026, white: 0, blue: 0 }, 0);
  assert.ok(result.demandLayoffs > 0);
  assert.equal(result.newClosures, 0);
  for (const c of city.companies) for (const role of ["white", "blue"] as const) {
    if (before[c.id][role] > c.desiredWorkers[role]) {
      assert.equal(c.workers[role], c.desiredWorkers[role]);
      assert.equal(c.vacancies[role], 0);
    } else {
      assert.ok(c.workers[role] <= c.desiredWorkers[role]);
      assert.equal(c.workers[role] + c.vacancies[role], c.desiredWorkers[role]);
    }
  }
  const counts = city.companies.map(() => ({ white: 0, blue: 0 }));
  for (let i = 0; i < city.citizens.count; i++) {
    const id = city.citizens.employer[i];
    if (id >= 0) counts[id][city.citizens.role[i] === 1 ? "white" : "blue"]++;
  }
  city.companies.forEach(c => assert.deepEqual(c.workers, counts[c.id]));
});

test("the same purchasing-power collapse causes closures when losses persist, preserving a sector supplier", () => {
  const { city } = fixture();
  city.config.household.propensity = { white: 0, blue: 0 };
  city.config.policy.annualBenefit = 0;
  city.config.policy.governmentPerResident = 0;
  city.config.policy.investmentShare = 0;
  for (const c of city.companies) c.profit = -1000;
  const result = transitionLabor(city, { year: 2026, white: 0, blue: 0 }, 0);
  assert.ok(result.newClosures > 0);
  assert.ok(result.closureLayoffs > 0 && result.closureLayoffs <= result.demandLayoffs);
  for (const sector of city.config.sectors) {
    const firms = city.companies.filter(c => c.sector === sector.id);
    assert.equal(firms.filter(c => !c.closed).length, 1);
    for (const c of firms.filter(c => c.closed)) {
      assert.equal(c.expectedOrders, 0);
      assert.deepEqual(c.vacancies, { white: 0, blue: 0 });
      assert.deepEqual(c.automated, { white: 0, blue: 0 });
      assert.equal(c.workers.white + c.workers.blue, c.shareholderCount);
    }
  }
});

test("higher wages reduce staffing within the baseline-calibrated payroll budget", () => {
  const { city, final } = fixture();
  const c = city.companies.find(c => !c.provider && c.workers.white > 10)!;
  const before = planStaffing(city, final, 0)[c.id];
  let payroll = 0;
  for (let i = 0; i < city.citizens.count; i++) if (city.citizens.employer[i] === c.id) {
    city.citizens.salary[i] *= 10;
    payroll += city.citizens.salary[i];
  }
  const after = planStaffing(city, final, 0)[c.id];
  assert.equal(after.orders, before.orders);
  assert.ok(after.target.white + after.target.blue < before.target.white + before.target.blue);
  assert.ok(payroll > after.orders);
  const rolePayroll = { white: 0, blue: 0 };
  for (let i = 0; i < city.citizens.count; i++) if (city.citizens.employer[i] === c.id)
    rolePayroll[city.citizens.role[i] === 1 ? "white" : "blue"] += city.citizens.salary[i];
  const wages = Object.fromEntries((["white", "blue"] as const).map(role => [role,
    (c.workers[role] ? rolePayroll[role] / c.workers[role] : c.wages[role]) *
      (1 + city.config.policy.pensionContributionRate / 2),
  ])) as Record<"white" | "blue", number>;
  const targetPayroll = after.continuousTarget.white * wages.white + after.continuousTarget.blue * wages.blue;
  const budget = Math.max(0, after.orders * (1 - city.config.policy.intermediateShare) -
    c.initialWorkers.white * city.config.policy.baseServiceFee.white -
    c.initialWorkers.blue * city.config.policy.baseServiceFee.blue);
  const calibratedBudget = budget * c.initialPayroll / c.initialOperatingIncome;
  assert.ok(targetPayroll <= calibratedBudget + 0.01);
  for (const role of ["white", "blue"] as const)
    assert.ok(Math.abs(after.target[role] - after.continuousTarget[role]) < 1);
});

test("whole-job allocation preserves sector/role demand across thousands of small firms", () => {
  const city = CityFactory.create(structuredClone(DEFAULT_CONFIG));
  const h = householdAccounts(city.config, city.citizens);
  const capital = h.disposableIncome - Object.values(h.spending).reduce((n, v) => n + v, 0);
  productionAccounts(city, h.spending, -1, true, capital);
  const final = planDemand(city, h.spending, capital).final;
  const plans = planStaffing(city, final, 0);
  let continuous = 0;
  for (const sector of city.config.sectors) for (const role of ["white", "blue"] as const) {
    const sectorPlans = city.companies.filter(c => c.sector === sector.id).map(c => plans[c.id]);
    const raw = sectorPlans.reduce((n, p) => n + p.continuousTarget[role], 0);
    const rounded = sectorPlans.reduce((n, p) => n + p.target[role], 0);
    assert.equal(rounded, Math.round(raw));
    continuous += raw;
  }
  const initial = city.companies.reduce((n, c) => n + c.initialWorkers.white + c.initialWorkers.blue, 0);
  assert.ok(Math.abs(continuous - initial / (1 + city.config.policy.productivityGrowth)) < 0.01);
  assert.ok(Math.abs(total(plans) - continuous) <= city.config.sectors.length);
});

test("matching remains limited by job seekers when supported vacancies are abundant", () => {
  const { city } = fixture();
  city.config.policy.matchingRate = 0.6;
  city.config.policy.demandAdjustment = 0;
  for (const c of city.companies) c.profit = 1;
  city.config.policy.governmentPerResident *= 100;
  const available = { white: 0, blue: 0 };
  for (let i = 0; i < city.citizens.count; i++)
    if (city.citizens.role[i] && city.citizens.employer[i] < 0)
      available[city.citizens.role[i] === 1 ? "white" : "blue"]++;
  const labor = transitionLabor(city, { year: 2026, white: 0, blue: 0 }, 0);
  for (const role of ["white", "blue"] as const) {
    const remaining = city.companies.reduce((sum, c) => sum + c.vacancies[role], 0);
    const offered = remaining + labor.hires[role];
    assert.equal(labor.hires[role], matchWorkers(available[role], offered, 0.6));
    assert.ok(labor.hires[role] > Math.round(available[role] * 0.6));
    assert.ok(labor.hires[role] <= available[role]);
  }
});

test("abundant candidates fill most supported openings while hard role boundaries remain", () => {
  const { city } = fixture();
  city.config.policy.matchingRate = 0.6;
  city.config.policy.demandAdjustment = 0;
  for (const c of city.companies) c.profit = 1;
  // Create a white-collar surplus without authorizing any blue-collar candidates.
  // Supported openings still come from the ordinary staffing plan.
  const p = city.citizens;
  for (let i = 0; i < p.count; i++)
    if (p.role[i] !== 0 && p.employer[i] < 0) p.role[i] = 1;
  const labor = transitionLabor(city, { year: 2026, white: 0.1, blue: 0 }, 0);
  const remaining = city.companies.reduce((n, c) => n + c.vacancies.white, 0);
  const openings = remaining + labor.hires.white;
  assert.ok(openings > 0);
  assert.ok(labor.hires.white / openings > 0.6, "candidate surplus improves filling versus the fixed quota");
  assert.equal(labor.hires.blue, 0, "white-collar candidates cannot fill blue-collar openings");
});
