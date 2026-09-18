import { simulate } from "./simulation";
import type { CityConfig, YearPolicy } from "./types";
self.onmessage = (
  event: MessageEvent<{
    config: CityConfig;
    scenario: YearPolicy[];
    requestId: number;
    baseline?: boolean;
  }>,
) => {
  try {
    const result = simulate(event.data.config, event.data.scenario);
    if (event.data.baseline)
      for (const year of [result.initial, ...result.years]) {
        year.companies = [];
        year.samples = [];
      }
    self.postMessage({ requestId: event.data.requestId, result });
  } catch (error) {
    self.postMessage({
      requestId: event.data.requestId,
      error: error instanceof Error ? error.message : "Simulation failed",
    });
  }
};
