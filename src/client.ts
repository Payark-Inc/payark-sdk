// ---------------------------------------------------------------------------
// PayArk SDK – Main Client
// ---------------------------------------------------------------------------
// The primary entry point for SDK consumers.
// ---------------------------------------------------------------------------

import { HttpClient } from "./http";
import { CheckoutResource } from "./resources/checkout";
import { PaymentsResource } from "./resources/payments";
import { WebhooksResource } from "./resources/webhooks";
import { Projects } from "./resources/projects";
import { CustomersResource, type PayArkClient } from "./resources/customers";
import { SubscriptionsResource } from "./resources/subscriptions";
import type { PayArkConfig } from "./schemas";

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
 * ```
 */
export class PayArk implements PayArkClient {
  /** Internal HTTP transport – shared across all resources. */
  readonly http: HttpClient;
  readonly config: PayArkConfig;

  /**
   * Static webhook verification utility.
   */
  static readonly webhooks = new WebhooksResource();

  // ── Resource instances (lazy-initialised) ────────────────────────────────
  private _checkout?: CheckoutResource;
  private _payments?: PaymentsResource;
  private _projects?: Projects;
  private _customers?: CustomersResource;
  private _subscriptions?: SubscriptionsResource;

  /**
   * Create a new PayArk client.
   */
  constructor(config: PayArkConfig) {
    this.config = config;
    this.http = new HttpClient(config);
  }

  // ── Resource accessors ───────────────────────────────────────────────────

  get checkout(): CheckoutResource {
    if (!this._checkout) {
      this._checkout = new CheckoutResource(this.http);
    }
    return this._checkout;
  }

  get payments(): PaymentsResource {
    if (!this._payments) {
      this._payments = new PaymentsResource(this.http);
    }
    return this._payments;
  }

  get customers(): CustomersResource {
    if (!this._customers) {
      this._customers = new CustomersResource(this.http);
    }
    return this._customers;
  }

  get subscriptions(): SubscriptionsResource {
    if (!this._subscriptions) {
      this._subscriptions = new SubscriptionsResource(this.http);
    }
    return this._subscriptions;
  }

  get projects(): Projects {
    if (!this._projects) {
      this._projects = new Projects(this.http);
    }
    return this._projects;
  }
}
