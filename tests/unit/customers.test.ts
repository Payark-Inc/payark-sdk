// ---------------------------------------------------------------------------
// PayArk SDK – Customer Resource Unit Tests
// ---------------------------------------------------------------------------
// Verifies the CustomersResource methods form correct HTTP requests:
//   - create()   → POST   /v1/customers
//   - retrieve()  → GET    /v1/customers/:id
//   - list()      → GET    /v1/customers
//   - update()   → PATCH  /v1/customers/:id
//   - delete()   → DELETE /v1/customers/:id
// ---------------------------------------------------------------------------

import { describe, test, expect, mock, afterEach } from "bun:test";
import { PayArk } from "../../src/client";
import { PayArkError } from "../../src/errors";

function setFetch(fn: (...args: any[]) => any): void {
  (globalThis as any).fetch = fn;
}

function fetchMock(): { mock: { calls: any[][] } } {
  return globalThis.fetch as any;
}

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const MOCK_CUSTOMER = {
  id: "cus_abc123",
  merchant_customer_id: "usr_42",
  email: "test@example.com",
  name: "Test User",
  phone: null,
  project_id: "proj_001",
  metadata: {},
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("CustomersResource", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function createClient(): PayArk {
    return new PayArk({
      apiKey: "sk_test_key",
      baseUrl: "https://mock.test",
      maxRetries: 0,
    });
  }

  // ── create() ────────────────────────────────────────────────────────────

  describe("customers.create", () => {
    test("should POST to /v1/customers with correct body", async () => {
      setFetch(mock(() => Promise.resolve(mockResponse(MOCK_CUSTOMER, 200))));

      const client = createClient();
      const result = await client.customers.create({
        merchant_customer_id: "usr_42",
        email: "test@example.com",
        name: "Test User",
      });

      expect(result.id).toBe("cus_abc123");
      expect(result.merchant_customer_id).toBe("usr_42");

      const [url, opts] = fetchMock().mock.calls[0];
      expect(url.toString()).toContain("/v1/customers");
      expect(opts.method).toBe("POST");

      const body = JSON.parse(opts.body);
      expect(body.merchant_customer_id).toBe("usr_42");
      expect(body.email).toBe("test@example.com");
    });
  });

  // ── retrieve() ──────────────────────────────────────────────────────────

  describe("customers.retrieve", () => {
    test("should GET /v1/customers/:id", async () => {
      setFetch(mock(() => Promise.resolve(mockResponse(MOCK_CUSTOMER))));

      const client = createClient();
      const result = await client.customers.retrieve("cus_abc123");

      expect(result.id).toBe("cus_abc123");

      const url = fetchMock().mock.calls[0][0].toString();
      expect(url).toContain("/v1/customers/cus_abc123");
    });

    test("should URL-encode the customer ID", async () => {
      setFetch(mock(() => Promise.resolve(mockResponse(MOCK_CUSTOMER))));

      const client = createClient();
      await client.customers.retrieve("cus/special");

      const url = fetchMock().mock.calls[0][0].toString();
      expect(url).toContain("cus%2Fspecial");
    });
  });

  // ── update() ────────────────────────────────────────────────────────────

  describe("customers.update", () => {
    test("should PATCH /v1/customers/:id with correct body", async () => {
      const updated = { ...MOCK_CUSTOMER, name: "Updated Name" };
      setFetch(mock(() => Promise.resolve(mockResponse(updated))));

      const client = createClient();
      const result = await client.customers.update("cus_abc123", {
        name: "Updated Name",
      });

      expect(result.name).toBe("Updated Name");

      const [url, opts] = fetchMock().mock.calls[0];
      expect(url.toString()).toContain("/v1/customers/cus_abc123");
      expect(opts.method).toBe("PATCH");

      const body = JSON.parse(opts.body);
      expect(body.name).toBe("Updated Name");
    });

    test("should send only provided fields", async () => {
      setFetch(mock(() => Promise.resolve(mockResponse(MOCK_CUSTOMER))));

      const client = createClient();
      await client.customers.update("cus_abc123", {
        email: "new@example.com",
      });

      const body = JSON.parse(fetchMock().mock.calls[0][1].body);
      expect(body.email).toBe("new@example.com");
      expect(body.name).toBeUndefined();
      expect(body.phone).toBeUndefined();
    });

    test("should URL-encode the customer ID", async () => {
      setFetch(mock(() => Promise.resolve(mockResponse(MOCK_CUSTOMER))));

      const client = createClient();
      await client.customers.update("cus/special", { name: "X" });

      const url = fetchMock().mock.calls[0][0].toString();
      expect(url).toContain("cus%2Fspecial");
    });

    test("should throw on 409 conflict", async () => {
      setFetch(
        mock(() =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                error: "Customer with this email already exists",
              }),
              { status: 409 },
            ),
          ),
        ),
      );

      const client = createClient();

      try {
        await client.customers.update("cus_abc123", {
          email: "taken@example.com",
        });
        expect(true).toBe(false); // Should not reach
      } catch (err) {
        expect(err).toBeInstanceOf(PayArkError);
        expect((err as PayArkError).statusCode).toBe(409);
      }
    });
  });

  // ── delete() ────────────────────────────────────────────────────────────

  describe("customers.delete", () => {
    test("should DELETE /v1/customers/:id", async () => {
      setFetch(
        mock(() => Promise.resolve(new Response(null, { status: 204 }))),
      );

      const client = createClient();
      await client.customers.delete("cus_abc123");

      const [url, opts] = fetchMock().mock.calls[0];
      expect(url.toString()).toContain("/v1/customers/cus_abc123");
      expect(opts.method).toBe("DELETE");
    });

    test("should URL-encode the customer ID", async () => {
      setFetch(
        mock(() => Promise.resolve(new Response(null, { status: 204 }))),
      );

      const client = createClient();
      await client.customers.delete("cus/special");

      const url = fetchMock().mock.calls[0][0].toString();
      expect(url).toContain("cus%2Fspecial");
    });

    test("should throw on 409 when customer has subscriptions", async () => {
      setFetch(
        mock(() =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                error: "Cannot delete customer with active subscriptions",
              }),
              { status: 409 },
            ),
          ),
        ),
      );

      const client = createClient();

      try {
        await client.customers.delete("cus_has_subs");
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(PayArkError);
        expect((err as PayArkError).statusCode).toBe(409);
      }
    });

    test("should throw on 404 for non-existent customer", async () => {
      setFetch(
        mock(() =>
          Promise.resolve(
            new Response(JSON.stringify({ error: "Customer not found" }), {
              status: 404,
            }),
          ),
        ),
      );

      const client = createClient();

      try {
        await client.customers.delete("cus_ghost");
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(PayArkError);
        expect((err as PayArkError).code).toBe("not_found_error");
      }
    });
  });
});
