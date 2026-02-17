import { Schema } from "@effect/schema";

/**
 * Schema for creating a checkout session.
 */
export const CreateCheckoutSchema = Schema.Struct({
  amount: Schema.Number,
  currency: Schema.optionalWith(Schema.Literal("NPR", "USD"), {
    default: () => "NPR" as const,
  }),
  provider: Schema.Union(
    Schema.Literal(
      "esewa",
      "khalti",
      "connectips",
      "imepay",
      "fonepay",
      "sandbox",
    ),
  ),
  returnUrl: Schema.String,
  cancelUrl: Schema.optional(Schema.String),
  metadata: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Any }),
  ),
});

/**
 * Schema for a checkout session response.
 */
export const CheckoutSessionSchema = Schema.Struct({
  id: Schema.String,
  checkout_url: Schema.String,
  amount: Schema.Number,
  currency: Schema.String,
  status: Schema.String,
  created_at: Schema.String,
});
