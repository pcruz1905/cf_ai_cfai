/**
 * Effect-TS Testing Utilities
 *
 * Test helpers for Effect-based applications using @effect/vitest.
 * Provides type-safe table-driven and scenario-based testing patterns.
 *
 * @module testHelpers
 */

import { it, expect } from "@effect/vitest";
import { Effect, Either, type Layer } from "effect";

// ============================================================================
// makeTests - Individual test case definitions
// ============================================================================

/**
 * Assertion can be a function predicate or an object for toMatchObject
 */
export type Assertion<T> = ((value: T) => void) | Record<string, unknown>;

export interface TestCase<Expect extends "success" | "failure", A, R> {
  readonly expect: Expect;
  readonly description: string;
  readonly effect: Expect extends "success"
    ? Effect.Effect<A, any, R>
    : Effect.Effect<any, A, R>;
  readonly layers: Layer.Layer<NoInfer<R>>;
  readonly assert: Assertion<NoInfer<A>>;
  readonly timeout?: number;
}

export const success = <A, R>(
  config: Omit<TestCase<"success", A, R>, "expect">,
): TestCase<"success", A, R> => ({ ...config, expect: "success" });

export const failure = <A, R>(
  config: Omit<TestCase<"failure", A, R>, "expect">,
): TestCase<"failure", A, R> => ({ ...config, expect: "failure" });

const runAssertion = <T>(value: T, assertion: Assertion<T>): void => {
  if (typeof assertion === "function") {
    assertion(value);
  } else {
    expect(value).toMatchObject(assertion);
  }
};

interface RunnableTestCase {
  readonly expect: "success" | "failure";
  readonly description: string;
  readonly effect: unknown;
  readonly layers: unknown;
  readonly assert: unknown;
  readonly timeout?: number;
}

export const makeTests = <const T extends readonly RunnableTestCase[]>(
  testCases: T,
): void => {
  for (const rawTestCase of testCases) {
    const testCase = rawTestCase as TestCase<
      "success" | "failure",
      unknown,
      never
    >;
    const {
      description,
      effect,
      layers,
      assert: assertion,
      timeout,
    } = testCase;

    it.effect(
      description,
      () =>
        Effect.gen(function* () {
          if (testCase.expect === "failure") {
            const result = yield* Effect.either(effect);
            if (Either.isLeft(result)) {
              runAssertion(result.left, assertion);
            } else {
              expect.fail(
                `Expected effect to fail, but it succeeded with: ${JSON.stringify(result.right)}`,
              );
            }
          } else {
            const result = yield* effect;
            runAssertion(result, assertion);
          }
        }).pipe(Effect.provide(layers)),
      timeout,
    );
  }
};

// ============================================================================
// createTableTests - Table-driven testing for functions returning Effects
// ============================================================================

interface TableScenario<
  Expect extends "success" | "failure",
  TInput,
  TResult,
  R,
> {
  readonly expect: Expect;
  readonly name: string;
  readonly input: TInput;
  readonly layers: Layer.Layer<R>;
  readonly timeout?: number;
  readonly assert: TResult | ((result: TResult) => void);
}

type ScenarioEffectFn<S> =
  S extends TableScenario<infer Expect, infer TInput, infer TResult, infer R>
    ? Expect extends "success"
      ? (input: TInput) => Effect.Effect<TResult, any, R>
      : (input: TInput) => Effect.Effect<any, TResult, R>
    : never;

type ScenariosFromEffectFn<EffectFn> = EffectFn extends (
  input: infer TInput,
) => Effect.Effect<infer TResult, infer TError, infer R>
  ? (
      | TableScenario<"success", TInput, TResult, R>
      | TableScenario<"failure", TInput, TError, R>
    )[]
  : never;

const createTest = <Scenario extends TableScenario<any, any, any, any>>(
  scenario: Scenario,
  effectFn: ScenarioEffectFn<Scenario>,
): void => {
  it.effect(
    scenario.name,
    () =>
      Effect.gen(function* () {
        if (scenario.expect === "failure") {
          const result = yield* Effect.either(effectFn(scenario.input));

          if (Either.isLeft(result)) {
            if (typeof scenario.assert === "function") {
              scenario.assert(result.left);
            } else {
              expect(result.left).toEqual(scenario.assert);
            }
          } else {
            expect.fail(
              `Expected effect to fail, but it succeeded with: ${JSON.stringify(result.right)}`,
            );
          }
        } else {
          const result = yield* effectFn(scenario.input);

          if (typeof scenario.assert === "function") {
            scenario.assert(result);
          } else {
            expect(result).toEqual(scenario.assert);
          }
        }
      }).pipe(Effect.provide(scenario.layers)),
    scenario.timeout,
  );
};

export const createTableTests = <TInput, TResult, TError, R>(
  effectFn: (input: TInput) => Effect.Effect<TResult, TError, R>,
) => ({
  run: (scenarios: ScenariosFromEffectFn<typeof effectFn>): void => {
    for (const scenario of scenarios) {
      createTest(scenario, effectFn);
    }
  },
});

export const tableTests = createTableTests;
