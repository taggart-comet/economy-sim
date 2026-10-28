/**
 * Bounded search matching (Den Haan–Ramey–Watson form):
 * H = U V / (U^shape + V^shape)^(1/shape).
 * The setting is the matched fraction when U = V, so shape = log(2)/-log(rate).
 * Evaluate using the smaller/larger ratio to avoid overflowing large powers.
 * More candidates raise the vacancy-fill rate; more openings raise job finding.
 */
export function matchWorkers(jobSeekers: number, openings: number, balancedRate: number): number {
  const smaller = Math.min(jobSeekers, openings);
  if (smaller === 0 || balancedRate === 0) return 0;
  if (balancedRate === 1) return smaller;
  const shape = Math.log(2) / -Math.log(balancedRate);
  const ratio = smaller / Math.max(jobSeekers, openings);
  const fraction = Math.exp(-Math.log1p(Math.pow(ratio, shape)) / shape);
  return Math.min(smaller, Math.max(0, Math.round(smaller * fraction)));
}
