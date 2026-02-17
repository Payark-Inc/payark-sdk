import { describe, it, expect } from "bun:test";
import { Effect, Layer, Exit, Cause, Option } from "effect";
import { HttpClient, HttpClientResponse } from "@effect/platform";
import { PayArkConfigService, request } from "../../src/effect/http";
import { PayArkEffectError } from "../../src/effect/errors";

describe("PayArk SDK - Effect Internal HTTP", () => {
  const apiKey = "sk_test_123";

  it("should make a request with correct URL and headers", async () => {
    let capturedRequest: any = null;
    const MockClient = HttpClient.make((req) => {
      capturedRequest = req;
      return Effect.succeed(
        HttpClientResponse.fromTypedJson({ success: true }, { status: 200 }),
      );
    });

    const program = request("POST", "/v1/test", { body: { foo: "bar" } }).pipe(
      Effect.provide(Layer.succeed(HttpClient.HttpClient, MockClient)),
      Effect.provideService(PayArkConfigService, {
        apiKey,
        baseUrl: "https://api.test.com",
      }),
    );

    const result = await Effect.runPromise(program);

    expect(result).toEqual({ success: true });
    expect(capturedRequest.url).toBe("https://api.test.com/v1/test");
    expect(capturedRequest.headers["authorization"]).toBe(`Bearer ${apiKey}`);
    expect(capturedRequest.method).toBe("POST");
  });

  it("should map 401 to authentication_error", async () => {
    const MockClient = HttpClient.make(() =>
      Effect.succeed(
        HttpClientResponse.fromTypedJson(
          { error: "Unauthorized" },
          { status: 401 },
        ),
      ),
    );

    const program = request("GET", "/v1/test").pipe(
      Effect.provide(Layer.succeed(HttpClient.HttpClient, MockClient)),
      Effect.provideService(PayArkConfigService, { apiKey }),
    );

    const result = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(result)).toBe(true);
    if (Exit.isFailure(result)) {
      const failure = Cause.failureOption(result.cause);
      if (Option.isSome(failure)) {
        const error: any = failure.value;
        expect(error._tag).toBe("PayArkEffectError");
        expect(error.statusCode).toBe(401);
        expect(error.code).toBe("authentication_error");
      }
    }
  });

  it("should map network failures to connection_error", async () => {
    const MockClient = HttpClient.make(() =>
      Effect.fail({
        _tag: "RequestError",
        reason: "Transport",
        message: "DNS failure",
      } as any),
    );

    const program = request("GET", "/v1/test").pipe(
      Effect.provide(Layer.succeed(HttpClient.HttpClient, MockClient)),
      Effect.provideService(PayArkConfigService, { apiKey }),
    );

    const result = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(result)).toBe(true);
    if (Exit.isFailure(result)) {
      const failure = Cause.failureOption(result.cause);
      if (Option.isSome(failure)) {
        const error: any = failure.value;
        expect(error.code).toBe("connection_error");
      }
    }
  });
});
