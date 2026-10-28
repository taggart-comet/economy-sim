"use client";
import { useEffect, useRef, useState } from "react";
import SimulationWorker from "../../domain/simulation.worker?worker";
import type { CityConfig, SimulationResult, YearPolicy } from "@/domain/types";
export function useSimulation(
  config: CityConfig,
  scenario: YearPolicy[],
  baseline = false,
) {
  const [result, setResult] = useState<SimulationResult | null>(null),
    [pending, setPending] = useState(true),
    [error, setError] = useState("");
  const sequence = useRef(0);
  useEffect(() => {
    const requestId = ++sequence.current;
    setPending(true);
    setError("");
    let worker: Worker | undefined;
    const timer = setTimeout(() => {
      try {
        worker = new SimulationWorker();
        worker.onmessage = (event) => {
          if (requestId !== sequence.current) return;
          if (event.data.error) setError(event.data.error);
          else setResult(event.data.result);
          setPending(false);
          worker?.terminate();
        };
        worker.onerror = (event) => {
          if (requestId !== sequence.current) return;
          setError(
            event.message || "Could not run the city model. Please reload.",
          );
          setPending(false);
          worker?.terminate();
        };
        worker.postMessage({ config, scenario, requestId, baseline });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Simulation unavailable");
        setPending(false);
      }
    }, 120);
    return () => {
      clearTimeout(timer);
      worker?.terminate();
    };
  }, [config, scenario, baseline]);
  return { result, pending, error };
}
