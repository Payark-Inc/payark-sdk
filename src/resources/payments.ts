// ---------------------------------------------------------------------------
// PayArk SDK – Payments Resource
// ---------------------------------------------------------------------------
// Encapsulates all operations related to the Payments API.
// ---------------------------------------------------------------------------

import type { HttpClient } from "../http";
import type {
  ListPaymentsParams,
  PaginatedResponse,
  Payment,
} from "../schemas";
import {
  createAutoPaginatingList,
  type AutoPaginatingList,
} from "../pagination";
import type { PayArkClient } from "./customers";

// ── Functional API ─────────────────────────────────────────────────────────

/**
 * List payments for the authenticated project.
 */
export async function listPayments(
  client: PayArkClient,
  params: ListPaymentsParams = {},
): Promise<AutoPaginatingList<Payment>> {
  const limit = params.limit ?? 100;

  const fetchPage = (offset: number) =>
    client.http.request<PaginatedResponse<Payment>>("GET", "/v1/payments", {
      query: { limit, offset, projectId: params.projectId },
    });

  const firstPage = await fetchPage(params.offset ?? 0);
  return createAutoPaginatingList(firstPage, fetchPage, limit);
}

/**
 * Retrieve a single payment by its ID.
 */
export async function retrievePayment(
  client: PayArkClient,
  id: string,
): Promise<Payment> {
  return client.http.request<Payment>(
    "GET",
    `/v1/payments/${encodeURIComponent(id)}`,
  );
}

// ── Legacy Resource Class ──────────────────────────────────────────────────

/**
 * Resource class for PayArk Payments.
 * @deprecated Use functional exports instead for better tree-shaking.
 */
export class PaymentsResource {
  constructor(private readonly http: HttpClient) {}

  async list(
    params: ListPaymentsParams = {},
  ): Promise<AutoPaginatingList<Payment>> {
    return listPayments(this, params);
  }

  async retrieve(id: string): Promise<Payment> {
    return retrievePayment(this, id);
  }
}
