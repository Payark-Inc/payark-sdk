// ---------------------------------------------------------------------------
// PayArk SDK – Type Definitions
// ---------------------------------------------------------------------------
// These types mirror the PayArk REST API v1 response shapes exactly.
// They are the single source of truth for consumers of this SDK.
// ---------------------------------------------------------------------------

// ── Provider enum ──────────────────────────────────────────────────────────
/** Supported payment providers on the PayArk platform. */
export type Provider = "esewa" | "khalti";

// ── Checkout ───────────────────────────────────────────────────────────────
/** Parameters required to create a new checkout session. */
export interface CreateCheckoutParams {
  /** Payment amount in the base currency unit (e.g. 1000 = NPR 1000). */
  amount: number;
  /** ISO 4217 currency code. Defaults to `"NPR"`. */
  currency?: string;
  /** Which payment provider to use for this transaction. */
  provider: Provider;
  /** URL to redirect the customer to after successful payment. */
  returnUrl: string;
  /** URL to redirect the customer to if they cancel. */
  cancelUrl?: string;
  /** Arbitrary key-value metadata attached to the payment (e.g. order_id). */
  metadata?: Record<string, unknown>;
}

/** Successful response from the checkout creation endpoint. */
export interface CheckoutSession {
  /** Unique payment identifier (e.g. `"pay_abc123"`). */
  id: string;
  /** The full URL of the hosted checkout page for the customer. */
  checkout_url: string;
  /** Provider-specific payment method details. */
  payment_method: {
    type: Provider;
    url?: string;
    method?: "GET" | "POST";
    fields?: Record<string, string>;
  };
}

// ── Payment ────────────────────────────────────────────────────────────────
/** The status lifecycle of a PayArk payment. */
export type PaymentStatus = "pending" | "success" | "failed";

/** A payment record as returned by the API. */
export interface Payment {
  id: string;
  project_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider_ref?: string | null;
  metadata_json?: Record<string, unknown> | null;
  gateway_response?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
}

/** Pagination metadata returned alongside list queries. */
export interface PaginationMeta {
  total: number | null;
  limit: number;
  offset: number;
}

/** Paginated response wrapper for list endpoints. */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Query parameters for the list-payments endpoint. */
export interface ListPaymentsParams {
  /** Maximum number of records to return (1–100). Default `10`. */
  limit?: number;
  /** Offset for pagination. Default `0`. */
  offset?: number;
}

// ── Client Config ──────────────────────────────────────────────────────────
/** Configuration options for initialising the PayArk client. */
export interface PayArkConfig {
  /** Your project's secret API key (`sk_...`). **Never expose in client-side code.** */
  apiKey: string;
  /**
   * Override the base URL of the PayArk API.
   * Useful for local development or self-hosted instances.
   * @default "https://api.payark.com"
   */
  baseUrl?: string;
  /**
   * Request timeout in milliseconds.
   * @default 30_000
   */
  timeout?: number;
  /**
   * Maximum number of automatic retries on 5xx / network errors.
   * Uses exponential back-off with jitter.
   * @default 2
   */
  maxRetries?: number;
  /**
   * Enable Sandbox Mode.
   *
   * When set to `true`, all requests will include the `x-sandbox-mode: true` header.
   * This allows you to test your integration without moving real money or needing
   * real provider credentials.
   *
   * @default false
   */
  sandbox?: boolean;
}

// ── Error ──────────────────────────────────────────────────────────────────
/** Shape of the error body returned by the PayArk API. */
export interface PayArkErrorBody {
  error: string;
  details?: unknown;
}

// ── Webhooks ───────────────────────────────────────────────────────────────
/** Valid webhook event types. */
export type WebhookEventType = "payment.success" | "payment.failed";

/** Shape of a webhook event sent to your server. */
export interface WebhookEvent {
  /** The type of event (e.g. `payment.success`). */
  type: WebhookEventType;
  /** Unique ID for this event occurrence. */
  id?: string;
  /** The resource object that triggered the event. */
  data: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
  /** Whether this is a test mode event. */
  is_test: boolean;
  /** Timestamp when the event was created. */
  created?: number;
}
