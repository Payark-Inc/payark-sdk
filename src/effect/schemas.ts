import { Schema } from "@effect/schema";

/**
 * Supported payment providers on the PayArk platform.
 */
export const ProviderSchema = Schema.Union(
  Schema.Literal(
    "esewa",
    "khalti",
    "connectips",
    "imepay",
    "fonepay",
    "sandbox",
  ),
);

/**
 * Schema for creating a checkout session.
 */
export const CreateCheckoutSchema = Schema.Struct({
  amount: Schema.Number,
  currency: Schema.optionalWith(Schema.String, {
    default: () => "NPR" as const,
  }),
  provider: ProviderSchema,
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
  payment_method: Schema.Struct({
    type: ProviderSchema,
    url: Schema.optional(Schema.String),
    method: Schema.optional(
      Schema.Union(Schema.Literal("GET"), Schema.Literal("POST")),
    ),
    fields: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.String }),
    ),
  }),
});

/**
 * Schema for a Payment response.
 */
export const PaymentSchema = Schema.Struct({
  id: Schema.String,
  project_id: Schema.String,
  amount: Schema.Number,
  currency: Schema.String,
  status: Schema.Union(
    Schema.Literal("pending"),
    Schema.Literal("success"),
    Schema.Literal("failed"),
  ),
  provider_ref: Schema.optional(Schema.NullOr(Schema.String)),
  metadata_json: Schema.optional(
    Schema.NullOr(Schema.Record({ key: Schema.String, value: Schema.Any })),
  ),
  gateway_response: Schema.optional(
    Schema.NullOr(Schema.Record({ key: Schema.String, value: Schema.Any })),
  ),
  created_at: Schema.String,
  updated_at: Schema.optional(Schema.String),
});

/**
 * Schema for a Project response.
 */
export const ProjectSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  api_key_secret: Schema.String,
  created_at: Schema.String,
});

/**
 * Higher-order schema for paginated responses.
 */
export const PaginatedResponseSchema = <A, I>(item: Schema.Schema<A, I>) =>
  Schema.Struct({
    data: Schema.Array(item),
    meta: Schema.Struct({
      total: Schema.NullOr(Schema.Number),
      limit: Schema.Number,
      offset: Schema.Number,
    }),
  });
