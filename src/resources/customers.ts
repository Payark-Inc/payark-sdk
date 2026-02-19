// ---------------------------------------------------------------------------
// PayArk SDK – Customers Resource
// ---------------------------------------------------------------------------
// CRUD operations for Customer identities.
// ---------------------------------------------------------------------------

import type { HttpClient } from "../http";
import type {
  CreateCustomerParams,
  Customer,
  ListCustomersParams,
  PaginatedResponse,
} from "../types";

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
   * List customers.
   *
   * @param params - Filtering and pagination parameters.
   * @returns Paginated list of customers.
   */
  async list(
    params: ListCustomersParams = {},
  ): Promise<PaginatedResponse<Customer>> {
    return this.http.request<PaginatedResponse<Customer>>(
      "GET",
      "/v1/customers",
      {
        query: {
          limit: params.limit,
          offset: params.offset,
          projectId: params.projectId,
          email: params.email,
        },
      },
    );
  }
}
