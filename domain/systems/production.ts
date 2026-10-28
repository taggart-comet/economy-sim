import type { City, Spending } from "../types";
import { planDemand, supplierDemand, demandShares } from "./demand";
import { CATEGORIES } from "./households";
/** Final demand drives local production. Internal procurement is explicitly double-entry:
 * every buyer expense is a supplier receipt, so only final deliveries enter GDP. */
export function productionAccounts(
  city: City,
  spending: Spending,
  yearIndex: number,
  initialize = false,
  availableCapital = Infinity,
) {
  const { config, companies: cs } = city,
    ss = config.sectors,
    policy = config.policy;
  const { final, government, investment, consumptionTotal, demandBlockedInvestment } =
    planDemand(city, spending, availableCapital, initialize);
  const baseWeights = Object.fromEntries(
    ss.map((s) => [
      s.id,
      cs
        .filter((c) => c.sector === s.id)
        .reduce(
          (n, c) => n + c.initialWorkers.white + c.initialWorkers.blue,
          0,
        ),
    ]),
  );
  const capacities = Object.fromEntries(ss.map((s) => [s.id, 0]));
  for (const c of cs) {
    if (c.closed) continue;
    const initial = c.initialWorkers.white + c.initialWorkers.blue;
    const equivalent =
      c.workers.white +
      c.workers.blue +
      c.automated.white * policy.automationEfficiency.white +
      c.automated.blue * policy.automationEfficiency.blue;
    capacities[c.sector] += initialize ? initial : equivalent;
  }
  if (initialize) city.initialFinalDemand = { ...final };
  const delivered: Record<string, number> = {},
    ratios: Record<string, number> = {};
  for (const s of ss) {
    const capacity = initialize
      ? final[s.id]
      : (city.initialFinalDemand[s.id] || 0) *
        (capacities[s.id] / Math.max(1, baseWeights[s.id])) *
        Math.pow(1 + policy.productivityGrowth, yearIndex + 1);
    delivered[s.id] = Math.min(final[s.id], capacity);
    ratios[s.id] = final[s.id] > 0 ? delivered[s.id] / final[s.id] : 1;
  }
  const realizedSpending = { ...spending };
  for (const category of CATEGORIES)
    realizedSpending[category] *= Object.entries(
      config.consumptionLinks[category],
    ).reduce((n, [id, share]) => n + share * ratios[id], 0);
  const consumption = Object.values(realizedSpending).reduce(
    (a, b) => a + b,
    0,
  );
  const governmentPurchases = Object.entries(government).reduce(
    (n, [id, v]) => n + v * ratios[id],
    0,
  );
  const realizedInvestment = Object.entries(investment).reduce(
    (n, [id, v]) => n + v * ratios[id],
    0,
  );
  const gross = supplierDemand(city, delivered);
  const shares = demandShares(city, final, !initialize);
  const automationRevenue = { white: 0, blue: 0 };
  const baseServiceRevenue = { white: 0, blue: 0 };
  for (const c of cs) {
    for (const r of ["white", "blue"] as const)
      automationRevenue[r] += c.automated[r] * policy.automationFee[r];
  }
  for (const c of cs)
    if (!c.provider && !c.closed)
      for (const r of ["white", "blue"] as const)
        baseServiceRevenue[r] += c.initialWorkers[r] * policy.baseServiceFee[r];
  // Wages use individual earnings (fixed skill/experience factor) rather than a headcount proxy.
  for (const c of cs) c.payroll = 0;
  const p = city.citizens;
  for (let i = 0; i < p.count; i++)
    if (p.employer[i] >= 0) cs[p.employer[i]].payroll +=
      p.salary[i] * (1 + policy.pensionContributionRate / 2);
  for (const c of cs) {
    c.previousRevenue = c.revenue;
    const weight = shares[c.id];
    c.revenue =
      gross[c.sector] * weight +
      (c.provider
        ? automationRevenue[c.provider] + baseServiceRevenue[c.provider]
        : 0);
    c.intermediateCosts = gross[c.sector] * weight * policy.intermediateShare;
    c.automationCosts =
      c.automated.white * policy.automationFee.white +
      c.automated.blue * policy.automationFee.blue +
      (c.provider || c.closed
        ? 0
        : c.initialWorkers.white * policy.baseServiceFee.white +
          c.initialWorkers.blue * policy.baseServiceFee.blue);
    c.profit = c.revenue - c.intermediateCosts - c.automationCosts - c.payroll;
    if (initialize) {
      c.expectedOrders = c.revenue;
      c.initialRevenue = c.revenue;
      c.initialPayroll = c.payroll;
      c.initialOperatingIncome = c.revenue - c.intermediateCosts - c.automationCosts;
      c.previousRevenue = c.revenue;
    }
  }
  return {
    gdp: consumption + governmentPurchases + realizedInvestment,
    spending: realizedSpending,
    plannedConsumption: consumptionTotal,
    consumption,
    unmetDemand: consumptionTotal - consumption,
    governmentPurchases,
    investment: realizedInvestment,
    automationRevenue,
    demandBlockedInvestment,
  };
}
