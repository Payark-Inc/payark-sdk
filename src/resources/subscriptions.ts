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
} from "../schemas";
import {
  createAutoPaginatingList,
  type AutoPaginatingList,
} from "../pagination";
import type { PayArkClient } from "./customers";

// ── Functional API ─────────────────────────────────────────────────────────

/**
 * Create a new subscription for a customer.
 */
export async function createSubscription(
  client: PayArkClient,
  params: CreateSubscriptionParams,
): Promise<Subscription> {
  return client.http.request<Subscription>("POST", "/v1/subscriptions", {
    body: params,
  });
}

/**
 * Retrieve a single subscription by its unique ID.
 */
export async function retrieveSubscription(
  client: PayArkClient,
  id: string,
): Promise<Subscription> {
  return client.http.request<Subscription>(
    "GET",
    `/v1/subscriptions/${encodeURIComponent(id)}`,
  );
}

/**
 * List subscriptions with auto-pagination support.
 */
export async function listSubscriptions(
  client: PayArkClient,
  params: ListSubscriptionsParams = {},
): Promise<AutoPaginatingList<Subscription>> {
  const limit = params.limit ?? 100;

  const fetchPage = (offset: number) =>
    client.http.request<PaginatedResponse<Subscription>>(
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
 */
export async function cancelSubscription(
  client: PayArkClient,
  id: string,
  immediate = false,
): Promise<Subscription> {
  return client.http.request<Subscription>(
    "POST",
    `/v1/subscriptions/${encodeURIComponent(id)}/cancel`,
    { body: { immediate } },
  );
}

// ── Legacy Resource Class ──────────────────────────────────────────────────

/**
 * Resource class for managing PayArk Subscriptions.
 * @deprecated Use functional exports instead for better tree-shaking.
 */
export class SubscriptionsResource {
  constructor(private readonly http: HttpClient) {}

  async create(params: CreateSubscriptionParams): Promise<Subscription> {
    return createSubscription(this, params);
  }

  async retrieve(id: string): Promise<Subscription> {
    return retrieveSubscription(this, id);
  }

  async list(
    params: ListSubscriptionsParams = {},
  ): Promise<AutoPaginatingList<Subscription>> {
    return listSubscriptions(this, params);
  }

  async cancel(id: string, immediate = false): Promise<Subscription> {
    return cancelSubscription(this, id, immediate);
  }
}
