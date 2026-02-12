// ---------------------------------------------------------------------------
// PayArk SDK – Checkout Resource
// ---------------------------------------------------------------------------
// Encapsulates all operations related to the Checkout Sessions API.
// Follows the "resource" pattern (similar to stripe.checkout.sessions).
// ---------------------------------------------------------------------------

import type { HttpClient } from '../http';
import type { CheckoutSession, CreateCheckoutParams } from '../types';

/**
 * Resource class for PayArk Checkout Sessions.
 *
 * @example
 * ```ts
 * const session = await payark.checkout.create({
 *   amount: 500,
 *   provider: 'esewa',
 *   returnUrl: 'https://example.com/thank-you',
 * });
 *
 * // Redirect customer to the hosted checkout page
 * console.log(session.checkout_url);
 * ```
 */
export class CheckoutResource {
    constructor(private readonly http: HttpClient) { }

    /**
     * Create a new checkout session.
     *
     * Initiates a payment with the specified provider and returns a
     * hosted checkout URL that you can redirect your customer to.
     *
     * @param params - Checkout session parameters.
     * @returns The created checkout session with a `checkout_url`.
     * @throws  {PayArkError} if the request fails validation or auth.
     */
    async create(params: CreateCheckoutParams): Promise<CheckoutSession> {
        return this.http.request<CheckoutSession>('POST', '/v1/checkout', {
            body: {
                amount: params.amount,
                currency: params.currency ?? 'NPR',
                provider: params.provider,
                returnUrl: params.returnUrl,
                cancelUrl: params.cancelUrl,
                metadata: params.metadata,
            },
        });
    }
}
