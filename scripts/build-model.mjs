import { build } from "esbuild";
await build({
  entryPoints: ["domain/simulation.worker.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: "public/model.worker.js",
  minify: true,
});
