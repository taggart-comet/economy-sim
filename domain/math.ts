/** Largest remainder allocation: integer counts, exact total, deterministic tie-breaking. */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (
    !Number.isInteger(total) ||
    total < 0 ||
    !weights.length ||
    weights.some((x) => !Number.isFinite(x) || x < 0) ||
    sum <= 0
  )
    throw new Error("Invalid allocation");
  const raw = weights.map((w) => (total * w) / sum),
    out = raw.map(Math.floor);
  const order = raw
    .map((v, i) => ({ i, r: v - out[i] }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (let n = total - out.reduce((a, b) => a + b, 0), i = 0; i < n; i++)
    out[order[i].i]++;
  return out;
}
export function random(seed: number): () => number {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
