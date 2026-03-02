// ---------------------------------------------------------------------------
// PayArk SDK – Customers Resource
// ---------------------------------------------------------------------------
// CRUD operations for Customer identities.
// ---------------------------------------------------------------------------

import type { HttpClient } from "../http";
import type {
  CreateCustomerParams,
  UpdateCustomerParams,
  Customer,
  ListCustomersParams,
  PaginatedResponse,
} from "./../schemas";
import {
  createAutoPaginatingList,
  type AutoPaginatingList,
} from "../pagination";

/**
 * Minimal interface required for resource functions.
 */
export interface PayArkClient {
  readonly http: HttpClient;
}

// ── Functional API ─────────────────────────────────────────────────────────

/**
 * Create a new customer in the authenticated project.
 */
export async function createCustomer(
  client: PayArkClient,
  params: CreateCustomerParams,
): Promise<Customer> {
  return client.http.request<Customer>("POST", "/v1/customers", {
    body: params,
  });
}

/**
 * Retrieve a single customer by its unique ID.
 */
export async function retrieveCustomer(
  client: PayArkClient,
  id: string,
): Promise<Customer> {
  return client.http.request<Customer>(
    "GET",
    `/v1/customers/${encodeURIComponent(id)}`,
  );
}

/**
 * List customers with auto-pagination support.
 */
export async function listCustomers(
  client: PayArkClient,
  params: ListCustomersParams = {},
): Promise<AutoPaginatingList<Customer>> {
  const limit = params.limit ?? 100;

  const fetchPage = (offset: number) =>
    client.http.request<PaginatedResponse<Customer>>("GET", "/v1/customers", {
      query: {
        limit,
        offset,
        projectId: params.projectId,
        email: params.email,
      },
    });

  const firstPage = await fetchPage(params.offset ?? 0);
  return createAutoPaginatingList(firstPage, fetchPage, limit);
}

/**
 * Update a customer's mutable fields.
 */
export async function updateCustomer(
  client: PayArkClient,
  id: string,
  params: UpdateCustomerParams,
): Promise<Customer> {
  return client.http.request<Customer>(
    "PATCH",
    `/v1/customers/${encodeURIComponent(id)}`,
    { body: params },
  );
}

/**
 * Permanently delete a customer.
 */
export async function deleteCustomer(
  client: PayArkClient,
  id: string,
): Promise<void> {
  await client.http.request<void>(
    "DELETE",
    `/v1/customers/${encodeURIComponent(id)}`,
  );
}

// ── Legacy Resource Class ──────────────────────────────────────────────────

/**
 * Resource class for managing PayArk Customers.
 * @deprecated Use functional exports instead for better tree-shaking.
 */
export class CustomersResource {
  constructor(private readonly http: HttpClient) {}

  async create(params: CreateCustomerParams): Promise<Customer> {
    return createCustomer(this, params);
  }

  async retrieve(id: string): Promise<Customer> {
    return retrieveCustomer(this, id);
  }

  async list(
    params: ListCustomersParams = {},
  ): Promise<AutoPaginatingList<Customer>> {
    return listCustomers(this, params);
  }

  async update(id: string, params: UpdateCustomerParams): Promise<Customer> {
    return updateCustomer(this, id, params);
  }

  async delete(id: string): Promise<void> {
    return deleteCustomer(this, id);
  }
}
