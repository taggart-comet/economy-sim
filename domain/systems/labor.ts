import type { City, Pair, Role, YearPolicy } from "../types";
import { allocate } from "../math";
const ROLES: Role[] = ["white", "blue"];
export function transitionLabor(
  city: City,
  policy: YearPolicy,
  yearIndex: number,
) {
  const { companies: cs, citizens: p, config } = city,
    eligible: Pair = { white: 0, blue: 0 },
    layoffs: Pair = { white: 0, blue: 0 },
    hires: Pair = { white: 0, blue: 0 };
  const automation = [new Int32Array(cs.length), new Int32Array(cs.length)],
    contraction = [new Int32Array(cs.length), new Int32Array(cs.length)];
  let demandLayoffs = 0;
  for (const role of ROLES) {
    const weights = cs.map((c) => (c.provider ? 0 : c.workers[role]));
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
      contraction[ri][i] = c.provider
        ? 0
        : Math.floor(
            (c.workers[role] - targets[i]) *
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
    if (automation[ri][id] > 0) {
      automation[ri][id]--;
      c.automated[role]++;
      layoffs[role]++;
    } else if (contraction[ri][id] > 0) {
      contraction[ri][id]--;
      demandLayoffs++;
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
      c.provider || c.revenue >= c.initialRevenue * 0.95
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
  return { eligible, layoffs, hires, demandLayoffs };
}
