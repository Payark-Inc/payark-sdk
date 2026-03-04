// ---------------------------------------------------------------------------
// PayArk SDK – Type Definitions
// ---------------------------------------------------------------------------
// Plain TypeScript types for the SDK. These are intentionally kept free of
// any runtime dependencies (no Effect, no Zod) so the standalone SDK has
// zero production dependencies.
// ---------------------------------------------------------------------------

// ── Config ─────────────────────────────────────────────────────────────────

export interface PayArkConfig {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
    maxRetries?: number;
    sandbox?: boolean;
}

// ── Primitives ──────────────────────────────────────────────────────────────

export type Provider =
    | "esewa"
    | "khalti"
    | "connectips"
    | "imepay"
    | "fonepay"
    | "sandbox";

export type PaymentStatus = "pending" | "success" | "failed";

export type SubscriptionStatus =
    | "active"
    | "past_due"
    | "canceled"
    | "paused";

export type SubscriptionInterval = "month" | "year" | "week";

export type WebhookEventType =
    | "payment.success"
    | "payment.failed"
    | "subscription.created"
    | "subscription.payment_succeeded"
    | "subscription.payment_failed"
    | "subscription.renewal_due"
    | "subscription.canceled";

// ── Pagination ──────────────────────────────────────────────────────────────

export interface PaginationMeta {
    total: number | null;
    limit: number;
    offset: number;
}

export interface PaginatedResponse<T> {
    readonly data: readonly T[];
    readonly meta: PaginationMeta;
}

// ── Models ──────────────────────────────────────────────────────────────────

export type Metadata = Record<string, unknown>;

export interface Customer {
    id: string;
    merchant_customer_id: string;
    email: string | null;
    name: string | null;
    phone: string | null;
    project_id: string;
    metadata: Metadata | null;
    created_at: string;
    updated_at?: string;
}

export interface Payment {
    id: string;
    project_id: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    provider_ref?: string | null;
    metadata_json?: Metadata | null;
    gateway_response?: unknown | null;
    created_at: string;
    updated_at?: string;
}

export interface Subscription {
    id: string;
    project_id: string;
    customer_id: string;
    status: SubscriptionStatus;
    amount: number;
    currency: string;
    interval: SubscriptionInterval;
    interval_count: number;
    current_period_start: string;
    current_period_end: string;
    payment_link: string;
    auto_send_link: boolean;
    metadata?: Metadata | null;
    canceled_at?: string | null;
    created_at: string;
    updated_at?: string;
}

export interface Project {
    id: string;
    name: string;
    api_key_secret: string;
    created_at: string;
}

export interface Token {
    id: string;
    name: string;
    scopes: string[];
    last_used_at: string | null;
    expires_at: string | null;
    created_at: string;
}

// ── Checkout ────────────────────────────────────────────────────────────────

export interface CreateCheckoutParams {
    amount: number;
    currency?: string;
    provider: Provider;
    returnUrl: string;
    cancelUrl?: string;
    metadata?: Metadata;
}

export interface CheckoutSession {
    id: string;
    checkout_url: string;
    payment_method: {
        type: Provider;
        url?: string;
        method?: "GET" | "POST";
        fields?: Record<string, string>;
    };
}

// ── Customers ───────────────────────────────────────────────────────────────

export interface CreateCustomerParams {
    merchant_customer_id: string;
    email?: string;
    name?: string;
    phone?: string;
    project_id?: string;
    metadata?: Metadata;
}

export interface UpdateCustomerParams {
    email?: string;
    name?: string;
    phone?: string;
    metadata?: Metadata;
}

export interface ListCustomersParams {
    limit?: number;
    offset?: number;
    email?: string;
    projectId?: string;
}

// ── Payments ─────────────────────────────────────────────────────────────────

export interface ListPaymentsParams {
    limit?: number;
    offset?: number;
    projectId?: string;
}

// ── Subscriptions ────────────────────────────────────────────────────────────

export interface CreateSubscriptionParams {
    customer_id: string;
    amount: number;
    currency?: string;
    interval: SubscriptionInterval;
    interval_count?: number;
    project_id?: string;
    auto_send_link?: boolean;
    metadata?: Metadata;
}

export interface ListSubscriptionsParams {
    limit?: number;
    offset?: number;
    projectId?: string;
    customerId?: string;
    status?: SubscriptionStatus;
}

// ── Webhooks ─────────────────────────────────────────────────────────────────

export interface WebhookEvent {
    type: WebhookEventType;
    id?: string;
    data: Payment | Subscription | Customer | Record<string, unknown>;
    is_test: boolean;
    created?: number;
}

// ── Errors ───────────────────────────────────────────────────────────────────

export interface PayArkErrorBody {
    error: string;
    details?: unknown;
}
