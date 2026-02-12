// ---------------------------------------------------------------------------
// PayArk SDK – Custom Error Classes
// ---------------------------------------------------------------------------
// Provides structured, inspectable errors that preserve the HTTP context
// from failed API calls. Follows the Stripe SDK error pattern.
// Ref: https://docs.stripe.com/error-handling
// ---------------------------------------------------------------------------

import type { PayArkErrorBody } from './types';

/** Machine-readable error codes emitted by the SDK. */
export type PayArkErrorCode =
    | 'authentication_error'   // 401 – invalid or missing API key
    | 'forbidden_error'        // 403 – valid auth but insufficient permissions
    | 'invalid_request_error'  // 400/422 – bad request body / params
    | 'not_found_error'        // 404 – resource does not exist
    | 'rate_limit_error'       // 429 – too many requests
    | 'api_error'              // 500 – server-side failure
    | 'network_error'          // fetch failed (DNS, timeout, etc.)
    | 'unknown_error';         // catch-all

/**
 * Base error class for all PayArk SDK errors.
 *
 * Every error includes:
 * - `statusCode` – the HTTP status (or 0 for network failures)
 * - `code`       – a machine-readable error type
 * - `raw`        – the original response body, if available
 *
 * @example
 * ```ts
 * try {
 *   await payark.checkout.create({ ... });
 * } catch (err) {
 *   if (err instanceof PayArkError) {
 *     switch (err.code) {
 *       case 'authentication_error': // Re-auth flow
 *       case 'rate_limit_error':     // Back off & retry
 *       case 'api_error':            // Alert on-call
 *     }
 *   }
 * }
 * ```
 */
export class PayArkError extends Error {
    /** HTTP status code returned by the API (0 for network-level failures). */
    public readonly statusCode: number;
    /** Machine-readable error classification. */
    public readonly code: PayArkErrorCode;
    /** Raw error payload from the API, when available. */
    public readonly raw?: PayArkErrorBody;

    constructor(
        message: string,
        statusCode: number,
        code: PayArkErrorCode,
        raw?: PayArkErrorBody,
    ) {
        super(message);
        this.name = 'PayArkError';
        this.statusCode = statusCode;
        this.code = code;
        this.raw = raw;

        // Required for `instanceof` to work correctly when compiled to ES5
        // or when errors cross realm boundaries (e.g. iframe, vm).
        Object.setPrototypeOf(this, PayArkError.prototype);

        // Maintain proper stack trace in V8 environments
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, PayArkError);
        }
    }

    /** Human-readable representation for logging/debugging. */
    override toString(): string {
        return `[PayArkError: ${this.code}] ${this.message} (HTTP ${this.statusCode})`;
    }

    /** Serialise to a plain object – useful for structured logging. */
    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            raw: this.raw,
        };
    }
}

/**
 * Derive a machine-readable error code from an HTTP status code.
 * Maps every meaningful HTTP status to a `PayArkErrorCode`.
 */
export function errorCodeFromStatus(status: number): PayArkErrorCode {
    if (status === 401) return 'authentication_error';
    if (status === 403) return 'forbidden_error';
    if (status === 400 || status === 422) return 'invalid_request_error';
    if (status === 404) return 'not_found_error';
    if (status === 429) return 'rate_limit_error';
    if (status >= 500) return 'api_error';
    return 'unknown_error';
}
