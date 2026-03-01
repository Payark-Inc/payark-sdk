// ---------------------------------------------------------------------------
// PayArk SDK – Payments Resource
// ---------------------------------------------------------------------------
// Encapsulates all operations related to the Payments API.
// ---------------------------------------------------------------------------

import type { HttpClient } from "../http";
import type { ListPaymentsParams, PaginatedResponse, Payment } from "../types";
import {
  createAutoPaginatingList,
  type AutoPaginatingList,
} from "../pagination";

/**
 * Resource class for PayArk Payments.
 *
 * @example
 * ```ts
 * // Traditional pagination
 * const { data, meta } = await payark.payments.list({ limit: 25 });
 *
 * // Auto-pagination (fetches all pages automatically)
 * for await (const payment of payark.payments.list()) {
 *   console.log(payment.id);
 * }
 *
 * // Retrieve a specific payment
 * const payment = await payark.payments.retrieve('pay_abc123');
 * ```
 */
export class PaymentsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List payments for the authenticated project.
   *
   * Returns a paginated list ordered by newest-first. Supports both
   * traditional `.data`/`.meta` access and `for await...of` auto-pagination.
   *
   * @param params - Optional pagination and filter parameters.
   * @returns An auto-paginating list of payments.
   * @throws  {PayArkError} on authentication or server failure.
   *
   * @example
   * ```ts
   * // Auto-paginate through all payments
   * for await (const payment of payark.payments.list()) {
   *   console.log(payment.id, payment.amount);
   * }
   * ```
   */
  async list(
    params: ListPaymentsParams = {},
  ): Promise<AutoPaginatingList<Payment>> {
    const limit = params.limit ?? 100;

    const fetchPage = (offset: number) =>
      this.http.request<PaginatedResponse<Payment>>("GET", "/v1/payments", {
        query: { limit, offset, projectId: params.projectId },
      });

    const firstPage = await fetchPage(params.offset ?? 0);
    return createAutoPaginatingList(firstPage, fetchPage, limit);
  }

  /**
   * Retrieve a single payment by its ID.
   *
   * @param id - The payment identifier (e.g. `"pay_abc123"`).
   * @returns The full payment object.
   * @throws  {PayArkError} with `not_found_error` if the payment does not exist.
   */
  async retrieve(id: string): Promise<Payment> {
    return this.http.request<Payment>(
      "GET",
      `/v1/payments/${encodeURIComponent(id)}`,
    );
  }
}
