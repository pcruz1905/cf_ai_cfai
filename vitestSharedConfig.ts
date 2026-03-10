import { defineConfig } from "vitest/config";

export const sharedConfig = defineConfig({
  test: {
    passWithNoTests: true,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.wrangler/**",
      "**/e2e-tests/**",
      "**/testConfig/**",
    ],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html", "lcov"],
      reportOnFailure: true,
      reportsDirectory: "coverage",
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
        "**/.wrangler/**",
        "**/testConfig/**",
        "**/*.{test,spec}.*",
        "**/*.config.*",
        "**/*.d.ts",
        "**/schemas/**",
        "**/schema.ts",
        "**/types/**",
        "**/*.types.ts",
      ],
    },
  },
});

export default sharedConfig;
