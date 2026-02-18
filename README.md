# @payark/sdk

**Unified TypeScript SDK for PayArk.**

[![NPM Version](https://img.shields.io/npm/v/@payark/sdk?color=black&style=flat-square)](https://www.npmjs.com/package/@payark/sdk)
[![License](https://img.shields.io/npm/l/@payark/sdk?style=flat-square)](https://opensource.org/licenses/MIT)

The official TypeScript SDK for the [PayArk](https://payark.com) platform. Zero dependencies, 100% type-safe.

---

## Installation

```bash
# Using bun
bun add @payark/sdk

# Using npm
npm install @payark/sdk
```

---

## Usage

```ts
import { PayArk } from "@payark/sdk";

const payark = new PayArk({ 
  apiKey: process.env.PAYARK_SECRET_KEY 
});

// Create a Checkout Session
const session = await payark.checkout.create({
  amount: 1000,
  provider: "esewa",
  returnUrl: "https://shop.yoursite.com/success",
});

console.log(`Checkout URL: ${session.checkout_url}`);
```

---

## Features

### Idempotency
All mutating requests (`POST`, `PUT`, `PATCH`) automatically include an `Idempotency-Key`. Retries are safe and won't result in duplicate charges.

### Automatic Retries
Built-in exponential back-off with random jitter. Transient network failures are handled automatically.

### Webhook Verification
Native support for HMAC-SHA256 signature verification to prevent spoofing.

```ts
const event = await payark.webhooks.constructEvent(
  rawBody,
  headerSignature,
  webhookSecret
);
```

---

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | **Required** | Your project secret key (`sk_...`) |
| `sandbox` | `boolean` | `false` | Enable test mode |
| `maxRetries` | `number` | `2` | Automated retry attempts |
| `timeout` | `number` | `30000` | Global request timeout in ms |

---

## Effect SDK

For developers using the **Effect** ecosystem, use **`@payark/sdk-effect`**.

```bash
bun add @payark/sdk-effect
```

---

## License

MIT © 2026 PayArk Labs.
