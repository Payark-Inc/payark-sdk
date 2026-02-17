// ---------------------------------------------------------------------------
// PayArk SDK – Error Module Unit Tests
// ---------------------------------------------------------------------------
// Tests PayArkError construction, serialisation, instanceof behaviour,
// and the PayArkError.generate factory method.
// ---------------------------------------------------------------------------

import { describe, test, expect } from "bun:test";
import {
  PayArkError,
  PayArkAuthenticationError,
  PayArkPermissionError,
  PayArkInvalidRequestError,
  PayArkNotFoundError,
  PayArkRateLimitError,
  PayArkAPIError,
  PayArkConnectionError,
} from "../../src/errors";
import type { PayArkErrorCode } from "../../src/errors";

describe("PayArkError", () => {
  // ── Construction ─────────────────────────────────────────────────────

  describe("constructor", () => {
    test("should set all properties correctly", () => {
      const raw = { error: "test error", details: { field: "amount" } };
      const err = new PayArkError(
        "Test message",
        400,
        "invalid_request_error",
        raw,
      );

      expect(err.message).toBe("Test message");
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("invalid_request_error");
      expect(err.raw).toEqual(raw);
      expect(err.name).toBe("PayArkError");
    });

    test("should work without raw body (optional param)", () => {
      const err = new PayArkError("No body", 500, "api_error");

      expect(err.raw).toBeUndefined();
      expect(err.statusCode).toBe(500);
    });

    test("should set statusCode to 0 for connection errors", () => {
      const err = new PayArkError("DNS failed", 0, "connection_error");

      expect(err.statusCode).toBe(0);
      expect(err.code).toBe("connection_error");
    });

    test("should have a proper stack trace", () => {
      const err = new PayArkError("Stack test", 500, "api_error");

      expect(err.stack).toBeDefined();
      expect(err.stack).toContain("Stack test");
    });
  });

  // ── instanceof ───────────────────────────────────────────────────────

  describe("instanceof", () => {
    test("should be an instance of PayArkError", () => {
      const err = new PayArkError("test", 400, "invalid_request_error");
      expect(err).toBeInstanceOf(PayArkError);
    });

    test("should be an instance of Error", () => {
      const err = new PayArkError("test", 400, "invalid_request_error");
      expect(err).toBeInstanceOf(Error);
    });

    test("should work correctly after Object.setPrototypeOf", () => {
      // This specifically tests the cross-realm instanceof fix
      const err = new PayArkError("cross-realm", 401, "authentication_error");
      const isPayArkError = err instanceof PayArkError;
      const isError = err instanceof Error;

      expect(isPayArkError).toBe(true);
      expect(isError).toBe(true);
    });
  });

  // ── Serialisation ────────────────────────────────────────────────────

  describe("toString", () => {
    test("should include code, message, and HTTP status", () => {
      const err = new PayArkError("Unauthorized", 401, "authentication_error");
      const str = err.toString();

      expect(str).toContain("PayArkError");
      expect(str).toContain("authentication_error");
      expect(str).toContain("Unauthorized");
      expect(str).toContain("401");
    });

    test("should show HTTP 0 for connection errors", () => {
      const err = new PayArkError("Timeout", 0, "connection_error");

      expect(err.toString()).toContain("HTTP 0");
    });
  });

  describe("toJSON", () => {
    test("should return a serialisable plain object", () => {
      const raw = { error: "Bad request" };
      const err = new PayArkError(
        "Bad request",
        400,
        "invalid_request_error",
        raw,
      );
      const json = err.toJSON();

      expect(json.name).toBe("PayArkError");
      expect(json.message).toBe("Bad request");
      expect(json.code).toBe("invalid_request_error");
      expect(json.statusCode).toBe(400);
      expect(json.raw).toEqual(raw);
    });

    test("should produce valid JSON via JSON.stringify", () => {
      const err = new PayArkError("Serialise me", 500, "api_error");
      const parsed = JSON.parse(JSON.stringify(err.toJSON()));

      expect(parsed.name).toBe("PayArkError");
      expect(parsed.code).toBe("api_error");
      expect(parsed.statusCode).toBe(500);
    });

    test("should handle undefined raw body", () => {
      const err = new PayArkError("No raw", 404, "not_found_error");
      const json = err.toJSON();

      expect(json.raw).toBeUndefined();
    });
  });
});

// ── PayArkError.generate factory ──────────────────────────────────────

describe("PayArkError.generate", () => {
  test("should map HTTP 401 to PayArkAuthenticationError", () => {
    const err = PayArkError.generate(401, { error: "Auth failed" });
    expect(err).toBeInstanceOf(PayArkAuthenticationError);
    expect(err.code).toBe("authentication_error");
    expect(err.statusCode).toBe(401);
  });

  test("should map HTTP 403 to PayArkPermissionError", () => {
    const err = PayArkError.generate(403, { error: "Forbidden" });
    expect(err).toBeInstanceOf(PayArkPermissionError);
    expect(err.code).toBe("permission_error");
    expect(err.statusCode).toBe(403);
  });

  test("should map HTTP 400/422 to PayArkInvalidRequestError", () => {
    const err1 = PayArkError.generate(400, { error: "Bad request" });
    expect(err1).toBeInstanceOf(PayArkInvalidRequestError);
    expect(err1.code).toBe("invalid_request_error");

    const err2 = PayArkError.generate(422, { error: "Unprocessable" });
    expect(err2).toBeInstanceOf(PayArkInvalidRequestError);
    expect(err2.code).toBe("invalid_request_error");
  });

  test("should map HTTP 404 to PayArkNotFoundError", () => {
    const err = PayArkError.generate(404, { error: "Not found" });
    expect(err).toBeInstanceOf(PayArkNotFoundError);
    expect(err.code).toBe("not_found_error");
  });

  test("should map HTTP 429 to PayArkRateLimitError", () => {
    const err = PayArkError.generate(429, { error: "Too many requests" });
    expect(err).toBeInstanceOf(PayArkRateLimitError);
    expect(err.code).toBe("rate_limit_error");
  });

  test("should map HTTP 5xx to PayArkAPIError", () => {
    const err = PayArkError.generate(500, { error: "Internal failure" });
    expect(err).toBeInstanceOf(PayArkAPIError);
    expect(err.code).toBe("api_error");
    expect(err.statusCode).toBe(500);
  });

  test("should map HTTP 0 to PayArkConnectionError", () => {
    const err = PayArkError.generate(0, undefined, "Timeout");
    expect(err).toBeInstanceOf(PayArkConnectionError);
    expect(err.code).toBe("connection_error");
    expect(err.statusCode).toBe(0);
  });

  test("should return base PayArkError for unmapped status codes", () => {
    const err = PayArkError.generate(418, { error: "I am a teapot" });
    expect(err).toBeInstanceOf(PayArkError);
    expect(err.code).toBe("unknown_error");
  });
});
