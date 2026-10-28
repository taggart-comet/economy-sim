# City / Lab

A React + TypeScript city economy simulator with a separate, deterministic domain layer. The frontend uses the Next.js App Router API on Vinext/Vite. All simulation runs locally in a Web Worker; there is no server database or external data submission.

The interface is desktop-only and requires a viewport at least 1280 CSS pixels wide. Smaller windows retain the desktop layout with horizontal scrolling; there is no separate mobile layout.

## Run

Node 22.13+ and npm:

```sh
npm ci
npm run dev
```

Open the URL printed by the server (normally http://localhost:5173). `npm run build` creates the production bundle. `npm test` runs domain invariant tests; `npm run typecheck` checks the app and model.

### Persistent local hostname (this Mac)

Open **http://ecosim.local**. The hosts entry maps `ecosim.local` to `127.0.0.2`; Caddy listens on `127.0.0.2:80` and forwards requests (including hot reload) to the development server at `127.0.0.1:5173`. Local Vite configuration allows this hostname and refuses to silently move to a different port.

The app runs as the `local.ecosim.server` LaunchAgent, starts at login, and restarts if it exits. Caddy runs as the `local.ecosim.proxy` LaunchDaemon and starts at boot; its startup script restores the dedicated loopback alias. The website is available while this Mac is awake and the user session is running.

- App service: `~/Library/LaunchAgents/local.ecosim.server.plist`
- App logs: `~/Library/Logs/ecosim/`
- Proxy service: `/Library/LaunchDaemons/local.ecosim.proxy.plist`
- Proxy configuration: `/usr/local/etc/ecosim/Caddyfile`
- Proxy log: `/var/log/ecosim-proxy.log`
- Hostname mapping: `/etc/hosts` (original saved as `/etc/hosts.before-ecosim`)

Restart the app with `launchctl kickstart -k gui/$(id -u)/local.ecosim.server`. Stop it with `launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/local.ecosim.server.plist`; start it again with `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.ecosim.server.plist`. Stop the managed app before running another development server on port 5173.

These services are machine-local, not installed automatically by cloning the repository. The app service uses the absolute project and Node runtime paths recorded in its plist; update those paths if either moves.

The simulation worker is a source dependency of the app, using Vite’s `?worker` import support. This avoids the framework’s development-time rewriting of `import.meta.url` to a filesystem URL. Development serves and transforms its current TypeScript dependencies; changes under `domain/` automatically reload the page and rerun the simulation. Production builds emit a content-hashed worker asset. There is no separate worker build command. Restart an already-running development server once after this build-configuration change. UI-only edits retain normal hot reload.

## Review the model

Start with [the model specification](docs/MODEL.md), then:

- `domain/config.ts`: population proportions, sector archetypes, spending links, policies, and source URLs.
- `domain/types.ts`: entities, configuration, and result contracts. All rates are fractions and all amounts are annual USD.
- `domain/factories/company-factory.ts`: creates companies with sector-specific headcount, roles, wages, and vacancies.
- `domain/factories/citizen-factory.ts`: creates all one million citizen records; `at()` returns a readable citizen entity.
- `domain/factories/city-factory.ts`: validates and assembles a fresh city.
- `domain/systems/demographics.ts`: independent annual aging, workforce entry, and retirement.
- `components/economy/age-distribution.tsx`: age census chart, initial cohort comparison, and cumulative workforce entry/retirement totals in the Demographics tab.
- `domain/systems/earnings.ts`: configurable sharing of ordinary productivity growth with real wages.
- `domain/systems/demand.ts`: shared funded purchasing-power and supplier-demand calculations.
- `domain/systems/staffing.ts`: demand and payroll staffing targets, apportioned across firms without losing fractional jobs to repeated rounding.
- `domain/systems/labor.ts`: automation, target-based hiring and layoffs, closure decisions, and vacancy matching.
- `domain/systems/matching.ts`: bounded matching that fills openings faster when compatible candidates are plentiful; the efficiency setting applies to equal-sized queues.
- `domain/systems/households.ts`: wages, benefits, funded pension transfers, and consumption from income and liquid savings.
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

Zero automation does not freeze unemployment. New entrants seek work, retirement changes the labor force, and matching is limited by both openings and candidates. Ordinary productivity gains also raise real wages by a configurable share. Pensions replace 40% of prior earnings by default, with a 12.4% contribution split equally between workers and employers; both contributions and pension payments enter the city budget. Household consumption can draw 4% of liquid savings annually. These are visible behavioral assumptions, with no unemployment target or guaranteed retirement replacement. See the model specification for sources, accounting, and diagnostic comparisons.

Run `npm run diagnose:labor` to print the annual unemployment flow reconciliation and compare the default baseline with disabled/full matching, fixed real wages, no pension system, no savings drawdown, and the automation shock.

Opening finances use three illustrative annual accounting periods at the starting jobs, wages, ages, and productivity. The same spending, profit/loss, debt, dividend, and investment settlement rules generate initial balances; no labor transitions or forecast policies run during those periods. The starting demand/output reference is then calibrated to those balances. Set `openingHistoryYears` to zero for the previous cash-free startup diagnostic. The history length is a modeling assumption, not observed household wealth or a guarantee of economic equilibrium. The diagnostic command also compares 0, 1, and 5 opening accounting periods. Investment funding and planned recipient sectors are explained in a collapsed section of Wealth & demand.
