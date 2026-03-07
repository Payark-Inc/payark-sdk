// ---------------------------------------------------------------------------
// PayArk SDK – Type Definitions
// ---------------------------------------------------------------------------
// Unified TypeScript types for the SDK. These are re-exported from the
// industrial schemas in @payark/sdk-effect to ensure 100% type parity.
// ---------------------------------------------------------------------------

import * as S from "./schemas";

// ── Config ─────────────────────────────────────────────────────────────────

export type PayArkConfig = S.PayArkConfig;

// ── Primitives ──────────────────────────────────────────────────────────────

export type Provider = S.Provider;
export type PaymentStatus = S.PaymentStatus;
export type SubscriptionStatus = S.SubscriptionStatus;
export type SubscriptionInterval = S.SubscriptionInterval;
export type WebhookEventType = S.WebhookEventType;

// ── Pagination ──────────────────────────────────────────────────────────────

export type PaginationMeta = S.PaginationMeta;
export type PaginatedResponse<T> = {
  readonly data: readonly T[];
  readonly meta: PaginationMeta;
};

// ── Models ──────────────────────────────────────────────────────────────────

export type Metadata = S.Metadata;
export type Customer = S.Customer;
export type Payment = S.Payment;
export type Subscription = S.Subscription;
export type Project = S.Project;
export type Token = S.Token;

// ── Checkout ────────────────────────────────────────────────────────────────

export type CreateCheckoutParams = S.CreateCheckoutParams;
export type CheckoutSession = S.CheckoutSession;

// ── Customers ───────────────────────────────────────────────────────────────

export type CreateCustomerParams = S.CreateCustomerParams;
export type UpdateCustomerParams = S.UpdateCustomerParams;
export type ListCustomersParams = S.ListCustomersParams;

// ── Payments ─────────────────────────────────────────────────────────────────

export type ListPaymentsParams = S.ListPaymentsParams;

// ── Subscriptions ────────────────────────────────────────────────────────────

export type CreateSubscriptionParams = S.CreateSubscriptionParams;
export type ListSubscriptionsParams = S.ListSubscriptionsParams;

// ── Webhooks ─────────────────────────────────────────────────────────────────

export type WebhookEvent = S.WebhookEvent;

// ── Errors ───────────────────────────────────────────────────────────────────

export type PayArkErrorBody = S.PayArkErrorBody;
