# @payark/sdk-effect

A high-performance, functional TypeScript SDK for [PayArk](https://payark.com), built natively on the [Effect](https://effect.website/) ecosystem.

> **Native Effect** · **Type-safe** · **Runtime Validation** · **Zero Promise overhead** · **Branded Types**

---

## Features

- **Effect-Native**: Built directly on `@effect/platform/HttpClient`. Returns pure `Effect` types without Promise wrappers.
- **Strict Validation**: All API responses are parsed and validated at runtime using `@effect/schema`, ensuring your data is exactly what you expect.
- **Branded Types**: IDs (e.g., `PaymentId`, `ProjectId`) are branded for compile-time safety, preventing mix-ups between different ID types.
- **Structured Errors**: Errors are typed as `PayArkEffectError`, a `TaggedError` that integrates seamlessly with `Effect.catchTag`.
- **Dependency Injection**: First-class support for `Layer` and `Context` for easy testing and modular architecture.
- **Tracing Ready**: Fully instrumented for observability with Effect's built-in tracing.

## Installation

```bash
# bun
bun add @payark/sdk-effect effect @effect/schema @effect/platform

# npm
npm install @payark/sdk-effect effect @effect/schema @effect/platform

# pnpm
pnpm add @payark/sdk-effect effect @effect/schema @effect/platform
```

## Quick Start

### 1. Basic Usage

If you just want to run a script:

```ts
import { Effect, Console } from "effect";
import { PayArkEffect } from "@payark/sdk-effect";

// Initialize the client
const payark = new PayArkEffect({ apiKey: "sk_live_..." });

const program = Effect.gen(function* (_) {
  // Create a checkout session
  const session = yield* _(
    payark.checkout.create({
      amount: 1000,
      provider: "esewa",
      returnUrl: "https://your-site.com/success",
    }),
  );

  yield* _(Console.log(`Checkout created: ${session.checkout_url}`));

  // Access safely typed IDs
  // session.id is type `CheckoutSessionId`, not just `string`
});

// Run it
Effect.runPromise(program);
```

### 2. Dependency Injection (Recommended)

For larger applications, use the `PayArk` service tag and `PayArk.Live` layer.

```ts
import { Effect, Layer, Console } from "effect";
import { PayArk, PayArkConfig } from "@payark/sdk-effect";

// Define a program that depends on PayArk
const program = Effect.gen(function* (_) {
  // Access the service from context
  const client = yield* _(PayArk);

  const payments = yield* _(client.payments.list({ limit: 5 }));

  yield* _(Console.log(`Found ${payments.meta.total} payments`));
});

// Configure the layer
const PayArkLive = PayArk.Live({
  apiKey: process.env.PAYARK_API_KEY!,
  sandbox: true, // Enable sandbox mode
});

// Provide the layer to the program
const runnable = program.pipe(Effect.provide(PayArkLive));

Effect.runPromise(runnable);
```

## Configuration

The `PayArkConfig` object accepts:

| Option       | Type      | Default                  | Description                                         |
| ------------ | --------- | ------------------------ | --------------------------------------------------- |
| `apiKey`     | `string`  | **Required**             | Your project's secret key (`sk_...`).               |
| `sandbox`    | `boolean` | `false`                  | Enable Sandbox Mode for testing without real money. |
| `baseUrl`    | `string`  | `https://api.payark.com` | Override for local dev or proxy.                    |
| `timeout`    | `number`  | `30000`                  | Request timeout in ms.                              |
| `maxRetries` | `number`  | `2`                      | Automatic retries on 5xx errors.                    |

## Branded Types & Validation

This SDK uses **Branded Types** to prevent logic errors. You cannot accidentally pass a `PaymentId` to a function expecting a `ProjectId`.

```ts
import { PaymentId, ProjectId } from "@payark/sdk-effect";

const payId = "pay_123" as PaymentId; // In real code, this comes from API
const projId = "proj_456" as ProjectId;

// ❌ Compile Error: Argument of type 'ProjectId' is not assignable to parameter of type 'PaymentId'.
client.payments.retrieve(projId);

// ✅ Correct
client.payments.retrieve(payId);
```

### Schemas

We export all `@effect/schema` definitions for your use:

```ts
import { PaymentSchema } from "@payark/sdk-effect";
import { Schema } from "@effect/schema";

const isPayment = Schema.is(PaymentSchema);
```

## Error Handling

Errors are fully typed using `PayArkEffectError`. You can handle them exhaustively using `Effect.catchTag`.

```ts
import { Effect, Console } from "effect";
import { PayArkEffectError } from "@payark/sdk-effect";

program.pipe(
  Effect.catchTag("PayArkEffectError", (err) => {
    switch (err.code) {
      case "authentication_error":
        return Console.error("Check your API Key!");
      case "rate_limit_error":
        return Console.error("Slow down!");
      default:
        return Console.error(`Something went wrong: ${err.message}`);
    }
  }),
);
```

## Testing

Because the SDK is built on `Context` and `Layer`, mocking is trivial. You don't need network mocks; you can just provide a test layer.

```ts
import { PayArk } from "@payark/sdk-effect";
import { Layer } from "effect";

// Create a mock implementation
const MockPayArk = Layer.succeed(
  PayArk,
  {
    checkout: {
      create: () =>
        Effect.succeed({ id: "cs_mock", checkout_url: "http://mock" }),
    },
  } as any, // Cast to partial implementation for simplicity
);

// Run test with mock
program.pipe(Effect.provide(MockPayArk));
```

## License

MIT
