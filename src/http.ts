// ---------------------------------------------------------------------------
// PayArk SDK – HTTP Transport Layer
// ---------------------------------------------------------------------------
// A thin, zero-dependency HTTP client built on the global `fetch()` API.
// Handles:
//   - Bearer token authentication
//   - Automatic retries with exponential back-off + jitter (5xx only)
//   - Idempotency keys for safely retrying mutating requests (POST)
//   - Structured error mapping via PayArkError
//   - Timeouts via AbortController
//
// This module is intentionally kept internal. Consumers interact via the
// higher-level PayArk client class.
// ---------------------------------------------------------------------------

import { PayArkError } from "./errors";
import type { PayArkConfig, PayArkErrorBody } from "./types";

/** SDK version – injected at build time for User-Agent header. */
const SDK_VERSION = "0.1.0";

/** Supported HTTP methods for the PayArk API. */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

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

/** HTTP status codes that signal a retryable server failure. */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/** Methods that mutate state and require idempotency protection. */
const MUTATING_METHODS = new Set<HttpMethod>(["POST", "PUT", "PATCH"]);

/** Regex to match trailing slashes for base URL normalization. */
const TRAILING_SLASH_REGEX = /\/+$/;

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
  private readonly sandbox: boolean;

  constructor(config: PayArkConfig) {
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      throw PayArkError.generate(
        401,
        undefined,
        "An API key is required. Pass it as `apiKey` in the PayArk config.",
      );
    }

    this.apiKey = config.apiKey.trim();
    this.baseUrl = (config.baseUrl ?? "https://api.payark.com").replace(
      TRAILING_SLASH_REGEX,
      "",
    );
    this.timeout = config.timeout ?? 30_000;
    this.maxRetries = config.maxRetries ?? 2;
    this.sandbox = config.sandbox ?? false;
  }

  // ── Public request method ────────────────────────────────────────────────

  /**
   * Execute an HTTP request against the PayArk API.
   *
   * @returns Parsed JSON response body of type `T`.
   * @throws  {PayArkError} on any non-2xx response or network failure.
   */
  async request<T>(
    method: HttpMethod,
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    const url = this.buildUrl(path, opts.query);
    const requestTimeout = opts.timeout ?? this.timeout;

    // Generate idempotency key for mutating methods to make retries safe.
    // The same key is reused across all retry attempts for a given call.
    const idempotencyKey = MUTATING_METHODS.has(method)
      ? this.generateIdempotencyKey()
      : undefined;
    const headers = this.buildHeaders(opts.headers, idempotencyKey);

    const baseInit: RequestInit = {
      method,
      headers,
    };

    if (opts.body !== undefined && method !== "GET") {
      baseInit.body = JSON.stringify(opts.body);
    }

    let lastError: PayArkError | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), requestTimeout);

      let retryAfterMs = 0;

      try {
        const response = await fetch(url.toString(), {
          ...baseInit,
          signal: controller.signal,
        });

        clearTimeout(timer);

        // ── 2xx success ──
        if (response.ok) {
          if (response.status === 204) return {} as T;
          return (await response.json()) as T;
        }

        // ── Non-2xx: parse error body ──
        let errorBody: PayArkErrorBody | undefined;
        try {
          errorBody = (await response.json()) as PayArkErrorBody;
        } catch {
          // Response body is not JSON – fall through to status text
        }

        lastError = PayArkError.generate(
          response.status,
          errorBody,
          errorBody?.error,
        );

        // Handle Rate Limiting (429) - Retry-After
        if (response.status === 429) {
          const retryHeader = response.headers.get("Retry-After");
          if (retryHeader) {
            if (/^\d+$/.test(retryHeader)) {
              retryAfterMs = parseInt(retryHeader, 10) * 1000;
            } else {
              // Try parsing HTTP Date
              const date = Date.parse(retryHeader);
              if (!isNaN(date)) {
                retryAfterMs = Math.max(0, date - Date.now());
              }
            }
          }
        }

        // Client errors (4xx) are deterministic – retrying won't help
        // UNLESS it's 429 (Rate Limit)
        if (!RETRYABLE_STATUS_CODES.has(response.status)) {
          throw lastError;
        }
      } catch (error) {
        clearTimeout(timer);

        if (error instanceof PayArkError) {
          lastError = error;
          // Don't retry client-side errors unless retryable (429)
          if (
            error.statusCode > 0 &&
            !RETRYABLE_STATUS_CODES.has(error.statusCode)
          ) {
            throw error;
          }
        } else if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          lastError = PayArkError.generate(
            0,
            undefined,
            `Request timed out after ${requestTimeout}ms`,
          );
        } else {
          lastError = PayArkError.generate(
            0,
            undefined,
            `Network error: ${(error as Error).message}`,
          );
        }
      }

      // Calculate delay: prefer Retry-After, else Exponential Back-off
      if (attempt < this.maxRetries) {
        let delay = 0;

        if (retryAfterMs > 0) {
          delay = retryAfterMs;
        } else {
          // Exponential back-off: 500ms, 1000ms, 2000ms... + jitter (0-200ms)
          delay = 500 * Math.pow(2, attempt) + Math.random() * 200;
        }

        await this.sleep(delay);
      }
    }

    throw (
      lastError ??
      new PayArkError("Request failed after retries", 0, "unknown_error")
    );
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /** Construct the full URL with query parameters, filtering out undefined values. */
  private buildUrl(
    path: string,
    query?: Record<string, string | number | undefined>,
  ): URL {
    const url = new URL(`${this.baseUrl}${path}`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url;
  }

  /** Build default + custom headers for every request. */
  private buildHeaders(
    extra?: Record<string, string>,
    idempotencyKey?: string,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": `payark-sdk-node/${SDK_VERSION}`,
    };

    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    if (this.sandbox) {
      headers["x-sandbox-mode"] = "true";
    }

    if (extra) {
      Object.assign(headers, extra);
    }

    return headers;
  }

  /** Generate a unique idempotency key (UUID v4-like without crypto dep). */
  private generateIdempotencyKey(): string {
    // Use crypto.randomUUID if available (Node 19+, all modern browsers, Bun)
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
    // Fallback: timestamp + random hex (sufficient for idempotency, not crypto)
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /** Promise-based sleep utility. */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
