import type { City, Spending } from "../types";
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
  const final = Object.fromEntries(ss.map((s) => [s.id, 0]));
  for (const category of CATEGORIES)
    for (const [id, share] of Object.entries(config.consumptionLinks[category]))
      final[id] += spending[category] * share;
  const consumptionTotal = Object.values(spending).reduce((a, b) => a + b, 0);
  const plannedGovernment = config.population * policy.governmentPerResident;
  const initialConsumption = Object.values(city.initialSpending).reduce((a, b) => a + b, 0);
  const demandRatio = initialConsumption > 0 ? Math.min(1, consumptionTotal / initialConsumption) : 0;
  const normalOpportunity = initialConsumption * policy.investmentShare;
  const investmentOpportunity = consumptionTotal * policy.investmentShare * demandRatio;
  const plannedInvestment = Math.min(availableCapital, investmentOpportunity);
  const demandBlockedInvestment = initialize ? 0 : Math.max(0,
    Math.min(availableCapital, normalOpportunity) - plannedInvestment);
  // Government purchases are distinct from benefits and support the city's education/health services.
  const government = Object.fromEntries(
    Object.entries(config.governmentLinks).map(([id, share]) => [
      id,
      plannedGovernment * share,
    ]),
  );
  const investment = Object.fromEntries(
    Object.entries(config.investmentLinks).map(([id, share]) => [
      id,
      plannedInvestment * share,
    ]),
  );
  for (const [id, value] of Object.entries(government)) final[id] += value;
  for (const [id, value] of Object.entries(investment)) final[id] += value;
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
  // Solve a bounded input-output network. Coefficients sum to <1; the fixed point converges.
  let gross = { ...delivered };
  for (let iteration = 0; iteration < 1000; iteration++) {
    const next = { ...delivered };
    for (const s of ss)
      for (const [supplier, share] of Object.entries(s.suppliers))
        next[supplier] += gross[s.id] * policy.intermediateShare * share;
    const residual = ss.reduce(
      (sum, s) => sum + Math.abs(next[s.id] - gross[s.id]),
      0,
    );
    gross = next;
    if (residual < 0.0001) break;
    if (iteration === 999) throw new Error("Supplier network did not converge");
  }
  // Larger survivors gain market share when final demand contracts. Closed firms receive none.
  const companyWeights = cs.map((c) => {
    if (c.closed) return 0;
    const initialSize = c.initialWorkers.white + c.initialWorkers.blue;
    const pressure = initialize || !city.initialFinalDemand[c.sector] ? 0 :
      Math.max(0, 1 - final[c.sector] / city.initialFinalDemand[c.sector]);
    const effective = c.workers.white + c.workers.blue +
      c.automated.white * policy.automationEfficiency.white +
      c.automated.blue * policy.automationEfficiency.blue;
    return (initialize ? initialSize : effective) * Math.pow(Math.max(1, initialSize), pressure * 2);
  });
  const weightTotals = Object.fromEntries(ss.map((s) => [s.id, 0]));
  cs.forEach((c) => { weightTotals[c.sector] += companyWeights[c.id]; });
  // An automated firm can have no human employees; if all capacity is gone,
  // leave one surviving supplier's intermediate receipts explicit rather than losing money.
  for (const s of ss) if (!weightTotals[s.id]) {
    const survivor = cs.find((c) => c.sector === s.id && !c.closed);
    if (survivor) { companyWeights[survivor.id] = 1; weightTotals[s.id] = 1; }
  }
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
  for (let i = 0; i < p.laborForce; i++)
    if (p.employer[i] >= 0) cs[p.employer[i]].payroll += p.salary[i];
  for (const c of cs) {
    c.previousRevenue = c.revenue;
    const weight = companyWeights[c.id] / Math.max(1, weightTotals[c.sector]);
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
      c.initialRevenue = c.revenue;
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
