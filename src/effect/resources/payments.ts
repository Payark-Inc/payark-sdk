import { Effect } from "effect";
import { Schema } from "@effect/schema";
import { PayArkConfigService, request } from "../http";
import { PaymentSchema, PaginatedResponseSchema } from "../schemas";
import type {
  ListPaymentsParams,
  PayArkConfig,
  PaginatedResponse,
  Payment,
} from "../../types";
import type { HttpClient } from "@effect/platform";

/**
 * Effect-based resource for PayArk Payments.
 */
export class PaymentsEffect {
  constructor(private readonly config: PayArkConfig) {}

  /**
   * List payments for the authenticated project.
   *
   * @param params - Optional pagination parameters.
   * @returns Effect that resolves to paginated payments.
   */
  list(
    params: ListPaymentsParams = {},
  ): Effect.Effect<PaginatedResponse<Payment>, any, HttpClient.HttpClient> {
    return request<any>("GET", "/v1/payments", {
      query: {
        limit: params.limit,
        offset: params.offset,
        projectId: params.projectId,
      },
    }).pipe(
      Effect.flatMap(
        Schema.decodeUnknown(PaginatedResponseSchema(PaymentSchema)),
      ),
      Effect.provideService(PayArkConfigService, this.config),
    ) as any;
  }

  /**
   * Retrieve a single payment by its ID.
   *
   * @param id - The payment identifier.
   * @returns Effect that resolves to the payment object.
   */
  retrieve(id: string): Effect.Effect<Payment, any, HttpClient.HttpClient> {
    return request<any>("GET", `/v1/payments/${encodeURIComponent(id)}`).pipe(
      Effect.flatMap(Schema.decodeUnknown(PaymentSchema)),
      Effect.provideService(PayArkConfigService, this.config),
    ) as any;
  }
}
