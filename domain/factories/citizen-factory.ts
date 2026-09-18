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
      role: new Uint8Array(n),
      employer: new Int32Array(n).fill(-1),
      lastEmployer: new Int32Array(n).fill(-1),
      salary: new Float64Array(n),
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
          p.spendingProfile[id] = p.role[id];
          id++;
        }
    const unemployed = laborForce - id,
      white = Math.round(unemployed * config.unemployedWhiteShare);
    for (let j = 0; j < unemployed; j++, id++) {
      p.role[id] = j < white ? 1 : 2;
      p.spendingProfile[id] = 3;
      p.incomeFactor[id] = 0.8 + rng() * 0.4;
    }
    return p;
  }
  static at(p: CitizenPopulation, id: number): Citizen {
    if (!Number.isInteger(id) || id < 0 || id >= p.count)
      throw new Error("Unknown citizen");
    return this.create(id, {
      role:
        p.role[id] === 1 ? "white" : p.role[id] === 2 ? "blue" : "dependent",
      employerId: p.employer[id] < 0 ? null : p.employer[id],
      lastEmployerId: p.lastEmployer[id] < 0 ? null : p.lastEmployer[id],
      annualSalary: p.salary[id],
      unemployedYears: p.unemployedYears[id],
      spendingProfile: p.spendingProfile[id],
    });
  }
}
