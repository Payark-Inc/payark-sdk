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
   * List subscriptions.
   *
   * @param params - Filtering and pagination parameters.
   * @returns Paginated list of subscriptions.
   */
  async list(
    params: ListSubscriptionsParams = {},
  ): Promise<PaginatedResponse<Subscription>> {
    return this.http.request<PaginatedResponse<Subscription>>(
      "GET",
      "/v1/subscriptions",
      {
        query: {
          limit: params.limit,
          offset: params.offset,
          projectId: params.projectId,
          customerId: params.customerId,
          status: params.status,
        },
      },
    );
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
