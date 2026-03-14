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
import { Effect } from "effect";
import {
  HttpClient as Http,
  HttpClientRequest as HttpRequest,
  HttpClientResponse as HttpResponse,
  FetchHttpClient,
  Headers,
} from "@effect/platform";
import { Cause, Exit, Duration, Option } from "effect";

/** SDK version – injected at build time for User-Agent header. */
const SDK_VERSION = "0.1.9";

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
const RETRYABLE_STATUS_CODES = new Set([500, 502, 503, 504]);

/** Methods that mutate state and require idempotency protection. */
const MUTATING_METHODS = new Set<HttpMethod>(["POST", "PUT", "PATCH"]);

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
    this.baseUrl = (config.baseUrl ?? "https://api.payark.dev").replace(
      /\/+$/,
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
  /**
   * Execute an HTTP request against the PayArk API.
   * Internally uses Effect for robust retry logic and error handling.
   *
   * @returns Parsed JSON response body of type `T`.
   * @throws  {PayArkError} on any non-2xx response or network failure.
   */
  async request<T>(
    method: HttpMethod,
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    const url = this.buildUrl(path, opts.query).toString();
    const timeout = opts.timeout ?? this.timeout;

    // Generate idempotency key for mutating methods
    const idempotencyKey = MUTATING_METHODS.has(method)
      ? this.generateIdempotencyKey()
      : undefined;

    const headers = this.buildHeaders(opts.headers, idempotencyKey);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    const program = Effect.gen(function* () {
      const parseRetryAfterMs = (retryAfter: string): number | undefined => {
        const trimmed = retryAfter.trim();
        if (/^\d+$/.test(trimmed)) {
          const seconds = Number.parseInt(trimmed, 10);
          if (seconds > 0) return seconds * 1000;
        }

        const retryAt = Date.parse(trimmed);
        if (!Number.isNaN(retryAt)) {
          const delta = retryAt - Date.now();
          if (delta > 0) return delta;
        }

        return undefined;
      };

      const isResponseError = (err: unknown): boolean =>
        !!(
          err &&
          typeof err === "object" &&
          "_tag" in err &&
          err._tag === "ResponseError"
        );

      const getStatusCode = (err: unknown): number | undefined => {
        if (!isResponseError(err)) return undefined;
        const responseError = err as any;
        return responseError.response.status;
      };

      const getRetryAfterMsFromError = (err: unknown): number | undefined => {
        if (!isResponseError(err)) return undefined;
        const responseError = err as any;
        if (responseError.response.status !== 429) return undefined;
        const retryAfter = Headers.get(
          responseError.response.headers,
          "retry-after",
        );
        if (Option.isNone(retryAfter)) return undefined;
        return parseRetryAfterMs(retryAfter.value);
      };

      const computeBackoffMs = (retryIndex: number): number => {
        const base = 500 * 2 ** retryIndex;
        const jitter = Math.floor(Math.random() * base); // Full jitter in [0, base)
        return jitter;
      };

      // Build request
      let req = HttpRequest.make(method)(url).pipe(
        HttpRequest.setHeaders(headers),
      );

      if (opts.body !== undefined && method !== "GET") {
        req = yield* HttpRequest.bodyJson(opts.body)(req);
      }

      const executeWithRetry: (
        attempt: number,
      ) => Effect.Effect<any, any, any> = (attempt: number) =>
        Http.execute(req).pipe(
          Effect.flatMap(HttpResponse.filterStatusOk),
          Effect.timeout(timeout),
          Effect.catchAll((err) =>
            Effect.gen(function* () {
              if (attempt >= self.maxRetries) {
                return yield* Effect.fail(err);
              }

              const retryAfterMs = getRetryAfterMsFromError(err);
              if (retryAfterMs !== undefined) {
                // For 429, retry exactly at server-provided Retry-After.
                yield* Effect.sleep(Duration.millis(retryAfterMs));
                return yield* executeWithRetry(attempt + 1);
              }

              const statusCode = getStatusCode(err);
              const shouldRetryServerError =
                statusCode !== undefined &&
                RETRYABLE_STATUS_CODES.has(statusCode);
              const shouldRetryNetworkError = statusCode === undefined;

              if (shouldRetryServerError || shouldRetryNetworkError) {
                const backoffMs = computeBackoffMs(attempt);
                yield* Effect.sleep(Duration.millis(backoffMs));
                return yield* executeWithRetry(attempt + 1);
              }

              return yield* Effect.fail(err);
            }),
          ),
        );

      // Execute request with retries and timeout
      const response = yield* executeWithRetry(0).pipe(
        // Map any remaining errors to PayArkError
        Effect.catchAll((err: any) =>
          Effect.gen(function* () {
            if (
              err &&
              typeof err === "object" &&
              "_tag" in err &&
              err._tag === "ResponseError"
            ) {
              const responseError = err as any;
              // 1. Try to parse JSON problem body (RFC 7807) or standard JSON error
              const errorBody = yield* responseError.response.json.pipe(
                // 2. Fall back to raw text if it's not JSON (e.g., 502 Bad Gateway from Nginx)
                Effect.catchAll(() =>
                  responseError.response.text.pipe(
                    Effect.map((text: string) => ({
                      error: text.length > 0 ? text.slice(0, 512) : undefined,
                    })),
                    Effect.catchAll(() => Effect.succeed(undefined)),
                  ),
                ),
              );

              return yield* Effect.fail(
                PayArkError.generate(
                  responseError.response.status,
                  errorBody,
                  errorBody?.detail || errorBody?.error,
                ),
              );
            }

            if (
              err &&
              typeof err === "object" &&
              "_tag" in err &&
              err._tag === "TimeoutException"
            ) {
              return yield* Effect.fail(
                PayArkError.generate(
                  0,
                  undefined,
                  `Request timed out after ${timeout}ms`,
                ),
              );
            }

            return yield* Effect.fail(
              PayArkError.generate(
                0,
                undefined,
                `Network error: ${String(err)}`,
              ),
            );
          }),
        ),
      );

      // Parse success response
      if (response.status === 204) {
        return {} as T;
      }
      const data = yield* response.json as Effect.Effect<T, any, never>;
      return data;
    }).pipe(Effect.provide(FetchHttpClient.layer)) as Effect.Effect<
      T,
      PayArkError,
      never
    >;

    const result = await Effect.runPromiseExit(program);
    if (Exit.isSuccess(result)) {
      return result.value;
    }

    // Unwrap the error from the Cause
    const failures = Array.from(Cause.failures(result.cause));
    if (failures.length > 0) {
      throw failures[0];
    }
    throw Cause.squash(result.cause);
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
