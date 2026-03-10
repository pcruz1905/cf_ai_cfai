import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@testConfig": path.resolve(__dirname, "testConfig"),
    },
  },
  test: {
    include: ["src/**/*.{test,spec}.ts"],
  },
});
