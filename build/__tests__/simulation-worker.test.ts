import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { simulationWorkerReload } from "../simulation-worker-plugin";

test("a transitive worker dependency change reloads the page and serves fresh code", { timeout: 15_000 }, async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "economy-worker-watch-")));
  await mkdir(join(root, "domain"));
  await writeFile(join(root, "entry.js"), 'import SimulationWorker from "./domain/simulation.worker?worker"; new SimulationWorker();');
  await writeFile(join(root, "domain/simulation.worker.ts"), 'import { value } from "./value"; self.postMessage(value);');
  const dependency = join(root, "domain/value.ts");
  await writeFile(dependency, 'export const value = "before-edit";');
  const server = await createServer({
    root, configFile: false, environments: { client: { isBundled: false } }, logLevel: "silent", plugins: [simulationWorkerReload()],
    server: { host: "127.0.0.1", port: 0, watch: { usePolling: true, interval: 30 } },
  });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await server.listen();
    const origin = server.resolvedUrls!.local[0];
    const entry = await (await fetch(new URL("entry.js", origin), { headers: { "sec-fetch-dest": "script" } })).text();
    assert.ok(entry.includes("simulation.worker.ts?worker"), "Vite must resolve the worker import");
    const wrapper = await (await fetch(new URL("domain/simulation.worker.ts?worker", origin), { headers: { "sec-fetch-dest": "script" } })).text();
    assert.ok(wrapper.includes("/domain/simulation.worker.ts?worker_file&type=module"));
    assert.ok(!wrapper.includes("import.meta.url") && !wrapper.includes("file://"), "worker constructor must not depend on a filesystem module URL");
    const worker = await (await fetch(new URL("domain/simulation.worker.ts?worker_file&type=module", origin), { headers: { "sec-fetch-dest": "worker" } })).text();
    assert.ok(worker.includes("/domain/value.ts"));
    const initial = await (await fetch(new URL("domain/value.ts", origin), { headers: { "sec-fetch-dest": "script" } })).text();
    assert.ok(initial.includes("before-edit"));
    const reloaded = new Promise<void>((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error("No page reload after worker dependency edit")), 8000);
      const originalSend = server.ws.send.bind(server.ws);
      server.ws.send = ((...args: Parameters<typeof originalSend>) => {
        const message: unknown = args[0];
        if (message !== null && typeof message === "object" && "type" in message && message.type === "full-reload") resolve();
        return originalSend(...args);
      }) as typeof server.ws.send;
    });
    await writeFile(dependency, 'export const value = "after-edit";');
    await reloaded;
    const updated = await (await fetch(new URL("domain/value.ts", origin), { headers: { "sec-fetch-dest": "script" } })).text();
    assert.ok(updated.includes("after-edit"));
    assert.ok(!updated.includes("before-edit"));
  } finally {
    clearTimeout(timeout);
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
