import { ArrowRight, Cpu, ShoppingBag, Store } from "lucide-react";
import type { YearResult } from "@/domain/types";

const count = (value: number) => value.toLocaleString("en-US");
const dollars = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2,
}).format(Math.abs(value));
const signedDollars = (value: number) => `${value < 0 ? "−" : value > 0 ? "+" : ""}${dollars(value)}`;

export function IndustryRipple({ current, previous }: { current: YearResult; previous: YearResult }) {
  const sectors = [...current.sectors].sort((a, b) =>
    (b.directLayoffs + b.demandLayoffs) - (a.directLayoffs + a.demandLayoffs) || a.name.localeCompare(b.name));
  const maxLoss = Math.max(1, ...sectors.map(s => s.directLayoffs + s.demandLayoffs));
  const direct = current.layoffs.white + current.layoffs.blue;

  return (
    <section className="panel industry-ripple" aria-labelledby="ripple-title">
      <div className="panel-title">
        <h2 id="ripple-title">The industry ripple</h2>
        <span className="tiny-label">{current.year}</span>
      </div>
      <p>One lost paycheck reaches beyond one business.</p>

      <div className="ripple-path" aria-label="Automation leads to lost income, lower spending, and fewer jobs">
        <span><Cpu size={15} aria-hidden="true" />Automation</span>
        <ArrowRight size={14} aria-hidden="true" />
        <span><ShoppingBag size={15} aria-hidden="true" />Less spending</span>
        <ArrowRight size={14} aria-hidden="true" />
        <span><Store size={15} aria-hidden="true" />Fewer jobs</span>
      </div>

      <div className="ripple-totals">
        <div className="ripple-stat direct">
          <span><i className="ripple-key direct" />Direct layoffs</span>
          <strong>{count(direct)}</strong>
          <small>Jobs replaced by automation</small>
        </div>
        <div className="ripple-stat indirect">
          <span><i className="ripple-key indirect" />Indirect layoffs</span>
          <strong>{count(current.demandLayoffs)}</strong>
          <small>Demand & staffing adjustments</small>
        </div>
      </div>

      <div className="ripple-table-note">
        <span>{sectors.length} industries · most job losses first</span>
        <span>Revenue vs. {previous.year}</span>
      </div>
      <table className="ripple-table">
        <caption className="sr-only">
          Annual layoffs by industry in {current.year}, with revenue changes from {previous.year}.
          Bar lengths compare job losses on the same scale; direct and indirect segments use different colors.
        </caption>
        <thead>
          <tr>
            <th scope="col">Industry / jobs lost</th>
            <th scope="col" className="direct-text">Direct</th>
            <th scope="col" className="indirect-text">Indirect</th>
            <th scope="col">Revenue change</th>
          </tr>
        </thead>
        <tbody>
          {sectors.map(s => {
            const prior = previous.sectors.find(p => p.id === s.id);
            const change = prior ? s.revenue - prior.revenue : null;
            const rate = prior && prior.revenue > 0 && change !== null ? change / prior.revenue : null;
            const trend = change === null || Math.abs(change) < 0.5 ? "neutral" : change < 0 ? "down" : "up";
            return (
              <tr key={s.id}>
                <th scope="row">
                  <span className="ripple-industry-name">{s.name}</span>
                  <span className="ripple-bar-track" aria-hidden="true">
                    <span className="ripple-bar direct" style={{ width: `${s.directLayoffs / maxLoss * 100}%` }} />
                    <span className="ripple-bar indirect" style={{ width: `${s.demandLayoffs / maxLoss * 100}%` }} />
                  </span>
                </th>
                <td className={s.directLayoffs ? "direct-text" : "ripple-zero"}>{count(s.directLayoffs)}</td>
                <td className={s.demandLayoffs ? "indirect-text" : "ripple-zero"}>{count(s.demandLayoffs)}</td>
                <td className={`ripple-revenue ${trend}`}>
                  <strong>{change === null ? "—" : signedDollars(Math.abs(change) < 0.5 ? 0 : change)}</strong>
                  <small>{rate === null ? "No prior revenue" : `${rate < 0 ? "−" : rate > 0 ? "+" : ""}${(Math.abs(rate) * 100).toFixed(1)}%`}</small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="ripple-footnote">
        Layoffs are annual job losses before rehiring. Indirect losses include lower purchasing power,
        business closures, and adjustments for productivity and payroll affordability;
        they do not isolate purchasing power alone. Revenue is the annual change in sales.
      </p>
    </section>
  );
}
