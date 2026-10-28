"use client";
import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { createLayoffPreset, type LayoffPreset } from "@/domain/scenario";
import type { YearPolicy } from "@/domain/types";

const roles = ["white", "blue"] as const;
const labels = { white: "White-collar", blue: "Blue-collar" };
const colors = { white: "#9860c7", blue: "#2863df" };
const left = 52, top = 24, width = 616, height = 240;

export function LayoffPresets({ scenario, onApply, onClose }: {
  scenario: YearPolicy[];
  onApply: (policies: YearPolicy[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => scenario.map((p) => ({ ...p })));
  const [preset, setPreset] = useState<LayoffPreset>("normal");
  const [custom, setCustom] = useState(() => JSON.stringify(scenario) !== JSON.stringify(createLayoffPreset("normal", scenario[0].year, scenario.length)));
  const [axisMax, setAxisMax] = useState(() => Math.max(10, Math.ceil(Math.max(...scenario.flatMap((p) => [p.white, p.blue])) * 10) * 10));
  const [activeRole, setActiveRole] = useState<"white" | "blue">("white");
  const orderedRoles = roles.filter((role) => role !== activeRole).concat(activeRole);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ index: number; role: "white" | "blue" } | null>(null);
  const x = (index: number) => left + index * width / (draft.length - 1);
  const update = (index: number, role: "white" | "blue", percent: number) => {
    if (!Number.isFinite(percent)) return;
    if (percent > axisMax) setAxisMax(Math.min(100, Math.ceil(percent / 10) * 10));
    setDraft((current) => current.map((p, i) => i === index
      ? { ...p, [role]: Math.max(0, Math.min(100, Math.round(percent))) / 100 } : p));
    setCustom(true);
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="layoff-preset-dialog">
        <DialogTitle>Select Layoff Preset</DialogTitle>
        <DialogDescription>
          Set annual layoffs for your {draft.length}-year scenario. Drag a dot or enter an exact percentage below. Unemployment is calculated by the model.
        </DialogDescription>
        <Tabs value={preset} onValueChange={(value) => {
          const next = value as LayoffPreset;
          setPreset(next);
          setAxisMax(next === "normal" ? 10 : 25);
          setDraft(createLayoffPreset(next, scenario[0].year, scenario.length));
          setCustom(false);
        }}>
          <TabsList className="preset-tabs">
            <TabsTrigger value="normal" onClick={() => {
              if (preset === "normal") {
                setAxisMax(10);
                setDraft(createLayoffPreset("normal", scenario[0].year, scenario.length));
                setCustom(false);
              }
            }}>Normal scenario</TabsTrigger>
            <TabsTrigger value="ai-projection" onClick={() => {
              if (preset === "ai-projection") {
                setAxisMax(25);
                setDraft(createLayoffPreset("ai-projection", scenario[0].year, scenario.length));
                setCustom(false);
              }
            }}>AI Projection scenario</TabsTrigger>
          </TabsList>
        </Tabs>
        <label className="preset-range">Chart range <select value={axisMax} onChange={(event) => setAxisMax(Number(event.target.value))}>{Array.from(new Set([10, 25, 50, 100, axisMax])).sort((a, b) => a - b).map((value) => <option key={value} value={value} disabled={draft.some((p) => Math.max(p.white, p.blue) * 100 > value)}>0–{value}%</option>)}</select></label>
        <div className="preset-chart-scroll">
          <svg ref={svg} viewBox="0 0 700 310" className="preset-chart" role="group" aria-label="Editable annual layoff percentages"
            onPointerMove={(event) => {
              if (!drag.current || !svg.current) return;
              const matrix = svg.current.getScreenCTM();
              if (!matrix) return;
              const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
              update(drag.current.index, drag.current.role, Math.max(0, Math.min(axisMax, (1 - (point.y - top) / height) * axisMax)));
            }}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}>
            {[0, axisMax / 4, axisMax / 2, axisMax * 3 / 4, axisMax].map((percent) => {
              const y = top + height * (1 - percent / axisMax);
              return <g key={percent}><line x1={left} x2={left + width} y1={y} y2={y} stroke="#e1e5eb" /><text x={left - 10} y={y + 4} textAnchor="end">{percent}%</text></g>;
            })}
            {draft.map((p, i) => <text key={p.year} x={x(i)} y={290} textAnchor="middle">{p.year}</text>)}
            {orderedRoles.map((role) => <g key={role}>
              <polyline fill="none" stroke={colors[role]} strokeWidth="2.5" points={draft.map((p, i) => `${x(i)},${top + height * (1 - p[role] * 100 / axisMax)}`).join(" ")} />
              {draft.map((p, i) => <circle key={p.year} cx={x(i)} cy={top + height * (1 - p[role] * 100 / axisMax)} r={7}
                fill="white" stroke={colors[role]} strokeWidth="3" tabIndex={0} role="slider"
                aria-label={`${labels[role]} layoffs in ${p.year}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p[role] * 100)} aria-valuetext={`${Math.round(p[role] * 100)}%`} aria-orientation="vertical"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.focus();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  drag.current = { index: i, role };
                }}
                onLostPointerCapture={() => { drag.current = null; }}
                onKeyDown={(event) => {
                  const step = event.shiftKey ? 10 : 1;
                  const value = Math.round(p[role] * 100);
                  const next = { ArrowUp: value + step, ArrowRight: value + step, ArrowDown: value - step, ArrowLeft: value - step, Home: 0, End: 100 }[event.key];
                  if (next !== undefined) { event.preventDefault(); update(i, role, next); }
                }}><title>{labels[role]} · {p.year}: {Math.round(p[role] * 100)}%</title></circle>)}
            </g>)}
          </svg>
        </div>
        <div className="preset-legend">
          {roles.map((role) => <button type="button" key={role} aria-pressed={activeRole === role} onClick={() => setActiveRole(role)} title="Select line to edit overlapping points"><i style={{ background: colors[role] }} />{labels[role]}</button>)}
          <span>{custom ? "Custom · current settings" : "Illustrative preset"}</span>
        </div>
        <div className="preset-values">
          <table><caption className="sr-only">Annual layoff percentages</caption>
            <thead><tr><th>Year</th><th>White-collar %</th><th>Blue-collar %</th></tr></thead>
            <tbody>{draft.map((p, i) => <tr key={p.year}><th scope="row">{p.year}</th>{roles.map((role) => <td key={role}><input type="number" min={0} max={100} step={1} value={Math.round(p[role] * 100)} aria-label={`${labels[role]} percentage in ${p.year}`} onChange={(event) => update(i, role, event.currentTarget.valueAsNumber)} /></td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="preset-note">Normal models gradual adoption, with office layoffs rising first and robotics following. AI Projection increases them over the selected horizon. Both are editable assumptions.</p>
        <div className="preset-actions"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => { onApply(draft); onClose(); }}>Apply layoffs</Button></div>
      </DialogContent>
    </Dialog>
  );
}
