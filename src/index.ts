// ---------------------------------------------------------------------------
// PayArk SDK – Public API Surface
// ---------------------------------------------------------------------------
// Everything re-exported here is part of the public contract.
// Internal modules (http.ts) are intentionally NOT exported.
// ---------------------------------------------------------------------------

// ── Main client ────────────────────────────────────────────────────────────
export { PayArk } from "./client";

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
  // Checkout
  CreateCheckoutParams,
  CheckoutSession,
  // Payments
  Payment,
  PaymentStatus,
  ListPaymentsParams,
  PaginatedResponse,
  PaginationMeta,
  // Provider
  Provider,
  // Webhooks
  WebhookEvent,
  WebhookEventType,
  // Error body
  PayArkErrorBody,
} from "./types";

// ── Version ────────────────────────────────────────────────────────────────
/** SDK version string for runtime introspection. */
export const SDK_VERSION = "0.1.0" as const;
