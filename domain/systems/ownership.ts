import type { City } from "../types";

export const SHAREHOLDER_SPENDING_CAP = 500_000;
/** Qualification uses current profit or a full-automation profit ceiling at current prices.
 * Providers use 10% adoption across the initial city as their potential market. */
export function assignShareholders(city: City) {
  const { companies: cs, citizens: p, config } = city;
  const market = { white: 0, blue: 0 };
  for (const c of cs) if (!c.provider)
    for (const r of ["white", "blue"] as const)
      market[r] += c.initialWorkers[r] * config.policy.automationFee[r] * 0.1;
  const candidates = new Set<number>();
  for (const c of cs) {
    const size = c.workers.white + c.workers.blue;
    const automatedCost = c.workers.white * config.policy.automationFee.white +
      c.workers.blue * config.policy.automationFee.blue;
    const potential = c.provider
      ? c.profit + market[c.provider] * (1 - config.policy.intermediateShare)
      : c.revenue - c.intermediateCosts - c.automationCosts - automatedCost - c.payroll * 0.01;
    if (!c.closed && !c.shareholderCount && size > 50 && Math.max(c.profit, potential) > 1_000_000)
      candidates.add(c.id);
  }
  const employees = new Map<number, number[]>();
  for (let i = 0; i < p.laborForce; i++) {
    const employer = p.employer[i];
    if (candidates.has(employer) && p.ownerCompany[i] < 0) {
      const list = employees.get(employer) ?? [];
      list.push(i);
      employees.set(employer, list);
    }
  }
  for (const [id, list] of employees) {
    const c = cs[id];
    const count = Math.max(1, Math.round(list.length * 0.01));
    for (let n = 0; n < count; n++) {
      const i = list[Math.floor((n + 0.5) * list.length / count)];
      p.ownerCompany[i] = id;
      c.shareholders[p.role[i] === 1 ? "white" : "blue"]++;
      c.shareholderCount++;
    }
  }
}

/** Prior-year profits are paid once, before this year's consumption decisions. */
export function payDividends(city: City) {
  const { companies: cs, citizens: p } = city;
  p.dividends.fill(0);
  const payments = cs.map((c) => c.shareholderCount ? Math.min(c.dividend, c.retainedCapital) : 0);
  for (const c of cs) {
    c.retainedCapital -= payments[c.id];
    c.dividend = 0;
  }
  for (let i = 0; i < p.laborForce; i++) {
    const id = p.ownerCompany[i];
    if (id >= 0) p.dividends[i] = payments[id] / cs[id].shareholderCount;
  }
}

export function wealthAccounts(city: City) {
  const { companies: cs, citizens: p } = city;
  const values = new Float64Array(p.laborForce);
  let total = 0, ownerWealth = 0, shareholders = 0, dividends = 0;
  let idleCapital = cs.reduce((sum, c) => sum + c.retainedCapital, 0);
  for (let i = 0; i < p.laborForce; i++) {
    const id = p.ownerCompany[i];
    const equity = id < 0 ? 0 : Math.max(0, cs[id].retainedCapital + cs[id].investedCapital - cs[id].operatingDebt) / cs[id].shareholderCount;
    values[i] = p.wealth[i] + p.investedWealth[i] + equity;
    total += values[i];
    idleCapital += p.wealth[i];
    dividends += p.dividends[i];
    if (id >= 0) { shareholders++; ownerWealth += values[i]; }
  }
  values.sort();
  let cumulative = 0, weighted = 0, top = 0;
  const lorenz = [{ population: 0, wealth: 0 }];
  const topCount = Math.max(1, Math.ceil(p.laborForce * 0.01));
  for (let i = 0; i < values.length; i++) {
    cumulative += values[i];
    weighted += (i + 1) * values[i];
    if (i >= values.length - topCount) top += values[i];
    if (Math.floor((i + 1) * 100 / values.length) > Math.floor(i * 100 / values.length))
      lorenz.push({ population: (i + 1) / values.length, wealth: total ? (i === values.length - 1 ? 1 : Math.min(1, cumulative / total)) : (i + 1) / values.length });
  }
  return {
    shareholders, dividends, householdWealth: total, idleCapital, lorenz,
    wealthGini: total ? Math.max(0, Math.min(1, 2 * weighted / (values.length * total) - (values.length + 1) / values.length)) : 0,
    topOnePercentWealthShare: total ? top / total : 0,
    shareholderWealthShare: total ? ownerWealth / total : 0,
  };
}
