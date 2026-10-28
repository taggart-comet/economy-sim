import type { City, DemographicProfile } from "../types";

/** Read-only census of actual citizen records, including residents outside the labor force. */
export function demographicProfile({ citizens: p, config }: City): DemographicProfile {
  const ageGroups = Array.from({ length: 18 }, (_, i) => ({
    label: i === 17 ? "85+" : `${i * 5}–${i * 5 + 4}`,
    minAge: i * 5,
    maxAge: i === 17 ? null : i * 5 + 4,
    residents: 0, employed: 0, unemployed: 0, inactive: 0,
  }));
  let upcomingEntrants = 0, upcomingExits = 0;
  for (let i = 0; i < p.count; i++) {
    const age = p.age[i], active = p.role[i] !== 0;
    const group = ageGroups[Math.min(17, Math.floor(age / 5))];
    group.residents++;
    if (!active) group.inactive++;
    else if (p.employer[i] >= 0) group.employed++;
    else group.unemployed++;
    if (!active && !p.retired[i] && age < config.workforceEntryAge &&
        age + config.years >= config.workforceEntryAge) upcomingEntrants++;
    if (active && age < config.retirementAge &&
        age + config.years >= config.retirementAge) upcomingExits++;
  }
  return { ageGroups, horizonYears: config.years, upcomingEntrants, upcomingExits };
}

/** Synthetic age cohorts; population and citizen IDs remain fixed. */
export function transitionDemographics({ citizens: p, companies, config }: City) {
  let workforceEntrants = 0, employedExits = 0, unemployedExits = 0;
  // Entrants' broad occupation mix follows the city's initial jobs, rather than
  // the unrelated role mix of its initial unemployment stock. No jobs are promised.
  const initialWhite = companies.reduce((n, c) => n + c.initialWorkers.white, 0);
  const initialJobs = companies.reduce((n, c) => n + c.initialWorkers.white + c.initialWorkers.blue, 0);
  const whiteShare = initialJobs ? initialWhite / initialJobs : config.unemployedWhiteShare;
  for (let i = 0; i < p.count; i++) {
    p.age[i]++;
    if (p.role[i] !== 0 && p.age[i] >= config.retirementAge) {
      const role = p.role[i] === 1 ? "white" : "blue";
      const employer = p.employer[i];
      if (employer >= 0) {
        const c = companies[employer];
        c.workers[role]--;
        if (p.ownerCompany[i] === employer) c.shareholders[role]--;
        p.lastEmployer[i] = employer;
        employedExits++;
      } else unemployedExits++;
      p.role[i] = 0;
      p.pension[i] = p.referenceSalary[i] * config.policy.pensionReplacementRate;
      p.retired[i] = 1;
      p.employer[i] = -1;
      p.salary[i] = 0;
      p.unemployedYears[i] = 0;
      p.spendingProfile[i] = 0;
      p.laborForce--;
    } else if (p.role[i] === 0 && !p.retired[i] && p.age[i] === config.workforceEntryAge) {
      // Stable dispersed role mix, independent of company ordering and policy changes.
      const fraction = ((Math.imul(i + 1, 2654435761) + config.seed) >>> 0) / 4294967296;
      p.role[i] = fraction < whiteShare ? 1 : 2;
      p.spendingProfile[i] = 3;
      p.laborForce++;
      workforceEntrants++;
    }
  }
  return { workforceEntrants, workforceExits: employedExits + unemployedExits,
    employedExits, unemployedExits };
}
