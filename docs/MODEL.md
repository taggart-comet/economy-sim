# City model specification

## Scope and units

The city starts on January 1, 2026 with 1,000,000 residents and forecasts full years 2026–2030. Monetary values are USD, held at fixed prices labeled constant 2026 dollars. Historical category weights and rounded wages are adopted without a separate inflation adjustment. This is a scenario model, not a statistically estimated or validated prediction.

The city is closed: all consumption, investment, government service purchases, suppliers, AI, and robotics are local. Savings and borrowing are modeled as local financial balances; there is no foreign trade. Prices, population, and the labor force stay fixed. Births, migration, aging, new company formation, closures, bankruptcy, pensions, wealth, interest, and financial-market clearing are not simulated.

## Source calibration versus assumptions

| Parameter                 |       Starting value | Provenance / transformation                                                                                  |
| ------------------------- | -------------------: | ------------------------------------------------------------------------------------------------------------ |
| Population                |            1,000,000 | User requirement                                                                                             |
| Adult share               |                  80% | Rounded modeling assumption, not a Census estimate                                                           |
| Adult labor participation |                62.4% | BLS December 2025 CPS; applied to assumed adult population                                                   |
| Labor force               |              499,200 | 1,000,000 × 80% × 62.4%                                                                                      |
| Initial unemployment      |                 4.4% | BLS December 2025 CPS; integer unemployed count rounded                                                      |
| Initial employment        |              477,235 | Labor force less 21,965 unemployed                                                                           |
| Companies                 |               18,722 | Synthetic establishment-like entities across 15 sectors; not a measured national firms-per-capita ratio      |
| Initial vacancies         | 3.5% target per role | Assumption; rounded within each company, so realized citywide rate differs                                   |
| Wage scale                |    $67,920 reference | BLS May 2024 all-occupation mean; configured role wages are rounded archetypes, not direct sector estimates  |
| Spending weights          |   CE 2024 categories | Category weights normalized across modeled goods/services; pension contributions and cash transfers excluded |
| Annual benefit            |              $15,080 | Federal $7.25/hour × assumed 2,080 hours; hypothetical universal city benefit, not US unemployment insurance |

Sources:

