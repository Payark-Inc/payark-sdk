import { describe, it, expect } from "bun:test";
import { Effect, Layer, Exit, Cause, Option } from "effect";
import { HttpClient, HttpClientResponse } from "@effect/platform";
import { PayArk } from "../../src/client";
import { PayArkEffectError } from "../../src/effect/errors";

describe("PayArk SDK - Effect API High-Level", () => {
  const apiKey = "sk_test_123";

  it("should create a checkout session", async () => {
    const mockResponse = {
      id: "cs_123",
      checkout_url: "https://pay.ark/cs_123",
      payment_method: { type: "esewa" },
    };
    const MockClient = HttpClient.make((req) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(
          req,
          new Response(JSON.stringify(mockResponse)),
        ),
      ),
    );

    const payark = new PayArk({ apiKey });
    const program = payark.effect.checkout
      .create({
        amount: 1000,
        provider: "esewa",
        returnUrl: "https://example.com/success",
      })
      .pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, MockClient)));

    const result = await Effect.runPromise(program);
    expect(result.id).toBe("cs_123");
    expect(result.payment_method.type).toBe("esewa");
  });

  it("should list payments", async () => {
    const mockResponse = {
      data: [
        {
          id: "pay_1",
          amount: 100,
          currency: "NPR",
          status: "completed", // Note: PaymentStatus is success|pending|failed, so completed might fail if literal
          project_id: "p1",
          created_at: "now",
        },
      ],
      meta: { total: 1, limit: 10, offset: 0 },
    };
    // Fix status to be valid
    mockResponse.data[0].status = "success";

    const MockClient = HttpClient.make((req) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(
          req,
          new Response(JSON.stringify(mockResponse)),
        ),
      ),
    );

    const payark = new PayArk({ apiKey });
    const program = payark.effect.payments
      .list()
      .pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, MockClient)));

    const result = await Effect.runPromise(program);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("pay_1");
    expect(result.meta.total).toBe(1);
  });

  it("should list projects", async () => {
    const mockResponse = [
      {
        id: "proj_1",
        name: "My Project",
        api_key_secret: "sk_...",
        created_at: "now",
      },
    ];
    const MockClient = HttpClient.make((req) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(
          req,
          new Response(JSON.stringify(mockResponse)),
        ),
      ),
    );

    const payark = new PayArk({ apiKey });
    const program = payark.effect.projects
      .list()
      .pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, MockClient)));

    const result = await Effect.runPromise(program);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("My Project");
  });

  it("should handle validation errors with Schema", async () => {
    const mockResponse = { invalid: "data" };
    const MockClient = HttpClient.make((req) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(
          req,
          new Response(JSON.stringify(mockResponse)),
        ),
      ),
    );

    const payark = new PayArk({ apiKey });
    const program = payark.effect.checkout
      .create({
        amount: 1000,
        provider: "esewa",
        returnUrl: "https://example.com/success",
      })
      .pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, MockClient)));

    const result = await Effect.runPromiseExit(program);
    expect(Exit.isFailure(result)).toBe(true);
  });
});
