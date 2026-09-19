# City model specification

## Scope and units

The city starts on January 1, 2026 with 1,000,000 residents and forecasts full years 2026–2030. Monetary values are USD, held at fixed prices labeled constant 2026 dollars. Historical category weights and rounded wages are adopted without a separate inflation adjustment. This is a scenario model, not a statistically estimated or validated prediction.

The city is closed: all consumption, investment, government service purchases, suppliers, AI, and robotics are local. Savings and borrowing are modeled as local financial balances; there is no foreign trade. Prices, population, and the labor force stay fixed. Births, migration, aging, new company formation, pensions, pre-existing wealth, interest, and financial-market clearing are not simulated. Firm closures, ownership, dividends, and accumulated financial wealth are modeled.

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

Records use typed-array columns to avoid allocating a million JavaScript objects and blocking the browser. `CitizenFactory.at(population, id)` materializes a normal entity for review. This is individual-level employment state, not a weighted sample. Individual budgets are calculated before aggregation so shareholder spending caps and savings drawdowns apply per person. Factories initialize once per scenario. Annual transitions update those records rather than replacing the population.

## Annual order of operations

1. Assign persistent employee ownership at firms with >50 current employees and >$1M actual or potential annual profit. The group is 1% of employees, rounded to the nearest whole person (at least one), selected deterministically across the employee list. Assignment happens once per qualifying firm, including providers; dilution is not modeled. Potential ordinary-firm profit assumes automating remaining jobs at configured service fees while retaining 1% of payroll. Provider potential assumes 10% adoption across the initial city, less the ordinary input share. These are explicit eligibility assumptions, not forecasts.
2. Pay the previous year's scheduled dividends, capped by available company cash, equally to its shareholders. The first forecast year has no opening dividends. Corporate and household opening capital are zero; the initial snapshot is a calibration, not an extra year of earnings.
3. Compare last year's aggregate sector revenue with initial revenue and effective productive capacity. Visit firms in ascending initial size (ID breaks ties). Close a non-provider firm only if its sales are below 70% of initial sales, it is loss-making, and its capacity fits within the sector's excess. Preserve at least one supplier per sector because the local input network assumes intermediate inputs remain available. Closed firms never reopen, receive no revenue, cancel service contracts, clear vacancies, and release non-owner employees. Protected shareholders retain employer links as unpaid proprietors even if their company closes, keeping ownership and existing assets. They are counted as employed, an explicit convention rather than a claim that their livelihoods are unaffected.
4. Apply slider automation quotas to remaining non-provider, non-shareholder employees, using largest-remainder allocation. Separately cut 25% of employment associated with the prior year's proportional revenue decline, protecting shareholders. Closure layoffs are a subset of demand layoffs, never counted twice. Both demand responses lag one year, so the secondary loss of spending feeds into subsequent years.
5. Add provider vacancies: one additional job per $180,000 of active recurring automation revenue. Other surviving firms add vacancies if revenue recovers to at least 95% of initial revenue. Fill 60% of supported vacancies with unemployed people of the same job type, using a rotating candidate queue. Destroyed jobs never become vacancies.
6. Compute households' disposable income and intended category purchases, then final demand, delivered production, company profit, taxes, and public accounts. Settle actual purchases once, finance investment, settle business profits/losses, and schedule next year's dividends. Annual job changes happen at the beginning of the year; no monthly wage or benefit proration is modeled.

Destroyed jobs are not vacancies. Existing unfilled vacancies persist. New companies and new citizens are not created in response to layoffs; the configured city population remains fixed.

## Consumption and connections

Employed white-collar households spend 86% of their wage after a flat 20% income tax. Blue-collar households spend 94%. These propensities are assumptions. Remaining disposable income and unfulfilled purchases accumulate as individual liquid savings. Shareholders spend the lesser of $500,000, available funds, and wage-based spending plus 90% of dividends plus 4% of liquid savings. Their employed category weights double restaurants, entertainment, and other services before normalization. These are illustrative affluent-spending assumptions; the cap is per shareholder budget, not a citywide cap. Each labor-force member finances their own modeled budget plus an implicit share of dependents, so children are not assigned duplicate full household budgets.

Unemployed workers receive the configured annual benefit and spend all of it using a needs-first profile: 49% housing, 21% groceries, 10% healthcare, 9% transport, 2.5% clothing, 1.5% restaurants, 1.5% entertainment, and 5.5% other services. Their former salary does not continue. Benefits persist while unemployed, without an eligibility cutoff. These are policy assumptions.

`consumptionLinks` maps each consumption category into sectors. Sector spending is allocated among active companies using effective capacity × initial size raised to (2 × proportional final-demand decline). At calibration this reduces to initial headcount shares. When demand falls, larger firms gain share; closed firms receive none. This is an explicit weighted relationship, rather than a million separately stored household-to-shop edge lists. `suppliers` maps every company sector's ordinary procurement to other local sectors. Links have nonnegative shares summing to one.