- [BLS December 2025 employment report](https://www.bls.gov/news.release/archives/empsit_01092026.htm): unemployment and adult participation; January 9, 2026 release. This is retrospective calibration and would not have been known on January 1.
- [BLS May 2024 occupational wages](https://www.bls.gov/news.release/archives/ocwage_04022025.htm): wage scale benchmark, available in 2025.
- [BLS 2024 consumer expenditures](https://www.bls.gov/news.release/cesan.htm): grocery, food away from home, housing, transportation, healthcare, entertainment, and apparel weights. The survey measures consumer units, not individual workers. We use relative category weights only, applying them to modeled household budgets funded by earners. “Other” is a synthetic residual of $3,921, not a published category estimate.
- [US Department of Labor wage overview](https://www.dol.gov/general/topic/wages): federal minimum wage. State and local minimum wages can be higher; this model deliberately uses the federal floor.
- [BEA gross output versus value added](https://www.bea.gov/help/faq/1197): GDP excludes intermediate purchases.

Sector employment proportions follow the broad shape of US service-heavy employment, but are deliberately rounded and adjusted to create local food, manufacturing, utility, and automation capacity. Company counts, white/blue role splits, sector wages, size distributions, supplier links, and all behavioral coefficients are assumptions. Healthcare, education, and services contain both job types. “Blue-collar” includes physical service occupations; “white-collar” is not a formal BLS category here. This model should be calibrated further before any policy interpretation.

## Factories and persistent entities

`CompanyFactory.createAll(config)` allocates the exact employed population across sectors with largest remainders, then across firms using deterministic size weights. 70% of sampled size weights are 1, 25% are 5, and 5% are 25. Each company receives a sector, stable ID, role counts, role wages, vacancies, supplier relationships via its sector, and accounts. AI and robotics each have exactly one company.

`CitizenFactory.createPopulation(config, companies)` creates one record for every resident. Workers have persistent IDs, job type, employer ID, previous employer, wage, wage factor, unemployment duration, and consumption-profile ID. Wage factors are seeded values between 0.8 and 1.2 times the sector role wage. Initial unemployed workers are split 55% white-collar and 45% blue-collar, an assumption. Other residents are outside the labor force and have no separate earnings; their consumption is included in the budgets funded by labor-force members.

Records use typed-array columns to avoid allocating a million JavaScript objects and blocking the browser. `CitizenFactory.at(population, id)` materializes a normal entity for review. This is individual-level employment state, not a weighted sample. Aggregated consumption by role is mathematically equivalent to summing each individual's configured linear spending profile. Factories initialize once per scenario. Annual transitions update those records rather than replacing the population.

## Annual order of operations

1. Count employed non-provider workers at the start of the year. Round the chosen layoff rate times that eligible role count, then distribute exact company quotas using largest remainders. Provider employees are exempt from the layoff sliders.
2. Destroy the selected jobs and record persistent automated role capacity. Demand contractions separately remove 25% of the proportional employment associated with the previous year's revenue decline. This effect lags one year, avoiding circular same-year firing loops.
3. Add provider vacancies: one additional job per $180,000 of recurring automation revenue, with the configured provider role mix. Other firms can add openings at the productivity-growth rate if their revenue is recovering and at least 95% of initial revenue.
4. Fill 60% of demand-supported vacancies, limited by available unemployed people. Matching is within the white/blue job type, including across sectors. Firms below 95% of their starting revenue suspend hiring. Quotas conserve individual counts. Candidate ordering rotates each year; within-company layoffs use stable record order. No occupational credentials or retraining friction beyond the matching rate are represented.
5. Compute annual earnings and benefits using employment after hiring. Events are treated as occurring at the beginning of the year: a worker rehired immediately earns a full year of wages and receives no annual unemployment benefit. There is no monthly duration model.
6. Compute spending, production, company revenue, operating profit, tax receipts, and the city budget. Carry company, citizen, automation, vacancy, and fiscal state into the next year.

Destroyed jobs are not vacancies. Existing unfilled vacancies persist. New companies and new citizens are not created in response to layoffs; the configured city population remains fixed.

## Consumption and connections

Employed white-collar households spend 86% of their wage after a flat 20% income tax. Blue-collar households spend 94%. These propensities are assumptions. Remaining disposable income is saved; wealth accumulation is not individually tracked. Each labor-force member finances their own modeled budget plus an implicit share of dependents, so children are not assigned duplicate full household budgets.

Unemployed workers receive the configured annual benefit and spend all of it using a needs-first profile: 49% housing, 21% groceries, 10% healthcare, 9% transport, 2.5% clothing, 1.5% restaurants, 1.5% entertainment, and 5.5% other services. Their former salary does not continue. Benefits persist while unemployed, without an eligibility cutoff. These are policy assumptions.

`consumptionLinks` maps each consumption category into sectors. Sector spending is allocated among companies in proportion to initial headcount. This is an explicit weighted relationship, rather than a million separately stored household-to-shop edge lists. `suppliers` maps every company sector's ordinary procurement to other local sectors. Links have nonnegative shares summing to one.

## Production and accounting

Household budgets produce final demand. Government purchases are $6,500 per resident, split among education/civic services (55%), health (30%), and utilities (15%). Private investment is 18% of household planned spending, allocated to construction (55%), manufacturing (30%), and software (15%). These are synthetic closures, not calibrated fiscal or investment models.

For each sector, final output is capped by initial final output times its effective workforce ratio times cumulative 1.5% annual productivity growth. Effective workforce is human employment plus 100% of automated white-collar roles plus 90% of automated blue-collar roles. Demand above capacity is unfulfilled; unspent household money is excluded from GDP. GDP is consumption actually delivered plus investment actually delivered plus government purchases actually delivered.

Ordinary intermediate spending equals 22% of gross sector output. The supplier network solves `gross = deliveredFinal + supplierMatrix × gross` by fixed-point iteration until the aggregate change is below $0.0001 (at most 1,000 iterations). Each column sums to 0.22 by default, giving rapid convergence. Configuration limits this coefficient to at most 0.95. Internal suppliers are assumed to expand enough to fulfill intermediate demand; there are no separate intermediate-input bottlenecks, inventories, or input prices. Company revenue distribution is based on initial size, so firms do not compete for market share.

Each non-provider firm also pays base local service contracts of $500 per initial white-collar role to Civic AI and $500 per initial blue-collar role to Atlas Robotics. For every automated job, it then pays $12,000/year (AI) or $18,000/year (robotics), including later years. Both providers receive exactly those payments. Firms retain automated capacity without depreciation, even if demand drops. Provider service delivery is scalable; fees are not capacity-limited.

Operating profit = gross revenue − ordinary intermediate inputs − base and automation service fees − actual payroll. Companies can operate at a loss; no bankruptcy or wage-default behavior is modeled. Positive company profit is taxed at 18%.

GDP = final consumption + investment + government purchases = sum of company revenue minus ordinary intermediate inputs and automation service fees. Adding provider revenue without deducting its buyer costs would double-count GDP; tests enforce the identity. Benefits are transfers and never subtracted directly from GDP.

City budget balance = wage and positive-profit taxes − benefits − government purchases. Cumulative balance starts at zero and can become negative (locally financed debt). There is no debt ceiling, interest, tax response, or crowding-out feedback. Benefits can therefore support spending even while worsening the fiscal balance. All dollar assumptions, including the annual benefit, are held fixed in real terms.

## Reproducibility and limits

Every simulation starts from the same seed and a fresh city. Changing an earlier policy changes later states; changing 2030 cannot alter 2026–2029. Sliders apply to each year's remaining eligible employees, not a fixed starting count. A 10% rate in consecutive years is not the same as eliminating 20% of initial jobs. A zero-layoff comparison retains matching, growth, government policy, and the same seed.

The model is useful for inspecting causal assumptions. It omits price adjustment, interest, corporate ownership/dividends, firm entry and exit, retraining, detailed households, demographics, pension income, insurance, occupational licensing, housing stock, international trade, and empirically estimated elasticities. Its default scenario and five-year outcome should not be interpreted as a real US city forecast.
