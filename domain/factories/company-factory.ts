import type { CityConfig, Company, SectorConfig } from "../types";
import { allocate, random } from "../math";
export class CompanyFactory {
  static create(
    id: number,
    sector: SectorConfig,
    headcount: number,
    sizeIndex: number,
  ): Company {
    const white = Math.round(headcount * sector.whiteShare),
      workers = { white, blue: headcount - white };
    return {
      id,
      name: sector.provider
        ? sector.name
        : `${sector.name} ${String(sizeIndex + 1).padStart(4, "0")}`,
      sector: sector.id,
      provider: sector.provider,
      closed: false,
      shareholders: { white: 0, blue: 0 },
      shareholderCount: 0,
      retainedCapital: 0,
      operatingDebt: 0,
      investedCapital: 0,
      dividend: 0,
      workers: { ...workers },
      initialWorkers: { ...workers },
      vacancies: {
        white: Math.round(white * sector.vacancyRate),
        blue: Math.round(workers.blue * sector.vacancyRate),
      },
      automated: { white: 0, blue: 0 },
      wages: { ...sector.wages },
      revenue: 0,
      initialRevenue: 0,
      previousRevenue: 0,
      intermediateCosts: 0,
      automationCosts: 0,
      payroll: 0,
      profit: 0,
    };
  }
  static createAll(config: CityConfig): Company[] {
    const laborForce = Math.round(
      config.population * config.adultShare * config.participationRate,
    );
    const jobs =
      laborForce - Math.round(laborForce * config.initialUnemployment);
    const counts = allocate(
        jobs,
        config.sectors.map((s) => s.employmentShare),
      ),
      rng = random(config.seed),
      result: Company[] = [];
    config.sectors.forEach((s, i) => {
      // Mostly small firms, some medium employers, a few large establishments.
      const sizes = Array.from({ length: s.companies }, () => {
        const r = rng();
        return r < 0.7 ? 1 : r < 0.95 ? 5 : 25;
      });
      allocate(counts[i], sizes).forEach((n, j) =>
        result.push(this.create(result.length, s, n, j)),
      );
    });
    return result;
  }
}