## Production and accounting

Household budgets produce final demand. Government purchases are $6,500 per resident, split among education/civic services (55%), health (30%), and utilities (15%). Private investment opportunity is 18% of household planned spending multiplied by min(1, current planned consumption / initial planned consumption). Funding is capped by household liquid savings plus disposable income less intended purchases, plus pre-existing company cash. Initialization applies the same funding cap. Investment is allocated to construction (55%), manufacturing (30%), and software (15%). These are synthetic closures, not calibrated fiscal or investment models.

For each sector, final output is capped by initial final output times its effective workforce ratio times cumulative 1.5% annual productivity growth. Effective workforce is human employment plus 100% of automated white-collar roles plus 90% of automated blue-collar roles. Demand above capacity is unfulfilled; unspent household money is excluded from GDP. GDP is consumption actually delivered plus investment actually delivered plus government purchases actually delivered.

Ordinary intermediate spending equals 22% of gross sector output. The supplier network solves `gross = deliveredFinal + supplierMatrix × gross` by fixed-point iteration until the aggregate change is below $0.0001 (at most 1,000 iterations). Each column sums to 0.22 by default, giving rapid convergence. Configuration limits this coefficient to at most 0.95. Internal suppliers are assumed to expand enough to fulfill intermediate demand; there are no separate intermediate-input bottlenecks, inventories, or input prices. Company revenue shares respond to capacity, size, and sector demand pressure. If a sector has zero productive capacity, its remaining supplier still receives intermediate receipts under the assumed scalable-input network; final deliveries remain capacity-limited.

Each non-provider firm also pays base local service contracts of $500 per initial white-collar role to Civic AI and $500 per initial blue-collar role to Atlas Robotics. For every automated job, it then pays $12,000/year (AI) or $18,000/year (robotics), including later years. Both providers receive exactly those payments. Surviving firms retain automated capacity without depreciation, even if demand drops. Closed firms cancel all automation and base-service contracts, lowering provider revenue. Provider service delivery is scalable; fees are not capacity-limited.

Operating profit = gross revenue − ordinary intermediate inputs − base and automation service fees − actual payroll. Positive company profit is taxed at 18%. Investment is financed from household cash first, then company cash, exchanging cash for productive assets at book value without depreciation. Companies then settle operating results; losses exhaust cash and the remainder becomes operating debt, without interest or a credit ceiling. Future cash repays debt before retention or dividends. Solvency alone does not trigger closure: the demand/capacity rules above apply. This simplified credit accommodation is not a financial-market-clearing model.

GDP = final consumption + investment + government purchases = sum of company revenue minus ordinary intermediate inputs and automation service fees. Adding provider revenue without deducting its buyer costs would double-count GDP; tests enforce the identity. Benefits are transfers and never subtracted directly from GDP.

City budget balance = wage and positive-profit taxes − benefits − government purchases. Cumulative balance starts at zero and can become negative (locally financed debt). There is no debt ceiling, interest, tax response, or crowding-out feedback. Benefits can therefore support spending even while worsening the fiscal balance. All dollar assumptions, including the annual benefit, are held fixed in real terms.

## Reproducibility and limits

Every simulation starts from the same seed and a fresh city. Changing an earlier policy changes later states; changing 2030 cannot alter 2026–2029. Sliders apply to each year's remaining eligible employees, not a fixed starting count. A 10% rate in consecutive years is not the same as eliminating 20% of initial jobs. A zero-layoff comparison retains matching, growth, government policy, and the same seed.

The model is useful for inspecting causal assumptions. It omits price adjustment, interest, firm entry, asset-price valuation, retraining, detailed households, demographics, pension income, insurance, occupational licensing, housing stock, international trade, and empirically estimated elasticities. Its default scenario and five-year outcome should not be interpreted as a real US city forecast.

## Wealth and unused capital

The Lorenz curve, Gini, and top-1% share cover the labor-force budget accounts, each including dependent consumption. Wealth equals accumulated liquid savings plus investment assets plus an owner's equal share of their company's nonnegative net book equity (retained cash + invested assets − operating debt). No starting fortunes, homes, mark-to-market gains, or negative household wealth are modeled. Ownership transfer does not create wealth: dividends debit corporate cash and credit household income exactly once. Firms without qualifying employee shareholders retain their profits; these unassigned corporate assets are excluded from household inequality but their cash is included in total idle capital.

Idle capital is year-end household cash plus company retained cash, counted once. It is a **stock**, not annual income or investment. Not all idle cash is attributed to missing consumers. The separate annual demand-blocked investment measure is max(0, min(available funding, 18% of initial planned consumption) − min(available funding, demand-limited investment opportunity)). Capacity-limited underdelivery is separate. Lower consumption therefore reduces investable opportunities even if funds accumulate. Investment does not consume household wealth; it changes its composition from cash to assets.
