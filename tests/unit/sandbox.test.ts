import { describe, expect, test, mock, spyOn } from "bun:test";
import { PayArk } from "../../src/client";
import {
  PayArkAuthenticationError,
  PayArkNotFoundError,
  PayArkRateLimitError,
} from "../../src/errors";
import { HttpClient } from "../../src/http";

describe("PayArk Client Sandbox & Errors", () => {
  const mockFetch = mock(
    async () => new Response(JSON.stringify({}), { status: 200 }),
  );
  // @ts-expect-error - Mocking global fetch for testing
  global.fetch = mockFetch;

  test("should include x-sandbox-mode header when sandbox is enabled", async () => {
    const payark = new PayArk({ apiKey: "sk_test_123", sandbox: true });

    // Spy on internal buildHeaders or just check fetch calls
    // Since HttpClient is private, we can't easily spy on it directly without exposing it
    // Check the mock calls instead
    mockFetch.mockClear();
    await payark.payments.list();

    const lastCall = (mockFetch.mock.calls as any)[0];
    const headers = lastCall?.[1]?.headers as Record<string, string>;
    expect(headers).toBeDefined();
    if (headers) {
      expect(headers["x-sandbox-mode"]).toBe("true");
    }
  });

  test("should NOT include x-sandbox-mode header when sandbox is disabled", async () => {
    const payark = new PayArk({ apiKey: "sk_live_123" });

    mockFetch.mockClear();
    await payark.payments.list();

    const lastCall = mockFetch.mock.calls[0] as any[];
    const headers = lastCall?.[1]?.headers as Record<string, string>;
    expect(headers?.["x-sandbox-mode"]).toBeUndefined();
  });

  test("should throw PayArkAuthenticationError on 401", async () => {
    const payark = new PayArk({ apiKey: "sk_test_123" });
    mockFetch.mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: "Invalid API Key" }), {
          status: 401,
        }),
    );

    try {
      await payark.payments.list();
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(PayArkAuthenticationError);
      // @ts-expect-error - Property statusCode doesn't exist on type 'Error'
      expect(err.statusCode).toBe(401);
      // @ts-expect-error - Property code doesn't exist on type 'Error'
      expect(err.code).toBe("authentication_error");
    }
  });

  test("should throw PayArkNotFoundError on 404", async () => {
    const payark = new PayArk({ apiKey: "sk_test_123" });
    mockFetch.mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: "Not Found" }), { status: 404 }),
    );

    try {
      await payark.payments.retrieve("pay_123");
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(PayArkNotFoundError);
      // @ts-expect-error - Property code doesn't exist on type 'Error'
      expect(err.code).toBe("not_found_error");
    }
  });

  test("should throw PayArkRateLimitError on 429", async () => {
    const payark = new PayArk({ apiKey: "sk_test_123", maxRetries: 0 }); // Disable retries for this test
    mockFetch.mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: "Too Many Requests" }), {
          status: 429,
        }),
    );

    try {
      await payark.payments.list();
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(PayArkRateLimitError);
      // @ts-expect-error - Property code doesn't exist on type 'Error'
      expect(err.code).toBe("rate_limit_error");
    }
  });
});
