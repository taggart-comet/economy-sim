import type { City, Spending } from "../types";
import { CATEGORIES } from "./households";

/** Funded orders before capacity limits: shared by staffing and production. */
export function planDemand(city: City, spending: Spending, availableCapital: number, initialize = false) {
  const { config } = city, ss = config.sectors, policy = config.policy;
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
  return { final, government, investment, consumptionTotal, demandBlockedInvestment };
}

/** Supplier orders conserve the same input-output relationships as realized production. */
export function supplierDemand(city: City, final: Record<string, number>) {
  const { config } = city;
  let gross = { ...final };
  for (let iteration = 0; iteration < 1000; iteration++) {
    const next = { ...final };
    for (const s of config.sectors)
      for (const [supplier, share] of Object.entries(s.suppliers))
        next[supplier] += gross[s.id] * config.policy.intermediateShare * share;
    const residual = config.sectors.reduce((sum, s) => sum + Math.abs(next[s.id] - gross[s.id]), 0);
    gross = next;
    if (residual < 0.0001) return gross;
  }
  throw new Error("Supplier network did not converge");
}

/** Expected orders use established size; delivered sales also reflect available capacity. */
export function demandShares(city: City, final: Record<string, number>, delivered = false) {
  const weights = city.companies.map(c => {
    if (c.closed) return 0;
    const size = c.initialWorkers.white + c.initialWorkers.blue;
    const initial = city.initialFinalDemand[c.sector];
    const pressure = initial > 0 ? Math.max(0, 1 - final[c.sector] / initial) : 0;
    const capacity = c.workers.white + c.workers.blue +
      c.automated.white * city.config.policy.automationEfficiency.white +
      c.automated.blue * city.config.policy.automationEfficiency.blue;
    return (delivered ? capacity : size) * Math.pow(Math.max(1, size), pressure * 2);
  });
  const totals = Object.fromEntries(city.config.sectors.map(s => [s.id, 0]));
  city.companies.forEach(c => { totals[c.sector] += weights[c.id]; });
  for (const s of city.config.sectors) if (!totals[s.id]) {
    const survivor = city.companies.find(c => c.sector === s.id && !c.closed);
    if (survivor) { weights[survivor.id] = 1; totals[s.id] = 1; }
  }
  return city.companies.map(c => weights[c.id] / Math.max(1, totals[c.sector]));
}
