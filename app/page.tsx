"use client";
import { useMemo, useState } from "react";
import {
  Building2,
  RotateCcw,
  Users,
  BriefcaseBusiness,
  ArrowUpRight,
  Info,
  Cpu,
  Bot,
  ArrowRight,
  SlidersHorizontal,
  CircleDollarSign,
  ChevronDown,
  Check,
  LoaderCircle,
} from "lucide-react";
import { NamedSlider as Slider } from "@/components/economy/named-slider";
import { useModelTools } from "@/components/economy/use-model-tools";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { DEFAULT_CONFIG, DEFAULT_SCENARIO, SOURCES } from "@/domain/config";
import { createLayoffPreset, resizeScenario, SCENARIO_DURATIONS } from "@/domain/scenario";
import type { CityConfig, Role, YearPolicy, YearResult } from "@/domain/types";
import { CATEGORIES, consumptionProfile } from "@/domain/systems/households";
import { WealthDemand } from "@/components/economy/wealth-demand";
import { LayoffPresets } from "@/components/economy/layoff-presets";
import { Forecast } from "@/components/economy/forecast";
import { BudgetForecast } from "@/components/economy/budget-forecast";
import { AgeDistribution } from "@/components/economy/age-distribution";
import { IndustryRipple } from "@/components/economy/industry-ripple";
import { useSimulation } from "@/components/economy/use-simulation";
const number = (n: number) => Math.round(n).toLocaleString("en-US");
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
const compact = (n: number) =>
  `${n < 0 ? "−" : ""}$${(Math.abs(n) / (Math.abs(n) >= 1e9 ? 1e9 : 1e6)).toFixed(2)}${Math.abs(n) >= 1e9 ? "B" : "M"}`;
