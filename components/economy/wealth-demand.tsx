"use client";
import { ResponsiveContainer, ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import type { SimulationResult, YearResult } from "@/domain/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(n);
const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
const count = (n: number) => n.toLocaleString("en-US");
export function WealthDemand({ result, selected }: { result: SimulationResult; selected: YearResult }) {
  const history = result.years.map((y) => ({ year: y.year, idle: y.idleCapital / 1e9, invested: y.investment / 1e9, blocked: y.demandBlockedInvestment / 1e9 }));
  const lorenz = selected.lorenz.map((p) => ({ population: p.population * 100, wealth: p.wealth * 100, equality: p.population * 100 }));
  return <div className="wealth-demand">
    <section className="panel detail-panel">
      <div className="panel-title"><div><h2>Who owns the gains?</h2><p>Accumulated financial wealth · {selected.year}</p></div><span className="tiny-label">OWNERSHIP & DEMAND</span></div>
      <div className="wealth-metrics">
        <div><span>Top 1% wealth share</span><strong>{percent(selected.topOnePercentWealthShare)}</strong><small>of household-owned wealth</small></div>
        <div><span>Wealth Gini</span><strong>{selected.wealthGini.toFixed(3)}</strong><small>0 = equal · 1 = concentrated</small></div>
        <div><span>Idle capital</span><strong>{money(selected.idleCapital)}</strong><small>household + company cash at year end</small></div>
        <div><span>Businesses closed</span><strong>{count(selected.closedCompanies)}</strong><small>{count(selected.newClosures)} new closures this year</small></div>
      </div>
      <p className="wealth-note">Qualifying firms with more than 50 employees assign roughly 1% as protected shareholders (rounded to whole people). Eligibility requires annual actual or modeled potential profit above $1M. They share after-tax profits, spend up to $500,000 a year each, and keep the rest as wealth.</p>
    </section>
    <div className="wealth-charts">
      <section className="panel detail-panel">
        <h2>Wealth concentration</h2><p>Share of wealth held by the poorest fraction of households</p>
        <div role="img" aria-label={`Lorenz curve for ${selected.year}. Top 1% hold ${percent(selected.topOnePercentWealthShare)} of wealth; Gini ${selected.wealthGini.toFixed(3)}.`}>
          <ResponsiveContainer width="100%" height={290}><ComposedChart data={lorenz} margin={{ top: 20, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#edf0f5" strokeDasharray="3 4" />
            <XAxis dataKey="population" type="number" domain={[0, 100]} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} tick={{ fontSize: 11 }} width={45} />
            <Tooltip formatter={(v, n) => [`${Number(v).toFixed(1)}%`, n]} labelFormatter={(v) => `Poorest ${Number(v).toFixed(0)}%`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line dataKey="equality" name="Equal distribution" stroke="#a7b0c0" strokeDasharray="5 5" dot={false} isAnimationActive={false} />
            <Area dataKey="wealth" name="Actual wealth share" stroke="#3469e5" fill="#e9effd" strokeWidth={2} isAnimationActive={false} />
          </ComposedChart></ResponsiveContainer>
        </div>
        <div className="table-footnote">{count(selected.shareholders)} shareholders hold {percent(selected.shareholderWealthShare)} of household-owned wealth. Each labor-force member represents one budget including dependents. Starting wealth is zero; property values and historical fortunes are excluded.</div>
      </section>
      <section className="panel detail-panel">
        <h2>When capital has nowhere to go</h2><p>Cash accumulates as demand limits investment opportunities</p>
        <div role="img" aria-label="Annual chart comparing year-end idle capital with investment and investment blocked by weak demand, in billions of dollars. Exact values appear in the table below.">
          <ResponsiveContainer width="100%" height={290}><ComposedChart data={history} margin={{ top: 20, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#edf0f5" strokeDasharray="3 4" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${v}B`} tick={{ fontSize: 11 }} width={50} />
            <Tooltip formatter={(v, n) => [money(Number(v) * 1e9), n]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="invested" name="Invested this year" fill="#76b6a0" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="blocked" name="Demand-blocked this year" fill="#dfaa78" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Line dataKey="idle" name="Idle cash at year end" stroke="#7d62bf" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
          </ComposedChart></ResponsiveContainer>
        </div>
        <div className="table-footnote">Idle cash is a stock; investment is an annual flow. Demand-blocked investment measures affordable opportunities lost relative to starting demand. Other idle cash may reflect ordinary saving or limited production capacity.</div>
      </section>
    </div>
    <section className="panel detail-panel">
      <h2>The demand → closure → layoff cycle</h2>
      <p>Citizens set demand by category. Larger firms gain share as demand falls; small, loss-making firms close first when their sector has excess capacity. Displaced workers reduce next year’s demand.</p>
      <div className="wealth-metrics">
        <div><span>Shareholder dividends</span><strong>{money(selected.dividends)}</strong><small>paid from previous-year profits</small></div>
        <div><span>Shareholder consumption</span><strong>{money(selected.shareholderConsumption)}</strong><small>total purchases after spending caps</small></div>
        <div><span>Closure layoffs</span><strong>{count(selected.closureLayoffs)}</strong><small>included in {count(selected.demandLayoffs)} demand layoffs</small></div>
        <div><span>Demand-blocked investment</span><strong>{money(selected.demandBlockedInvestment)}</strong><small>this year’s lost investment opportunity</small></div>
      </div>
      <Table><TableHeader><TableRow><TableHead>Sector</TableHead><TableHead>Revenue vs start</TableHead><TableHead>Small-firm revenue share</TableHead><TableHead>Active / closed firms</TableHead></TableRow></TableHeader>
        <TableBody>{selected.sectors.filter((s) => !["ai", "robotics"].includes(s.id)).map((s) => {
          const smallRevenue = selected.companies.filter((c) => c.sector === s.id && c.initialWorkers.white + c.initialWorkers.blue <= 50).reduce((sum, c) => sum + c.revenue, 0);
          return <TableRow key={s.id}><TableCell>{s.name}</TableCell><TableCell>{percent(s.initialRevenue ? s.revenue / s.initialRevenue - 1 : 0)}</TableCell><TableCell>{percent(s.revenue ? smallRevenue / s.revenue : 0)}</TableCell><TableCell>{count(s.companies)} / {count(s.closedCompanies)}</TableCell></TableRow>;
        })}</TableBody></Table>
      <div className="table-footnote">Small firms start with ≤50 employees. Closures follow prior-year results and cancel automation contracts. Shareholders retain ownership even after closure, as unpaid proprietors; they are never laid off.</div>
    </section>
    <section className="panel detail-panel"><h2>Wealth & demand by year</h2>
      <Table><TableHeader><TableRow><TableHead>Year</TableHead><TableHead>Top 1% share</TableHead><TableHead>Idle cash</TableHead><TableHead>Investment</TableHead><TableHead>Demand-blocked</TableHead><TableHead>New closures</TableHead><TableHead>Closure layoffs</TableHead></TableRow></TableHeader><TableBody>
        {result.years.map((y) => <TableRow key={y.year} className={y.year === selected.year ? "highlight-row" : ""}><TableCell>{y.year}</TableCell><TableCell>{percent(y.topOnePercentWealthShare)}</TableCell><TableCell>{money(y.idleCapital)}</TableCell><TableCell>{money(y.investment)}</TableCell><TableCell>{money(y.demandBlockedInvestment)}</TableCell><TableCell>{count(y.newClosures)}</TableCell><TableCell>{count(y.closureLayoffs)}</TableCell></TableRow>)}
      </TableBody></Table>
    </section>
  </div>;
}
