// ---------------------------------------------------------------------------
// PayArk SDK – HTTP Transport Layer
// ---------------------------------------------------------------------------
// A thin, zero-dependency HTTP client built on the global `fetch()` API.
// Handles:
//   - Bearer token authentication
//   - Automatic retries with exponential back-off + jitter (5xx only)
//   - Structured error mapping via PayArkError
//   - Timeouts via AbortController
//
// This module is intentionally kept internal. Consumers interact via the
// higher-level PayArk client class.
// ---------------------------------------------------------------------------

import { PayArkError, errorCodeFromStatus } from './errors';
import type { PayArkConfig, PayArkErrorBody } from './types';

// SDK version injected at build time (fallback for dev)
const SDK_VERSION = '0.1.0';

/** Supported HTTP methods for the PayArk API. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Options forwarded to an individual request. */
export interface RequestOptions {
    /** Query parameters appended to the URL. */
    query?: Record<string, string | number | undefined>;
    /** JSON body (for POST/PUT/PATCH). */
    body?: unknown;
    /** Extra headers merged with defaults. */
    headers?: Record<string, string>;
    /** Override per-request timeout (ms). */
    timeout?: number;
}

/**
 * Internal HTTP client used by every resource module.
 *
 * Encapsulates retry logic, error parsing, and authentication so that
 * resource methods only need to declare *what* to call, not *how*.
 */
export class HttpClient {
    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly timeout: number;
    private readonly maxRetries: number;

    constructor(config: PayArkConfig) {
        if (!config.apiKey) {
            throw new PayArkError(
                'An API key is required. Pass it as `apiKey` in the PayArk config.',
                0,
                'authentication_error',
            );
        }

        this.apiKey = config.apiKey;
        this.baseUrl = (config.baseUrl ?? 'https://api.payark.com').replace(/\/+$/, '');
        this.timeout = config.timeout ?? 30_000;
        this.maxRetries = config.maxRetries ?? 2;
    }

    // ── Public request method ────────────────────────────────────────────────

    /**
     * Execute an HTTP request against the PayArk API.
     *
     * @returns Parsed JSON response body of type `T`.
     * @throws  {PayArkError} on any non-2xx response or network failure.
     */
    async request<T>(method: HttpMethod, path: string, opts: RequestOptions = {}): Promise<T> {
        const url = this.buildUrl(path, opts.query);
        const headers = this.buildHeaders(opts.headers);
        const requestTimeout = opts.timeout ?? this.timeout;

        const fetchOptions: RequestInit = {
            method,
            headers,
        };

        if (opts.body !== undefined && method !== 'GET') {
            fetchOptions.body = JSON.stringify(opts.body);
        }

        // Retry loop with exponential back-off
        let lastError: PayArkError | undefined;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), requestTimeout);
                fetchOptions.signal = controller.signal;

                const response = await fetch(url.toString(), fetchOptions);
                clearTimeout(timer);

                if (response.ok) {
                    // 204 No Content → return empty object
                    if (response.status === 204) return {} as T;
                    return (await response.json()) as T;
                }

                // Parse error body
                let errorBody: PayArkErrorBody | undefined;
                try {
                    errorBody = (await response.json()) as PayArkErrorBody;
                } catch {
                    // Body is not JSON – use status text
                }

                const code = errorCodeFromStatus(response.status);
                const message =
                    errorBody?.error ?? `PayArk API error: ${response.status} ${response.statusText}`;

                lastError = new PayArkError(message, response.status, code, errorBody);

                // Only retry 5xx errors (server faults). Client errors are deterministic.
                if (response.status < 500) {
                    throw lastError;
                }
            } catch (error) {
                if (error instanceof PayArkError) {
                    lastError = error;
                    // If it's a client error (4xx), don't retry
                    if (error.statusCode > 0 && error.statusCode < 500) {
                        throw error;
                    }
                } else if (error instanceof DOMException && error.name === 'AbortError') {
                    lastError = new PayArkError(
                        `Request timed out after ${requestTimeout}ms`,
                        0,
                        'network_error',
                    );
                } else {
                    lastError = new PayArkError(
                        `Network error: ${(error as Error).message}`,
                        0,
                        'network_error',
                    );
                }
            }

            // Exponential back-off: 500ms, 1000ms, 2000ms...  + jitter
            if (attempt < this.maxRetries) {
                const baseDelay = 500 * Math.pow(2, attempt);
                const jitter = Math.random() * 200;
                await this.sleep(baseDelay + jitter);
            }
        }

        // All retries exhausted
        throw lastError ?? new PayArkError('Request failed after retries', 0, 'unknown_error');
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /** Construct the full URL with query parameters. */
    private buildUrl(path: string, query?: Record<string, string | number | undefined>): URL {
        const url = new URL(`${this.baseUrl}${path}`);

        if (query) {
            for (const [key, value] of Object.entries(query)) {
                if (value !== undefined) {
                    url.searchParams.set(key, String(value));
                }
            }
        }

        return url;
    }

    /** Build default + custom headers for every request. */
    private buildHeaders(extra?: Record<string, string>): Record<string, string> {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': `payark-sdk-node/${SDK_VERSION}`,
            ...extra,
        };
    }

    /** Promise-based sleep utility. */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
