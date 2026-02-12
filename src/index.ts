// ---------------------------------------------------------------------------
// PayArk SDK – Public API Surface
// ---------------------------------------------------------------------------
// Everything re-exported here is part of the public contract.
// Internal modules (http.ts) are intentionally NOT exported.
// ---------------------------------------------------------------------------

// ── Main client ────────────────────────────────────────────────────────────
export { PayArk } from './client';

// ── Error classes ──────────────────────────────────────────────────────────
export { PayArkError } from './errors';
export type { PayArkErrorCode } from './errors';

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
    // Error body
    PayArkErrorBody,
} from './types';
