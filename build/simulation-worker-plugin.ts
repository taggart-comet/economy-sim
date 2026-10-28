import { resolve, sep } from "node:path";
import type { Plugin } from "vite";

/** Completed simulation workers terminate, so their own HMR client cannot refresh results. */
export function simulationWorkerReload(): Plugin {
  let domainRoot: string;
  return {
    name: "simulation-worker-reload",
    apply: "serve",
    configResolved(config) {
      domainRoot = resolve(config.root, "domain") + sep;
    },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(domainRoot) && !file.includes(`${sep}__tests__${sep}`) && /\.tsx?$/.test(file)) {
        server.ws.send({ type: "full-reload", path: "*" });
      }
    },
  };
}
