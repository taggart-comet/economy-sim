import type { City, Pair, Role, YearPolicy } from "../types";
import { assignShareholders, payDividends } from "./ownership";
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
  const automation = [new Int32Array(cs.length), new Int32Array(cs.length)],
    contraction = [new Int32Array(cs.length), new Int32Array(cs.length)];
  let demandLayoffs = 0, closureLayoffs = 0, newClosures = 0;
  // Observe last year's demand; retire excess capacity from the smallest firms first.
  for (const sector of config.sectors) {
    const firms = cs.filter((c) => c.sector === sector.id);
    const active = firms.filter((c) => !c.closed);
    const initialRevenue = firms.reduce((sum, c) => sum + c.initialRevenue, 0);
    const revenue = active.reduce((sum, c) => sum + c.revenue, 0);
    const originalWorkers = firms.reduce((sum, c) => sum + c.initialWorkers.white + c.initialWorkers.blue, 0);
    const effective = (c: typeof cs[number]) => c.workers.white + c.workers.blue +
      c.automated.white * config.policy.automationEfficiency.white +
      c.automated.blue * config.policy.automationEfficiency.blue;
    const required = originalWorkers * (initialRevenue > 0 ? revenue / initialRevenue : 1) /
      Math.pow(1 + config.policy.productivityGrowth, yearIndex);
    let excess = Math.max(0, active.reduce((sum, c) => sum + effective(c), 0) - required);
    const ordered = active.filter((c) => !c.provider).sort((a, b) =>
      (a.initialWorkers.white + a.initialWorkers.blue) - (b.initialWorkers.white + b.initialWorkers.blue) || a.id - b.id);
    let survivors = active.length;
    for (const c of ordered) {
      const size = effective(c);
      if (survivors <= 1 || size <= 0 || size > excess || c.initialRevenue <= 0 ||
        c.revenue >= c.initialRevenue * 0.7 || c.profit >= 0) continue;
      c.closed = true;
      survivors--;
      c.vacancies = { white: 0, blue: 0 };
      c.automated = { white: 0, blue: 0 };
      excess -= size;
      newClosures++;
    }
  }
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
      const decline =
        c.previousRevenue > 0
          ? Math.max(0, 1 - c.revenue / c.previousRevenue)
          : 0;
      contraction[ri][i] = c.closed
        ? c.workers[role] - c.shareholders[role]
        : Math.floor(
            (c.workers[role] - c.shareholders[role] - targets[i]) *
              decline *
              config.policy.demandAdjustment,
          );
    });
  }
  // Each worker is updated once. Job destruction removes their employer edge permanently.
  for (let i = 0; i < p.laborForce; i++) {
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
    } else if (contraction[ri][id] > 0) {
      contraction[ri][id]--;
      demandLayoffs++;
      if (c.closed) closureLayoffs++;
    } else continue;
    c.workers[role]--;
    p.lastEmployer[i] = id;
    p.employer[i] = -1;
    p.salary[i] = 0;
    p.spendingProfile[i] = 3;
  }
  // Provider demand expands staff capacity; automation is an ongoing annual service contract.
  const fees = { white: 0, blue: 0 };
  for (const c of cs)
    for (const r of ROLES)
      fees[r] += c.automated[r] * config.policy.automationFee[r];
  for (const c of cs) {
    if (c.closed) continue;
    if (c.provider) {
      const sector = config.sectors.find((s) => s.id === c.sector)!;
      const target = Math.floor(fees[c.provider] / 180000);
      const desired = {
        white: Math.round(target * sector.whiteShare),
        blue: target - Math.round(target * sector.whiteShare),
      };
      for (const r of ROLES)
        c.vacancies[r] = Math.max(
          c.vacancies[r],
          c.initialWorkers[r] + desired[r] - c.workers[r],
        );
    } else if (
      yearIndex > 0 &&
      c.revenue >= c.previousRevenue &&
      c.revenue >= c.initialRevenue * 0.95
    ) {
      for (const r of ROLES)
        c.vacancies[r] += Math.round(
          c.workers[r] * config.policy.productivityGrowth,
        );
    }
  }
  // Aggregate by role, then distribute exact hiring quotas. Same-role cross-sector matching.
  const vacancies = ROLES.map((role) =>
    cs.map((c) =>
      !c.closed && (c.provider || c.revenue >= c.initialRevenue * 0.95)
        ? c.vacancies[role]
        : 0,
    ),
  );
  const available: Pair = { white: 0, blue: 0 };
  for (let i = 0; i < p.laborForce; i++)
    if (p.employer[i] < 0) available[p.role[i] === 1 ? "white" : "blue"]++;
  const hiring = ROLES.map((r, i) => {
    const count = vacancies[i].reduce((a, b) => a + b, 0);
    return count
      ? allocate(
          Math.min(
            available[r],
            Math.round(count * config.policy.matchingRate),
          ),
          vacancies[i],
        )
      : vacancies[i];
  });
  const cursors = [0, 0];
  // Rotate the candidate queue each year, avoiding a perpetual preference for early citizen IDs.
  const offset = (yearIndex * 104729) % p.laborForce;
  for (let n = 0; n < p.laborForce; n++) {
    const i = (n + offset) % p.laborForce;
    if (p.employer[i] >= 0) continue;
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
    p.unemployedYears[i] = 0;
    p.spendingProfile[i] = p.role[i];
  }
  for (let i = 0; i < p.laborForce; i++)
    if (p.employer[i] < 0) p.unemployedYears[i]++;
  return { eligible, layoffs, hires, demandLayoffs, closureLayoffs, newClosures };
}
