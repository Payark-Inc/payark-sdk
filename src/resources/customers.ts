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
} from "../types";
import {
  createAutoPaginatingList,
  type AutoPaginatingList,
} from "../pagination";

/**
 * Resource class for managing PayArk Customers.
 *
 * Provides full CRUD operations for customer identities within a project.
 * Customers can be linked to subscriptions and payments for unified billing.
 *
 * @example
 * ```ts
 * // Create a customer
 * const customer = await payark.customers.create({
 *   merchant_customer_id: 'usr_42',
 *   email: 'alice@example.com',
 *   name: 'Alice',
 * });
 *
 * // Iterate all customers
 * for await (const c of payark.customers.list()) {
 *   console.log(c.id, c.email);
 * }
 * ```
 */
export class CustomersResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a new customer in the authenticated project.
   *
   * @param params - Customer creation parameters.
   * @returns The created customer object.
   * @throws {PayArkError} with `conflict_error` (409) if `merchant_customer_id` already exists.
   *
   * @example
   * ```ts
   * const customer = await payark.customers.create({
   *   merchant_customer_id: 'usr_42',
   *   email: 'alice@example.com',
   *   name: 'Alice',
   *   metadata: { plan: 'premium' },
   * });
   * ```
   */
  async create(params: CreateCustomerParams): Promise<Customer> {
    return this.http.request<Customer>("POST", "/v1/customers", {
      body: params,
    });
  }

  /**
   * Retrieve a single customer by its unique ID.
   *
   * @param id - The customer identifier (e.g., `"cus_abc123"`).
   * @returns The full customer object.
   * @throws {PayArkError} with `not_found_error` (404) if the customer does not exist.
   *
   * @example
   * ```ts
   * const customer = await payark.customers.retrieve('cus_abc123');
   * console.log(customer.name, customer.email);
   * ```
   */
  async retrieve(id: string): Promise<Customer> {
    return this.http.request<Customer>(
      "GET",
      `/v1/customers/${encodeURIComponent(id)}`,
    );
  }

  /**
   * List customers with auto-pagination support.
   *
   * @param params - Filtering and pagination parameters.
   * @returns An auto-paginating list of customers.
   *
   * @example
   * ```ts
   * // Auto-paginate through all customers
   * for await (const customer of payark.customers.list()) {
   *   console.log(customer.email);
   * }
   * ```
   */
  async list(
    params: ListCustomersParams = {},
  ): Promise<AutoPaginatingList<Customer>> {
    const limit = params.limit ?? 100;

    const fetchPage = (offset: number) =>
      this.http.request<PaginatedResponse<Customer>>("GET", "/v1/customers", {
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
   *
   * Only the fields provided will be changed; omitted fields remain unchanged.
   *
   * @param id     - The customer identifier (e.g., `"cus_abc123"`).
   * @param params - Fields to update (email, name, phone, metadata).
   * @returns The updated customer object with new `updated_at` timestamp.
   * @throws {PayArkError} with `conflict_error` (409) if email is already taken.
   *
   * @example
   * ```ts
   * const updated = await payark.customers.update('cus_abc123', {
   *   name: 'Alice Smith',
   *   metadata: { upgraded: true },
   * });
   * ```
   */
  async update(id: string, params: UpdateCustomerParams): Promise<Customer> {
    return this.http.request<Customer>(
      "PATCH",
      `/v1/customers/${encodeURIComponent(id)}`,
      { body: params },
    );
  }

  /**
   * Permanently delete a customer.
   *
   * Customers with active subscriptions cannot be deleted — cancel all
   * subscriptions first, or the API will return `409 Conflict`.
   *
   * @param id - The customer identifier (e.g., `"cus_abc123"`).
   * @throws {PayArkError} with `conflict_error` (409) if customer has active subscriptions.
   * @throws {PayArkError} with `not_found_error` (404) if customer does not exist.
   *
   * @example
   * ```ts
   * await payark.customers.delete('cus_abc123');
   * ```
   */
  async delete(id: string): Promise<void> {
    await this.http.request<void>(
      "DELETE",
      `/v1/customers/${encodeURIComponent(id)}`,
    );
  }
}
