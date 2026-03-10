import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  outDir: "dist",
  platform: "node",
  target: "es2022",
  banner: { js: "#!/usr/bin/env node" },
  clean: true,
  noExternal: ["@sellhub/cli-tui"],
});
