import { Effect } from "effect";
import { request } from "../http";
import { CheckoutSessionSchema, CreateCheckoutSchema } from "../schemas";
import { Schema } from "@effect/schema";

export class CheckoutEffect {
  /**
   * Create a new checkout session using Effect.
   */
  create(params: Schema.Schema.Type<typeof CreateCheckoutSchema>) {
    return request<Schema.Schema.Type<typeof CheckoutSessionSchema>>(
      "POST",
      "/v1/checkout",
      {
        body: params,
      },
    );
  }
}
