// ---------------------------------------------------------------------------
// PayArk SDK – Payments Resource
// ---------------------------------------------------------------------------
// Encapsulates all operations related to the Payments API.
// ---------------------------------------------------------------------------

import type { HttpClient } from "../http";
import type { ListPaymentsParams, PaginatedResponse, Payment } from "../types";

/**
 * Resource class for PayArk Payments.
 *
 * @example
 * ```ts
 * // List recent payments
 * const { data, meta } = await payark.payments.list({ limit: 25 });
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
   * Returns a paginated list ordered by newest-first.
   *
   * @param params - Optional pagination parameters.
   * @returns Paginated list of payments with metadata.
   * @throws  {PayArkError} on authentication or server failure.
   */
  async list(
    params: ListPaymentsParams = {},
  ): Promise<PaginatedResponse<Payment>> {
    return this.http.request<PaginatedResponse<Payment>>(
      "GET",
      "/v1/payments",
      {
        query: {
          limit: params.limit,
          offset: params.offset,
          projectId: params.projectId,
        },
      },
    );
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
