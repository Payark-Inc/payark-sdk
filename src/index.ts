// ---------------------------------------------------------------------------
// PayArk SDK – Public API Surface
// ---------------------------------------------------------------------------

// ── Models & Schemas ───────────────────────────────────────────────────────
export * from "./schemas";

// ── Client ─────────────────────────────────────────────────────────────────
export { PayArk } from "./client";
export type { PayArkClient } from "./resources/customers";

// ── Functional API ─────────────────────────────────────────────────────────
export { createCheckout } from "./resources/checkout";
export { listPayments, retrievePayment } from "./resources/payments";
export {
  createCustomer,
  retrieveCustomer,
  updateCustomer,
  deleteCustomer,
  listCustomers,
} from "./resources/customers";
export {
  createSubscription,
  retrieveSubscription,
  listSubscriptions,
  cancelSubscription,
} from "./resources/subscriptions";
export { listProjects } from "./resources/projects";
export {
  constructEvent,
  parseHeader,
  verifySignature,
} from "./resources/webhooks";

// ── Errors ─────────────────────────────────────────────────────────────────
export {
  PayArkError,
  PayArkAuthenticationError,
  PayArkInvalidRequestError,
  PayArkNotFoundError,
  PayArkPermissionError,
  PayArkRateLimitError,
  PayArkAPIError,
  PayArkConnectionError,
  PayArkSignatureVerificationError,
} from "./errors";
export type { PayArkErrorCode } from "./errors";

// ── Version ────────────────────────────────────────────────────────────────
/** SDK version string for runtime introspection. */
export const SDK_VERSION = "0.1.0" as const;
