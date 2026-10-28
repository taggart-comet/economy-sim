# City / Lab

**Your salary is somebody else’s revenue.**

When a company replaces workers with AI or robotics, its payroll falls. When thousands of companies do the same, the people they let go spend less. Other businesses lose customers, cut staff, and pass the shock further through the economy.

City / Lab is an interactive city economy simulator built to explore that feedback loop. A million residents and thousands of businesses share one connected economy, with wages, household spending, suppliers, taxes, pensions, and automation providers collecting their fees.

**What happens when saving money at each company means less money flowing through the city?**

## What you can explore

Set annual white- and blue-collar automation layoffs, adjust unemployment benefits and job matching, and follow the effects over five, seven, or ten years.

- **Jobs and spending:** See how direct automation layoffs spread through customer demand, suppliers, staffing decisions, and business closures.
- **Public finances:** Track the annual budget balance as a share of GDP as tax receipts and public commitments change.
- **Output and automation revenue:** Compare production and GDP with employment, and see how much AI and robotics providers earn.
- **Wealth and demand:** Inspect savings, dividends, ownership, inequality, and capital left unused when investment opportunities shrink.
- **Demographics:** Follow workforce entry, retirement, and the city’s changing age distribution.

Every scenario includes a comparison with no automation layoffs under the same model settings. GDP can remain resilient while employment and public finances deteriorate: benefits, pensions, and savings can sustain spending even as wages fall.

## Try a scenario

1. Start with the default **Normal** layoff preset, or open the scenario menu to choose **AI Projection** and edit its annual rates.
2. Select a year and adjust white- and blue-collar layoffs. Rates apply to that year’s remaining eligible employees, so repeated cuts compound.
3. Follow the budget and unemployment charts, then inspect industry effects, household income, wealth, and demographics.
4. Change benefits or matching efficiency to explore how those assumptions affect the outcome. Use **Reset to no layoffs** for a fresh scenario with default model settings and your selected duration.

Both presets are illustrative assumptions. “AI Projection” is a stress scenario, not an empirical forecast. The no-automation comparison still includes productivity growth, hiring, workforce entry, and retirement; employment can change without automation.

## Run locally

Requires **Node.js 22.13+** and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by the development server, normally [localhost:5173](http://localhost:5173). The interface is designed for desktop viewports at least **1280 CSS pixels** wide; smaller windows use horizontal scrolling.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create the production bundle |
| `npm test` | Run simulation and build integration tests |
| `npm run typecheck` | Check TypeScript across the app and model |
| `npm run diagnose:labor` | Compare labor flows and model sensitivities |

## How the model works

The city begins in 2026 with **1,000,000 residents**, **18,722 companies**, and **15 sectors**. Its starting assumptions are US-inspired; it does not represent a particular municipality. Monetary results use constant 2026 US dollars.

Residents keep their identities throughout a run. Each year, they age, enter or leave the workforce, earn income, and spend from income and available savings. Companies automate jobs, assess funded demand, hire or lay off workers, and settle their accounts. Purchases flow through local suppliers, while taxes and pension contributions fund part of the city’s spending and transfers.

Opening savings, company cash, and operating debt come from three illustrative accounting periods at the starting jobs, wages, ages, and productivity. These balances are synthetic, not observed wealth or evidence that the city begins in equilibrium.

The simulation is deterministic: the same configuration and seed produce the same results. Every edit starts a fresh run, and changing a later year cannot alter earlier results.

### Scope and limits

This is a simplified, closed economy for examining assumptions and their consequences. It cannot identify the percentage of layoffs at which a real economy would collapse.

Prices and population stay fixed. The model omits international trade, new firms, retraining, migration, births and deaths, interest, and financial-market clearing. Public commitments continue to be funded without borrowing limits or interest costs, allowing transfers to support demand while deficits accumulate. Sector structures, behavioral rules, demographics, and opening finances are synthetic assumptions, with selected public data used as benchmarks.

Read the [model specification](docs/MODEL.md) for accounting rules, sources, calibration diagnostics, and limitations. The app’s **Model & sources** tab provides an accessible overview.

## Code and development

The interface uses **React and TypeScript**, with the Next.js App Router API on **Vinext/Vite**. A separate domain layer runs the simulation locally in a **Web Worker**; simulation data is not submitted to an external service and requires no server database.

| Location | Responsibility |
| --- | --- |
| [`app/page.tsx`](app/page.tsx) | Scenario controls and dashboard |
| [`components/economy/`](components/economy/) | Charts, presets, and worker integration |
| [`domain/config.ts`](domain/config.ts) | Defaults, sector assumptions, policies, and source URLs |
| [`domain/types.ts`](domain/types.ts) | Entities, configuration, and result contracts |
| [`domain/factories/`](domain/factories/) | Initial companies, residents, and city state |
| [`domain/systems/`](domain/systems/) | Demographics, earnings, demand, staffing, matching, households, and production |
| [`domain/simulation.ts`](domain/simulation.ts) | Annual transitions and result snapshots |
| [`domain/__tests__/`](domain/__tests__/) | Accounting, conservation, determinism, and behavioral checks |

Use the domain model independently of the interface:

```ts
import { DEFAULT_CONFIG, DEFAULT_SCENARIO } from "./domain/config";
import { simulate } from "./domain/simulation";

const result = simulate(DEFAULT_CONFIG, DEFAULT_SCENARIO);
console.log(result.years[0].gdp);
```

Domain rates are fractions; monetary amounts are annual USD unless documented as balance-sheet stocks. Resident records use typed-array columns, with `CitizenFactory.at(population, id)` available to inspect an individual as a readable object.

The worker is imported through Vite’s `?worker` support. Domain changes reload the page and rerun the simulation during development; production builds emit a content-hashed worker asset. No separate worker build is needed.

For deeper checks, `npm run diagnose:labor` reconciles annual unemployment flows and compares matching, wage growth, pensions, savings drawdowns, automation, and opening financial history.

<details>
<summary>Machine-specific setup: ecosim.local on the original development Mac</summary>

The original development Mac serves the app at [ecosim.local](http://ecosim.local). These services are configured on that machine and are not installed by cloning this repository.

A hosts entry maps `ecosim.local` to `127.0.0.2`. Caddy listens on port 80 at that address and forwards requests, including hot reload, to `127.0.0.1:5173`. The local Vite configuration allows this hostname and requires its configured port to be available.

| Service | Configuration | Logs |
| --- | --- | --- |
| App, starts at login | `~/Library/LaunchAgents/local.ecosim.server.plist` | `~/Library/Logs/ecosim/` |
| Caddy proxy, starts at boot | `/Library/LaunchDaemons/local.ecosim.proxy.plist` and `/usr/local/etc/ecosim/Caddyfile` | `/var/log/ecosim-proxy.log` |

The proxy startup script restores the dedicated loopback alias. The original hosts file is saved at `/etc/hosts.before-ecosim`. The app is available while the Mac is awake and its user session is running. The app service records absolute project and Node runtime paths; update its plist if either moves.

Restart the app:

```sh
launchctl kickstart -k gui/$(id -u)/local.ecosim.server
```

Stop the managed app before starting another development server on port 5173:

```sh
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/local.ecosim.server.plist
```

Start it again:

```sh
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.ecosim.server.plist
```

</details>
