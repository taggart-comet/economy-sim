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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { DEFAULT_CONFIG, DEFAULT_SCENARIO, SOURCES } from "@/domain/config";
import type { CityConfig, Role, YearPolicy, YearResult } from "@/domain/types";
import { CATEGORIES, consumptionProfile } from "@/domain/systems/households";
import { WealthDemand } from "@/components/economy/wealth-demand";
import { Forecast } from "@/components/economy/forecast";
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
    [sector, setSector] = useState<string | null>(null);
  const zeroScenario = useMemo(
    () => scenario.map((p) => ({ ...p, white: 0, blue: 0 })),
    [config],
  ); // Always the same horizon; does not re-run when only layoffs change.
  const { result, pending, error } = useSimulation(config, scenario),
    { result: baseline } = useSimulation(config, zeroScenario, true);
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
  const reset = () => {
    setScenario(DEFAULT_SCENARIO.map((p) => ({ ...p, white: 0, blue: 0 })));
    setConfig(DEFAULT_CONFIG);
    setSelected(0);
  };
  return (
    <div className="app-shell">
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
          <button className="button" onClick={reset}>
            <RotateCcw size={15} /> Reset to no layoffs
          </button>
        </div>
        <div className="city-strip">
          <span>
            <Users size={16} />
            <strong>1,000,000</strong> residents
          </span>
          <span>
            <BriefcaseBusiness size={16} />
            <strong>{number(result?.laborForce ?? 499200)}</strong> labor force
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
              <h2>Your scenario</h2>
              <SlidersHorizontal size={17} color="#8793a5" />
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
                Vacancy matching{" "}
                <strong>{Math.round(config.policy.matchingRate * 100)}%</strong>
              </div>
              <Slider
                aria-label="Vacancy matching rate"
                value={[config.policy.matchingRate * 100]}
                onValueChange={(v) => policy("matchingRate", v[0] / 100)}
                max={100}
              />
              <p className="control-help">
                Share of open, demand-supported roles filled each year. Skills
                stay within the same job type.
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
                    <TabsTrigger value="wealth">Wealth & demand</TabsTrigger>
                    <TabsTrigger value="companies">Companies</TabsTrigger>
                    <TabsTrigger value="households">Households</TabsTrigger>
                    <TabsTrigger value="model">Model & sources</TabsTrigger>
                  </TabsList>
                  <TabsContent value="overview">
                    <section className="panel forecast">
                      <div className="panel-title">
                        <div>
                          <h2>The five-year outlook</h2>
                          <p>Annual GDP and unemployment · 2026–2030</p>
                        </div>
                        <span className="forecast-badge">5-year forecast</span>
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
                      <div className="chart-footer">
                        <Info size={14} />
                        The first point is the starting city. Forecast points
                        show full-year activity after hiring.
                      </div>
                    </section>
                    <div className="lower-grid">
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
                      <section className="panel labor-panel">
                        <div className="panel-title">
                          <h2>The employment ripple</h2>
                          <span className="tiny-label">{year.year}</span>
                        </div>
                        <p>Jobs lost, people rehired, and the remaining gap</p>
                        <div className="flow-row">
                          <span>
                            <i className="flow-dot loss" />
                            Automation layoffs
                          </span>
                          <strong>
                            −{number(r.layoffs.white + r.layoffs.blue)}
                          </strong>
                        </div>
                        <div className="flow-row">
                          <span>
                            <i className="flow-dot demand" />
                            Lower-demand layoffs
                          </span>
                          <strong>−{number(r.demandLayoffs)}</strong>
                        </div>
                        <div className="flow-row">
                          <span>
                            <i className="flow-dot hires" />
                            Hired into vacancies
                          </span>
                          <strong className="positive">
                            +{number(r.hires.white + r.hires.blue)}
                          </strong>
                        </div>
                        <div className="flow-row flow-total">
                          <span>Unfilled positions</span>
                          <strong>{number(r.vacancies)}</strong>
                        </div>
                        <div className="labor-footnote">
                          {number(r.newClosures)} firms closed this year; {number(r.closureLayoffs)} of the demand layoffs came from closures.
                        </div>
                      </section>
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
                            <TableHead>City budget balance</TableHead>
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
                              <TableCell
                                className={
                                  v.budgetBalance < 0 ? "negative" : "positive"
                                }
                              >
                                {compact(v.budgetBalance)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="table-footnote">
                        Budget balance = taxes − benefits − government
                        purchases. Debt carries forward; benefits are transfers,
                        not a direct GDP subtraction.
                      </div>
                    </section>
                  </TabsContent>
                  <TabsContent value="wealth">
                    <WealthDemand result={result} selected={r} />
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
                          First 12 companies in this sector. Every company is
                          simulated individually.
                        </p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Company</TableHead>
                              <TableHead>Status / shareholders</TableHead>
                              <TableHead>Employees</TableHead>
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
          after-tax wages. Unemployed households spend their benefit,
          prioritizing housing and groceries.
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
              "Apply layoffs to existing jobs, add provider vacancies, and match unemployed people into open roles of the same type.",
            ],
            [
              "03",
              "Follow the money",
              "Wages and benefits fund households. Purchases flow to sectors and local suppliers. Companies pay recurring automation fees.",
            ],
            [
              "04",
              "Carry the effects forward",
              "Falling demand shifts sales toward larger firms. Small firms with excess capacity close first, creating more layoffs next year. Profits fund shareholder dividends and accumulated wealth.",
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
            <strong>1.5% / year</strong>
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
          job type; no retraining, migration, inflation, aging, or new firms are
          modeled.
        </p>
        <p>
          All goods, services, and automation are local. Household budgets
          include dependents; pension income and pre-existing wealth are omitted.
          Savings and ownership wealth accumulate from zero. Investment is financed by available cash and limited by consumer demand. Internal supplier purchases are
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
