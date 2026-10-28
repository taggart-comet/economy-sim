import type { City, Pair, Role, YearPolicy } from "../types";
import { assignShareholders, payDividends } from "./ownership";
import { householdAccounts } from "./households";
import { planDemand } from "./demand";
import { planStaffing } from "./staffing";
import { matchWorkers } from "./matching";
import { allocate } from "../math";
const ROLES: Role[] = ["white", "blue"];
export function transitionLabor(
  city: City,
  policy: YearPolicy,
  yearIndex: number,
) {
  assignShareholders(city);
  payDividends(city);
  const { companies: cs, citizens: p, config } = city,
    eligible: Pair = { white: 0, blue: 0 },
    layoffs: Pair = { white: 0, blue: 0 },
    hires: Pair = { white: 0, blue: 0 };
  const automation = [new Int32Array(cs.length), new Int32Array(cs.length)];
  const sectorLayoffs = Object.fromEntries(config.sectors.map(s =>
    [s.id, { directLayoffs: 0, demandLayoffs: 0 }]));
  let demandLayoffs = 0, closureLayoffs = 0, newClosures = 0;
  for (const role of ROLES) {
    const weights = cs.map((c) => (c.provider || c.closed ? 0 : c.workers[role] - c.shareholders[role]));
    eligible[role] = weights.reduce((a, b) => a + b, 0);
    const targets =
      eligible[role] > 0
        ? allocate(Math.round(eligible[role] * policy[role]), weights)
        : weights;
    const ri = role === "white" ? 0 : 1;
    cs.forEach((c, i) => {
      automation[ri][i] = targets[i];
    });
  }
  // Each worker is updated once. Job destruction removes their employer edge permanently.
  for (let i = 0; i < p.count; i++) {
    const id = p.employer[i];
    if (id < 0) continue;
    const ri = p.role[i] - 1,
      role = ROLES[ri],
      c = cs[id];
    if (p.ownerCompany[i] >= 0) {
      if (c.closed) p.salary[i] = 0; // Ownership persists as an unpaid proprietor.
      continue;
    }
    if (automation[ri][id] > 0) {
      automation[ri][id]--;
      c.automated[role]++;
      layoffs[role]++;
      sectorLayoffs[c.sector].directLayoffs++;
    } else continue;
    c.workers[role]--;
    p.lastEmployer[i] = id;
    p.employer[i] = -1;
    p.salary[i] = 0;
    p.spendingProfile[i] = 3;
  }
  // Freeze funded purchasing power after demographics and automation, before business
  // responses. Secondary income effects feed production now and next year's decisions.
  const h = householdAccounts(config, p);
  const planned = Object.values(h.spending).reduce((sum, value) => sum + value, 0);
  const capital = Math.max(0, h.liquidWealth + h.disposableIncome - planned +
    cs.reduce((sum, c) => sum + c.retainedCapital, 0));
  const { final } = planDemand(city, h.spending, capital);
  let plans = planStaffing(city, final, yearIndex);
  for (const sector of config.sectors) {
    const active = cs.filter(c => c.sector === sector.id && !c.closed);
    let survivors = active.length;
    let excess = Math.max(0, active.reduce((sum, c) => sum +
      plans[c.id].effectiveCapacity - plans[c.id].requiredCapacity, 0));
    const ordered = active.filter(c => !c.provider).sort((a, b) =>
      (a.initialWorkers.white + a.initialWorkers.blue) - (b.initialWorkers.white + b.initialWorkers.blue) || a.id - b.id);
    for (const c of ordered) {
      const plan = plans[c.id];
      // Persistent losses and severely reduced orders; preserve supply in every sector.
      if (survivors <= 1 || plan.effectiveCapacity <= 0 || plan.effectiveCapacity > excess ||
        c.initialRevenue <= 0 || plan.orders >= c.initialRevenue * 0.7 ||
        plan.projectedProfit >= 0 || c.profit >= 0) continue;
      c.closed = true;
      c.automated = { white: 0, blue: 0 };
      c.vacancies = { white: 0, blue: 0 };
      excess -= plan.effectiveCapacity;
      survivors--;
      newClosures++;
    }
  }
  // Reallocate the same finite orders among survivors and cancel closed-firm contracts.
  if (newClosures) plans = planStaffing(city, final, yearIndex);
  const contraction = [new Int32Array(cs.length), new Int32Array(cs.length)];
  for (const c of cs) {
    c.expectedOrders = plans[c.id].orders;
    c.desiredWorkers = { ...plans[c.id].target };
    for (const [ri, role] of ROLES.entries()) {
      const removable = c.workers[role] - c.shareholders[role];
      const surplus = Math.max(0, c.workers[role] - c.desiredWorkers[role]);
      contraction[ri][c.id] = c.closed ? removable : Math.min(removable,
        Math.floor(surplus * config.policy.demandAdjustment));
      // Openings are recalculated, never accumulated or automatically replaced at retirement.
      c.vacancies[role] = c.closed ? 0 : Math.max(0, c.desiredWorkers[role] - c.workers[role]);
    }
  }
  for (let i = 0; i < p.count; i++) {
    const id = p.employer[i];
    if (id < 0) continue;
    const c = cs[id], ri = p.role[i] - 1, role = ROLES[ri];
    if (p.ownerCompany[i] >= 0) {
      if (c.closed) p.salary[i] = 0;
      continue;
    }
    if (contraction[ri][id] <= 0) continue;
    contraction[ri][id]--;
    demandLayoffs++;
    sectorLayoffs[c.sector].demandLayoffs++;
    if (c.closed) closureLayoffs++;
    c.workers[role]--;
    p.lastEmployer[i] = id;
    p.employer[i] = -1;
    p.salary[i] = 0;
    p.spendingProfile[i] = 3;
  }
  // Matching responds to the role-specific queues: abundant candidates make
  // openings easier to fill, while scarce candidates leave more jobs unfilled.
  const vacancies = ROLES.map(role => cs.map(c => c.closed ? 0 : c.vacancies[role]));
  const available: Pair = { white: 0, blue: 0 };
  for (let i = 0; i < p.count; i++)
    if (p.role[i] !== 0 && p.employer[i] < 0) available[p.role[i] === 1 ? "white" : "blue"]++;
  const hiring = ROLES.map((r, i) => {
    const count = vacancies[i].reduce((a, b) => a + b, 0);
    return count
      ? allocate(
          matchWorkers(available[r], count, config.policy.matchingRate),
          vacancies[i],
        )
      : vacancies[i];
  });
  const cursors = [0, 0];
  // Rotate the candidate queue each year, avoiding a perpetual preference for early citizen IDs.
  const offset = (yearIndex * 104729) % p.count;
  for (let n = 0; n < p.count; n++) {
    const i = (n + offset) % p.count;
    if (p.role[i] === 0 || p.employer[i] >= 0) continue;
    const ri = p.role[i] - 1,
      role = ROLES[ri];
    while (cursors[ri] < cs.length && hiring[ri][cursors[ri]] === 0)
      cursors[ri]++;
    if (cursors[ri] === cs.length) continue;
    const c = cs[cursors[ri]];
    hiring[ri][c.id]--;
    c.workers[role]++;
    c.vacancies[role]--;
    hires[role]++;
    p.employer[i] = c.id;
    p.salary[i] = c.wages[role] * p.incomeFactor[i];
    p.referenceSalary[i] = p.salary[i];
    p.unemployedYears[i] = 0;
    p.spendingProfile[i] = p.role[i];
  }
  for (let i = 0; i < p.count; i++)
    if (p.role[i] !== 0 && p.employer[i] < 0) p.unemployedYears[i]++;
  return { eligible, layoffs, hires, demandLayoffs, closureLayoffs, newClosures, sectorLayoffs };
}
