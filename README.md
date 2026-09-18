# City / Lab

A React + TypeScript city economy simulator with a separate, deterministic domain layer. The frontend uses the Next.js App Router API on Vinext/Vite. All simulation runs locally in a Web Worker; there is no server database or external data submission.

## Run

Node 22.13+ and npm:

```sh
npm ci
npm run dev
```

Open the URL printed by the server (normally http://localhost:5173). `npm run build` creates the production bundle. `npm test` runs domain invariant tests; `npm run typecheck` checks the app and model.

`predev` and `prebuild` bundle `domain/simulation.worker.ts` into the ignored `public/model.worker.js`. When editing domain code during an existing development session, run `node scripts/build-model.mjs` and reload the page. UI edits use normal hot reload.

## Review the model

Start with [the model specification](docs/MODEL.md), then:

- `domain/config.ts`: population proportions, sector archetypes, spending links, policies, and source URLs.
- `domain/types.ts`: entities, configuration, and result contracts. All rates are fractions and all amounts are annual USD.
- `domain/factories/company-factory.ts`: creates companies with sector-specific headcount, roles, wages, and vacancies.
- `domain/factories/citizen-factory.ts`: creates all one million citizen records; `at()` returns a readable citizen entity.
- `domain/factories/city-factory.ts`: validates and assembles a fresh city.
- `domain/systems/labor.ts`: automation layoffs, lagged demand layoffs, provider expansion, and vacancy matching.
- `domain/systems/households.ts`: wages, benefits, and changed consumption profiles.
- `domain/systems/production.ts`: local spending network, final output, provider fees, and company accounts.
- `domain/simulation.ts`: orchestrates yearly state transitions and snapshots.
- `domain/__tests__/simulation.test.ts`: conservation, accounting, provider revenue, boundary, deterministic replay, and temporal isolation checks.

```ts
import { DEFAULT_CONFIG, DEFAULT_SCENARIO } from "./domain/config";
import { simulate } from "./domain/simulation";

const result = simulate(DEFAULT_CONFIG, DEFAULT_SCENARIO);
console.log(result.years[0].gdp);
```

Citizen identities persist throughout a run. Factories create the initial population once; subsequent years evolve those entities. Re-running with new sliders starts a fresh deterministic scenario, so slider history cannot affect the result. Zero-layoff comparisons use the same policy settings and initial seed.

The default scenario is an illustrative automation shock, not a forecast. Reset sets every layoff rate to zero and restores policy defaults. Sector counts, wages, and company sizes are synthetic US-inspired assumptions; the model is not fitted to a specific US municipality. Use Model & sources in the app for the main limitations.
