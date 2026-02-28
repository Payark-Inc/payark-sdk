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

export class CustomersResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a new customer.
   *
   * @param params - Customer creation parameters.
   * @returns The created customer object.
   */
  async create(params: CreateCustomerParams): Promise<Customer> {
    return this.http.request<Customer>("POST", "/v1/customers", {
      body: params,
    });
  }

  /**
   * Retrieve a customer by ID.
   *
   * @param id - The customer identifier (e.g., `cus_...`).
   * @returns The customer object.
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
   * @param id - The customer identifier (e.g., `cus_...`).
   * @param params - Fields to update (email, name, phone, metadata).
   * @returns The updated customer object.
   */
  async update(id: string, params: UpdateCustomerParams): Promise<Customer> {
    return this.http.request<Customer>(
      "PATCH",
      `/v1/customers/${encodeURIComponent(id)}`,
      { body: params },
    );
  }

  /**
   * Delete a customer.
   *
   * Customers with active subscriptions cannot be deleted (409 Conflict).
   * Cancel all subscriptions before deleting the customer.
   *
   * @param id - The customer identifier (e.g., `cus_...`).
   */
  async delete(id: string): Promise<void> {
    await this.http.request<void>(
      "DELETE",
      `/v1/customers/${encodeURIComponent(id)}`,
    );
  }
}
