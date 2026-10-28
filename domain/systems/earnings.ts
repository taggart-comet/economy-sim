import type { City } from "../types";

/** Ordinary trend productivity shares gains with wages, independently of job automation. */
export function growWages({ config, companies, citizens: p }: City) {
  const factor = 1 + config.policy.productivityGrowth * config.policy.productivityWageShare;
  for (const c of companies) {
    c.wages.white *= factor;
    c.wages.blue *= factor;
  }
  for (let i = 0; i < p.count; i++) if (p.employer[i] >= 0 && p.salary[i] > 0) {
    p.salary[i] *= factor;
    p.referenceSalary[i] = p.salary[i];
  }
}
