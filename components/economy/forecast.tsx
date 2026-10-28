"use client";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { SimulationResult } from "@/domain/types";
export function Forecast({
  result,
  baseline,
  year,
}: {
  result: SimulationResult;
  baseline: SimulationResult | null;
  year: number;
}) {
  const data = [result.initial, ...result.years].map((r, i) => ({
    year: i === 0 ? `Jan ${result.initial.year + 1}` : String(r.year),
    gdp: r.gdp / 1e9,
    unemployment: r.unemploymentRate * 100,
    baseline: (i === 0 ? baseline?.initial : baseline?.years[i - 1])?.gdp
      ? (i === 0 ? baseline!.initial : baseline!.years[i - 1]).gdp / 1e9
      : undefined,
  }));
  return (
    <div
      className="chart-wrap"
      role="img"
      aria-label={`GDP in billions of US dollars and unemployment rate from January ${result.initial.year + 1} through ${result.years.at(-1)?.year}. Exact values are in the annual results table below.`}
    >
      <ResponsiveContainer width="100%" height={285}>
        <ComposedChart
          data={data}
          margin={{ top: 16, right: 0, left: 0, bottom: 6 }}
        >
          <defs>
            <linearGradient id="gdp-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3469e5" stopOpacity={0.14} />
              <stop offset="100%" stopColor="#3469e5" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="#edf0f5"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="year"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#8a94a4" }}
            dy={12}
            padding={{ left: 10, right: 10 }}
          />
          <YAxis
            yAxisId="gdp"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#8a94a4" }}
            tickFormatter={(v) => `$${v.toFixed(0)}B`}
            width={54}
            domain={[0, "auto"]}
          />
          <YAxis
            yAxisId="jobs"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#8a94a4" }}
            tickFormatter={(v) => `${v}%`}
            width={44}
            domain={[0, (max: number) => Math.max(20, Math.ceil(max / 5) * 5)]}
          />
          <Tooltip
            contentStyle={{
              border: "1px solid #e1e5eb",
              borderRadius: 8,
              fontSize: 14,
            }}
            formatter={(value, name) => [
              name === "Unemployment"
                ? `${Number(value).toFixed(1)}%`
                : `$${Number(value).toFixed(2)}B`,
              name,
            ]}
            labelFormatter={(label) =>
              label === `Jan ${result.initial.year + 1}` ? "Starting city" : `${label} · year end`
            }
          />
          <ReferenceLine
            x={String(year)}
            yAxisId="gdp"
            stroke="#d8dfed"
            strokeDasharray="4 4"
          />
          <Line
            yAxisId="gdp"
            name="No-layoff baseline"
            dataKey="baseline"
            type="monotone"
            stroke="#b3bdcf"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            isAnimationActive={false}
          />
          <Area
            yAxisId="gdp"
            name="GDP"
            dataKey="gdp"
            type="monotone"
            stroke="#3469e5"
            strokeWidth={2.5}
            fill="url(#gdp-fill)"
            dot={{ r: 3, fill: "#fff", strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="jobs"
            name="Unemployment"
            dataKey="unemployment"
            type="monotone"
            stroke="#dc8c52"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#fff", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
