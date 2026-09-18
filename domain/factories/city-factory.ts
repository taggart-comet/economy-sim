import type { City, CityConfig } from "../types";
import { CompanyFactory } from "./company-factory";
import { CitizenFactory } from "./citizen-factory";
import { householdAccounts } from "../systems/households";
import { validateConfig } from "../validation";
export class CityFactory {
  static create(config: CityConfig): City {
    validateConfig(config);
    const companies = CompanyFactory.createAll(config),
      citizens = CitizenFactory.createPopulation(config, companies);
    return {
      config,
      companies,
      citizens,
      initialSpending: householdAccounts(config, citizens).spending,
      initialFinalDemand: {},
    };
  }
}
