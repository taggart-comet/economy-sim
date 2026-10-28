import type { City, Pair } from "../types";
import { demandShares, supplierDemand } from "./demand";
import { roundCounts } from "../math";
const ROLES = ["white", "blue"] as const;

/** One funded demand estimate determines expansion, contraction and closure eligibility. */
export function planStaffing(city: City, final: Record<string, number>, yearIndex: number) {
  const { companies: cs, config, citizens: p } = city;
  const gross = supplierDemand(city, final), shares = demandShares(city, final);
  const productivity = Math.pow(1 + config.policy.productivityGrowth, yearIndex + 1);
  const contracts: Pair = { white: 0, blue: 0 };
  for (const c of cs) if (!c.closed && !c.provider)
    for (const role of ROLES)
      contracts[role] += c.automated[role] * config.policy.automationFee[role] +
        c.initialWorkers[role] * config.policy.baseServiceFee[role];
  const payroll = cs.map(() => ({ white: 0, blue: 0 }));
  for (let i = 0; i < p.count; i++) if (p.employer[i] >= 0)
    payroll[p.employer[i]][p.role[i] === 1 ? "white" : "blue"] +=
      p.salary[i] * (1 + config.policy.pensionContributionRate / 2);

  const plans = cs.map(c => {
    const initial = c.initialWorkers.white + c.initialWorkers.blue;
    const ordinaryOrders = gross[c.sector] * shares[c.id];
    const serviceOrders = c.provider && !c.closed ? contracts[c.provider] : 0;
    const orders = ordinaryOrders + serviceOrders;
    // Calibrate output per worker from starting sales, including providers' service
    // contracts. Every firm uses the same rule; productivity reduces labor needs.
    const requiredCapacity = c.initialRevenue > 0
      ? initial * orders / c.initialRevenue / productivity : 0;
    const sector = config.sectors.find(s => s.id === c.sector)!;
    const whiteShare = initial > 0 ? c.initialWorkers.white / initial : sector.whiteShare;
    const target: Pair = { white: 0, blue: 0 };
    let serviceCosts = 0;
    for (const role of ROLES) {
      const share = role === "white" ? whiteShare : 1 - whiteShare;
      target[role] = Math.max(0, requiredCapacity * share -
        c.automated[role] * config.policy.automationEfficiency[role]);
      serviceCosts += c.automated[role] * config.policy.automationFee[role] +
        (c.provider || c.closed ? 0 : c.initialWorkers[role] * config.policy.baseServiceFee[role]);
    }
    const operatingIncome = Math.max(0, ordinaryOrders * (1 - config.policy.intermediateShare) + serviceOrders - serviceCosts);
    // Synthetic employment and expenditure shares are independently configured.
    // Anchor payroll coverage to the initial city, just like output per worker:
    // unchanged orders/wages must support the initial workforce, even where the
    // synthetic accounts start at a loss. This is a relative staffing budget,
    // not extra revenue or financing; actual profits/debt are settled unchanged.
    const wageBudget = c.initialOperatingIncome > 0
      ? operatingIncome * c.initialPayroll / c.initialOperatingIncome : 0;
    const wages = Object.fromEntries(ROLES.map(role => [role,
      c.workers[role] > 0 ? payroll[c.id][role] / c.workers[role]
        : c.wages[role] * (1 + config.policy.pensionContributionRate / 2),
    ])) as Pair;
    const plannedPayroll = ROLES.reduce((sum, role) => sum + target[role] * wages[role], 0);
    // A staffing ceiling, not a guarantee that all orders will be fulfilled this year.
    const affordable = plannedPayroll > 0 ? Math.min(1, wageBudget / plannedPayroll) : 1;
    for (const role of ROLES)
      target[role] = c.closed ? 0 : Math.max(c.shareholders[role], target[role] * affordable);
    const effectiveCapacity = c.workers.white + c.workers.blue +
      c.automated.white * config.policy.automationEfficiency.white +
      c.automated.blue * config.policy.automationEfficiency.blue;
    return { target, continuousTarget: { ...target }, orders, requiredCapacity, effectiveCapacity,
      projectedProfit: ordinaryOrders * (1 - config.policy.intermediateShare) + serviceOrders -
        serviceCosts - payroll[c.id].white - payroll[c.id].blue };
  });
  // Independent floors discard almost one job per firm/role. Apportion each sector's
  // fractional demand instead, after the payroll constraint, retaining owner floors.
  // Whole jobs can exceed an individual firm's continuous budget by <1 wage per role;
  // the sector/role total differs from its continuous target by at most half a job.
  for (const sector of config.sectors) {
    const firms = cs.filter(c => c.sector === sector.id && !c.closed);
    for (const role of ROLES) {
      const counts = roundCounts(firms.map(c => plans[c.id].target[role] - c.shareholders[role]));
      firms.forEach((c, i) => { plans[c.id].target[role] = counts[i] + c.shareholders[role]; });
    }
  }
  return plans;
}
