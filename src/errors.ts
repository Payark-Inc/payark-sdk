// ---------------------------------------------------------------------------
// PayArk SDK – Custom Error Classes
// ---------------------------------------------------------------------------
// Provides structured, inspectable errors that preserve the HTTP context
// from failed API calls. Follows the Stripe SDK error pattern.
// Ref: https://docs.stripe.com/error-handling
// ---------------------------------------------------------------------------

import type { PayArkErrorBody } from './types';

/**
 * Base error class for all PayArk SDK errors.
 *
 * Every error includes:
 * - `statusCode` – the HTTP status (or 0 for network failures)
 * - `code`       – a machine-readable error type
 * - `raw`        – the original response body, if available
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

        // Maintain proper stack trace in V8 environments
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, PayArkError);
        }
    }
}

/** Machine-readable error codes emitted by the SDK. */
export type PayArkErrorCode =
    | 'authentication_error'   // 401 – invalid or missing API key
    | 'invalid_request_error'  // 400 – bad request body / params
    | 'not_found_error'        // 404 – resource does not exist
    | 'rate_limit_error'       // 429 – too many requests
    | 'api_error'              // 500 – server-side failure
    | 'network_error'          // fetch failed (DNS, timeout, etc.)
    | 'unknown_error';         // catch-all

/**
 * Derive a machine-readable error code from an HTTP status code.
 * This avoids callers needing to remember numerical ranges.
 */
export function errorCodeFromStatus(status: number): PayArkErrorCode {
    if (status === 401) return 'authentication_error';
    if (status === 400 || status === 422) return 'invalid_request_error';
    if (status === 404) return 'not_found_error';
    if (status === 429) return 'rate_limit_error';
    if (status >= 500) return 'api_error';
    return 'unknown_error';
}
