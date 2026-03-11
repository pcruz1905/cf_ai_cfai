import { defineProject, mergeConfig } from "vitest/config";
import { defineWorkersProject } from "@cloudflare/vitest-pool-workers/config";
import baseConfig from "./vitest.config";

export default [
  // Unit tests — run in Node, no Cloudflare bindings needed
  mergeConfig(
    baseConfig,
    defineProject({
      test: {
        name: "unit",
        include: ["src/**/*.unit.test.ts"],
        environment: "node",
      },
    }),
  ),

  // Workers tests — run in Cloudflare Workers (miniflare) with real bindings
  mergeConfig(
    baseConfig,
    defineWorkersProject({
      test: {
        name: "workers",
        include: ["src/**/*.workers.test.ts"],
        poolOptions: {
          workers: {
            wrangler: { configPath: "./wrangler.jsonc", environment: "local" },
            miniflare: {
              compatibilityDate: "2025-11-17",
              compatibilityFlags: ["nodejs_compat"],
            },
          },
        },
      },
    }),
  ),
];
