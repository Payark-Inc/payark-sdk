# @payark/sdk

The official TypeScript SDK for the [PayArk](https://payark.com) payment gateway API.

> **Zero dependencies** · **Type-safe** · **Node 18+ / Bun / Deno**

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
import { PayArk } from '@payark/sdk';

const payark = new PayArk({ apiKey: 'sk_live_...' });

// Create a checkout session
const session = await payark.checkout.create({
  amount: 500,
  provider: 'esewa',
  returnUrl: 'https://your-site.com/thank-you',
});

// Redirect user to the hosted checkout page
console.log(session.checkout_url);
// → "https://payark.com/checkout/pay_abc123"
```

## Configuration

```ts
const payark = new PayArk({
  apiKey: 'sk_test_...',      // Required – your project secret key
  baseUrl: 'http://localhost:3001', // Optional – for local dev
  timeout: 10_000,            // Optional – request timeout in ms (default: 30s)
  maxRetries: 2,              // Optional – retries on 5xx errors (default: 2)
});
```

## API Reference

### `payark.checkout.create(params)`

Create a new payment checkout session.

| Parameter   | Type     | Required | Description |
|-------------|----------|----------|-------------|
| `amount`    | `number` | ✅       | Payment amount in the base currency unit |
| `provider`  | `'esewa' \| 'khalti'` | ✅ | Payment provider |
| `returnUrl` | `string` | ✅       | URL to redirect after successful payment |
| `currency`  | `string` | ❌       | ISO currency code (default: `"NPR"`) |
| `cancelUrl` | `string` | ❌       | URL to redirect on cancellation |
| `metadata`  | `Record<string, unknown>` | ❌ | Arbitrary metadata (e.g. `order_id`) |

**Returns:** `Promise<CheckoutSession>`

```ts
interface CheckoutSession {
  id: string;
  checkout_url: string;
  payment_method: {
    type: 'esewa' | 'khalti';
    url?: string;
    method?: 'GET' | 'POST';
    fields?: Record<string, string>;
  };
}
```

---

### `payark.payments.list(params?)`

List payments for the authenticated project.

| Parameter | Type     | Required | Description |
|-----------|----------|----------|-------------|
| `limit`   | `number` | ❌       | Max records (1–100, default: 10) |
| `offset`  | `number` | ❌       | Pagination offset (default: 0) |

**Returns:** `Promise<PaginatedResponse<Payment>>`

```ts
const { data, meta } = await payark.payments.list({ limit: 25 });
console.log(`Total: ${meta.total}`);
```

---

### `payark.payments.retrieve(id)`

Retrieve a single payment by ID.

| Parameter | Type     | Required | Description |
|-----------|----------|----------|-------------|
| `id`      | `string` | ✅       | Payment identifier (`pay_...`) |

**Returns:** `Promise<Payment>`

```ts
const payment = await payark.payments.retrieve('pay_abc123');
console.log(payment.status); // → "success"
```

---

## Error Handling

All errors thrown by the SDK are instances of `PayArkError`, which extends the native `Error` class.

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
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `authentication_error` | 401 | Invalid or missing API key |
| `invalid_request_error` | 400 / 422 | Bad request parameters |
| `not_found_error` | 404 | Resource not found |
| `rate_limit_error` | 429 | Too many requests |
| `api_error` | 500+ | Server-side failure |
| `network_error` | — | DNS, timeout, or connection error |

## Retries

The SDK automatically retries **server errors (5xx)** with exponential back-off and jitter. Client errors (4xx) fail immediately since they are deterministic.

- Default: 2 retries
- Back-off: 500ms → 1s → 2s (+ random jitter)
- Set `maxRetries: 0` to disable

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
} from '@payark/sdk';
```

## License

MIT
