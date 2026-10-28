import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, DEFAULT_SCENARIO } from "../config";
import { createLayoffPreset, resizeScenario, SCENARIO_DURATIONS } from "../scenario";
import { simulate } from "../simulation";

test("duration changes retain policies, add zero layoffs, and discard removed years", () => {
  const extended = resizeScenario(DEFAULT_SCENARIO, 2026, 10);
  assert.deepEqual(extended.slice(0, 5), DEFAULT_SCENARIO);
  assert.deepEqual(extended.slice(5), Array.from({ length: 5 }, (_, i) => ({
    year: 2031 + i, white: 0, blue: 0,
  })));
  extended[9].white = 0.5;
  const shortened = resizeScenario(extended, 2026, 7);
  assert.equal(shortened.at(-1)?.year, 2032);
  assert.equal(resizeScenario(shortened, 2026, 10)[9].white, 0);
  assert.deepEqual(DEFAULT_SCENARIO[0], extended[0]);
  assert.notEqual(DEFAULT_SCENARIO[0], extended[0]);
});

test("all selectable durations simulate matching scenario and no-layoff horizons", () => {
  for (const years of SCENARIO_DURATIONS) {
    const config = {
      ...DEFAULT_CONFIG,
      population: 10_000,
      years,
      sectors: DEFAULT_CONFIG.sectors.map((s) => ({ ...s, companies: 1 })),
    };
    for (const policies of [DEFAULT_SCENARIO, []]) {
      const result = simulate(config, resizeScenario(policies, config.startYear, years));
      assert.deepEqual(result.years.map((y) => y.year),
        Array.from({ length: years }, (_, i) => config.startYear + i));
      assert.ok(result.years.every((y) => Number.isFinite(y.gdp)));
    }
  }
});


test("presets cover each duration with bounded rates and share one normal calendar-year path and match startup defaults", () => {
  assert.deepEqual(createLayoffPreset("normal", 2026, 5), DEFAULT_SCENARIO);
  const normalTen = createLayoffPreset("normal", 2026, 10);
  for (const years of SCENARIO_DURATIONS) {
    assert.deepEqual(createLayoffPreset("normal", 2026, years), normalTen.slice(0, years));
    for (const preset of ["normal", "ai-projection"] as const) {
      const policies = createLayoffPreset(preset, 2026, years);
      assert.equal(policies.length, years);
      assert.equal(policies.at(-1)?.year, 2026 + years - 1);
      assert.ok(policies.every((p) => [p.white, p.blue].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)));
      if (preset === "ai-projection") {
        const expected = [5, 7, 9, 10, 12, 15, 15, 15, 15, 15].slice(0, years);
        assert.deepEqual(policies.map((p) => p.white), expected.map((v) => v / 100));
        assert.deepEqual(policies.map((p) => p.blue), expected.map((v) => (v - 2) / 100));
        assert.ok(policies.every((p, i) => i === 0 || p.white >= policies[i - 1].white && p.blue >= policies[i - 1].blue));
      }
    }
  }
});
