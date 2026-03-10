import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../vitestSharedConfig";
import path from "node:path";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    resolve: {
      alias: {
        "@testConfig": path.resolve(__dirname, "testConfig"),
        "@services": path.resolve(__dirname, "src/services"),
        "@utils": path.resolve(__dirname, "src/utils"),
      },
    },
    test: {
      include: ["src/**/*.{test,spec}.ts"],
    },
  }),
);
