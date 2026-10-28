"use client";

import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import type { SimulationResult, YearResult } from "@/domain/types";

const balancePercent = (r: YearResult | undefined) =>
  r && r.gdp > 0 ? (r.budgetBalance / r.gdp) * 100 : null;

export function BudgetForecast({ result, baseline, year }: {
  result: SimulationResult;
  baseline: SimulationResult | null;
  year: number;
}) {
  const data = [result.initial, ...result.years].map((r, i) => ({
    year: i === 0 ? `Jan ${result.initial.year + 1}` : String(r.year),
    balance: balancePercent(r),
    unemployment: r.unemploymentRate * 100,
    baseline: balancePercent(i === 0 ? baseline?.initial : baseline?.years[i - 1]),
  }));

  return (
    <div className="chart-wrap" role="img"
      aria-label={`Government budget balance as a percentage of GDP on the left axis and unemployment rate on the right axis from January ${result.initial.year + 1} through ${result.years.at(-1)?.year}, compared with the no-layoff budget balance. Positive balances are surpluses; negative balances are deficits. Exact values are in the annual results table below.`}>
      <ResponsiveContainer width="100%" height={285}>
        <ComposedChart data={data} margin={{ top: 16, right: 0, left: 0, bottom: 6 }}>
          <CartesianGrid vertical={false} stroke="#edf0f5" strokeDasharray="3 4" />
          <XAxis dataKey="year" axisLine={false} tickLine={false}
            tick={{ fontSize: 12, fill: "#8a94a4" }} dy={12}
            padding={{ left: 10, right: 10 }} />
          <YAxis yAxisId="balance" axisLine={false} tickLine={false} width={62}
            tick={{ fontSize: 12, fill: "#8a94a4" }}
            tickFormatter={(v: number) => `${v}%`}
            domain={[(min: number) => Math.floor(Math.min(0, min) - 1),
              (max: number) => Math.ceil(Math.max(0, max) + 1)]} />
          <YAxis yAxisId="jobs" orientation="right" axisLine={false} tickLine={false}
            tick={{ fontSize: 12, fill: "#8a94a4" }} width={44}
            tickFormatter={(v: number) => `${v}%`}
            domain={[0, (max: number) => Math.max(20, Math.ceil(max / 5) * 5)]} />
          <Tooltip contentStyle={{ border: "1px solid #e1e5eb", borderRadius: 8, fontSize: 14 }}
            formatter={(value, name) => [name === "Unemployment"
              ? `${Number(value).toFixed(1)}%`
              : `${Number(value).toFixed(2)}% of GDP`, name]}
            labelFormatter={(label) => label === `Jan ${result.initial.year + 1}`
              ? "Starting city · annual accounts" : `${label} · full year`} />
          <ReferenceLine yAxisId="balance" y={0} stroke="#8a94a4"
            label={{ value: "Balanced budget", position: "insideTopRight", fill: "#748095", fontSize: 12 }} />
          <ReferenceLine yAxisId="balance" x={String(year)} stroke="#d8dfed" strokeDasharray="4 4" />
          <Line yAxisId="balance" name="Balance without layoffs" dataKey="baseline" type="linear"
            stroke="#b3bdcf" strokeWidth={2} strokeDasharray="5 5"
            dot={false} isAnimationActive={false} />
          <Line yAxisId="balance" name="Government budget balance" dataKey="balance" type="linear"
            stroke="#3469e5" strokeWidth={2.5}
            dot={{ r: 3, fill: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
          <Line yAxisId="jobs" name="Unemployment" dataKey="unemployment" type="monotone"
            stroke="#dc8c52" strokeWidth={2.5}
            dot={{ r: 3, fill: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
