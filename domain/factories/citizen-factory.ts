import type {
  Citizen,
  CitizenPopulation,
  CityConfig,
  Company,
  Role,
} from "../types";
import { random } from "../math";
export class CitizenFactory {
  static create(id: number, properties: Omit<Citizen, "id">): Citizen {
    return { id, ...properties };
  }
  static createPopulation(
    config: CityConfig,
    companies: Company[],
  ): CitizenPopulation {
    const n = config.population,
      laborForce = Math.round(n * config.adultShare * config.participationRate),
      rng = random(config.seed + 1);
    const p: CitizenPopulation = {
      count: n,
      laborForce,
      age: new Uint16Array(n),
      retired: new Uint8Array(n),
      role: new Uint8Array(n),
      employer: new Int32Array(n).fill(-1),
      lastEmployer: new Int32Array(n).fill(-1),
      salary: new Float64Array(n),
      referenceSalary: new Float64Array(n),
      pension: new Float64Array(n),
      ownerCompany: new Int32Array(n).fill(-1),
      dividends: new Float64Array(n),
      wealth: new Float64Array(n),
      investedWealth: new Float64Array(n),
      incomeFactor: new Float32Array(n),
      unemployedYears: new Uint8Array(n),
      spendingProfile: new Uint8Array(n),
    };
    let id = 0;
    for (const c of companies)
      for (const role of ["white", "blue"] as Role[])
        for (let j = 0; j < c.workers[role]; j++) {
          p.role[id] = role === "white" ? 1 : 2;
          p.employer[id] = c.id;
          p.lastEmployer[id] = c.id;
          p.incomeFactor[id] = 0.8 + rng() * 0.4;
          p.salary[id] = c.wages[role] * p.incomeFactor[id];
          p.referenceSalary[id] = p.salary[id];
          p.spendingProfile[id] = p.role[id];
          id++;
        }
    const unemployed = laborForce - id,
      white = Math.round(unemployed * config.unemployedWhiteShare);
    const employed = id;
    const roleJobs = { white: 0, blue: 0 }, rolePayroll = { white: 0, blue: 0 };
    for (const c of companies) for (const role of ["white", "blue"] as Role[]) {
      roleJobs[role] += c.workers[role];
      rolePayroll[role] += c.workers[role] * c.wages[role];
    }
    for (let j = 0; j < unemployed; j++, id++) {
      p.role[id] = j < white ? 1 : 2;
      p.spendingProfile[id] = 3;
      p.incomeFactor[id] = 0.8 + rng() * 0.4;
      const role = p.role[id] === 1 ? "white" : "blue";
      p.referenceSalary[id] = rolePayroll[role] / Math.max(1, roleJobs[role]) * p.incomeFactor[id];
    }
    // Separate random stream preserves existing wage calibration.
    const ages = random(config.seed + 2);
    const young = Math.min(n - laborForce, Math.round(n * (1 - config.adultShare)));
    for (let i = 0; i < n; i++) {
      p.age[i] = i < laborForce
        ? config.workforceEntryAge + Math.floor(ages() * (config.retirementAge - config.workforceEntryAge))
        : i < laborForce + young
          ? Math.floor(ages() * config.workforceEntryAge)
          : config.workforceEntryAge + Math.floor(ages() * (86 - config.workforceEntryAge));
      if (i >= laborForce) {
        p.retired[i] = Number(p.age[i] >= config.retirementAge);
        p.incomeFactor[i] = 0.8 + ages() * 0.4;
        if (p.retired[i]) {
          // Synthetic pre-simulation earnings history for existing pensioners.
          p.referenceSalary[i] = (rolePayroll.white + rolePayroll.blue) / Math.max(1, employed) * p.incomeFactor[i];
          p.pension[i] = p.referenceSalary[i] * config.policy.pensionReplacementRate;
        }
      }
    }
    return p;
  }
  static at(p: CitizenPopulation, id: number): Citizen {
    if (!Number.isInteger(id) || id < 0 || id >= p.count)
      throw new Error("Unknown citizen");
    return this.create(id, {
      age: p.age[id],
      retired: Boolean(p.retired[id]),
      role:
        p.role[id] === 1 ? "white" : p.role[id] === 2 ? "blue" : "dependent",
      employerId: p.employer[id] < 0 ? null : p.employer[id],
      lastEmployerId: p.lastEmployer[id] < 0 ? null : p.lastEmployer[id],
      annualSalary: p.salary[id],
      annualPension: p.pension[id],
      shareholderOf: p.ownerCompany[id] < 0 ? null : p.ownerCompany[id],
      wealth: p.wealth[id] + p.investedWealth[id],
      dividend: p.dividends[id],
      unemployedYears: p.unemployedYears[id],
      spendingProfile: p.spendingProfile[id],
    });
  }
}
