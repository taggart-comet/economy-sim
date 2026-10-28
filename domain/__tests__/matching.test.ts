import test from "node:test";
import assert from "node:assert/strict";
import { matchWorkers } from "../systems/matching";

test("balanced markets honor the setting and surplus candidates raise vacancy filling", () => {
  assert.equal(matchWorkers(10_000, 10_000, 0.6), 6000);
  const withTwoCandidates = matchWorkers(20_000, 10_000, 0.6);
  const withTenCandidates = matchWorkers(100_000, 10_000, 0.6);
  assert.ok(withTwoCandidates > 6000 && withTwoCandidates < withTenCandidates);
  assert.ok(withTenCandidates > 9500 && withTenCandidates < 9900);
  assert.ok(withTenCandidates < 10_000, "finite search friction remains without a vacancy floor");
});

test("candidate scarcity limits hiring and more openings improve job finding", () => {
  const scarce = matchWorkers(1000, 10_000, 0.6);
  assert.ok(scarce > 950 && scarce < 1000);
  assert.equal(scarce, matchWorkers(10_000, 1000, 0.6));
  assert.ok(matchWorkers(10_000, 1000, 0.6) < matchWorkers(10_000, 2000, 0.6));
});

test("matching is bounded, deterministic, and respects zero/full efficiency", () => {
  for (const seekers of [0, 1, 11, 1000, 2_000_000])
    for (const openings of [0, 1, 27, 10_000, 2_000_000]) {
      let previous = 0;
      for (const rate of [0, 1e-12, 0.01, 0.3, 0.6, 0.99, 1 - 1e-12, 1]) {
        const hires = matchWorkers(seekers, openings, rate);
        assert.ok(Number.isInteger(hires) && hires >= previous && hires <= Math.min(seekers, openings));
        assert.equal(hires, matchWorkers(seekers, openings, rate));
        previous = hires;
      }
      assert.equal(matchWorkers(seekers, openings, 0), 0);
      assert.equal(matchWorkers(seekers, openings, 1), Math.min(seekers, openings));
    }
});

test("queue growth changes matches monotonically and scaling preserves rates within rounding", () => {
  let last = 0;
  for (const seekers of [0, 1, 10, 100, 1000, 10_000, 100_000]) {
    const hires = matchWorkers(seekers, 1000, 0.6);
    assert.ok(hires >= last);
    last = hires;
  }
  assert.ok(Math.abs(matchWorkers(1000, 3000, 0.6) * 100 - matchWorkers(100_000, 300_000, 0.6)) <= 50);
});
