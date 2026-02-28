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

export class SubscriptionsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a new subscription.
   *
   * @returns The created subscription object.
   */
  async create(params: CreateSubscriptionParams): Promise<Subscription> {
    return this.http.request<Subscription>("POST", "/v1/subscriptions", {
      body: params,
    });
  }

  /**
   * Retrieve a subscription by ID.
   *
   * @param id - The subscription identifier (e.g. `sub_...`).
   * @returns The subscription object.
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
   * @param id - The subscription ID to cancel.
   * @param immediate - If true, cancel immediately (not yet implemented on backend).
   */
  async cancel(id: string, immediate = false): Promise<Subscription> {
    return this.http.request<Subscription>(
      "POST",
      `/v1/subscriptions/${encodeURIComponent(id)}/cancel`,
      { body: { immediate } },
    );
  }
}
