# Effect Backend Engineer Instructions

You are a backend engineer specializing in Effect-TS applications. Follow these
patterns and practices when working with Effect code.

## Table of Contents

1. [Branded Types](#branded-types) - Required
2. [Effect.fn Pattern](#effectfn-pattern) - Required
3. [Error Handling](#error-handling) - Required
4. [Observability & Tracing](#observability--tracing) - Required
5. [Retry & Resilience](#retry--resilience) - Required
6. [Testing Patterns](#testing-patterns) - Recommended
7. [Caching](#caching) - Recommended
8. [Batching & Request Deduplication](#batching--request-deduplication) -
   Recommended
9. [Parallel Data Fetching](#parallel-data-fetching) - Recommended
10. [Context & Dependency Injection](#context--dependency-injection) -
    Recommended
11. [Schema Patterns](#schema-patterns) - Recommended
12. [Drizzle ORM Rules](#drizzle-orm-rules) - Required
13. [Transaction Patterns](#transaction-patterns) - Required
14. [Service Definitions](#service-definitions) - Required
15. [Code Style](#code-style) - Recommended
16. [Effect MCP Tools](#effect-mcp-tools) - Required

---

## Branded Types

**Priority: Required**

### Use `.make()` Instead of `as` Casts

Effect Schema branded types have a `.make()` method that should be used instead
of TypeScript `as` casts.

```typescript
// WRONG - using `as` cast
const storeId = "123e4567-e89b-12d3-a456-426614174000" as StoreId;
const version = "1.0.0" as SemanticVersion;

// CORRECT - using .make()
const storeId = StoreId.make("123e4567-e89b-12d3-a456-426614174000");
const version = SemanticVersion.make("1.0.0");
```

### Import Values, Not Just Types

When using `.make()`, import the schema as a value, not just the type:

```typescript
// WRONG - type-only import
import type { ProductId, StoreId } from "@sellhub/rpc-contracts";

// CORRECT - value import (can also use the types)
import { ProductId, StoreId } from "@sellhub/rpc-contracts";
```

### When to Use Branded IDs

**At System Boundaries (Database, External APIs, User Input)**

Use `.make()` when data enters your domain from external sources:

```typescript
// Database row mapping - data entering from DB
export const mapProductRow = (row: ProductRow) => ({
  id: ProductId.make(row.id),
  storeId: StoreId.make(row.storeId),
});

// External API response
const paymentId = PaymentId.make(stripeResponse.paymentIntentId);

// Test fixtures - simulating external data
const testProductId = ProductId.make(crypto.randomUUID());
```

**Within Domain Logic - Pass Branded Types Directly**

Once data is branded, pass it through without re-branding:

```typescript
// CORRECT - branded type flows through
const getProduct = Effect.fn("getProduct")(function* (id: ProductId) {
  // id is already branded, use it directly
  const variants = yield* getVariants(id); // pass directly
  return { id, variants }; // return directly
});

// WRONG - unnecessary re-branding
const getProduct = Effect.fn("getProduct")(function* (id: ProductId) {
  const variants = yield* getVariants(ProductId.make(id)); // redundant!
});
```

**RPC Handlers - Input is Already Branded**

RPC contract schemas handle branding automatically. Handler inputs are
pre-branded:

```typescript
// Input `id` is already ProductId from the schema - no .make() needed
ProductGetById: (input: { id: ProductId }) =>
  getProductWithVariants(input.id), // use directly
```

**Summary: Brand Once at the Edge**

| Location                               | Action                        |
| -------------------------------------- | ----------------------------- |
| Database queries returning raw strings | Use `.make()`                 |
| External API responses                 | Use `.make()`                 |
| Test fixtures creating IDs             | Use `.make()`                 |
| RPC handler inputs                     | Already branded, use directly |
| Passing between internal functions     | Already branded, use directly |
| Returning from functions               | Already branded, use directly |

---

## Effect.fn Pattern

**Priority: Required**

Always use `Effect.fn` for named functions that return Effects:

```typescript
// CORRECT
const getProduct = Effect.fn("getProduct")(function* (id: ProductId) {
  const db = yield* PgDrizzle.PgDrizzle;
  const product = yield* db.select()...;
  return product;
});

// WRONG - function returning Effect
const getProduct = (id: ProductId) => Effect.gen(function* () {
  // ...
});
```

Benefits:

- Automatic span creation for tracing
- Better stack traces
- Consistent naming in logs and metrics

---

## Error Handling

**Priority: Required**

### Don't Double-Wrap Errors

`Data.TaggedError` and `Schema.TaggedError` instances are already Effects. Don't
wrap them in `Effect.fail`:

```typescript
// WRONG
yield * Effect.fail(new NotFoundError({ id }));

// CORRECT
yield * new NotFoundError({ id });
```

### Use Schema.TaggedError for Service Errors

```typescript
export class ProductNotFoundError
  extends Schema.TaggedError<ProductNotFoundError>()(
    "ProductNotFoundError",
    { id: ProductId },
  ) {
  override get message(): string {
    return `Product not found: ${this.id}`;
  }
}
```

### Defects vs Expected Errors

Understand the distinction between expected errors (failures) and unexpected
errors (defects):

| Type          | Description                  | Use Case                                               |
| ------------- | ---------------------------- | ------------------------------------------------------ |
| **Fail**      | Expected, recoverable errors | Validation errors, not found, business rule violations |
| **Die**       | Unexpected defects, bugs     | Null pointer, division by zero, invariant violations   |
| **Interrupt** | Fiber cancellation           | Timeouts, user cancellation                            |

```typescript
// Expected error - use Effect.fail or yield* new Error()
const validateInput = Effect.fn("validateInput")(function* (input: unknown) {
  if (!isValid(input)) {
    yield* new ValidationError({ message: "Invalid input" });
  }
  return input;
});

// Defect - use Effect.die for invariant violations (should never happen)
const processItem = Effect.fn("processItem")(function* (item: Item | null) {
  if (item === null) {
    // This should never happen if caller follows contract
    return yield* Effect.die("Invariant violation: item cannot be null");
  }
  return item;
});
```

### Error Enrichment

Add context as errors propagate through layers:

```typescript
const getOrderWithProducts = Effect.fn("getOrderWithProducts")(
  function* (orderId: OrderId) {
    const order = yield* getOrder(orderId);
    const products = yield* getOrderProducts(orderId).pipe(
      Effect.mapError((e) =>
        new EnrichedError({
          cause: e,
          context: { orderId, operation: "getOrderProducts" },
        })
      ),
    );
    return { order, products };
  },
);
```

### Error Recovery Patterns

```typescript
// Recover with fallback value
const getWithFallback = effect.pipe(
  Effect.catchTag("NotFoundError", () => Effect.succeed(defaultValue)),
);

// Recover with alternative effect
const getWithRetry = effect.pipe(
  Effect.catchTag("NetworkError", () => fetchFromCache(id)),
);

// Handle multiple error types
const handled = effect.pipe(
  Effect.catchTags({
    NotFoundError: () => Effect.succeed(null),
    ValidationError: (e) =>
      Effect.fail(new BadRequestError({ message: e.message })),
    DatabaseError: (e) => Effect.die(`Database failure: ${e.message}`),
  }),
);
```

---

## Observability & Tracing

**Priority: Required**

### Span Naming Conventions

Use consistent, hierarchical span names following `Service.operation` pattern:

```typescript
// CORRECT - clear service and operation naming
const getProduct = Effect.fn("ProductService.getProduct")(
  function* (id: ProductId) {
    // ...
  },
);

const createOrder = Effect.fn("OrderService.createOrder")(
  function* (input: CreateOrderInput) {
    // ...
  },
);

// For database operations, add db prefix
const fetchProducts = Effect.fn("db.products.findMany")(function* () {
  // ...
});
```

### Adding Span Annotations

Add context to spans for debugging and monitoring:

```typescript
const processOrder = Effect.fn("OrderService.processOrder")(
  function* (orderId: OrderId) {
    const order = yield* getOrder(orderId);

    // Annotate current span with business context
    yield* Effect.annotateCurrentSpan("order.total", order.total);
    yield* Effect.annotateCurrentSpan("order.itemCount", order.items.length);
    yield* Effect.annotateCurrentSpan("customer.id", order.customerId);

    return yield* processPayment(order);
  },
);
```

### Nested Spans for Complex Operations

```typescript
const fulfillOrder = Effect.fn("OrderService.fulfillOrder")(
  function* (orderId: OrderId) {
    const order = yield* getOrder(orderId);

    // Each sub-operation creates its own span
    yield* validateInventory(order).pipe(Effect.withSpan("validateInventory"));
    yield* processPayment(order).pipe(Effect.withSpan("processPayment"));
    yield* updateInventory(order).pipe(Effect.withSpan("updateInventory"));
    yield* sendConfirmation(order).pipe(Effect.withSpan("sendConfirmation"));

    return order;
  },
);
```

### Structured Logging

Use Effect's logging with annotations for structured, queryable logs:

```typescript
const processWebhook = Effect.fn("WebhookService.process")(
  function* (payload: WebhookPayload) {
    // Add annotations that apply to all logs in this scope
    yield* Effect.annotateLogs({
      webhookId: payload.id,
      webhookType: payload.type,
      storeId: payload.storeId,
    });

    yield* Effect.logInfo("Processing webhook");

    const result = yield* handleWebhook(payload);

    yield* Effect.logInfo("Webhook processed successfully");

    return result;
  },
).pipe(
  Effect.catchAll((error) =>
    Effect.logError("Webhook processing failed", Cause.fail(error)).pipe(
      Effect.flatMap(() => Effect.fail(error)),
    )
  ),
);
```

### Log Levels

| Level               | Use Case                                                    |
| ------------------- | ----------------------------------------------------------- |
| `Effect.logDebug`   | Detailed debugging info (disabled in production by default) |
| `Effect.logInfo`    | General operational messages                                |
| `Effect.logWarning` | Potential issues that don't stop execution                  |
| `Effect.logError`   | Errors that need attention                                  |
| `Effect.logFatal`   | Unrecoverable errors                                        |

### Correlation IDs

Pass correlation IDs through context for request tracing:

```typescript
export class CorrelationId extends Context.Tag("CorrelationId")<
  CorrelationId,
  string
>() {}

const withCorrelationId = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.tap(() =>
      Effect.flatMap(CorrelationId, (correlationId) =>
        Effect.annotateCurrentSpan("correlationId", correlationId),
      ),
    ),
    Effect.annotateLogs("correlationId", yield* CorrelationId),
  );
```

---

## Retry & Resilience

**Priority: Required**

### Basic Retry with Exponential Backoff

```typescript
const callExternalApi = Effect.fn("ExternalApi.call")(
  function* (request: ApiRequest) {
    return yield* httpClient.post(request).pipe(
      Effect.retry(
        Schedule.exponential("100 millis").pipe(
          Schedule.jittered, // Add randomness to prevent thundering herd
          Schedule.compose(Schedule.recurs(3)), // Max 3 retries
        ),
      ),
    );
  },
);
```

### Retry with Specific Error Types

Only retry on transient errors:

```typescript
const fetchWithRetry = Effect.fn("fetchWithRetry")(function* (url: string) {
  return yield* httpClient.get(url).pipe(
    Effect.retry({
      times: 3,
      schedule: Schedule.exponential("200 millis"),
      while: (error) =>
        error._tag === "NetworkError" || error._tag === "TimeoutError",
    }),
  );
});
```

### Timeouts

Always add timeouts to external calls:

```typescript
// Simple timeout
const fetchProduct = getProduct(id).pipe(Effect.timeout("5 seconds"));

// Timeout with custom error
const fetchProductWithError = getProduct(id).pipe(
  Effect.timeoutFail({
    duration: "5 seconds",
    onTimeout: () => new ProductFetchTimeoutError({ id }),
  }),
);

// Timeout with fallback
const fetchProductWithFallback = getProduct(id).pipe(
  Effect.timeoutTo({
    duration: "5 seconds",
    onSuccess: (product) => Either.right(product),
    onTimeout: () => Either.left("Timed out, using cached data"),
  }),
);
```

### Circuit Breaker Pattern

For services that may be temporarily unavailable:

```typescript
const makeCircuitBreaker = (
  maxFailures: number,
  resetTimeout: Duration.Duration,
) => {
  let failures = 0;
  let lastFailure: number | null = null;
  let isOpen = false;

  return <A, E, R>(
    effect: Effect.Effect<A, E, R>,
  ): Effect.Effect<A, E | CircuitOpenError, R> =>
    Effect.gen(function* () {
      if (isOpen) {
        const now = Date.now();
        if (
          lastFailure && now - lastFailure > Duration.toMillis(resetTimeout)
        ) {
          isOpen = false;
          failures = 0;
        } else {
          return yield* new CircuitOpenError({
            message: "Circuit breaker is open",
          });
        }
      }

      return yield* effect.pipe(
        Effect.tapError(() =>
          Effect.sync(() => {
            failures++;
            lastFailure = Date.now();
            if (failures >= maxFailures) {
              isOpen = true;
            }
          })
        ),
        Effect.tap(() =>
          Effect.sync(() => {
            failures = 0;
          })
        ),
      );
    });
};
```

### Graceful Degradation

```typescript
const getProductWithFallback = Effect.fn("getProductWithFallback")(
  function* (id: ProductId) {
    return yield* getProductFromPrimary(id).pipe(
      Effect.timeout("2 seconds"),
      Effect.catchAll(() =>
        Effect.logWarning("Primary unavailable, using cache").pipe(
          Effect.flatMap(() => getProductFromCache(id)),
        )
      ),
      Effect.catchAll(() =>
        Effect.logWarning("Cache unavailable, using stale data").pipe(
          Effect.flatMap(() => getStaleProduct(id)),
        )
      ),
    );
  },
);
```

---

## Testing Patterns

**Priority: Recommended**

### Basic Test Structure with @effect/vitest

```typescript
import { Effect, Layer } from "effect";
import { describe, expect, it } from "@effect/vitest";

describe("ProductService", () => {
  it.effect("creates a product successfully", () =>
    Effect.gen(function* () {
      const service = yield* ProductService;
      const product = yield* service.create({
        name: "Test Product",
        price: 99,
      });

      expect(product.name).toBe("Test Product");
      expect(product.price).toBe(99);
    }).pipe(Effect.provide(TestLayer)));
});
```

### Testing Error Cases

```typescript
it.effect("returns NotFoundError for missing product", () =>
  Effect.gen(function* () {
    const service = yield* ProductService;
    const result = yield* service.getById(ProductId.make("nonexistent")).pipe(
      Effect.either,
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("NotFoundError");
    }
  }).pipe(Effect.provide(TestLayer)));

// Using Exit for more detailed inspection
it.effect("fails with ValidationError for invalid input", () =>
  Effect.gen(function* () {
    const service = yield* ProductService;
    const exit = yield* service.create({ name: "", price: -1 }).pipe(
      Effect.exit,
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const cause = exit.cause;
      expect(Cause.isFailType(cause)).toBe(true);
    }
  }).pipe(Effect.provide(TestLayer)));
```

### Creating Test Layers

```typescript
// Test layer for a service with mocked dependencies
const TestProductRepository = Layer.succeed(ProductRepository, {
  findById: (id) =>
    id === "existing-id"
      ? Effect.succeed({ id, name: "Test Product", price: 100 })
      : Effect.fail(new NotFoundError({ id })),
  create: (input) =>
    Effect.succeed({ id: ProductId.make(crypto.randomUUID()), ...input }),
  update: (id, input) => Effect.succeed({ id, ...input }),
  delete: (id) => Effect.void,
});

// Compose test layers
const TestLayer = ProductService.Default.pipe(
  Layer.provide(TestProductRepository),
  Layer.provide(TestCacheService),
);
```

### Testing with Scoped Resources

```typescript
it.scoped("cleans up resources after test", () =>
  Effect.gen(function* () {
    const tempFile = yield* createTempFile();
    yield* writeToFile(tempFile, "test data");

    const content = yield* readFile(tempFile);
    expect(content).toBe("test data");
    // tempFile is automatically cleaned up after test
  }));
```

### Testing Time-Dependent Code

```typescript
it.effect("expires cache after TTL", () =>
  Effect.gen(function* () {
    const cache = yield* CacheService;
    yield* cache.set("key", "value");

    // Advance time by 1 hour
    yield* TestClock.adjust("1 hour");

    const result = yield* cache.get("key");
    expect(Option.isNone(result)).toBe(true);
  }));
```

### Testing Concurrent Code

```typescript
it.effect("handles concurrent updates correctly", () =>
  Effect.gen(function* () {
    const counter = yield* Ref.make(0);

    yield* Effect.all(
      Array.from({ length: 100 }, () => Ref.update(counter, (n) => n + 1)),
      { concurrency: "unbounded" },
    );

    const result = yield* Ref.get(counter);
    expect(result).toBe(100);
  }));
```

---

## Caching

**Priority: Recommended**

### Effect.cached for Simple Memoization

```typescript
// Cache a single value (computed once, reused)
const getConfig = Effect.cached(
  Effect.gen(function* () {
    yield* Effect.logInfo("Loading config...");
    return yield* loadConfigFromDatabase();
  }),
);

// Usage - config is only loaded once
const program = Effect.gen(function* () {
  const config1 = yield* getConfig;
  const config2 = yield* getConfig; // Returns cached value
});
```

### Effect.cachedWithTTL for Time-Based Expiration

```typescript
// Cache with 5 minute TTL
const getExchangeRates = Effect.cachedWithTTL(
  fetchExchangeRatesFromApi(),
  "5 minutes",
);
```

### Cache Service for Key-Value Caching

```typescript
import { Cache, Duration, Effect } from "effect";

const makeProductCache = Effect.gen(function* () {
  const cache = yield* Cache.make({
    capacity: 1000,
    timeToLive: Duration.minutes(10),
    lookup: (id: ProductId) => fetchProductFromDatabase(id),
  });

  return {
    get: (id: ProductId) => cache.get(id),
    invalidate: (id: ProductId) => cache.invalidate(id),
    invalidateAll: () => cache.invalidateAll(),
    refresh: (id: ProductId) => cache.refresh(id),
  };
});
```

### Cache Key Conventions

```typescript
// Use consistent, namespaced cache keys
const CacheKey = {
  product: (id: ProductId) => `product:${id}`,
  productVariants: (id: ProductId) => `product:${id}:variants`,
  storeProducts: (storeId: StoreId) => `store:${storeId}:products`,
  userSession: (userId: UserId) => `user:${userId}:session`,
};
```

### Multi-Level Caching

```typescript
const getProduct = Effect.fn("getProduct")(function* (id: ProductId) {
  // L1: In-memory cache (fastest)
  const cached = yield* memoryCache.get(id).pipe(Effect.option);
  if (Option.isSome(cached)) {
    yield* Effect.logDebug("L1 cache hit");
    return cached.value;
  }

  // L2: KV store (fast)
  const kvCached = yield* kvStore.get(CacheKey.product(id)).pipe(Effect.option);
  if (Option.isSome(kvCached)) {
    yield* Effect.logDebug("L2 cache hit");
    yield* memoryCache.set(id, kvCached.value); // Populate L1
    return kvCached.value;
  }

  // L3: Database (slowest)
  yield* Effect.logDebug("Cache miss, fetching from database");
  const product = yield* fetchFromDatabase(id);

  // Populate caches
  yield* Effect.all([
    memoryCache.set(id, product),
    kvStore.set(CacheKey.product(id), product, { ttl: "10 minutes" }),
  ]);

  return product;
});
```

---

## Batching & Request Deduplication

**Priority: Recommended**

### RequestResolver for N+1 Prevention

```typescript
import { Effect, Request, RequestResolver } from "effect";

// Define a request type
class GetProductById extends Request.TaggedClass("GetProductById")<
  Product,
  NotFoundError
> {
  readonly id: ProductId;
}

// Create a batched resolver
const ProductResolver = RequestResolver.makeBatched(
  (requests: Array<GetProductById>) =>
    Effect.gen(function* () {
      const ids = requests.map((r) => r.id);
      yield* Effect.logDebug(`Batching ${ids.length} product requests`);

      const products = yield* fetchProductsByIds(ids);
      const productMap = new Map(products.map((p) => [p.id, p]));

      for (const request of requests) {
        const product = productMap.get(request.id);
        if (product) {
          yield* Request.succeed(request, product);
        } else {
          yield* Request.fail(request, new NotFoundError({ id: request.id }));
        }
      }
    }),
);

// Use the resolver
const getProduct = (id: ProductId) =>
  Effect.request(new GetProductById({ id }), ProductResolver);

// Multiple calls are automatically batched
const getProducts = Effect.gen(function* () {
  const [p1, p2, p3] = yield* Effect.all([
    getProduct(ProductId.make("1")),
    getProduct(ProductId.make("2")),
    getProduct(ProductId.make("3")),
  ]);
  // Only ONE database query is made for all three products
  return [p1, p2, p3];
});
```

### Request Deduplication

The resolver automatically deduplicates identical requests:

```typescript
// These three calls result in only ONE fetch
const program = Effect.gen(function* () {
  const [a, b, c] = yield* Effect.all([
    getProduct(ProductId.make("same-id")),
    getProduct(ProductId.make("same-id")),
    getProduct(ProductId.make("same-id")),
  ]);
  // a === b === c
});
```

---

## Parallel Data Fetching

**Priority: Recommended**

### Use `Effect.all` with Concurrency Options

```typescript
// CORRECT - parallel fetching for independent operations
const getProductWithDetails = Effect.fn("getProductWithDetails")(
  function* (id: ProductId) {
    const product = yield* getProduct(id);

    // Fetch related data in parallel
    const { variants, images, reviews } = yield* Effect.all(
      {
        variants: getVariants(id),
        images: getImages(id),
        reviews: getReviews(id),
      },
      { concurrency: "unbounded" },
    );

    return { ...product, variants, images, reviews };
  },
);

// WRONG - sequential fetching when parallel is possible
const getProductWithDetails = Effect.fn("getProductWithDetails")(
  function* (id: ProductId) {
    const product = yield* getProduct(id);
    const variants = yield* getVariants(id); // waits for previous
    const images = yield* getImages(id); // waits for previous
    const reviews = yield* getReviews(id); // waits for previous
    return { ...product, variants, images, reviews };
  },
);
```

### Concurrency Limits

Avoid exhausting resources (DB connections, API rate limits):

```typescript
// WRONG - unbounded concurrency may overwhelm database
const allProducts = yield * Effect.forEach(
  productIds,
  (id) => getProduct(id),
  { concurrency: "unbounded" },
);

// CORRECT - limit concurrent database connections
const allProducts = yield * Effect.forEach(
  productIds,
  (id) => getProduct(id),
  { concurrency: 10 }, // Max 10 concurrent queries
);
```

### Chunked Processing

For large datasets, process in chunks:

```typescript
import { Chunk } from "effect";

const processAllOrders = Effect.fn("processAllOrders")(
  function* (orderIds: OrderId[]) {
    const chunks = Chunk.chunksOf(Chunk.fromIterable(orderIds), 100);

    for (const chunk of chunks) {
      yield* Effect.forEach(
        chunk,
        (orderId) => processOrder(orderId),
        { concurrency: 10 },
      );
      yield* Effect.logInfo(`Processed ${Chunk.size(chunk)} orders`);
    }
  },
);
```

### When to Use Parallel Fetching

| Scenario                     | Concurrency                                  |
| ---------------------------- | -------------------------------------------- |
| Independent database queries | `{ concurrency: 10 }` or pool size           |
| External API calls           | `{ concurrency: 5 }` or rate limit           |
| CPU-bound operations         | `{ concurrency: "unbounded" }` (fiber-based) |
| Memory-intensive operations  | `{ concurrency: 2-4 }`                       |
| Single query                 | No concurrency needed                        |

---

## Context & Dependency Injection

**Priority: Recommended**

### When to Use Effect.Service vs Context.Tag

| Use Case                                    | Pattern                    |
| ------------------------------------------- | -------------------------- |
| Service with dependencies on other services | `Effect.Service`           |
| Multiple implementations (Live, Test, NoOp) | `Context.Tag` with factory |
| Runtime parameters (env bindings)           | `Context.Tag` for binding  |
| Simple singleton service                    | `Effect.Service`           |

### Effect.Service Pattern

```typescript
export class ProductService extends Effect.Service<ProductService>()(
  "ProductService",
  {
    effect: Effect.gen(function* () {
      const db = yield* Database;
      const cache = yield* CacheService;

      const getById = Effect.fn("ProductService.getById")(
        function* (id: ProductId) {
          // ...
        },
      );

      return { getById };
    }),
    dependencies: [DatabaseLive, CacheServiceLive],
  },
) {}

// Access default layer
const program = Effect.gen(function* () {
  const service = yield* ProductService;
  return yield* service.getById(id);
}).pipe(Effect.provide(ProductService.Default));
```

### Context.Tag with Multiple Implementations

```typescript
const makeProductService = (deps: { db: Database; cache: CacheService }) => ({
  getById: (id: ProductId) =>
    Effect.gen(function* () {
      // ...
    }),
});

export class ProductService extends Context.Tag("ProductService")<
  ProductService,
  ReturnType<typeof makeProductService>
>() {}

// Live implementation
export const ProductServiceLive = Layer.effect(
  ProductService,
  Effect.gen(function* () {
    const db = yield* Database;
    const cache = yield* CacheService;
    return makeProductService({ db, cache });
  }),
);

// Test implementation
export const ProductServiceTest = Layer.succeed(
  ProductService,
  {
    getById: (id) => Effect.succeed(mockProduct),
  },
);
```

### Request-Scoped vs Singleton Services

```typescript
// Singleton - created once, shared across requests
export class ConfigService extends Effect.Service<ConfigService>()(
  "ConfigService",
  {
    effect: loadConfig(),
    dependencies: [],
  },
) {}

// Request-scoped - use Context.Tag with per-request layer
export class RequestContext extends Context.Tag("RequestContext")<
  RequestContext,
  { requestId: string; userId: string }
>() {}

// Provide per-request in Hono middleware
const withRequestContext = (c: Context, next: Next) => {
  const layer = Layer.succeed(RequestContext, {
    requestId: c.get("requestId"),
    userId: c.get("userId"),
  });
  // ...
};
```

### Avoiding Dependency Leakage in Services

When a service has methods that require dependencies, those dependencies must be
captured at **construction time**, not at **method call time**. Otherwise, the
dependency "leaks" into every Effect that uses the service.

```typescript
// WRONG - dependency leaks at method call time
// The layer type is Layer<MyService> but methods require SomeDependency
const makeService = () => ({
  doSomething: () =>
    Effect.gen(function* () {
      const dep = yield* SomeDependency; // Leaks into caller's context!
      return yield* dep.operation();
    }),
});

export class MyService extends Context.Tag("MyService")<
  MyService,
  ReturnType<typeof makeService>
>() {}

// Layer doesn't declare the dependency, but it's required at runtime
export const MyServiceLive = Layer.succeed(MyService, makeService());
```

```typescript
// CORRECT - dependency captured at construction time
const makeLiveService = (dep: SomeDependencyType) => ({
  doSomething: (): Effect.Effect<Result, MyError> =>
    Effect.gen(function* () {
      // dep is already captured, no context requirement
      return yield* dep.operation();
    }),
});

export class MyService extends Context.Tag("MyService")<
  MyService,
  ReturnType<typeof makeLiveService>
>() {}

// Layer properly declares its dependency
export const MyServiceLive: Layer.Layer<MyService, never, SomeDependency> =
  Layer.effect(
    MyService,
    Effect.gen(function* () {
      const dep = yield* SomeDependency;
      return makeLiveService(dep);
    }),
  );
```

**Key Points:**

- Service interface methods should return `Effect.Effect<A, E, never>` (no
  external dependencies)
- Use `Layer.effect` to capture dependencies during layer construction
- The layer type should declare all dependencies:
  `Layer.Layer<Service, Error, Dependencies>`
- When providing the layer, use `Layer.provide` to satisfy dependencies

### Avoiding Type Casts

**Never use `as` type casts** unless absolutely necessary, and **never use
`as unknown as Type`**.

```typescript
// WRONG - dangerous type casts
const value = someValue as MyType;
const value = someValue as unknown as MyType; // Even worse!

// CORRECT - use proper type guards or schema validation
const decoded = Schema.decodeUnknownSync(MySchema)(someValue);

// CORRECT - for service tags, use the actual type directly
// If types don't match, fix the source type instead of casting
export class MyService extends Effect.Tag("MyService")<
  MyService,
  ActualType // Use the real type, not a cast
>() {}
```

**When types don't align:**

1. Fix the source type definition
2. Use schema validation to transform data
3. Create proper type adapters
4. Never paper over type mismatches with casts

---

## Schema Patterns

**Priority: Recommended**

### Descriptive Refinement Messages

```typescript
// WRONG - generic error message
const Price = Schema.Number.pipe(Schema.positive());

// CORRECT - descriptive error message
const Price = Schema.Number.pipe(
  Schema.positive({ message: () => "Price must be greater than 0" }),
  Schema.lessThan(1000000, { message: () => "Price cannot exceed 1,000,000" }),
);
```

### Schema Composition

```typescript
// Base schemas
const Email = Schema.String.pipe(
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
    message: () => "Invalid email format",
  }),
);

const NonEmptyString = Schema.String.pipe(
  Schema.minLength(1, { message: () => "Cannot be empty" }),
);

// Composed schema
const CreateUserInput = Schema.Struct({
  email: Email,
  name: NonEmptyString,
  age: Schema.Number.pipe(
    Schema.int({ message: () => "Age must be a whole number" }),
    Schema.between(0, 150, { message: () => "Age must be between 0 and 150" }),
  ),
});
```

### Transformations

```typescript
// Transform string to trimmed, lowercase
const NormalizedEmail = Schema.transform(
  Schema.String,
  Schema.String,
  {
    decode: (s) => s.trim().toLowerCase(),
    encode: (s) => s,
  },
);

// Transform with validation
const PositiveInt = Schema.transformOrFail(
  Schema.String,
  Schema.Number,
  {
    decode: (s, _, ast) => {
      const n = parseInt(s, 10);
      if (isNaN(n) || n <= 0) {
        return ParseResult.fail(
          new ParseResult.Type(ast, s, "Expected positive integer"),
        );
      }
      return ParseResult.succeed(n);
    },
    encode: (n) => ParseResult.succeed(String(n)),
  },
);
```

### Optional vs Nullable

```typescript
// Optional - field may be missing
const UpdateInput = Schema.Struct({
  name: Schema.optional(Schema.String), // { name?: string }
});

// Nullable - field is present but may be null
const ApiResponse = Schema.Struct({
  data: Schema.NullOr(Schema.String), // { data: string | null }
});

// Optional and nullable
const FlexibleInput = Schema.Struct({
  value: Schema.optional(Schema.NullOr(Schema.String)), // { value?: string | null }
});
```

---

## Drizzle ORM Rules

**Priority: Required**

### Use `and()` Function, Not `&&`

```typescript
// WRONG
.where(products.storeId === activeStoreId && products.id === input.id)

// CORRECT
.where(and(eq(products.storeId, activeStoreId), eq(products.id, input.id)))
```

### Use Destructuring for Single Row Queries

```typescript
// CORRECT - destructure directly
const [theme] = yield * db
  .select()
  .from(themes)
  .where(and(eq(themes.id, payload.themeId), isNull(themes.deletedAt)))
  .limit(1);

if (!theme) {
  return yield * new NotFoundError({ id: payload.themeId });
}

// WRONG - unnecessary intermediate variable
const themeRows = yield * db
  .select()
  .from(themes)
  .where(and(eq(themes.id, payload.themeId), isNull(themes.deletedAt)))
  .limit(1);

const theme = themeRows[0];
```

---

## Transaction Patterns

**Priority: Required**

- Single writes: wrap with `runProcedure()` only
- Multi-step writes: wrap with `inTransaction` + `runProcedure()`

```typescript
// Single write - no explicit transaction needed
ProductUpdate: ((input) => crud.update(input).pipe(runProcedure));

// Multi-step write - wrap in transaction for atomicity
ProductCreate: ((input) =>
  Effect.gen(function* () {
    const product = yield* createProduct(input);
    yield* createDefaultVariant(product.id);
    yield* updateInventory(product.id);
    return product;
  }).pipe(inTransaction, runProcedure));
```

---

## Service Definitions

**Priority: Required**

### Prefer `Effect.Service` for Most Services

```typescript
export class ThemeResolver extends Effect.Service<ThemeResolver>()(
  "ThemeResolver",
  {
    effect: Effect.gen(function* () {
      const db = yield* Database;
      const cache = yield* Cache;

      const resolve = Effect.fn("ThemeResolver.resolve")(
        function* (id: ThemeId) {
          // ...
        },
      );

      return { resolve };
    }),
    dependencies: [DatabaseLive, CacheLive],
  },
) {}
```

### Wrap Runtime Parameters in Context Tags

```typescript
export class StorefrontBinding extends Context.Tag("StorefrontBinding")<
  StorefrontBinding,
  Fetcher
>() {}

const callPurge = Effect.fn("callPurge")(function* (request: PurgeRequest) {
  const binding = yield* StorefrontBinding;

  return yield* Effect.tryPromise({
    try: () =>
      binding.fetch("/_internal/purge", {
        method: "POST",
        body: JSON.stringify(request),
      }),
    catch: (error) => new PurgeError({ message: String(error) }),
  });
});
```

### Never Define Separate Interface Types

```typescript
// WRONG - redundant interface
interface MyServiceInterface {
  readonly doSomething: (id: string) => Effect.Effect<Result, MyError>;
}

// CORRECT - type inferred from makeService
const makeService = () => ({
  doSomething: (id: string): Effect.Effect<Result, MyError> =>
    Effect.succeed(/* ... */),
});

export class MyService extends Context.Tag("MyService")<
  MyService,
  ReturnType<typeof makeService>
>() {}
```

### Delegate Helper Methods to Core Implementation

```typescript
const makeService = () => {
  const invalidateByTags = (
    tags: CacheTags,
  ): Effect.Effect<Response, PurgeError> => callPurge({ tags });

  return {
    invalidateByTags,
    // Helpers delegate to core method
    invalidateStore: (storeId: string) =>
      invalidateByTags([CacheTag.store(storeId)]),
    invalidateTheme: (themeId: string) =>
      invalidateByTags([CacheTag.theme(themeId)]),
  };
};
```

---

## Code Style

**Priority: Recommended**

### Avoid Verbose Comments and Section Separators

```typescript
// WRONG - verbose separators
// ============================================================================
// Error Types
// ============================================================================

// CORRECT - clean, self-documenting code
export class PurgeError extends Schema.TaggedError<PurgeError>()("PurgeError", {
  message: Schema.String,
}) {}
```

### Let TypeScript Infer Types

```typescript
// CORRECT - return type on core method only
const makeService = () => {
  const invalidateByTags = (
    tags: CacheTags,
  ): Effect.Effect<Response, PurgeError> => purge({ tags });

  return {
    invalidateByTags,
    invalidateStore: (storeId: string) =>
      // No return type needed
      invalidateByTags([CacheTag.store(storeId)]),
  };
};
```

### Prefer `Effect.as` Over `Effect.gen` for Simple Transforms

```typescript
// CORRECT - concise
const noOp = (tags: CacheTags): Effect.Effect<Response, never> =>
  Effect.log(`[NoOp] tags=${tags.join(",")}`).pipe(
    Effect.as({ success: true, tags }),
  );

// WRONG - verbose for simple case
const noOp = (tags: CacheTags): Effect.Effect<Response, never> =>
  Effect.gen(function* () {
    yield* Effect.log(`[NoOp] tags=${tags.join(",")}`);
    return { success: true, tags };
  });
```

### Use Factory Functions for Similar Validators

```typescript
type AccessMode = "exists" | "accessible" | "owned";

const validateTheme = (mode: AccessMode) =>
  Effect.fn(`validateTheme:${mode}`)(function* (themeId: ThemeId) {
    // Common validation logic with mode-specific conditions
  });

export const validateThemeExists = validateTheme("exists");
export const validateThemeAccessible = validateTheme("accessible");
export const validateThemeOwnership = validateTheme("owned");
```

---

## Effect MCP Tools

**Priority: Required**

Always consult Effect MCP tools when:

- Unsure about Effect API usage
- Implementing new Effect patterns
- Looking up type signatures
- Understanding error handling patterns

The Effect MCP provides up-to-date documentation. Don't rely on outdated
knowledge.
