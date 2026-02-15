// ---------------------------------------------------------------------------
// PayArk SDK – Main Client
// ---------------------------------------------------------------------------
// The primary entry point for SDK consumers.
//
// Design rationale:
//   - Mirrors the Stripe SDK pattern: `payark.checkout.create(…)`
//   - Resources are lazy properties to avoid unnecessary allocations
//   - Zero runtime dependencies – uses global `fetch()` (Node 18+, Bun, Deno)
//   - Fully tree-shakeable when bundled
// ---------------------------------------------------------------------------

import { HttpClient } from './http';
import { CheckoutResource } from './resources/checkout';
import { PaymentsResource } from './resources/payments';
import { WebhooksResource } from './resources/webhooks';
import type { PayArkConfig } from './types';

/**
 * The PayArk SDK client.
 *
 * Instantiate with your project's secret API key to interact with the
 * PayArk payment platform.
 *
 * @example
 * ```ts
 * import { PayArk } from '@payark/sdk';
 *
 * const payark = new PayArk({ apiKey: 'sk_live_...' });
 *
 * // Create a checkout session
 * const session = await payark.checkout.create({
 *   amount: 500,
 *   provider: 'esewa',
 *   returnUrl: 'https://example.com/thank-you',
 * });
 *
 * console.log(session.checkout_url);
 * ```
 *
 * @example
 * ```ts
 * // List payments with pagination
 * const { data, meta } = await payark.payments.list({ limit: 25 });
 * console.log(`Found ${meta.total} payments`);
 * ```
 */
export class PayArk {
    /** Internal HTTP transport – shared across all resources. */
    private readonly http: HttpClient;

    /**
     * Static webhook verification utility.
     *
     * Does NOT require an SDK instance — used to verify incoming webhook
     * signatures in your server's request handler.
     *
     * @example
     * ```ts
     * const event = await PayArk.webhooks.constructEvent(
     *   rawBody,
     *   req.headers['x-payark-signature'],
     *   process.env.PAYARK_WEBHOOK_SECRET!,
     * );
     * console.log(event.type);
     * ```
     */
    static readonly webhooks = new WebhooksResource();

    // ── Resource instances (lazy-initialised) ────────────────────────────────
    private _checkout?: CheckoutResource;
    private _payments?: PaymentsResource;

    /**
     * Create a new PayArk client.
     *
     * @param config - Configuration object. Only `apiKey` is required.
     *
     * @example
     * ```ts
     * // Minimal
     * const payark = new PayArk({ apiKey: 'sk_live_...' });
     *
     * // With overrides (local dev)
     * const payark = new PayArk({
     *   apiKey: 'sk_test_...',
     *   baseUrl: 'http://localhost:3001',
     *   timeout: 10_000,
     *   maxRetries: 0,
     * });
     * ```
     */
    constructor(config: PayArkConfig) {
        this.http = new HttpClient(config);
    }

    // ── Resource accessors ───────────────────────────────────────────────────

    /**
     * Checkout sessions resource.
     *
     * Use this to create hosted checkout sessions that redirect your
     * customers to a PayArk-managed payment page.
     */
    get checkout(): CheckoutResource {
        if (!this._checkout) {
            this._checkout = new CheckoutResource(this.http);
        }
        return this._checkout;
    }

    /**
     * Payments resource.
     *
     * Use this to list and retrieve payment records for your project.
     */
    get payments(): PaymentsResource {
        if (!this._payments) {
            this._payments = new PaymentsResource(this.http);
        }
        return this._payments;
    }
}
