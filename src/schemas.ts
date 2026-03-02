import { Schema } from "effect";

/**
 * Atomic Atoms
 */
export const Id = Schema.String.pipe(Schema.brand("Id"));
export const Email = Schema.String.pipe(
  Schema.filter((s) => s.includes("@")),
  Schema.brand("Email"),
);
export const Timestamp = Schema.String.pipe(Schema.brand("Timestamp"));
export const Metadata = Schema.Record({
  key: Schema.String,
  value: Schema.Any,
});

export const Timestamps = Schema.Struct({
  created_at: Timestamp,
  updated_at: Timestamp,
});

/**
 * Provider enum.
 */
export const Provider = Schema.Literal(
  "esewa",
  "khalti",
  "connectips",
  "imepay",
  "fonepay",
  "sandbox",
);

export type Provider = Schema.Schema.Type<typeof Provider>;

/**
 * Payment Status.
 */
export const PaymentStatus = Schema.Literal("pending", "success", "failed");

export type PaymentStatus = Schema.Schema.Type<typeof PaymentStatus>;

/**
 * Subscription Status.
 */
export const SubscriptionStatus = Schema.Literal(
  "active",
  "past_due",
  "canceled",
  "paused",
);

export type SubscriptionStatus = Schema.Schema.Type<typeof SubscriptionStatus>;

/**
 * Subscription Interval.
 */
export const SubscriptionInterval = Schema.Literal("month", "year", "week");

export type SubscriptionInterval = Schema.Schema.Type<
  typeof SubscriptionInterval
>;

/**
 * Project Model.
 */
export const Project = Schema.Struct({
  id: Id,
  name: Schema.String,
  api_key_secret: Schema.String,
  created_at: Timestamp,
});

export type Project = Schema.Schema.Type<typeof Project>;

/**
 * Customer Model.
 */
export const Customer = Schema.Struct({
  id: Id,
  merchant_customer_id: Schema.String,
  email: Schema.NullOr(Email),
  name: Schema.NullOr(Schema.String),
  phone: Schema.NullOr(Schema.String),
  project_id: Id,
  metadata: Schema.NullOr(Metadata),
  created_at: Timestamp,
  updated_at: Schema.optional(Timestamp),
});

export type Customer = Schema.Schema.Type<typeof Customer>;

/**
 * Payment Model.
 */
export const Payment = Schema.Struct({
  id: Id,
  project_id: Id,
  amount: Schema.Number,
  currency: Schema.String,
  status: PaymentStatus,
  provider_ref: Schema.optional(Schema.NullOr(Schema.String)),
  metadata_json: Schema.optional(Schema.NullOr(Metadata)),
  gateway_response: Schema.optional(Schema.NullOr(Schema.Any)),
  created_at: Timestamp,
  updated_at: Schema.optional(Timestamp),
});

export type Payment = Schema.Schema.Type<typeof Payment>;

/**
 * Subscription Model.
 */
export const Subscription = Schema.Struct({
  id: Id,
  project_id: Id,
  customer_id: Id,
  status: SubscriptionStatus,
  amount: Schema.Number,
  currency: Schema.String,
  interval: SubscriptionInterval,
  interval_count: Schema.Number,
  current_period_start: Timestamp,
  current_period_end: Timestamp,
  payment_link: Schema.String,
  auto_send_link: Schema.Boolean,
  metadata: Schema.optional(Schema.NullOr(Metadata)),
  canceled_at: Schema.optional(Schema.NullOr(Timestamp)),
  created_at: Timestamp,
  updated_at: Schema.optional(Timestamp),
});

export type Subscription = Schema.Schema.Type<typeof Subscription>;

/**
 * Pagination Metadata.
 */
export const PaginationMeta = Schema.Struct({
  total: Schema.NullOr(Schema.Number),
  limit: Schema.Number,
  offset: Schema.Number,
});

export type PaginationMeta = Schema.Schema.Type<typeof PaginationMeta>;

/**
 * Paginated Response Wrapper.
 */
export const PaginatedResponse = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  Schema.Struct({
    data: Schema.Array(schema),
    meta: PaginationMeta,
  });

export interface PaginatedResponse<T> {
  readonly data: readonly T[];
  readonly meta: PaginationMeta;
}

// ── Params ─────────────────────────────────────────────────────────────────

export const CreateCheckoutParams = Schema.Struct({
  amount: Schema.Number,
  currency: Schema.optionalWith(Schema.String, { default: () => "NPR" }),
  provider: Provider,
  returnUrl: Schema.String,
  cancelUrl: Schema.optional(Schema.String),
  metadata: Schema.optional(Metadata),
});

