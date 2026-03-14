// ---------------------------------------------------------------------------
// PayArk SDK – Public API Surface
// ---------------------------------------------------------------------------
// Everything re-exported here is part of the public contract.
// Internal modules (http.ts) are intentionally NOT exported.
// ---------------------------------------------------------------------------

// ── Main client ────────────────────────────────────────────────────────────
export { PayArk } from "./client";

// ── Functional Resources ───────────────────────────────────────────────────
export * from "./resources/checkout";
export * from "./resources/payments";
export * from "./resources/customers";
export * from "./resources/subscriptions";
export * from "./resources/automation";
export * from "./resources/tokens";
export * from "./resources/projects";
export * from "./resources/webhooks";

// ── Error classes ──────────────────────────────────────────────────────────
export {
  PayArkError,
  PayArkAuthenticationError,
  PayArkPermissionError,
  PayArkInvalidRequestError,
  PayArkNotFoundError,
  PayArkRateLimitError,
  PayArkAPIError,
  PayArkConnectionError,
  PayArkSignatureVerificationError,
} from "./errors";
export type { PayArkErrorCode } from "./errors";

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  // Config
  PayArkConfig,
  // Models
  Customer,
  Payment,
  Subscription,
  Project,
  Token,
  Metadata,
  // Primitives
  Provider,
  PaymentStatus,
  SubscriptionStatus,
  SubscriptionInterval,
  // Checkout
  CreateCheckoutParams,
  CheckoutSession,
  // Customers
  CreateCustomerParams,
  UpdateCustomerParams,
  ListCustomersParams,
  // Payments
  ListPaymentsParams,
  // Subscriptions
  CreateSubscriptionParams,
  ListSubscriptionsParams,
  // Pagination
  PaginatedResponse,
  PaginationMeta,
  // Webhooks
  WebhookEvent,
  WebhookEventType,
  // Error body
  PayArkErrorBody,
} from "./types";

// ── Version ────────────────────────────────────────────────────────────────
/** SDK version string for runtime introspection. */
export const SDK_VERSION = "0.1.9" as const;
