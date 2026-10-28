"use client";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import type { CityConfig, SimulationResult, YearResult } from "@/domain/types";

const count = (n: number) => n.toLocaleString("en-US");
const signed = (n: number) => `${n < 0 ? "−" : n > 0 ? "+" : ""}${count(Math.abs(n))}`;

export function AgeDistribution({ config, result, selected }: {
  config: CityConfig;
  result: SimulationResult;
  selected: YearResult;
}) {
  const start = result.initial.demographics;
  const data = selected.demographics.ageGroups.map((group, i) => ({
    ...group, starting: start.ageGroups[i].residents,
  }));
  const elapsed = result.years.filter(y => y.year <= selected.year);
  const entrants = elapsed.reduce((sum, y) => sum + y.workforceEntrants, 0);
  const exits = elapsed.reduce((sum, y) => sum + y.workforceExits, 0);
  const net = selected.laborForce - result.initial.laborForce;
  const employmentChange = selected.employed.white + selected.employed.blue -
    result.initial.employed.white - result.initial.employed.blue;
  const entryFrom = Math.max(0, config.workforceEntryAge - start.horizonYears);
  const retirementFrom = Math.max(config.workforceEntryAge, config.retirementAge - start.horizonYears);
  return (
    <section className="panel age-panel" aria-labelledby="age-distribution-title">
      <div className="panel-title">
        <div>
          <h2 id="age-distribution-title">Population by age</h2>
          <p>All residents · five-year age bands · starting city compared with {selected.year}</p>
        </div>
        <span className="tiny-label">{selected.year} · YEAR END</span>
      </div>
      <div className="chart-legend age-legend">
        <span><i className="age-key employed" />Employed</span>
        <span><i className="age-key unemployed" />Unemployed</span>
        <span><i className="age-key inactive" />Outside labor force</span>
        <span><i className="legend-line baseline" />Starting population</span>
      </div>
      <div className="age-chart-scroll">
        <div className="age-chart" role="img" aria-label={`Population by five-year age group at the end of ${selected.year}, split into employed, unemployed, and outside the labor force, with starting population for comparison. Exact counts are in the expandable age table below.`}>
          <ResponsiveContainer width="100%" height={285}>
            <ComposedChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="#edf0f5" strokeDasharray="3 4" />
              <XAxis dataKey="label" interval={0} angle={-40} textAnchor="end" height={52}
                tick={{ fontSize: 11, fill: "#778297" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${Number(v) / 1000}k`} width={48}
                tick={{ fontSize: 11, fill: "#778297" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value, name) => [count(Number(value)), name]}
                labelFormatter={label => `Age ${label}`}
                contentStyle={{ border: "1px solid #e1e5eb", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="employed" name="Employed" stackId="population" fill="#3469e5" isAnimationActive={false} />
              <Bar dataKey="unemployed" name="Unemployed" stackId="population" fill="#dc8c52" isAnimationActive={false} />
              <Bar dataKey="inactive" name="Outside labor force" stackId="population" fill="#d2d9e5" isAnimationActive={false} />
              <Line dataKey="starting" name="Starting population" type="linear" stroke="#8b98ae"
                strokeDasharray="4 4" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="age-cohort-note">
        At the start, <strong>{count(start.upcomingEntrants)}</strong> residents aged {entryFrom}–{config.workforceEntryAge - 1} are due to enter during the {start.horizonYears}-year forecast, while <strong>{count(start.upcomingExits)}</strong> labor-force members aged {retirementFrom}–{config.retirementAge - 1} are due to retire. Inactive adults in that older band are already outside the labor force.
      </div>
      <div className="age-flow-heading">Workforce movements · start to {selected.year}</div>
      <div className="age-flow-metrics">
        <div><span>Entered the workforce</span><strong>{count(entrants)}</strong></div>
        <div><span>Retired from the workforce</span><strong>{count(exits)}</strong></div>
        <div><span>Net labor-force change</span><strong>{signed(net)}</strong></div>
      </div>
      <p className="age-explanation">
        The labor force has {net < 0 ? "shrunk" : net > 0 ? "grown" : "stayed unchanged"}{net !== 0 && <> by {count(Math.abs(net))} ({(100 * Math.abs(net) / result.initial.laborForce).toFixed(1)}%)</>}, while employment has changed by {signed(employmentChange)}. Hiring and job losses also determine unemployment; the age profile alone does not explain its direction.
      </p>
      <details className="age-data">
        <summary>View exact age counts</summary>
        <div className="age-table-scroll">
          <table>
            <caption>Starting population and end-of-{selected.year} population by age and labor-force status</caption>
            <thead><tr><th scope="col">Age</th><th scope="col">Starting city</th><th scope="col">{selected.year} residents</th><th scope="col">Employed</th><th scope="col">Unemployed</th><th scope="col">Outside labor force</th></tr></thead>
            <tbody>{data.map(group => <tr key={group.label}><th scope="row">{group.label}</th><td>{count(group.starting)}</td><td>{count(group.residents)}</td><td>{count(group.employed)}</td><td>{count(group.unemployed)}</td><td>{count(group.inactive)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
      <div className="chart-footer">
        Seeded synthetic ages, not Census estimates. Entry at {config.workforceEntryAge}, retirement at {config.retirementAge}; no births, deaths, or migration. Age cohorts are the same across automation scenarios.
      </div>
    </section>
  );
}