export type CreateCheckoutParams = Schema.Schema.Type<
  typeof CreateCheckoutParams
>;

export const CheckoutSession = Schema.Struct({
  id: Schema.String,
  checkout_url: Schema.String,
  payment_method: Schema.Struct({
    type: Provider,
    url: Schema.optional(Schema.String),
    method: Schema.optional(Schema.Literal("GET", "POST")),
    fields: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.String }),
    ),
  }),
});

export type CheckoutSession = Schema.Schema.Type<typeof CheckoutSession>;

export const CreateCustomerParams = Schema.Struct({
  merchant_customer_id: Schema.String,
  email: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  phone: Schema.optional(Schema.String),
  project_id: Schema.optional(Schema.String),
  metadata: Schema.optional(Metadata),
});

export type CreateCustomerParams = Schema.Schema.Type<
  typeof CreateCustomerParams
>;

export const ListPaymentsParams = Schema.Struct({
  limit: Schema.optional(Schema.NumberFromString),
  offset: Schema.optional(Schema.NumberFromString),
  projectId: Schema.optional(Schema.String),
});

export type ListPaymentsParams = Schema.Schema.Type<typeof ListPaymentsParams>;

export const ListCustomersParams = Schema.Struct({
  limit: Schema.optional(Schema.NumberFromString),
  offset: Schema.optional(Schema.NumberFromString),
  email: Schema.optional(Schema.String),
  projectId: Schema.optional(Schema.String),
});

export type ListCustomersParams = Schema.Schema.Type<
  typeof ListCustomersParams
>;

export const UpdateCustomerParams = Schema.Struct({
  email: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  phone: Schema.optional(Schema.String),
  metadata: Schema.optional(Metadata),
});

export type UpdateCustomerParams = Schema.Schema.Type<
  typeof UpdateCustomerParams
>;

export const CreateSubscriptionParams = Schema.Struct({
  customer_id: Id,
  amount: Schema.Number,
  currency: Schema.optionalWith(Schema.String, { default: () => "NPR" }),
  interval: SubscriptionInterval,
  interval_count: Schema.optional(Schema.Number),
  project_id: Schema.optional(Id),
  auto_send_link: Schema.optional(Schema.Boolean),
  metadata: Schema.optional(Metadata),
});

export type CreateSubscriptionParams = Schema.Schema.Type<
  typeof CreateSubscriptionParams
>;

export const ListSubscriptionsParams = Schema.Struct({
  limit: Schema.optional(Schema.NumberFromString),
  offset: Schema.optional(Schema.NumberFromString),
  projectId: Schema.optional(Id),
  customerId: Schema.optional(Id),
  status: Schema.optional(SubscriptionStatus),
});

export type ListSubscriptionsParams = Schema.Schema.Type<
  typeof ListSubscriptionsParams
>;

// ── Client Config ──────────────────────────────────────────────────────────

export const PayArkConfig = Schema.Struct({
  apiKey: Schema.String,
  baseUrl: Schema.optional(Schema.String),
  timeout: Schema.optional(Schema.Number),
  maxRetries: Schema.optional(Schema.Number),
  sandbox: Schema.optional(Schema.Boolean),
});

export type PayArkConfig = Schema.Schema.Type<typeof PayArkConfig>;

// ── Webhooks ───────────────────────────────────────────────────────────────

export const WebhookEventType = Schema.Literal(
  "payment.success",
  "payment.failed",
  "subscription.created",
  "subscription.payment_succeeded",
  "subscription.payment_failed",
  "subscription.renewal_due",
  "subscription.canceled",
);

export type WebhookEventType = Schema.Schema.Type<typeof WebhookEventType>;

export const WebhookEvent = Schema.Struct({
  type: WebhookEventType,
  id: Schema.optional(Schema.String),
  data: Schema.Union(
    Payment,
    Subscription,
    Customer,
    Schema.Struct({
      id: Schema.String,
      amount: Schema.optional(Schema.Number),
      currency: Schema.optional(Schema.String),
      status: Schema.String,
      metadata: Schema.optional(Metadata),
    }),
  ),
  is_test: Schema.Boolean,
  created: Schema.optional(Schema.Number),
});

export type WebhookEvent = Schema.Schema.Type<typeof WebhookEvent>;

/** Shape of the error body returned by the PayArk API. */
export const PayArkErrorBody = Schema.Struct({
  error: Schema.String,
  details: Schema.optional(Schema.Any),
});

export type PayArkErrorBody = Schema.Schema.Type<typeof PayArkErrorBody>;
