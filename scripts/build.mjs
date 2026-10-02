import { build } from "esbuild";
import { fileURLToPath } from "node:url";

await build({
  absWorkingDir: fileURLToPath(new URL("../", import.meta.url)),
  entryPoints: ["src/node-server.ts"], outfile: "dist/server.mjs",
  bundle: true, platform: "node", target: "node24", format: "esm",
  packages: "external",
});
