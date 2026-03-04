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
import { Effect, Option } from "effect";
import {
  HttpClient as Http,
  HttpClientRequest as HttpRequest,
  FetchHttpClient,
  Headers,
} from "@effect/platform";

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

    let retries = 0;

    while (true) {
      const req = await this.buildRequest(method, url, headers, opts.body);

      let response;
      try {
        response = await Effect.runPromise(
          Http.execute(req).pipe(
            Effect.timeout(timeout),
            Effect.provide(FetchHttpClient.layer),
          ),
        );
      } catch (err: unknown) {
        if (retries < this.maxRetries) {
          retries += 1;
          const delayMs = this.computeBackoffMs(retries);
          await this.sleep(delayMs);
          continue;
        }

        throw this.mapNetworkError(err, timeout);
      }

      if (response.status >= 200 && response.status < 300) {
        if (response.status === 204) {
          return {} as T;
        }

        return (await this.parseJsonSafe<T>(response)) as T;
      }

      const retryAfterSeconds = this.getRetryAfterSeconds(response);
      const isRetryable = RETRYABLE_STATUS_CODES.has(response.status);

      if (isRetryable && retries < this.maxRetries) {
        retries += 1;

        if (response.status === 429 && retryAfterSeconds !== null) {
          await this.sleep(retryAfterSeconds * 1000);
        } else {
          const delayMs = this.computeBackoffMs(retries);
          await this.sleep(delayMs);
        }
        continue;
      }

      const errorBody = await this.parseJsonSafe<PayArkErrorBody>(response);
      throw PayArkError.generate(
        response.status,
        errorBody,
        errorBody?.error,
      );
    }
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

  /** Build a request (including optional JSON body). */
  private async buildRequest(
    method: HttpMethod,
    url: string,
    headers: Record<string, string>,
    body: unknown,
  ) {
    let req = HttpRequest.make(method)(url).pipe(
      HttpRequest.setHeaders(headers),
    );

    if (body !== undefined && method !== "GET") {
      req = await Effect.runPromise(HttpRequest.bodyJson(body)(req));
    }

    return req;
  }

  /** Compute exponential backoff with jitter (0.5x–1.5x). */
  private computeBackoffMs(retryCount: number): number {
    const baseMs = 500 * 2 ** (retryCount - 1);
    const jitter = 0.5 + Math.random();
    return Math.round(baseMs * jitter);
  }

  /** Parse Retry-After header into seconds (supports delta or HTTP-date). */
  private getRetryAfterSeconds(response: any): number | null {
    const retryAfterOption = Headers.get(response.headers, "retry-after");
    if (!Option.isSome(retryAfterOption)) return null;

    const value = retryAfterOption.value.trim();
    const seconds = Number.parseInt(value, 10);
    if (Number.isFinite(seconds)) {
      return Math.max(0, seconds);
    }

    const dateMs = Date.parse(value);
    if (!Number.isNaN(dateMs)) {
      const deltaMs = dateMs - Date.now();
      return deltaMs > 0 ? Math.ceil(deltaMs / 1000) : 0;
    }

    return null;
  }

  /** Parse JSON body safely (returns undefined on failure). */
  private async parseJsonSafe<T>(response: any): Promise<T | undefined> {
    try {
      return (await Effect.runPromise(response.json)) as T;
    } catch {
      return undefined;
    }
  }

  /** Map network/timeout errors to PayArkError. */
  private mapNetworkError(err: unknown, timeout: number): PayArkError {
    if (
      err &&
      typeof err === "object" &&
      "_tag" in err &&
      (err as { _tag?: string })._tag === "TimeoutException"
    ) {
      return PayArkError.generate(
        0,
        undefined,
        `Request timed out after ${timeout}ms`,
      );
    }

    return PayArkError.generate(
      0,
      undefined,
      `Network error: ${String(err)}`,
    );
  }
}
