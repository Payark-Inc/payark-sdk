// ---------------------------------------------------------------------------
// PayArk SDK – Checkout Resource
// ---------------------------------------------------------------------------
// Encapsulates all operations related to the Checkout Sessions API.
// ---------------------------------------------------------------------------

import type { HttpClient } from "../http";
import type { CheckoutSession, CreateCheckoutParams } from "../schemas";
import type { PayArkClient } from "./customers";

// ── Functional API ─────────────────────────────────────────────────────────

/**
 * Create a new checkout session.
 */
export async function createCheckout(
  client: PayArkClient,
  params: CreateCheckoutParams,
): Promise<CheckoutSession> {
  return client.http.request<CheckoutSession>("POST", "/v1/checkout", {
    body: {
      amount: params.amount,
      currency: params.currency ?? "NPR",
      provider: params.provider,
      returnUrl: params.returnUrl,
      cancelUrl: params.cancelUrl,
      metadata: params.metadata,
    },
  });
}

// ── Legacy Resource Class ──────────────────────────────────────────────────

/**
 * Resource class for PayArk Checkout Sessions.
 * @deprecated Use functional exports instead for better tree-shaking.
 */
export class CheckoutResource {
  constructor(public readonly http: HttpClient) {}

  async create(params: CreateCheckoutParams): Promise<CheckoutSession> {
    return createCheckout(this, params);
  }
}
