import { defineConfig } from "vitest/config";
import { defineWorkersProject } from "@cloudflare/vitest-pool-workers/config";
import path from "node:path";

const alias = {
  "@testConfig": path.resolve(__dirname, "testConfig"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
    },
    onConsoleLog(log, type) {
      if (type === "stderr" && log.includes("Error closing SSE connection"))
        return false;
    },
    projects: [
      // Unit tests — Node environment, no Cloudflare bindings
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["src/**/*.unit.test.ts"],
          environment: "node",
        },
      },

      // Workers tests — real Cloudflare Workers runtime via miniflare
      defineWorkersProject({
        resolve: { alias },
        test: {
          name: "workers",
          include: ["src/**/*.workers.test.ts"],
          poolOptions: {
            workers: {
              wrangler: { configPath: "./wrangler.jsonc", remote: false },
              miniflare: {
                compatibilityDate: "2025-11-17",
                compatibilityFlags: ["nodejs_compat"],
              },
            },
          },
        },
      }),
    ],
  },
});
