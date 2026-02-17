// ---------------------------------------------------------------------------
// PayArk SDK – Type Definitions
// ---------------------------------------------------------------------------
// These types mirror the PayArk REST API v1 response shapes exactly.
// They are the single source of truth for consumers of this SDK.
// ---------------------------------------------------------------------------

// ── Provider enum ──────────────────────────────────────────────────────────
/** Supported payment providers on the PayArk platform. */
export type Provider =
  | "esewa"
  | "khalti"
  | "connectips"
  | "imepay"
  | "fonepay"
  | "sandbox";

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
  readonly id: string;
  /** The full URL of the hosted checkout page for the customer. */
  readonly checkout_url: string;
  /** Provider-specific payment method details. */
  readonly payment_method: {
    readonly type: Provider;
    readonly url?: string;
    readonly method?: "GET" | "POST";
    readonly fields?: Record<string, string>;
  };
}

// ── Payment ────────────────────────────────────────────────────────────────
/** The status lifecycle of a PayArk payment. */
export type PaymentStatus = "pending" | "success" | "failed";

/** A payment record as returned by the API. */
export interface Payment {
  readonly id: string;
  readonly project_id: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: PaymentStatus;
  readonly provider_ref?: string | null;
  readonly metadata_json?: Record<string, unknown> | null;
  readonly gateway_response?: Record<string, unknown> | null;
  readonly created_at: string;
  readonly updated_at?: string;
}

/** Pagination metadata returned alongside list queries. */
export interface PaginationMeta {
  readonly total: number | null;
  readonly limit: number;
  readonly offset: number;
}

/** Paginated response wrapper for list endpoints. */
export interface PaginatedResponse<T> {
  readonly data: readonly T[];
  readonly meta: PaginationMeta;
}

/** Query parameters for the list-payments endpoint. */
export interface ListPaymentsParams {
  /** Maximum number of records to return (1–100). Default `10`. */
  limit?: number;
  /** Offset for pagination. Default `0`. */
  offset?: number;
  /** Optional project ID to filter results (required if using Personal Access Token). */
  projectId?: string;
}

// ── Project ───────────────────────────────────────────────────────────────
/** A project record belonging to the authenticated account. */
export interface Project {
  readonly id: string;
  readonly name: string;
  readonly api_key_secret: string;
  readonly created_at: string;
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
