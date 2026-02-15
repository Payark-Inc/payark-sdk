// ---------------------------------------------------------------------------
// PayArk SDK – Custom Error Classes
// ---------------------------------------------------------------------------
// Provides structured, inspectable errors that preserve the HTTP context
// from failed API calls. Follows the Stripe SDK error pattern.
// Ref: https://docs.stripe.com/error-handling
// ---------------------------------------------------------------------------

import type { PayArkErrorBody } from "./types";

/** Machine-readable error codes emitted by the SDK. */
export type PayArkErrorCode =
  | "authentication_error" // 401 – invalid or missing API key
  | "permission_error" // 403 – valid auth but insufficient permissions
  | "invalid_request_error" // 400/422 – bad request body / params
  | "not_found_error" // 404 – resource does not exist
  | "rate_limit_error" // 429 – too many requests
  | "api_error" // 500 – server-side failure
  | "connection_error" // fetch failed (DNS, timeout, etc.)
  | "unknown_error"; // catch-all

/**
 * Base error class for all PayArk SDK errors.
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
    this.name = "PayArkError";
    this.statusCode = statusCode;
    this.code = code;
    this.raw = raw;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PayArkError);
    }
  }

  /** Human-readable representation for logging/debugging. */
  override toString(): string {
    return `[${this.name}: ${this.code}] ${this.message} (HTTP ${this.statusCode})`;
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

  /**
   * Factory method to generate the appropriate error subclass based on HTTP status.
   */
  static generate(
    status: number,
    data?: PayArkErrorBody,
    message?: string,
  ): PayArkError {
    const msg =
      message || data?.error || `Request failed with status ${status}`;
    const raw = data;

    switch (status) {
      case 401:
        return new PayArkAuthenticationError(msg, raw);
      case 403:
        return new PayArkPermissionError(msg, raw);
      case 400:
      case 422:
        return new PayArkInvalidRequestError(msg, status, raw);
      case 404:
        return new PayArkNotFoundError(msg, raw);
      case 429:
        return new PayArkRateLimitError(msg, raw);
      case 0:
        return new PayArkConnectionError(msg);
      default:
        if (status >= 500) {
          return new PayArkAPIError(msg, status, raw);
        }
        return new PayArkError(msg, status, "unknown_error", raw);
    }
  }
}

/** 401 - Authentication failure (invalid API key). */
export class PayArkAuthenticationError extends PayArkError {
  constructor(message: string, raw?: PayArkErrorBody) {
    super(message, 401, "authentication_error", raw);
    this.name = "PayArkAuthenticationError";
  }
}

/** 403 - Permission failure (valid key, but unauthorized action). */
export class PayArkPermissionError extends PayArkError {
  constructor(message: string, raw?: PayArkErrorBody) {
    super(message, 403, "permission_error", raw);
    this.name = "PayArkPermissionError";
  }
}

/** 400/422 - Invalid parameters or bad request. */
export class PayArkInvalidRequestError extends PayArkError {
  constructor(message: string, statusCode: number, raw?: PayArkErrorBody) {
    super(message, statusCode, "invalid_request_error", raw);
    this.name = "PayArkInvalidRequestError";
  }
}

/** 404 - Resource not found. */
export class PayArkNotFoundError extends PayArkError {
  constructor(message: string, raw?: PayArkErrorBody) {
    super(message, 404, "not_found_error", raw);
    this.name = "PayArkNotFoundError";
  }
}

/** 429 - Too many requests (Rate Limit). */
export class PayArkRateLimitError extends PayArkError {
  constructor(message: string, raw?: PayArkErrorBody) {
    super(message, 429, "rate_limit_error", raw);
    this.name = "PayArkRateLimitError";
  }
}

/** 500+ - PayArk internal server error. */
export class PayArkAPIError extends PayArkError {
  constructor(message: string, statusCode: number, raw?: PayArkErrorBody) {
    super(message, statusCode, "api_error", raw);
    this.name = "PayArkAPIError";
  }
}

/** 0 - Network/Connection error (DNS, Timeout, Offline). */
export class PayArkConnectionError extends PayArkError {
  constructor(message: string) {
    super(message, 0, "connection_error");
    this.name = "PayArkConnectionError";
  }
}

/** Webhook signature verification failure. */
export class PayArkSignatureVerificationError extends PayArkError {
  constructor(message: string) {
    super(message, 400, "invalid_request_error");
    this.name = "PayArkSignatureVerificationError";
  }
}