const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
const names = {
  food: "Groceries",
  restaurants: "Restaurants & delivery",
  housing: "Housing & utilities",
  transport: "Transportation",
  health: "Healthcare",
  entertainment: "Entertainment",
  clothes: "Clothing",
  other: "Other services",
};
export default function Home() {
  const [config, setConfig] = useState<CityConfig>(DEFAULT_CONFIG),
    [scenario, setScenario] = useState<YearPolicy[]>(DEFAULT_SCENARIO),
    [selected, setSelected] = useState(0),
    [presetOpen, setPresetOpen] = useState(false),
    [sector, setSector] = useState<string | null>(null);
  const zeroScenario = useMemo(
    () => resizeScenario([], config.startYear, config.years),
    [config],
  ); // Recalculate the baseline only when model settings or duration change.
  const { result: latestResult, pending, error } = useSimulation(config, scenario),
    { result: latestBaseline } = useSimulation(config, zeroScenario, true);
  const matchesHorizon = (value: typeof latestResult) =>
    value?.years.length === config.years && value.years[0]?.year === config.startYear;
  const result = matchesHorizon(latestResult) ? latestResult : null;
  const baseline = matchesHorizon(latestBaseline) ? latestBaseline : null;
  useModelTools(scenario, result, pending, setScenario);
  const year = scenario[selected],
    r = result?.years[selected],
    base = baseline?.years[selected];
  const edit = (role: Role, value: number) =>
    setScenario((current) =>
      current.map((p, i) =>
        i === selected ? { ...p, [role]: value / 100 } : p,
      ),
    );
  const policy = (key: "annualBenefit" | "matchingRate", value: number) =>
    setConfig((current) => ({
      ...current,
      policy: { ...current.policy, [key]: value },
    }));
  const changeDuration = (value: string) => {
    const years = Number(value);
    setScenario((current) => resizeScenario([...current, ...createLayoffPreset("normal", config.startYear, years)], config.startYear, years));
    setConfig((current) => ({ ...current, years }));
    setSelected((current) => Math.min(current, years - 1));
  };
  const reset = () => {
    setScenario(resizeScenario([], DEFAULT_CONFIG.startYear, config.years));
    setConfig({ ...DEFAULT_CONFIG, years: config.years });
    setSelected(0);
  };
  return (
    <div className="app-shell">
      {presetOpen && <LayoffPresets scenario={scenario} onApply={setScenario} onClose={() => setPresetOpen(false)} />}
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-icon">
            <Building2 size={21} />
          </span>
          CITY / LAB<span className="brand-sub">Economy simulator</span>
        </a>
        <span className="model-tag">
          US CITY MODEL <span className="tag-divider">/</span> CONSTANT 2026 USD
        </span>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              A MILLION PEOPLE. ONE CONNECTED ECONOMY.
            </div>
            <h1>
              The cost of a changing workforce<span>.</span>
            </h1>
            <p>
              Explore how automation reshapes jobs, spending, and your city’s
              economy.
            </p>
          </div>
        </div>
        <div className="city-strip">
          <span>
            <Users size={16} />
            <strong>1,000,000</strong> residents
          </span>
          <span>
            <BriefcaseBusiness size={16} />
            <strong>{number(result?.laborForce ?? 499200)}</strong> initial labor force
          </span>
          <span>
            <Building2 size={16} />
            <strong>{number(result?.companyCount ?? 18722)}</strong> companies
          </span>
          <span className="strip-note">
            <span className="small-dot" />
            Closed economy · US-inspired
          </span>
        </div>
        <div className="workspace">
          <aside className="panel controls">
            <div className="panel-title">
              <h2>{config.years}-year scenario</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="scenario-menu-trigger"
                    aria-label="Scenario options"
                  >
                    <SlidersHorizontal size={17} aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="scenario-menu" onCloseAutoFocus={(event) => { if (presetOpen) event.preventDefault(); }}>
                  <DropdownMenuRadioGroup value={String(config.years)} onValueChange={changeDuration}>
                    {SCENARIO_DURATIONS.map((years) => (
                      <DropdownMenuRadioItem key={years} value={String(years)}>
                        {years}-year scenario
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setPresetOpen(true)}>
                    <SlidersHorizontal size={15} aria-hidden="true" />
                    Select Layoff Preset
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={reset}>
                    <RotateCcw size={15} aria-hidden="true" />
                    Reset to no layoffs
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p>Choose a year. Adjust the disruption.</p>
            <div className="year-buttons" aria-label="Simulation year">
              {scenario.map((p, i) => (
                <button
                  key={p.year}
                  className={selected === i ? "selected" : ""}
                  onClick={() => setSelected(i)}
                  aria-pressed={selected === i}
                >
                  {p.year}
                  <span
                    title={p.white + p.blue > 0 ? "Layoffs configured" : "No layoffs"}
                    className={
                      p.white + p.blue > 0 ? "year-mark active" : "year-mark"
                    }
                  />
                </button>
              ))}
            </div>
            <div className="control-section">
              <div className="control-heading">
                <span className="role-icon white">
                  <BriefcaseBusiness size={16} />
                </span>
                <h3>White-collar layoffs</h3>
              </div>
              <div className="control-value">
                <strong>
                  {Math.round(year.white * 100)}
                  <small>%</small>
                </strong>
                <span>
                  {r
                    ? `${number(year.white * r.eligible.white)} people`
                    : "Creating jobs…"}
                </span>
              </div>
              <Slider
                aria-label={`White-collar layoffs in ${year.year}`}
                value={[Math.round(year.white * 100)]}
                onValueChange={(v) => edit("white", v[0])}
                max={100}
                step={1}
              />
              <div className="range-labels">
                <span>0%</span>
                <span>100%</span>
              </div>
              <p className="control-help">
                Of {number(r?.eligible.white ?? 0)} eligible jobs at the start
                of {year.year}.
              </p>
              <div className="connection">
                <span>Replaced by AI</span>
                <ArrowRight size={13} />
                <span>Civic AI</span>
              </div>
            </div>
            <div className="control-section blue-control">
              <div className="control-heading">
                <span className="role-icon blue">
                  <SlidersHorizontal size={16} />
                </span>
                <h3>Blue-collar layoffs</h3>
              </div>
              <div className="control-value">
                <strong>
                  {Math.round(year.blue * 100)}
                  <small>%</small>
                </strong>
                <span>
                  {r
                    ? `${number(year.blue * r.eligible.blue)} people`
                    : "Creating jobs…"}
                </span>
              </div>
              <Slider
                aria-label={`Blue-collar layoffs in ${year.year}`}
                value={[Math.round(year.blue * 100)]}
                onValueChange={(v) => edit("blue", v[0])}
                max={100}
                step={1}
              />
              <div className="range-labels">
                <span>0%</span>
                <span>100%</span>
              </div>
              <p className="control-help">
                Of {number(r?.eligible.blue ?? 0)} eligible jobs at the start of{" "}
                {year.year}.
              </p>
              <div className="connection">
                <span>Replaced by robotics</span>
                <ArrowRight size={13} />
                <span>Atlas Robotics</span>
              </div>
            </div>
            <details className="assumptions">
              <summary>
                Policy settings
                <ChevronDown size={15} />
              </summary>
              <label className="policy-label" htmlFor="benefit">
                Annual social benefit{" "}
                <strong>{money(config.policy.annualBenefit)}</strong>
              </label>
              <input
                id="benefit"
                type="number"
                min="0"
                max="60000"
                step="100"
                value={config.policy.annualBenefit}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 0 && n <= 60000)
                    policy("annualBenefit", n);
                }}
              />
              <div className="control-label">
                Matching in a balanced market{" "}
                <strong>{Math.round(config.policy.matchingRate * 100)}%</strong>
              </div>
              <Slider
                aria-label="Matching rate in a balanced labor market"
                value={[config.policy.matchingRate * 100]}
                onValueChange={(v) => policy("matchingRate", v[0] / 100)}
                max={100}
              />
              <p className="control-help">
                Annual share matched when job seekers and openings are equal.
                More candidates per opening make vacancies easier to fill;
                more openings per candidate make jobs easier to find.
              </p>
            </details>
            <div className="callout">
              <Info size={16} />
              <span>
                Layoffs compound across years. Rehiring and lower consumer
                spending feed back into the city.
              </span>
            </div>
            <div className="run-state" role="status">
              {pending ? (
                <>
                  <LoaderCircle size={13} className="spin" />
                  Calculating your city…
                </>
              ) : error ? (
                <span className="negative">Model needs attention</span>
              ) : (
                <>
                  <Check size={14} />
                  Scenario up to date
                </>
              )}
            </div>
          </aside>
          <div className="results" aria-busy={pending}>
            {error ? (
              <div className="panel error-panel" role="alert">
                {error}
              </div>
            ) : !r || !result ? (
              <div className="panel loading-panel">
                <LoaderCircle className="spin" />
                <h2>Building your city</h2>
                <p>
                  Creating companies, citizens, and their economic connections.
                </p>
              </div>
            ) : (
              <>
                <div className="results-heading">
                  <span>
                    <span className="eyebrow">YEAR-END SNAPSHOT</span>
                    <strong>{year.year}</strong>
                  </span>
                  <span className="live-note">
                    {pending
                      ? "Recalculating…"
                      : "All values update with your scenario"}
                  </span>
                </div>
                <div className="metric-grid">
                  <Metric
                    title="City GDP"
                    value={compact(r.gdp)}
                    change={
                      base
                        ? `${percent((r.gdp - base.gdp) / base.gdp)} vs. no layoffs`
                        : "Comparing baseline…"
                    }
                    negative={!!base && r.gdp < base.gdp}
                    icon={<CircleDollarSign size={16} />}
                  />
                  <Metric
                    title="Unemployment"
                    value={percent(r.unemploymentRate)}
                    change={`${number(r.unemployed)} people out of work`}
                    negative={r.unemploymentRate > 0.044}
                    icon={<Users size={16} />}
                  />
                  <Metric
                    title="Household spending"
                    value={compact(r.consumption)}
                    change={
                      base
                        ? `${percent((r.consumption - base.consumption) / base.consumption)} vs. no layoffs`
                        : "Comparing baseline…"
                    }
                    negative={!!base && r.consumption < base.consumption}
                    icon={<BriefcaseBusiness size={16} />}
                  />
                  <Metric
                    title="Social benefit cost"
                    value={compact(r.benefitCost)}
                    change={`${money(config.policy.annualBenefit)} / unemployed person`}
                    icon={<Building2 size={16} />}
                  />
                </div>
                <Tabs defaultValue="overview" className="result-tabs">
                  <TabsList variant="line" className="view-tabs">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="gdp">GDP</TabsTrigger>
                    <TabsTrigger value="wealth">Wealth & demand</TabsTrigger>
                    <TabsTrigger value="companies">Companies</TabsTrigger>
                    <TabsTrigger value="households">Households</TabsTrigger>
                    <TabsTrigger value="demographics">Demographics</TabsTrigger>
                    <TabsTrigger value="model">Model & sources</TabsTrigger>
                  </TabsList>
                  <TabsContent value="overview">
                    <section className="panel forecast">
                      <div className="panel-title">
                        <div>
                          <h2>The {config.years}-year outlook</h2>
                          <p>Annual results · {config.startYear}–{config.startYear + config.years - 1}</p>
                        </div>
                        <span className="forecast-badge">{config.years}-year forecast</span>
                      </div>
                      <div className="chart-legend">
                        <span><i className="legend-line gdp" />Budget balance (% of GDP)</span>
                        <span><i className="legend-line unemployment" />Unemployment</span>
                        <span><i className="legend-line baseline" />Balance without layoffs</span>
                      </div>
                      <BudgetForecast result={result} baseline={baseline} year={year.year} />
                      <div className="budget-explanation">
                        <p><strong>Can taxes cover public commitments?</strong> Budget balance is tax revenue
                          (including pension contributions) minus public-service purchases, pensions, and
                          unemployment benefits, divided by GDP. Above zero is a surplus; below zero is a
                          deficit that needs financing from borrowing, reserves, or outside support.</p>
                        <p><strong>Historical comparisons:</strong> Greece’s deficit reached <strong>15.4% of GDP
                          in 2009</strong> before it lost sustainable market financing and entered its first
                          bailout in 2010. Portugal’s deficit reached <strong>11.4% in 2010</strong>; it
                          requested a bailout in 2011 when refinancing became unaffordable. <a
                            href="https://www.esm.europa.eu/assistance/greece/explainer-esm-and-efsf-financial-assistance-greece"
                            target="_blank" rel="noreferrer">Greece: ESM</a> · <a
                            href="https://www.esm.europa.eu/assistance/portugal"
                            target="_blank" rel="noreferrer">Portugal: ESM</a> · <a
                            href="https://www.imf.org/external/datamapper/GGXCNL_NGDP@WEO/GRC/PRT"
                            target="_blank" rel="noreferrer">Historical balances: IMF</a></p>
                        <p>These are historical comparisons, not bailout thresholds. The simulated balance
                          excludes debt interest, unlike the historical overall balances. Borrowing limits
                          are not modeled, so benefits, pensions, and public services continue to be paid
                          even when the budget is in deficit.</p>
                      </div>
                      <div className="chart-footer">
                        <Info size={14} />
                        The first point is the starting city’s annual accounts. Forecast points show full-year
                        balances after hiring.
                      </div>
                    </section>
                    <div className="lower-grid">
                      <IndustryRipple current={r} previous={selected === 0 ? result.initial : result.years[selected - 1]} />
                      <div className="revenue-sidebar">
                        <section className="panel providers">
                          <div className="panel-title">
                            <h2>Where the revenue goes</h2>
                            <span className="tiny-label">{year.year}</span>
                          </div>
                          <p>Annual revenue at the city’s automation providers</p>
                          <Provider
                            name="Civic AI"
                            subtitle="White-collar automation"
                            revenue={r.aiRevenue}
                            fees={r.aiAutomationRevenue}
                            icon={<Cpu size={20} />}
                            type="ai"
                          />
                          <Provider
                            name="Atlas Robotics"
                            subtitle="Blue-collar automation"
                            revenue={r.roboticsRevenue}
                            fees={r.roboticsAutomationRevenue}
                            icon={<Bot size={20} />}
                            type="robot"
                          />
                          <div className="provider-note">
                            Fees are paid by local companies, so they are not
                            counted twice in GDP.
                          </div>
                        </section>
                      </div>
                    </div>
                    <section className="panel annual-panel">
                      <div className="panel-title">
                        <h2>Year by year</h2>
                        <span className="tiny-label">CONSTANT USD</span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Year</TableHead>
                            <TableHead>GDP</TableHead>
                            <TableHead>Unemployment</TableHead>
                            <TableHead>Benefits</TableHead>
                            <TableHead>Pensions</TableHead>
                            <TableHead>Pension contributions</TableHead>
                            <TableHead>City budget balance</TableHead>
                            <TableHead>Balance / GDP</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.years.map((v, i) => (
                            <TableRow
                              key={v.year}
                              className={selected === i ? "highlight-row" : ""}
                            >
                              <TableCell>
                                <button
                                  className="text-button"
                                  onClick={() => setSelected(i)}
                                >
                                  {v.year}
                                  {selected === i && (
                                    <span className="selected-label">
                                      Selected
                                    </span>
                                  )}
                                </button>
                              </TableCell>
                              <TableCell>{compact(v.gdp)}</TableCell>
                              <TableCell>
                                {percent(v.unemploymentRate)}
                              </TableCell>
                              <TableCell>{compact(v.benefitCost)}</TableCell>
                              <TableCell>{compact(v.pensionCost)}</TableCell>
                              <TableCell>{compact(v.pensionContributions)}</TableCell>
                              <TableCell
                                className={
                                  v.budgetBalance < 0 ? "negative" : "positive"
                                }
                              >
                                {compact(v.budgetBalance)}
                              </TableCell>
                              <TableCell className={v.budgetBalance < 0 ? "negative" : "positive"}>
                                {v.gdp > 0 ? percent(v.budgetBalance / v.gdp) : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="table-footnote">
                        Budget balance = taxes (including pension contributions)
                        − unemployment benefits − pensions − government purchases.
                        Debt carries forward; benefits and pensions are transfers.
                      </div>
                    </section>
                  </TabsContent>
                  <TabsContent value="gdp">
                    <section className="panel forecast">
                      <div className="panel-title">
                        <div>
                          <h2>The {config.years}-year outlook</h2>
                          <p>Annual GDP and unemployment · {config.startYear}–{config.startYear + config.years - 1}</p>
                        </div>
                        <span className="forecast-badge">{config.years}-year forecast</span>
                      </div>
                      <div className="chart-legend">
                        <span>
                          <i className="legend-line gdp" />
                          City GDP
                        </span>
                        <span>
                          <i className="legend-line unemployment" />
                          Unemployment
                        </span>
                        <span>
                          <i className="legend-line baseline" />
                          GDP without layoffs
                        </span>
                      </div>
                      <Forecast
                        result={result}
                        baseline={baseline}
                        year={year.year}
                      />
                      <div className="budget-explanation">
                        <p><strong>Why doesn’t GDP collapse as unemployment rises?</strong> GDP measures
                          production, not how many people have jobs or how securely they live. In this model,
                          AI and robotics replace much of the productive capacity of displaced workers, so
                          fewer employees can still produce goods and services.</p>
                        <p><strong>Spending continues after jobs disappear.</strong> Unemployed residents
                          receive {money(config.policy.annualBenefit)} a year in benefits and can draw on
                          savings. Pensions, shareholder dividends, and continued government purchases also
                          sustain demand. These cushions soften the fall in GDP even as wage income falls.</p>
                        <p><strong>Budget balance is the more important health signal for public support
                          in this scenario.</strong> The Overview chart shows whether tax revenue covers
                          pensions, unemployment benefits, and public services. A growing deficit means
                          keeping that support in place requires more financing. GDP holding up does not
                          establish that those commitments are sustainable: this simulation keeps paying
                          them without borrowing limits or debt interest. Budget balance reveals that
                          pressure, though it is not a complete measure of economic health or a prediction
                          of when funding runs out.</p>
                      </div>
                      <div className="chart-footer">
                        <Info size={14} />
                        The first point is the starting city. Forecast points
                        show full-year activity after hiring.
                      </div>
                    </section>
                  </TabsContent>
                  <TabsContent value="wealth">
                    <WealthDemand config={config} result={result} selected={r} />
                  </TabsContent>
                  <TabsContent value="companies">
                    <section className="panel detail-panel">
                      <div className="panel-title">
                        <div>
                          <h2>The businesses behind the city</h2>
                          <p>
                            {number(result.companyCount)} individually modeled
                            companies across 15 sectors · {year.year}
                          </p>
                        </div>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Sector</TableHead>
                            <TableHead>Active / closed firms</TableHead>
                            <TableHead>White-collar</TableHead>
                            <TableHead>Blue-collar</TableHead>
                            <TableHead>Open jobs</TableHead>
                            <TableHead>Revenue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {r.sectors.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell>
                                <button
                                  className="sector-link"
                                  onClick={() =>
                                    setSector(sector === s.id ? null : s.id)
                                  }
                                >
                                  {s.name}
                                  <ArrowUpRight size={13} />
                                </button>
                              </TableCell>
                              <TableCell>{number(s.companies)} / {number(s.closedCompanies)}</TableCell>
                              <TableCell>{number(s.workers.white)}</TableCell>
                              <TableCell>{number(s.workers.blue)}</TableCell>
                              <TableCell>{number(s.vacancies)}</TableCell>
                              <TableCell>{compact(s.revenue)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </section>
                    {sector && (
                      <section className="panel detail-panel company-detail">
                        <h2>
                          {r.sectors.find((s) => s.id === sector)?.name} ·
                          company records
                        </h2>
                        <p>
                          First 12 companies in this sector. Funded orders set a staffing target; firms hire or reduce staff toward it.
                        </p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Company</TableHead>
                              <TableHead>Status / shareholders</TableHead>
                              <TableHead>Employees</TableHead>
                              <TableHead>Staffing target</TableHead>
                              <TableHead>Expected orders</TableHead>
                              <TableHead>Vacancies</TableHead>
                              <TableHead>Automated roles</TableHead>
                              <TableHead>Operating profit</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {r.companies
                              .filter((c) => c.sector === sector)
                              .slice(0, 12)
                              .map((c) => (
                                <TableRow key={c.id}>
                                  <TableCell>{c.name}</TableCell>
                                  <TableCell>{c.closed ? "Closed" : "Active"} · {c.shareholderCount} owners</TableCell>
                                  <TableCell>
                                    {number(c.workers.white + c.workers.blue)}
                                  </TableCell>
                                  <TableCell>{number(c.desiredWorkers.white + c.desiredWorkers.blue)}</TableCell>
                                  <TableCell>{money(c.expectedOrders)}</TableCell>
                                  <TableCell>
                                    {number(
                                      c.vacancies.white + c.vacancies.blue,
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {number(
                                      c.automated.white + c.automated.blue,
                                    )}
                                  </TableCell>
                                  <TableCell
                                    className={c.profit < 0 ? "negative" : ""}
                                  >
                                    {money(c.profit)}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </section>
                    )}
                  </TabsContent>
                  <TabsContent value="households">
                    <Households config={config} result={r} />
                  </TabsContent>
                  <TabsContent value="demographics">
                    <AgeDistribution config={config} result={result} selected={r} />
                  </TabsContent>
                  <TabsContent value="model">
                    <Model config={config} result={r} />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </div>
        <footer>
          <span>
            CITY / LAB <span className="footer-divider">/</span> An economy you
            can interrogate.
          </span>
          <span>
            Illustrative scenario model · US benchmarks, explicit assumptions
          </span>
        </footer>
      </main>
    </div>
  );
}
function Metric({
  title,
  value,
  change,
  negative,
  icon,
}: {
  title: string;
  value: string;
  change: string;
  negative?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="panel metric">
      <div className="metric-label">
        {title}
        {icon}
      </div>
      <div className="metric-value">{value}</div>
      <div className={`metric-change ${negative ? "negative" : ""}`}>
        {negative && <ArrowUpRight size={12} className="down-arrow" />}
        {change}
      </div>
    </div>
  );
}
function Provider({
  name,
  subtitle,
  revenue,
  fees,
  icon,
  type,
}: {
  name: string;
  subtitle: string;
  revenue: number;
  fees: number;
  icon: React.ReactNode;
  type: string;
}) {
  return (
    <div className="provider-row">
      <span className={`provider-icon ${type}`}>{icon}</span>
      <div className="provider-name">
        <strong>{name}</strong>
        <span>{subtitle}</span>
      </div>
      <div className="provider-money">
        <strong>{compact(revenue)}</strong>
        <span>{compact(fees)} automation fees</span>
      </div>
    </div>
  );
}
function Households({
  config,
  result: r,
}: {
  config: CityConfig;
  result: YearResult;
}) {
  const white = consumptionProfile(config, "white", 85000),
    blue = consumptionProfile(config, "blue", 45000),
    unemployed = consumptionProfile(config, "white", 0, true);
  return (
    <>
      <section className="panel detail-panel">
        <div className="panel-title">
          <div>
            <h2>When a paycheck disappears</h2>
            <p>
              Illustrative annual budgets per worker, including their share of
              dependent household members.
            </p>
          </div>
        </div>
        <div className="household-intro">
          <div>
            <span>White-collar example</span>
            <strong>{money(85000)}</strong>
            <small>gross annual salary</small>
          </div>
          <div>
            <span>Blue-collar example</span>
            <strong>{money(45000)}</strong>
            <small>gross annual salary</small>
          </div>
          <div>
            <span>After a layoff</span>
            <strong>{money(config.policy.annualBenefit)}</strong>
            <small>annual social benefit</small>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Consumption</TableHead>
              <TableHead>White-collar</TableHead>
              <TableHead>Blue-collar</TableHead>
              <TableHead>Unemployed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CATEGORIES.map((k) => (
              <TableRow key={k}>
                <TableCell>{names[k]}</TableCell>
                <TableCell>{money(white[k])}</TableCell>
                <TableCell>{money(blue[k])}</TableCell>
                <TableCell>{money(unemployed[k])}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="table-footnote">
          Working households spend 86% (white-collar) or 94% (blue-collar) of
          wages after income tax and employee pension contributions. Unemployed households spend their benefit,
          prioritizing housing and groceries. The examples exclude savings drawdowns;
          actual household budgets can also spend from liquid savings.
        </div>
      </section>
      <section className="panel detail-panel company-detail">
        <h2>Citywide household demand · {r.year}</h2>
        <p>
          Actual spending received by local companies after capacity limits.
        </p>
        <div className="spending-bars">
          {CATEGORIES.map((k) => (
            <div className="spending-bar" key={k}>
              <span>{names[k]}</span>
              <div>
                <i
                  style={{
                    width: `${r.consumption > 0 ? (r.spending[k] / r.consumption) * 100 : 0}%`,
                  }}
                />
              </div>
              <strong>{compact(r.spending[k])}</strong>
            </div>
          ))}
        </div>
        <div className="table-footnote">
          Unfulfilled household demand: {compact(r.unmetDemand)}. Unspent income
          is saved, not counted as production.
        </div>
      </section>
    </>
  );
}
function Model({
  config,
  result: r,
}: {
  config: CityConfig;
  result: YearResult;
}) {
  return (
    <div className="model-content">
      <section className="panel detail-panel">
        <div className="eyebrow">TRANSPARENT BY DESIGN</div>
        <h2>A US-inspired city, with visible assumptions</h2>
        <p>
          This is a deterministic scenario simulator, not an econometric
          forecast. National benchmarks calibrate the starting point; city
          composition and automation behavior are configurable assumptions.
        </p>
        <div className="model-steps">
          {[
            [
              "01",
              "Create the city",
              "Factories allocate citizens and companies from configured proportions. Each worker has an employer, a wage, and a spending profile.",
            ],
            [
              "02",
              "Change employment",
              "Aging runs independently. After automation, funded purchasing power sets company staffing targets: hire into gaps, gradually reduce surplus staff, or close persistently loss-making firms when demand leaves excess capacity.",
            ],
            [
              "03",
              "Follow the money",
              "Wages, benefits, pensions, and savings fund households. Ordinary productivity gains feed wages; workers and employers contribute to pensions. Purchases flow to sectors and local suppliers.",
            ],
            [
              "04",
              "Carry the effects forward",
              "Hiring and layoffs change incomes and spending. The next annual staffing decision uses that purchasing power. Profits fund shareholder dividends and accumulated wealth.",
            ],
          ].map(([n, title, body]) => (
            <div key={n}>
              <span>{n}</span>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel detail-panel">
        <h2>What is assumed</h2>
        <div className="assumption-grid">
          <div>
            <span>Adult population share</span>
            <strong>80%</strong>
          </div>
          <div>
            <span>Adult labor participation</span>
            <strong>62.4%</strong>
          </div>
          <div><span>Workforce entry / retirement age</span><strong>{config.workforceEntryAge} / {config.retirementAge}</strong></div>
          <div>
            <span>Starting unemployment</span>
            <strong>4.4%</strong>
          </div>
          <div>
            <span>Initial vacancies / employees</span>
            <strong>3.5% target</strong>
          </div>
          <div>
            <span>Real productivity growth</span>
            <strong>{percent(config.policy.productivityGrowth)} / year</strong>
          </div>
          <div>
            <span>Productivity gain passed to real wages</span>
            <strong>{percent(config.policy.productivityWageShare)}</strong>
          </div>
          <div>
            <span>Pension / prior earnings</span>
            <strong>{percent(config.policy.pensionReplacementRate)}</strong>
          </div>
          <div>
            <span>Pension contribution, worker + employer</span>
            <strong>{percent(config.policy.pensionContributionRate / 2)} + {percent(config.policy.pensionContributionRate / 2)}</strong>
          </div>
          <div>
            <span>Annual liquid savings drawdown</span>
            <strong>{percent(config.policy.savingsDrawdownRate)}</strong>
          </div>
          <div>
            <span>Opening financial history</span>
            <strong>{config.openingHistoryYears} accounting years</strong>
          </div>
          <div>
            <span>AI / robotics fee per replaced role</span>
            <strong>$12,000 / $18,000</strong>
          </div>
          <div>
            <span>Automation output retained</span>
            <strong>100% white / 90% blue</strong>
          </div>
          <div>
            <span>Annual benefit per unemployed worker</span>
            <strong>{money(config.policy.annualBenefit)}</strong>
          </div>
        </div>
        <p>
          Job types are a simplified occupational split, including physical
          service work under “blue-collar.” Wages and company sizes vary by
          sector. Matching assumes workers can move between sectors within their
          job type; no retraining, migration, inflation, or new firms are
          modeled.
        </p>
        <p>
          Ages use synthetic uniform cohorts; all young residents enter at 20 and active residents permanently exit at 65. Retirees retain savings and ownership. All goods, services, and automation are local. Household budgets
          include dependents; pensions replace a configured share of prior earnings and are paid from the city budget, with payroll contributions recorded as tax revenue.
          Opening savings, retained profits, debt, and dividends come from {config.openingHistoryYears} illustrative accounting periods at initial jobs and wages. These establish financial balances without aging residents or changing employment; they are not observed history or extra forecast years. Investment is financed by available cash and limited by consumer demand. Internal supplier purchases are
          modeled without separate input bottlenecks. Government can borrow
          locally without a debt limit or interest cost. Loss-making firms with sharply reduced sales close when their sector has excess capacity; the last supplier remains to preserve local supply links.
        </p>
        <div className="accounting-box">
          <strong>
            GDP = household consumption + investment + government purchases
          </strong>
          <p>
            Automation fees and supplier payments are internal transactions.
            Benefits are a budget expense, and support spending rather than
            mechanically reducing GDP.
          </p>
          <span>
            {compact(r.consumption)} + {compact(r.investment)} +{" "}
            {compact(r.governmentPurchases)} = {compact(r.gdp)}
          </span>
        </div>
      </section>
      <section className="panel detail-panel">
        <h2>Data & calibration</h2>
        <p>
          The model starts January 1, 2026. The December employment release is a
          retrospective starting-point calibration, not information available on
          that date. All monetary assumptions are held in constant 2026 dollars
          without a separate CPI adjustment.
        </p>
        <div className="source-list">
          {SOURCES.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
              <div>
                <strong>{s.title}</strong>
                <p>{s.note}</p>
              </div>
              <ArrowUpRight size={17} />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
