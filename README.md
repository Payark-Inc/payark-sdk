# @payark/sdk

The official TypeScript SDK for the [PayArk](https://payark.com) payment gateway API.

> **Zero dependencies** · **Type-safe** · **Retry-safe (idempotent)** · **Node 18+ / Bun / Deno**

---

## Installation

```bash
# npm
npm install @payark/sdk

# bun
bun add @payark/sdk

# pnpm
pnpm add @payark/sdk
```

## Quick Start

```ts
import { PayArk } from "@payark/sdk";

const payark = new PayArk({ apiKey: "sk_live_..." });

// Create a checkout session
const session = await payark.checkout.create({
  amount: 500,
  provider: "esewa",
  returnUrl: "https://your-site.com/thank-you",
});

// Redirect user to the hosted checkout page
console.log(session.checkout_url);
// → "https://payark.com/checkout/pay_abc123"
```

## Configuration

```ts
const payark = new PayArk({
  apiKey: "sk_test_...", // Required – your project secret key
  sandbox: true, // Optional – enable Sandbox Mode (default: false)
  baseUrl: "http://localhost:3001", // Optional – for local dev
  timeout: 10_000, // Optional – request timeout in ms (default: 30s)
  maxRetries: 2, // Optional – retries on 5xx errors (default: 2)
});
```

## Sandbox Mode

PayArk provides a **Sandbox Mode** to test your integration without moving real money or needing real provider credentials (e.g. eSewa merchant keys).

When `sandbox: true` is enabled:

1. Requests include the `x-sandbox-mode: true` header.
2. The API bypasses real provider validation.
3. Payments are marked as `test: true` in the database.
4. You can simulate various payment outcomes via the sandbox gateway.

```ts
const payark = new PayArk({
  apiKey: "sk_test_something",
  sandbox: true,
});
```

## API Reference

### `payark.checkout.create(params)`

Create a new payment checkout session.

| Parameter   | Type                      | Required | Description                              |
| ----------- | ------------------------- | -------- | ---------------------------------------- |
| `amount`    | `number`                  | ✅       | Payment amount in the base currency unit |
| `provider`  | `'esewa' \| 'khalti'`     | ✅       | Payment provider                         |
| `returnUrl` | `string`                  | ✅       | URL to redirect after successful payment |
| `currency`  | `string`                  | ❌       | ISO currency code (default: `"NPR"`)     |
| `cancelUrl` | `string`                  | ❌       | URL to redirect on cancellation          |
| `metadata`  | `Record<string, unknown>` | ❌       | Arbitrary metadata (e.g. `order_id`)     |

**Returns:** `Promise<CheckoutSession>`

```ts
interface CheckoutSession {
  id: string;
  checkout_url: string;
  payment_method: {
    type: "esewa" | "khalti";
    url?: string;
    method?: "GET" | "POST";
    fields?: Record<string, string>;
  };
}
```

---

### `payark.payments.list(params?)`

List payments for the authenticated project.

| Parameter | Type     | Required | Description                      |
| --------- | -------- | -------- | -------------------------------- |
| `limit`   | `number` | ❌       | Max records (1–100, default: 10) |
| `offset`  | `number` | ❌       | Pagination offset (default: 0)   |

**Returns:** `Promise<PaginatedResponse<Payment>>`

```ts
const { data, meta } = await payark.payments.list({ limit: 25 });
console.log(`Total: ${meta.total}`);
```

---

### `payark.payments.retrieve(id)`

Retrieve a single payment by ID.

| Parameter | Type     | Required | Description                    |
| --------- | -------- | -------- | ------------------------------ |
| `id`      | `string` | ✅       | Payment identifier (`pay_...`) |

**Returns:** `Promise<Payment>`

```ts
const payment = await payark.payments.retrieve("pay_abc123");
console.log(payment.status); // → "success"
```

---

### `payark.webhooks.constructEvent(body, signature, secret)`

Securely verify and parse incoming webhooks.

| Parameter   | Type     | Required | Description                               |
| ----------- | -------- | -------- | ----------------------------------------- |
| `body`      | `string` | ✅       | The **raw** request body string           |
| `signature` | `string` | ✅       | The `X-PayArk-Signature` header           |
| `secret`    | `string` | ✅       | Your webhook signing secret (`whsec_...`) |

**Returns:** `Promise<WebhookEvent>`

```ts
// Example for Hono/Node.js
const body = await req.text(); // Raw body is required
const sig = req.headers.get("x-payark-signature");

try {
  const event = await payark.webhooks.constructEvent(
    body,
    sig,
    process.env.PAYARK_WH_SECRET,
  );

  if (event.type === "payment.succeeded") {
    const payment = event.data;
    // Provision services here
  }
} catch (err) {
  // Signature verification failed or body is malformed
}
```

---

## Error Handling

All errors thrown by the SDK are instances of `PayArkError`, which extends `Error` with structured metadata.

```ts
import { PayArk, PayArkError } from '@payark/sdk';

try {
  await payark.checkout.create({ ... });
} catch (err) {
  if (err instanceof PayArkError) {
    console.error(err.code);       // "authentication_error"
    console.error(err.statusCode); // 401
    console.error(err.message);    // "Unauthorized: Invalid API Key"
    console.error(err.raw);        // Original API error body

    // Structured logging
    console.log(JSON.stringify(err.toJSON()));
  }
}
```

### Error Codes

| Code                    | HTTP Status | Description                             |
| ----------------------- | ----------- | --------------------------------------- |
| `authentication_error`  | 401         | Invalid or missing API key              |
| `permission_error`      | 403         | Valid auth but insufficient permissions |
| `invalid_request_error` | 400 / 422   | Bad request parameters                  |
| `not_found_error`       | 404         | Resource not found                      |
| `rate_limit_error`      | 429         | Too many requests                       |
| `api_error`             | 500+        | Server-side failure                     |
| `connection_error`      | —           | DNS, timeout, or connection error       |

## Retries & Idempotency

The SDK automatically retries **server errors (500, 502, 503, 504)** with exponential back-off and jitter. Client errors (4xx) fail immediately since they are deterministic.

- Default: 2 retries
- Back-off: 500ms → 1s → 2s (+ random jitter)
- Set `maxRetries: 0` to disable

**Idempotency:** All mutating requests (POST, PUT, PATCH) automatically include an `Idempotency-Key` header. The same key is reused across retry attempts for a given call, ensuring that retried payments are never accidentally duplicated.

## TypeScript

The SDK is written in TypeScript and ships with full type declarations.  
All types are available for import:

```ts
import type {
  PayArkConfig,
  CreateCheckoutParams,
  CheckoutSession,
  Payment,
  PaymentStatus,
  Provider,
  PaginatedResponse,
  PayArkErrorBody,
} from "@payark/sdk";
```

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build (CJS + ESM + types)
bun run build

# Type check
bun run lint
```

### Test Suite

```
tests/
├── unit/
│   ├── errors.test.ts     – Error class + factory mapping
│   ├── http.test.ts        – HTTP transport, retries, idempotency, timeouts
│   ├── sandbox.test.ts     – Sandbox Mode header injection
│   └── client.test.ts      – PayArk client, resources, request construction
└── integration/
    └── sdk.test.ts          – End-to-end workflows (checkout → payment → recovery)
```

## Effect API 🚀

For users of the **[Effect](https://effect.website/)** ecosystem, we provide a dedicated package **[@payark/sdk-effect](https://www.npmjs.com/package/@payark/sdk-effect)**.

This package offers a fully functional, type-safe API with:

- **Zero Promise overhead**: Uses `@effect/platform/HttpClient` natively.
- **Runtime Validation**: Validates all responses using `@effect/schema`.
- **Typed Errors**: Tagged errors for clean matching.
- **Observability**: Built-in support for Effect's tracing and spans.

```bash
bun add @payark/sdk-effect
```

See the [@payark/sdk-effect documentation](../sdk-effect/README.md) for more details.

## License

MIT
