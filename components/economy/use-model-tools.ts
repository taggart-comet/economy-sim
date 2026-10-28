"use client";
import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import type { SimulationResult, YearPolicy } from "@/domain/types";
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown;
};
type Context = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
/** Optional browser-native tools share the exact state used by the visible controls. */
export function useModelTools(
  scenario: YearPolicy[],
  result: SimulationResult | null,
  pending: boolean,
  setScenario: (s: YearPolicy[]) => void,
) {
  const current = useRef({ scenario, result, pending, setScenario });
  current.current = { scenario, result, pending, setScenario };
  useEffect(() => {
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    const register = (tool: Tool) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Browser support is optional. */
      }
    };
    register({
      name: "read_economy_forecast",
      description:
        "Read the city scenario and latest annual GDP, unemployment, benefits, and automation revenue. Check calculating before interpreting results.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => ({
        calculating: current.current.pending,
        scenario: current.current.scenario,
        years:
          current.current.result?.years.map((y) => ({
            year: y.year,
            gdp: y.gdp,
            unemploymentRate: y.unemploymentRate,
            laborForce: y.laborForce,
            workforceEntrants: y.workforceEntrants,
            workforceExits: y.workforceExits,
            benefitCost: y.benefitCost,
            pensionCost: y.pensionCost,
            pensionContributions: y.pensionContributions,
            investment: y.investment,
            investmentFunding: y.investmentFunding,
            aiRevenue: y.aiRevenue,
            roboticsRevenue: y.roboticsRevenue,
            wealthGini: y.wealthGini,
            topOnePercentWealthShare: y.topOnePercentWealthShare,
            idleCapital: y.idleCapital,
            demandBlockedInvestment: y.demandBlockedInvestment,
            closedCompanies: y.closedCompanies,
            closureLayoffs: y.closureLayoffs,
            demandLayoffs: y.demandLayoffs,
            hires: y.hires,
            vacancies: y.vacancies,
            openingsBeforeHiring: y.hires.white + y.hires.blue + y.vacancies,
          })) ?? [],
      }),
    });
    register({
      name: "configure_layoff_scenario",
      description:
        "Set annual white- and blue-collar layoff percentages in the visible simulator. Rates are percentages from 0 to 100. Returns the staged controls; use read_economy_forecast after calculation to read results.",
      inputSchema: {
        type: "object",
        properties: {
          years: {
            type: "array",
            items: {
              type: "object",
              properties: {
                year: { type: "integer" },
                whitePercent: { type: "number", minimum: 0, maximum: 100 },
                bluePercent: { type: "number", minimum: 0, maximum: 100 },
              },
              required: ["year", "whitePercent", "bluePercent"],
              additionalProperties: false,
            },
          },
        },
        required: ["years"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input) => {
        const candidate = input as {
          years?: { year: number; whitePercent: number; bluePercent: number }[];
        };
        if (
          !candidate ||
          !Array.isArray(candidate.years) ||
          !candidate.years.length
        )
          throw new Error("Supply at least one year");
        const years = candidate.years;
        const seen = new Set<number>();
        for (const y of years) {
          if (
            !y ||
            seen.has(y.year) ||
            !current.current.scenario.some((s) => s.year === y.year) ||
            ![y.whitePercent, y.bluePercent].every(
              (v) => Number.isFinite(v) && v >= 0 && v <= 100,
            )
          )
            throw new Error("Invalid year or layoff percentage");
          seen.add(y.year);
        }
        const next = current.current.scenario.map((s) => {
          const y = years.find((v) => v.year === s.year);
          return y
            ? {
                year: s.year,
                white: y.whitePercent / 100,
                blue: y.bluePercent / 100,
              }
            : s;
        });
        flushSync(() => current.current.setScenario(next));
        return {
          status: "configured",
          scenario: next,
          forecast: "recalculating",
        };
      },
    });
    return () => lifecycle.abort();
  }, []);
}
