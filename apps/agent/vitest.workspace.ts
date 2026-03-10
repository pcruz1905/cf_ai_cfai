import { defineProject, mergeConfig } from "vitest/config";
import { defineWorkersProject } from "@cloudflare/vitest-pool-workers/config";
import baseConfig from "./vitest.config";

export default [
  // Unit tests (Node environment)
  mergeConfig(
    baseConfig,
    defineProject({
      test: {
        name: "unit",
        include: ["src/**/*.test.ts"],
        exclude: ["src/**/*.test.ts"],
        environment: "node",
      },
    }),
  ),

  // Workers tests (Cloudflare Workers environment)
  mergeConfig(
    baseConfig,
    defineWorkersProject({
      test: {
        name: "workers",
        include: ["src/.test.ts"],
        poolOptions: {
          workers: {
            wrangler: { configPath: "./wrangler.jsonc" },
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
