// ---------------------------------------------------------------------------
// PayArk SDK – Subscriptions Resource
// ---------------------------------------------------------------------------
// Management of recurring billing subscriptions.
// ---------------------------------------------------------------------------

import type { HttpClient } from "../http";
import type {
  CreateSubscriptionParams,
  Subscription,
  ListSubscriptionsParams,
  PaginatedResponse,
} from "../types";
import {
  createAutoPaginatingList,
  type AutoPaginatingList,
} from "../pagination";

/**
 * Resource class for managing PayArk Subscriptions.
 *
 * Provides operations for creating, listing, retrieving, and cancelling
 * recurring billing subscriptions tied to customers.
 *
 * @example
 * ```ts
 * // Create a subscription
 * const sub = await payark.subscriptions.create({
 *   customer_id: 'cus_abc123',
 *   amount: 999,
 *   currency: 'NPR',
 *   interval: 'month',
 * });
 *
 * // List active subscriptions
 * for await (const sub of payark.subscriptions.list({ status: 'active' })) {
 *   console.log(sub.id, sub.amount);
 * }
 * ```
 */
export class SubscriptionsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a new subscription for a customer.
   *
   * @param params - Subscription creation parameters including customer_id, amount, and interval.
   * @returns The created subscription object.
   * @throws {PayArkError} on validation failure or if customer does not exist.
   *
   * @example
   * ```ts
   * const sub = await payark.subscriptions.create({
   *   customer_id: 'cus_abc123',
   *   amount: 999,
   *   currency: 'NPR',
   *   interval: 'month',
   * });
   * console.log(sub.id); // 'sub_...
   * ```
   */
  async create(params: CreateSubscriptionParams): Promise<Subscription> {
    return this.http.request<Subscription>("POST", "/v1/subscriptions", {
      body: params,
    });
  }

  /**
   * Retrieve a single subscription by its unique ID.
   *
   * @param id - The subscription identifier (e.g., `"sub_abc123"`).
   * @returns The full subscription object.
   * @throws {PayArkError} with `not_found_error` (404) if the subscription does not exist.
   *
   * @example
   * ```ts
   * const sub = await payark.subscriptions.retrieve('sub_abc123');
   * console.log(sub.status, sub.current_period_end);
   * ```
   */
  async retrieve(id: string): Promise<Subscription> {
    return this.http.request<Subscription>(
      "GET",
      `/v1/subscriptions/${encodeURIComponent(id)}`,
    );
  }

  /**
   * List subscriptions with auto-pagination support.
   *
   * @param params - Filtering and pagination parameters.
   * @returns An auto-paginating list of subscriptions.
   *
   * @example
   * ```ts
   * for await (const sub of payark.subscriptions.list({ status: 'active' })) {
   *   console.log(sub.id, sub.amount);
   * }
   * ```
   */
  async list(
    params: ListSubscriptionsParams = {},
  ): Promise<AutoPaginatingList<Subscription>> {
    const limit = params.limit ?? 100;

    const fetchPage = (offset: number) =>
      this.http.request<PaginatedResponse<Subscription>>(
        "GET",
        "/v1/subscriptions",
        {
          query: {
            limit,
            offset,
            projectId: params.projectId,
            customerId: params.customerId,
            status: params.status,
          },
        },
      );

    const firstPage = await fetchPage(params.offset ?? 0);
    return createAutoPaginatingList(firstPage, fetchPage, limit);
  }

  /**
   * Cancel a subscription.
   *
   * @param id        - The subscription ID to cancel.
   * @param immediate - If `true`, cancel immediately. If `false`, cancel at period end.
   * @returns The updated subscription with `status: 'cancelled'`.
   * @throws {PayArkError} with `not_found_error` (404) if subscription does not exist.
   *
   * @example
   * ```ts
   * // Cancel at end of billing period
   * await payark.subscriptions.cancel('sub_abc123');
   *
   * // Cancel immediately
   * await payark.subscriptions.cancel('sub_abc123', true);
   * ```
   */
  async cancel(id: string, immediate = false): Promise<Subscription> {
    return this.http.request<Subscription>(
      "POST",
      `/v1/subscriptions/${encodeURIComponent(id)}/cancel`,
      { body: { immediate } },
    );
  }
}
